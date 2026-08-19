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
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, mergeDraft(defaults[key], source[key])]));
};

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
