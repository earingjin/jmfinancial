import { describe, expect, it, vi } from 'vitest';
import { clearDraftSessionCache, createLatestDraftSaver, deleteDraft, DRAFT_SCHEMA_VERSION, fetchDraft, fetchDraftOnce, migrateLegacyDraft, readLegacyLocalDraft, upsertDraft, validateDraft } from './draftStorage.js';

const compatibleFormData = () => ({ basic: {}, income: {}, spouse: {}, expense: {}, assets: {} });

function storageWith(value) {
  const values = new Map(value ? [['jm-financial-planner:draft:user-1', JSON.stringify(value)]] : []);
  return { getItem: (key) => values.get(key) ?? null, removeItem: vi.fn((key) => values.delete(key)) };
}

describe('Supabase planner drafts', () => {
  it('saves one user-owned row with an upsert and the current schema version', async () => {
    const single = vi.fn().mockResolvedValue({ data: { updated_at: '2026-08-19T00:00:00Z' }, error: null });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const client = { from: vi.fn(() => ({ upsert })) };
    await upsertDraft('user-1', compatibleFormData(), 2, client);
    expect(client.from).toHaveBeenCalledWith('planner_drafts');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', step_index: 2, schema_version: DRAFT_SCHEMA_VERSION }), { onConflict: 'user_id' });
  });

  it('queries and deletes only the requested user id', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const fetchEq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: fetchEq }));
    await fetchDraft('user-a', { from: () => ({ select }) });
    expect(fetchEq).toHaveBeenCalledWith('user_id', 'user-a');

    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn(() => ({ eq: deleteEq }));
    await deleteDraft('user-b', { from: () => ({ delete: remove }) });
    expect(deleteEq).toHaveBeenCalledWith('user_id', 'user-b');
  });

  it('loads a user draft only once during a login session', async () => {
    clearDraftSessionCache('cached-user');
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })) };
    await Promise.all([fetchDraftOnce('cached-user', client), fetchDraftOnce('cached-user', client)]);
    expect(client.from).toHaveBeenCalledOnce();
    clearDraftSessionCache('cached-user');
  });

  it('rejects incompatible schemas, steps, and form structures without throwing', () => {
    expect(validateDraft({ schema_version: 'old', step_index: 0, form_data: compatibleFormData() }).valid).toBe(false);
    expect(validateDraft({ schema_version: DRAFT_SCHEMA_VERSION, step_index: 6, form_data: compatibleFormData() }).valid).toBe(false);
    expect(validateDraft({ schema_version: DRAFT_SCHEMA_VERSION, step_index: 0, form_data: { basic: {} } }).valid).toBe(false);
  });

  it('migrates a compatible legacy draft once and deletes local financial data only after success', async () => {
    const legacy = { version: 1, formData: compatibleFormData(), stepIndex: 3, updatedAt: '2026-08-19T00:00:00Z' };
    const storage = storageWith(legacy);
    const parsed = readLegacyLocalDraft('user-1', storage);
    const single = vi.fn().mockResolvedValue({ data: { ...parsed, updated_at: '2026-08-19T01:00:00Z' }, error: null });
    const client = { from: () => ({ upsert: () => ({ select: () => ({ single }) }) }) };
    await migrateLegacyDraft('user-1', parsed, client, storage);
    expect(storage.removeItem).toHaveBeenCalledOnce();
  });

  it('marks malformed legacy data as incompatible so it can be deleted instead of uploaded', () => {
    const storage = storageWith({ version: 0, formData: { secret: 'legacy' } });
    const legacy = readLegacyLocalDraft('user-1', storage);
    expect(validateDraft(legacy).valid).toBe(false);
  });

  it('keeps the latest queued snapshot when an older save finishes later', async () => {
    const resolvers = [];
    const persisted = [];
    const saver = createLatestDraftSaver({
      persist: (snapshot) => new Promise((resolve) => resolvers.push(() => { persisted.push(snapshot.stepIndex); resolve({ updated_at: String(snapshot.stepIndex) }); })),
      onSaved: vi.fn(),
      onError: vi.fn(),
    });
    const first = saver.save({ stepIndex: 1 });
    saver.save({ stepIndex: 2 });
    resolvers.shift()();
    await Promise.resolve();
    resolvers.shift()();
    await first;
    expect(persisted).toEqual([1, 2]);
  });

  it('surfaces save failures without mutating the submitted form data', async () => {
    const formData = compatibleFormData();
    const original = structuredClone(formData);
    const client = { from: () => ({ upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error('offline') }) }) }) }) };
    await expect(upsertDraft('user-1', formData, 0, client)).rejects.toThrow('offline');
    expect(formData).toEqual(original);
  });
});
