import { useMemo, useRef, useState, useCallback } from 'react';
import { initialFormData } from './initialFormData';
import { setIn } from './pathUtils';
import { FormContext } from './formState';
import { createLatestDraftSaver, mergeDraft, upsertDraft } from './draftStorage';

const snapshotOf = (formData, stepIndex) => JSON.stringify({ formData, stepIndex });

export function FormProvider({ children, userId, initialDraft }) {
  const [formData, setFormData] = useState(() => mergeDraft(initialFormData, initialDraft?.form_data));
  const [draftState, setDraftState] = useState(() => ({
    status: initialDraft ? 'saved' : 'idle',
    updatedAt: initialDraft?.updated_at || null,
    error: null,
    dirty: false,
  }));
  const formDataRef = useRef(formData);
  const stepIndexRef = useRef(initialDraft?.step_index || 0);
  const lastSavedSnapshotRef = useRef(initialDraft ? snapshotOf(formData, stepIndexRef.current) : null);
  const saverRef = useRef(null);
  if (!saverRef.current) {
    saverRef.current = createLatestDraftSaver({
      persist: (snapshot) => upsertDraft(userId, snapshot.formData, snapshot.stepIndex),
      onSaved: (snapshot, saved, hasQueued) => {
        lastSavedSnapshotRef.current = snapshot.serialized;
        const currentSerialized = snapshotOf(formDataRef.current, stepIndexRef.current);
        setDraftState({
          status: hasQueued ? 'saving' : currentSerialized === snapshot.serialized ? 'saved' : 'idle',
          updatedAt: saved.updated_at,
          error: null,
          dirty: currentSerialized !== snapshot.serialized,
        });
      },
      onError: () => setDraftState((state) => ({ ...state, status: 'error', error: '임시 저장에 실패했습니다.', dirty: true })),
    });
  }

  const changeFormData = useCallback((updater) => {
    setFormData((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      formDataRef.current = next;
      setDraftState((state) => ({ ...state, status: state.status === 'saving' ? state.status : 'idle', error: null, dirty: true }));
      return next;
    });
  }, []);

  const saveCurrentDraft = useCallback(async (stepIndex = stepIndexRef.current) => {
    stepIndexRef.current = stepIndex;
    const requested = {
      formData: formDataRef.current,
      stepIndex,
      serialized: snapshotOf(formDataRef.current, stepIndex),
    };
    if (requested.serialized === lastSavedSnapshotRef.current) {
      setDraftState((state) => ({ ...state, status: 'saved', error: null, dirty: false }));
      return { skipped: true };
    }
    setDraftState((state) => ({ ...state, status: 'saving', error: null }));
    await saverRef.current.save(requested);
    return { skipped: false };
  }, []);

  const setDraftStep = useCallback((stepIndex) => {
    if (stepIndexRef.current !== stepIndex) {
      stepIndexRef.current = stepIndex;
      setDraftState((state) => ({ ...state, status: state.status === 'saving' ? state.status : 'idle', dirty: true }));
    }
  }, []);

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

  const updateListItem = useCallback((path, index, key, value) => {
    changeFormData((prev) => {
      const list = path.split('.').reduce((acc, k) => acc[k], prev) || [];
      const updated = list.map((item, i) => (i === index ? { ...item, [key]: value } : item));
      return setIn(prev, path, updated);
    });
  }, [changeFormData]);

  const value = useMemo(
    () => ({ formData, setField, addListItem, removeListItem, updateListItem, setFormData: changeFormData, draftState, saveCurrentDraft, setDraftStep }),
    [formData, setField, addListItem, removeListItem, updateListItem, changeFormData, draftState, saveCurrentDraft, setDraftStep]
  );

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}
