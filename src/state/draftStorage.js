import { supabase } from '../lib/supabaseClient';

export const DRAFT_SCHEMA_VERSION = 'v1';
export const MAX_DRAFT_STEP_INDEX = 5;
const LEGACY_DRAFT_VERSION = 1;
const legacyKeyFor = (userId) => `jm-financial-planner:draft:${userId}`;
const sessionDraftCache = new Map();

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const mergeDraft = (defaults, saved) => {
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
  if (!defaults || typeof defaults !== 'object') return saved === undefined ? defaults : saved;
  const source = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const merged = Object.fromEntries(Object.keys(defaults).map((key) => [key, mergeDraft(defaults[key], source[key])]));

  // 입력 방식 선택 전 저장된 초안은 상세 항목만 유효했다. 새 진단의 기본값이 총액 입력으로
  // 바뀌어도, 이 초안의 상세 값을 숨기거나 계산에서 제외하지 않도록 기존 방식을 명시한다.
  const savedAssets = source.assets;
  if (!isRecord(savedAssets) || !isRecord(merged.assets)) return merged;
  const restoreDetailedMode = (savedSection, mergedSection, key = 'inputMode') => {
    if (isRecord(savedSection) && !Object.hasOwn(savedSection, key)) mergedSection[key] = 'detailed';
  };
  restoreDetailedMode(savedAssets.liquidAssets, merged.assets.liquidAssets);
  restoreDetailedMode(savedAssets.financialAssets, merged.assets.financialAssets);
  restoreDetailedMode(savedAssets.realEstateAssets, merged.assets.realEstateAssets);
  restoreDetailedMode(savedAssets.otherAssets, merged.assets.otherAssets);
  restoreDetailedMode(savedAssets.savingsPlan, merged.assets.savingsPlan);
  restoreDetailedMode(savedAssets, merged.assets, 'pensionAssetsInputMode');
  return merged;
};

// 노후저축 입력 버전(v1/v2) 판정. mergeDraft로 initialFormData 기본값을 채워 넣은 "이후"의
// formData를 보고 판정하면, 저장된 v1 초안에도 initialFormData의 기본값(2)이 끼어들어 v1 초안이
// v2로 잘못 인식된다 - 그래서 병합 "전" 원본 저장 데이터(rawFormData)만 보고 판정해야 한다.
// - rawFormData가 없으면(=저장된 초안 없이 새로 시작) v2.
// - rawFormData는 있지만 버전 필드가 없으면(=이 기능 이전에 저장된 v1 초안) v1.
// - rawFormData에 버전 필드가 명시적으로 2면(=작성 중이던 v2 초안) v2.
export function resolveRetirementSavingsInputVersion(rawFormData) {
  const rawVersion = rawFormData?.assets?.savingsPlan?.retirementSavingsInputVersion;
  if (rawVersion === 2) return 2;
  return rawFormData ? 1 : 2;
}

export function validateDraft(draft) {
  if (!isRecord(draft)) return { valid: false, reason: '초안 데이터 형식이 올바르지 않습니다.' };
  if (draft.schema_version !== DRAFT_SCHEMA_VERSION) return { valid: false, reason: '현재 버전과 호환되지 않는 초안입니다.' };
  if (!Number.isInteger(draft.step_index) || draft.step_index < 0 || draft.step_index > MAX_DRAFT_STEP_INDEX) {
    return { valid: false, reason: '초안의 작성 단계가 올바르지 않습니다.' };
  }
  const formData = draft.form_data;
  if (!isRecord(formData) || !['basic', 'income', 'spouse', 'expense', 'assets'].every((key) => isRecord(formData[key]))) {
    return { valid: false, reason: '현재 입력 구조와 호환되지 않는 초안입니다.' };
  }
  return { valid: true, draft };
}

export async function fetchDraft(userId, client = supabase) {
  const { data, error } = await client.from('planner_drafts')
    .select('user_id, form_data, step_index, schema_version, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function fetchDraftOnce(userId, client = supabase) {
  if (!sessionDraftCache.has(userId)) {
    const request = fetchDraft(userId, client).catch((error) => {
      sessionDraftCache.delete(userId);
      throw error;
    });
    sessionDraftCache.set(userId, request);
  }
  return sessionDraftCache.get(userId);
}

export function clearDraftSessionCache(userId) {
  if (userId) sessionDraftCache.delete(userId);
}

export async function upsertDraft(userId, formData, stepIndex, client = supabase) {
  const { data, error } = await client.from('planner_drafts').upsert({
    user_id: userId,
    form_data: formData,
    step_index: stepIndex,
    schema_version: DRAFT_SCHEMA_VERSION,
  }, { onConflict: 'user_id' }).select('user_id, form_data, step_index, schema_version, updated_at').single();
  if (error) throw error;
  sessionDraftCache.set(userId, Promise.resolve(data));
  return data;
}

export async function deleteDraft(userId, client = supabase) {
  const { error } = await client.from('planner_drafts').delete().eq('user_id', userId);
  if (error) throw error;
  sessionDraftCache.set(userId, Promise.resolve(null));
}

export function readLegacyLocalDraft(userId, storage = window.localStorage) {
  if (!userId) return null;
  try {
    const raw = storage.getItem(legacyKeyFor(userId));
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== LEGACY_DRAFT_VERSION || !isRecord(parsed.formData)) {
      return { user_id: userId, form_data: null, step_index: -1, schema_version: 'legacy-incompatible', updated_at: null };
    }
    return { user_id: userId, form_data: parsed.formData, step_index: parsed.stepIndex, schema_version: DRAFT_SCHEMA_VERSION, updated_at: parsed.updatedAt };
  } catch {
    return { user_id: userId, form_data: null, step_index: -1, schema_version: 'legacy-incompatible', updated_at: null };
  }
}

export function removeLegacyLocalDraft(userId, storage = window.localStorage) {
  try {
    if (userId) storage.removeItem(legacyKeyFor(userId));
  } catch {
    // 저장소가 차단돼도 인증 및 서버 초안 흐름은 계속 진행한다.
  }
}

export async function migrateLegacyDraft(userId, legacyDraft, client = supabase, storage = window.localStorage) {
  const validation = validateDraft(legacyDraft);
  if (!validation.valid) throw new Error(validation.reason);
  const saved = await upsertDraft(userId, legacyDraft.form_data, legacyDraft.step_index, client);
  removeLegacyLocalDraft(userId, storage);
  return saved;
}

export function createLatestDraftSaver({ persist, onSaved, onError }) {
  let queued = null;
  let inFlight = null;
  const drain = async () => {
    while (queued) {
      const snapshot = queued;
      queued = null;
      try {
        const saved = await persist(snapshot);
        onSaved(snapshot, saved, Boolean(queued));
      } catch (error) {
        queued = null;
        onError(error);
        throw error;
      }
    }
  };
  return {
    save(snapshot) {
      queued = snapshot;
      if (!inFlight) inFlight = drain().finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
