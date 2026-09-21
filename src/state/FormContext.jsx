import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { initialFormData } from './initialFormData';
import { setIn } from './pathUtils';
import { FormContext } from './formState';
import { createLatestDraftSaver, mergeDraft, resolveRetirementSavingsInputVersion, upsertDraft } from './draftStorage';

const AUTO_SAVE_DELAY_MS = 500;
const snapshotOf = (formData, stepIndex, screenId) => JSON.stringify({ formData, stepIndex, screenId });

// Repeatable financial item names are display labels, not calculation inputs.
// Keep their stored form consistent regardless of which field component edits them.
const NAMED_LIST_PATHS = [
  'income.regularIncomes', 'income.otherIncomes', 'expense.debts', 'expense.otherExpenses',
  'expense.healthInsurance.items', 'assets.liquidAssets.customItems', 'assets.currentLivingCost.breakdown.otherItems',
  'assets.financialAssets.otherItems', 'assets.pensionAssetsBreakdown.otherItems', 'assets.realEstateAssets.otherItems',
  'assets.otherAssets.items', 'assets.savingsPlan.customItems', 'assets.debtStatus.customItems',
  'expense.retirementLumpSumExpenses',
];

function trimRepeatableItemNames(data) {
  return NAMED_LIST_PATHS.reduce((next, path) => {
    const list = path.split('.').reduce((value, key) => value?.[key], next);
    if (!Array.isArray(list) || !list.some((item) => typeof item?.name === 'string' && item.name !== item.name.trim())) return next;
    return setIn(next, path, list.map((item) => (
      typeof item?.name === 'string' ? { ...item, name: item.name.trim() } : item
    )));
  }, data);
}

