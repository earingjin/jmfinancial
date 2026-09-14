import { describe, expect, it, vi } from 'vitest';
import { deletePlannerUserData } from './accountData.js';

describe('deletePlannerUserData', () => {
  it('uses the transactional RPC with the exact target and profile mode', async () => {
    const admin = { rpc: vi.fn().mockResolvedValue({ error: null }) };

    await deletePlannerUserData(admin, 'user-a', { deleteProfile: false });
    await deletePlannerUserData(admin, 'user-b', { deleteProfile: true });

    expect(admin.rpc).toHaveBeenNthCalledWith(1, 'delete_planner_user_data', { p_user_id: 'user-a', p_delete_profile: false });
    expect(admin.rpc).toHaveBeenNthCalledWith(2, 'delete_planner_user_data', { p_user_id: 'user-b', p_delete_profile: true });
  });

  it('fails closed when the transaction RPC fails', async () => {
    const admin = { rpc: vi.fn().mockResolvedValue({ error: new Error('failed') }) };
    await expect(deletePlannerUserData(admin, 'user-a')).rejects.toThrow('사용자 연결 데이터를 정리하지 못했습니다.');
  });
});
