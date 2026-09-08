import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearResetAttemptsForTests,
  consumeResetAttempt,
  createResetAccountHandler,
  performAccountReset,
  validateResetAccountInput,
} from './reset-account.js';

function createAdmin({ profile = { id: 'user-1', role: 'user' }, user = { id: 'user-1', email: '12345678@jmfinancial.local' }, events = [] } = {}) {
  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(profileQuery),
    rpc: vi.fn().mockImplementation(async () => { events.push('delete-data'); return { error: null }; }),
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user }, error: null }),
        updateUserById: vi.fn().mockImplementation(async () => { events.push('update-password'); return { error: null }; }),
        signOut: vi.fn().mockImplementation(async () => { events.push('revoke-sessions'); return { error: null }; }),
        deleteUser: vi.fn(),
      },
    },
    profileQuery,
  };
}

function createPasswordClient(events = []) {
  return {
    auth: {
      signInWithPassword: vi.fn().mockImplementation(async () => {
        events.push('create-revocation-session');
        return { data: { session: { access_token: 'server-only-token' } }, error: null };
      }),
    },
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const jsonHeaders = { 'content-type': 'application/json' };

describe('reset account input and rate limiting', () => {
  beforeEach(() => clearResetAttemptsForTests());

  it('rejects malformed id, invalid password, mismatch, and oversized bodies before deletion', () => {
    expect(validateResetAccountInput({ loginId: '1234', password: 'abcdef', passwordConfirm: 'abcdef' }).ok).toBe(false);
    expect(validateResetAccountInput({ loginId: '12345678', password: '12345', passwordConfirm: '12345' }).ok).toBe(false);
    expect(validateResetAccountInput({ loginId: '12345678', password: 'abcdef', passwordConfirm: 'abcdeg' }).ok).toBe(false);
    expect(validateResetAccountInput(`{"loginId":"12345678","password":"${'a'.repeat(2100)}","passwordConfirm":"x"}`).ok).toBe(false);
  });

  it('limits repeated attempts per id and across ids from one ip', () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.10' } };
    for (let index = 0; index < 5; index += 1) expect(consumeResetAttempt(req, '12345678', 1_000)).toBe(true);
    expect(consumeResetAttempt(req, '12345678', 1_000)).toBe(false);
    expect(consumeResetAttempt(req, '87654321', 1_000)).toBe(true);

    clearResetAttemptsForTests();
    for (let index = 0; index < 20; index += 1) {
      expect(consumeResetAttempt(req, String(10_000_000 + index), 1_000)).toBe(true);
    }
    expect(consumeResetAttempt(req, '99999999', 1_000)).toBe(false);
  });
});

describe('performAccountReset', () => {
  it('deletes only the target data before changing the password and globally revoking sessions', async () => {
    const events = [];
    const admin = createAdmin({ events });
    const passwordClient = createPasswordClient(events);

    await performAccountReset({ admin, passwordClient, loginId: '12345678', password: 'new-password' });

    expect(admin.profileQuery.eq).toHaveBeenCalledWith('email', '12345678@jmfinancial.local');
    expect(admin.rpc).toHaveBeenCalledWith('delete_planner_user_data', { p_user_id: 'user-1', p_delete_profile: false });
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', {
      password: 'new-password',
      user_metadata: { login_id: '12345678', name: null },
    });
    expect(passwordClient.auth.signInWithPassword).toHaveBeenCalledWith({ email: '12345678@jmfinancial.local', password: 'new-password' });
    expect(admin.auth.admin.signOut).toHaveBeenCalledWith('server-only-token', 'global');
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(events).toEqual(['delete-data', 'update-password', 'create-revocation-session', 'revoke-sessions']);
  });

  it('does not touch another user and does not reset administrators', async () => {
    const admin = createAdmin({ profile: { id: 'target-user', role: 'user' }, user: { id: 'target-user', email: '12345678@jmfinancial.local' } });
    await performAccountReset({ admin, passwordClient: createPasswordClient(), loginId: '12345678', password: 'new-password' });
    expect(admin.rpc).toHaveBeenCalledWith('delete_planner_user_data', { p_user_id: 'target-user', p_delete_profile: false });

    const adminAccount = createAdmin({ profile: { id: 'admin-user', role: 'admin' } });
    await performAccountReset({ admin: adminAccount, passwordClient: createPasswordClient(), loginId: '12345678', password: 'new-password' });
    expect(adminAccount.rpc).not.toHaveBeenCalled();
    expect(adminAccount.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('is idempotent at the data boundary and never changes a password when deletion fails', async () => {
    const admin = createAdmin();
    admin.rpc.mockResolvedValue({ error: new Error('db unavailable') });

    await expect(performAccountReset({ admin, passwordClient: createPasswordClient(), loginId: '12345678', password: 'new-password' })).rejects.toThrow();
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});

describe('reset account HTTP handler', () => {
  it('blocks invalid input without invoking reset work', async () => {
    const resetAccount = vi.fn();
    const handler = createResetAccountHandler({ getClients: () => ({}), resetAccount, consumeAttempt: () => true, minimumResponseMs: 0 });
    const res = responseRecorder();
    await handler({ method: 'POST', body: { loginId: 'bad', password: 'abcdef', passwordConfirm: 'abcdef' }, headers: jsonHeaders }, res);

    expect(res.statusCode).toBe(400);
    expect(resetAccount).not.toHaveBeenCalled();
  });

  it('uses the same data-free success response when reset work exposes no account existence', async () => {
    const handler = createResetAccountHandler({ getClients: () => ({}), resetAccount: vi.fn().mockResolvedValue(undefined), consumeAttempt: () => true, minimumResponseMs: 0 });
    const res = responseRecorder();
    await handler({ method: 'POST', body: { loginId: '12345678', password: 'abcdef', passwordConfirm: 'abcdef' }, headers: jsonHeaders }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ reset: true });
    expect(JSON.stringify(res.body)).not.toMatch(/user|name|asset|income|debt|pension|report|result/i);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('never returns success when server reset work fails', async () => {
    const handler = createResetAccountHandler({ getClients: () => ({}), resetAccount: vi.fn().mockRejectedValue(new Error('failure')), consumeAttempt: () => true, minimumResponseMs: 0 });
    const res = responseRecorder();
    await handler({ method: 'POST', body: { loginId: '12345678', password: 'abcdef', passwordConfirm: 'abcdef' }, headers: jsonHeaders }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: '계정 초기화 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  });

  it('rejects cross-site or non-JSON requests before reset work', async () => {
    const resetAccount = vi.fn();
    const handler = createResetAccountHandler({ getClients: () => ({}), resetAccount, consumeAttempt: () => true, minimumResponseMs: 0 });
    const crossSite = responseRecorder();
    const nonJson = responseRecorder();

    await handler({ method: 'POST', body: {}, headers: { ...jsonHeaders, 'sec-fetch-site': 'cross-site', origin: 'https://attacker.example', host: 'planner.example' } }, crossSite);
    await handler({ method: 'POST', body: '{}', headers: { 'content-type': 'text/plain' } }, nonJson);

    expect(crossSite.statusCode).toBe(403);
    expect(nonJson.statusCode).toBe(403);
    expect(resetAccount).not.toHaveBeenCalled();
  });
});
