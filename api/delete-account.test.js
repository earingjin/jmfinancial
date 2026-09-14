import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  deletePlannerUserData: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: { admin: { deleteUser: mocks.deleteUser } } })),
}));
vi.mock('./_lib/auth.js', () => ({ requireUser: mocks.requireUser }));
vi.mock('./_lib/accountData.js', () => ({ deletePlannerUserData: mocks.deletePlannerUserData }));

const { default: handler } = await import('./delete-account.js');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('delete-account API regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-key';
    mocks.requireUser.mockResolvedValue({ ok: true, user: { id: 'user-1' } });
    mocks.deletePlannerUserData.mockResolvedValue(undefined);
    mocks.deleteUser.mockResolvedValue({ error: null });
  });

  it('deletes transactional linked data before deleting the auth user', async () => {
    const events = [];
    mocks.deletePlannerUserData.mockImplementation(async () => { events.push('linked-data'); });
    mocks.deleteUser.mockImplementation(async () => { events.push('auth-user'); return { error: null }; });
    const res = responseRecorder();

    await handler({ method: 'POST', headers: {} }, res);

    expect(events).toEqual(['linked-data', 'auth-user']);
    expect(mocks.deletePlannerUserData).toHaveBeenCalledWith(expect.anything(), 'user-1', { deleteProfile: true });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ deleted: true });
  });

  it('does not delete the auth user when linked-data deletion fails', async () => {
    mocks.deletePlannerUserData.mockRejectedValue(new Error('failed'));
    const res = responseRecorder();

    await handler({ method: 'POST', headers: {} }, res);

    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
  });
});
