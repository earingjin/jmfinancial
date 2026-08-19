import { describe, expect, it, vi } from 'vitest';
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

  it('stores an idempotency marker without changing the planner_results columns', () => {
    expect(buildPlannerResultRow(user, {}, {}, 'submission-1')).toEqual(expect.objectContaining({
      user_id: 'user-1',
      assumptions_json: expect.objectContaining({ submissionId: 'submission-1' }),
    }));
  });

  it('skips insertion when a retry finds the same submission marker', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'existing' }, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const contains = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ contains }));
    const select = vi.fn(() => ({ eq }));
    const insert = vi.fn();
    const client = { from: vi.fn(() => ({ select, insert })) };
    await expect(savePlannerResult(user, {}, {}, 'submission-1', client)).resolves.toEqual({ id: 'existing' });
    expect(insert).not.toHaveBeenCalled();
  });
});
