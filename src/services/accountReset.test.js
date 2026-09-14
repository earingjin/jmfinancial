import { describe, expect, it, vi } from 'vitest';
import { requestAccountReset, validateResetPassword } from './accountReset.js';

describe('account reset client service', () => {
  it('rejects an invalid id, short password, and mismatched confirmation before any request', async () => {
    const fetchImpl = vi.fn();

    expect((await requestAccountReset({ loginId: '123', password: 'abcdef', passwordConfirm: 'abcdef' }, fetchImpl)).ok).toBe(false);
    expect((await requestAccountReset({ loginId: '12345678', password: '12345', passwordConfirm: '12345' }, fetchImpl)).ok).toBe(false);
    expect(validateResetPassword('abcdef', 'abcdeg')).toContain('일치하지 않습니다');
    expect((await requestAccountReset({ loginId: '12345678', password: 'abcdef', passwordConfirm: 'abcdeg' }, fetchImpl)).ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns success only for a successful server response and sends no old-account query', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reset: true }) });
    const result = await requestAccountReset({ loginId: '12345678', password: 'abcdef', passwordConfirm: 'abcdef' }, fetchImpl);

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith('/api/reset-account', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ loginId: '12345678', password: 'abcdef', passwordConfirm: 'abcdef' });
  });

  it('does not report success for server or network errors', async () => {
    const serverFailure = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'generic failure' }) });
    const networkFailure = vi.fn().mockRejectedValue(new Error('offline'));

    expect(await requestAccountReset({ loginId: '12345678', password: 'abcdef', passwordConfirm: 'abcdef' }, serverFailure)).toEqual({ ok: false, error: 'generic failure' });
    expect((await requestAccountReset({ loginId: '12345678', password: 'abcdef', passwordConfirm: 'abcdef' }, networkFailure)).ok).toBe(false);
  });
});
