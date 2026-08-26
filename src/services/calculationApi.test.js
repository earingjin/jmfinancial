import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({ supabase: { auth: {} } }));

const { requestCalculation } = await import('./calculationApi.js');

describe('requestCalculation', () => {
  it('uses the current session token for the calculation request', async () => {
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'current-token' } } }),
      refreshSession: vi.fn(),
    };
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200 });

    const response = await requestCalculation({ sample: true }, { auth, fetchImpl });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer current-token');
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes the session and retries once after a 401 response', async () => {
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'stale-token' } } }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'fresh-token' } }, error: null }),
    };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ status: 401 })
      .mockResolvedValueOnce({ status: 200 });

    const response = await requestCalculation({ sample: true }, { auth, fetchImpl });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh-token');
  });

  it('returns the 401 response without signing out when refresh is unavailable', async () => {
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'stale-token' } } }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: new Error('refresh failed') }),
    };
    const unauthorized = { status: 401 };
    const fetchImpl = vi.fn().mockResolvedValue(unauthorized);

    await expect(requestCalculation({ sample: true }, { auth, fetchImpl })).resolves.toBe(unauthorized);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