export function FormProvider({ children, userId, initialDraft, draftControllerRef }) {
  const [formData, setFormData] = useState(() => {
    // 버전은 반드시 병합 "전" 원본 저장 데이터(initialDraft?.form_data)로만 판정한다 - mergeDraft
    // 이후의 formData를 보고 판정하면 initialFormData의 기본값이 끼어들어 v1 초안이 v2로
    // 오판될 수 있다(draftStorage.js의 resolveRetirementSavingsInputVersion 참고).
    const retirementSavingsInputVersion = resolveRetirementSavingsInputVersion(initialDraft?.form_data);
    const merged = mergeDraft(initialFormData, initialDraft?.form_data);
    return setIn(merged, 'assets.savingsPlan.retirementSavingsInputVersion', retirementSavingsInputVersion);
  });
  const [draftState, setDraftState] = useState(() => ({
    // A14: "저장됨" 배지는 실제로 저장된 시각(updated_at)이 있을 때만 표시한다. initialDraft가
    // 객체로 존재한다는 사실만으로 'saved'를 판정하면, editHistoryResult(App.jsx)처럼 저장된
    // 결과(planner_results)를 위저드에 불러오면서 draft로서는 아직 한 번도 저장된 적이
    // 없는(updated_at: null) 경우에도 배지는 "저장됨"인데 문구는 "아직 저장되지 않았습니다"로
    // 보이는 모순이 생긴다.
    status: initialDraft?.updated_at ? 'saved' : 'idle',
    updatedAt: initialDraft?.updated_at || null,
    error: null,
    dirty: false,
  }));
  const formDataRef = useRef(formData);
  const stepIndexRef = useRef(initialDraft?.step_index || 0);
  const screenIdRef = useRef(initialDraft?.screen_id ?? null);
  const lastSavedSnapshotRef = useRef(initialDraft?.updated_at
    ? snapshotOf(formData, stepIndexRef.current, screenIdRef.current)
    : null);
  const autoSaveTimerRef = useRef(null);
  const dirtyRef = useRef(false);
  const persistedRef = useRef(Boolean(initialDraft?.updated_at));
  const stoppedRef = useRef(false);
  const navigationGuardsRef = useRef(new Set());
  const saverRef = useRef(null);
  if (!saverRef.current) {
    saverRef.current = createLatestDraftSaver({
      persist: (snapshot) => upsertDraft(userId, snapshot.formData, snapshot.stepIndex, snapshot.screenId),
      onSaved: (snapshot, saved, hasQueued) => {
        persistedRef.current = true;
        lastSavedSnapshotRef.current = snapshot.serialized;
        const currentSerialized = snapshotOf(formDataRef.current, stepIndexRef.current, screenIdRef.current);
        dirtyRef.current = currentSerialized !== snapshot.serialized;
        setDraftState({
          status: hasQueued ? 'saving' : currentSerialized === snapshot.serialized ? 'saved' : 'idle',
          updatedAt: saved.updated_at,
          error: null,
          dirty: dirtyRef.current,
        });
      },
      onError: () => setDraftState((state) => ({ ...state, status: 'error', error: '임시 저장에 실패했습니다.', dirty: true })),
    });
  }

  const changeFormData = useCallback((updater) => {
    setFormData((previous) => {
      const next = trimRepeatableItemNames(typeof updater === 'function' ? updater(previous) : updater);
      formDataRef.current = next;
      dirtyRef.current = true;
      setDraftState((state) => ({ ...state, status: state.status === 'saving' ? state.status : 'idle', error: null, dirty: true }));
      return next;
    });
  }, []);

  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current != null) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  const saveCurrentDraft = useCallback(async (stepIndex = stepIndexRef.current, screenId = screenIdRef.current) => {
    clearAutoSaveTimer();
    if (stoppedRef.current) return { skipped: true, stopped: true };
    stepIndexRef.current = stepIndex;
    screenIdRef.current = screenId ?? null;
    const requested = {
      formData: formDataRef.current,
      stepIndex,
      screenId: screenIdRef.current,
      serialized: snapshotOf(formDataRef.current, stepIndex, screenIdRef.current),
    };
    if (requested.serialized === lastSavedSnapshotRef.current) {
      dirtyRef.current = false;
      setDraftState((state) => ({ ...state, status: 'saved', error: null, dirty: false }));
      return { skipped: true };
    }
    setDraftState((state) => ({ ...state, status: 'saving', error: null }));
    await saverRef.current.save(requested);
    return { skipped: false };
  }, [clearAutoSaveTimer]);

  const scheduleAutoSave = useCallback(() => {
    clearAutoSaveTimer();
    if (stoppedRef.current) return;
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      void saveCurrentDraft().catch(() => {});
    }, AUTO_SAVE_DELAY_MS);
  }, [clearAutoSaveTimer, saveCurrentDraft]);

  useEffect(() => {
    if (dirtyRef.current) scheduleAutoSave();
  }, [formData, scheduleAutoSave]);

  const setDraftPosition = useCallback((stepIndex, screenId) => {
    const nextScreenId = screenId ?? null;
    if (stepIndexRef.current !== stepIndex || screenIdRef.current !== nextScreenId) {
      stepIndexRef.current = stepIndex;
      screenIdRef.current = nextScreenId;
      dirtyRef.current = true;
      setDraftState((state) => ({ ...state, status: state.status === 'saving' ? state.status : 'idle', dirty: true }));
    }
  }, []);

  const setDraftStep = useCallback((stepIndex) => {
    setDraftPosition(stepIndex, screenIdRef.current);
  }, [setDraftPosition]);

  const shutdownDraftSaving = useCallback(async () => {
    clearAutoSaveTimer();
    stoppedRef.current = true;
    await saverRef.current.stop();
  }, [clearAutoSaveTimer]);

  const resumeDraftSaving = useCallback(() => {
    stoppedRef.current = false;
    saverRef.current.resume();
    if (dirtyRef.current) scheduleAutoSave();
  }, [scheduleAutoSave]);

  const hasWorkingDraft = useCallback(() => persistedRef.current || dirtyRef.current, []);

  const markDraftDeleted = useCallback(() => {
    clearAutoSaveTimer();
    persistedRef.current = false;
    dirtyRef.current = false;
    lastSavedSnapshotRef.current = null;
    setDraftState({ status: 'idle', updatedAt: null, error: null, dirty: false });
  }, [clearAutoSaveTimer]);

  useEffect(() => {
    if (!draftControllerRef) return undefined;
    const controller = {
      saveCurrentDraft,
      shutdownDraftSaving,
      resumeDraftSaving,
      hasWorkingDraft,
      markDraftDeleted,
    };
    draftControllerRef.current = controller;
    return () => {
      clearAutoSaveTimer();
      if (draftControllerRef.current === controller) draftControllerRef.current = null;
    };
  }, [clearAutoSaveTimer, draftControllerRef, hasWorkingDraft, markDraftDeleted, resumeDraftSaving, saveCurrentDraft, shutdownDraftSaving]);

  // path 예: "income.salary.monthly"
  const setField = useCallback((path, value) => {
    changeFormData((prev) => setIn(prev, path, value));
  }, [changeFormData]);

  const addListItem = useCallback((path, item) => {
    changeFormData((prev) => {
      const list = path.split('.').reduce((acc, k) => acc[k], prev) || [];
      return setIn(prev, path, [...list, item]);
    });
  }, [changeFormData]);

  const removeListItem = useCallback((path, index) => {
    changeFormData((prev) => {
      const list = path.split('.').reduce((acc, k) => acc[k], prev) || [];
      return setIn(prev, path, list.filter((_, i) => i !== index));
    });
  }, [changeFormData]);

  const registerNavigationGuard = useCallback((guard) => {
    navigationGuardsRef.current.add(guard);
    return () => navigationGuardsRef.current.delete(guard);
  }, []);

  const runNavigationGuards = useCallback(() => {
    for (const guard of navigationGuardsRef.current) {
      if (guard() === false) return false;
    }
    return true;
  }, []);

  const updateListItem = useCallback((path, index, key, value) => {
    changeFormData((prev) => {
      const list = path.split('.').reduce((acc, k) => acc[k], prev) || [];
      const updated = list.map((item, i) => (i === index ? { ...item, [key]: value } : item));
      return setIn(prev, path, updated);
    });
  }, [changeFormData]);

  const value = useMemo(
    () => ({
      formData, setField, addListItem, removeListItem, updateListItem, setFormData: changeFormData,
      draftState, saveCurrentDraft, setDraftStep, setDraftPosition, registerNavigationGuard, runNavigationGuards,
    }),
    [
      formData, setField, addListItem, removeListItem, updateListItem, changeFormData, draftState,
      saveCurrentDraft, setDraftStep, setDraftPosition, registerNavigationGuard, runNavigationGuards,
    ]
  );

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}
