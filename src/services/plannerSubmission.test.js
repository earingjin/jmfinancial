import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));

import { buildPlannerResultRow, completePlannerSubmission, savePlannerResult } from './plannerSubmission.js';

const pending = () => ({ formData: { basic: {} }, data: { score: 1 }, resultSaved: false, submissionId: 'submission-1' });
const user = { id: 'user-1' };

describe('planner submission ordering', () => {
  it('deletes the draft only after the result is saved', async () => {
    const calls = [];
    const item = pending();
    await completePlannerSubmission(item, user, {
      saveResult: async () => calls.push('result'),
      deleteDraft: async () => calls.push('draft'),
    });
    expect(calls).toEqual(['result', 'draft']);
    expect(item.resultSaved).toBe(true);
  });

  it('preserves the draft when result saving fails', async () => {
    const remove = vi.fn();
    await expect(completePlannerSubmission(pending(), user, {
      saveResult: async () => { throw new Error('save failed'); },
      deleteDraft: remove,
    })).rejects.toThrow('save failed');
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not insert the same result again when retrying draft deletion', async () => {
    const item = pending();
    const save = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockRejectedValueOnce(new Error('delete failed')).mockResolvedValueOnce(undefined);
    await expect(completePlannerSubmission(item, user, { saveResult: save, deleteDraft: remove })).rejects.toThrow('delete failed');
    await completePlannerSubmission(item, user, { saveResult: save, deleteDraft: remove });
    expect(save).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('stores the idempotency marker in both the dedicated column and legacy assumptions JSON', () => {
    expect(buildPlannerResultRow(user, {}, {}, 'submission-1')).toEqual(expect.objectContaining({
      user_id: 'user-1',
      submission_id: 'submission-1',
      assumptions_json: expect.objectContaining({ submissionId: 'submission-1' }),
    }));
  });

  it('returns the existing row after a database uniqueness conflict', async () => {
    const insertSingle = vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'existing' }, error: null });
    const query = {
      insert: vi.fn(() => ({ select: () => ({ single: insertSingle }) })),
      select: vi.fn(() => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) })),
    };
    await expect(savePlannerResult(user, {}, {}, 'submission-1', { from: () => query })).resolves.toEqual({ id: 'existing' });
    expect(insertSingle).toHaveBeenCalledOnce();
  });

  it('allows only one row for concurrent requests from the same user and submission id', async () => {
    const rows = new Map();
    const client = {
      from: () => ({
        insert: (row) => ({
          select: () => ({
            single: async () => {
              await Promise.resolve();
              const key = `${row.user_id}:${row.submission_id}`;
              if (rows.has(key)) return { data: null, error: { code: '23505' } };
              const saved = { id: `result-${rows.size + 1}` };
              rows.set(key, saved);
              return { data: saved, error: null };
            },
          }),
        }),
        select: () => {
          let userId;
          return {
            eq: (_column, value) => {
              userId = value;
              return {
                eq: (_nextColumn, submissionId) => ({
                  maybeSingle: async () => ({ data: rows.get(`${userId}:${submissionId}`) || null, error: null }),
                }),
              };
            },
          };
        },
      }),
    };

    const saved = await Promise.all([
      savePlannerResult(user, {}, {}, 'submission-1', client),
      savePlannerResult(user, {}, {}, 'submission-1', client),
    ]);
    expect(rows).toHaveLength(1);
    expect(saved[0].id).toBe(saved[1].id);
  });

  it('allows different users to reuse the same submission id', async () => {
    const first = buildPlannerResultRow({ id: 'user-1' }, {}, {}, 'shared-id');
    const second = buildPlannerResultRow({ id: 'user-2' }, {}, {}, 'shared-id');
    const resultKeys = new Set([
      `${first.user_id}:${first.submission_id}`,
      `${second.user_id}:${second.submission_id}`,
    ]);

    expect(resultKeys.size).toBe(2);
  });
});
