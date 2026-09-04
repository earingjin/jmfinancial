import { describe, expect, it, vi } from 'vitest';

import { deletePlannerResult, restoreRowAfterFailedDelete } from './HistoryList.jsx';

// A6 회귀 테스트: 삭제 실패(응답 실패/네트워크 예외) 시 낙관적으로 제거했던 행이 실제로
// 다시 목록에 돌아오는지 - "실패했을 때 최종 사용자 상태가 어떻게 되는지"를 검증한다.

describe('deletePlannerResult (A6)', () => {
  it('세션이 없으면 fetch를 호출하지 않고 실패로 처리한다', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await deletePlannerResult('id-1', null);
    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('응답이 ok이면 성공을 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const result = await deletePlannerResult('id-1', { access_token: 'token' });
    expect(result).toEqual({ ok: true });
    vi.unstubAllGlobals();
  });

  it('응답이 실패(ok=false)이면 서버 메시지를 담아 실패를 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: '권한이 없습니다.' }),
    }));
    const result = await deletePlannerResult('id-1', { access_token: 'token' });
    expect(result).toEqual({ ok: false, error: '권한이 없습니다.' });
    vi.unstubAllGlobals();
  });

  it('fetch 자체가 네트워크 예외를 던지면 그 예외가 그대로 전달된다(호출부가 흡수해야 함)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('네트워크 오류')));
    await expect(deletePlannerResult('id-1', { access_token: 'token' })).rejects.toThrow('네트워크 오류');
    vi.unstubAllGlobals();
  });
});

describe('restoreRowAfterFailedDelete (A6)', () => {
  const rowA = { id: 'a', created_at: '2026-01-03T00:00:00Z' };
  const rowB = { id: 'b', created_at: '2026-01-02T00:00:00Z' };
  const rowC = { id: 'c', created_at: '2026-01-01T00:00:00Z' };

  it('삭제 성공(복원 대상 없음) 시 목록은 그대로 유지된다', () => {
    const rows = [rowA, rowC];
    expect(restoreRowAfterFailedDelete(rows, undefined)).toBe(rows);
  });

  it('삭제 실패한 행을 원래 정렬 순서(created_at 내림차순)에 맞게 복원한다', () => {
    const rows = [rowA, rowC]; // rowB(중간 날짜)가 실패해서 빠진 상태
    const restored = restoreRowAfterFailedDelete(rows, rowB);
    expect(restored.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('이미 목록에 있으면(예: 먼저 처리된 복원) 중복으로 추가하지 않는다', () => {
    const rows = [rowA, rowB, rowC];
    const restored = restoreRowAfterFailedDelete(rows, rowB);
    expect(restored).toBe(rows);
    expect(restored.filter((r) => r.id === 'b')).toHaveLength(1);
  });

  it('다른 행의 성공한 삭제 결과에는 영향을 주지 않는다(연속 삭제 시나리오)', () => {
    // A, B, C 모두 낙관적으로 제거된 뒤 B만 실패해서 복원되는 상황.
    const rowsAfterAllRemoved = [];
    const afterBRestored = restoreRowAfterFailedDelete(rowsAfterAllRemoved, rowB);
    expect(afterBRestored.map((r) => r.id)).toEqual(['b']);
    // A/C는 실제로 성공했으므로 다시 나타나지 않아야 한다 - 호출하지 않는 것으로 표현.
    expect(afterBRestored.some((r) => r.id === 'a')).toBe(false);
    expect(afterBRestored.some((r) => r.id === 'c')).toBe(false);
  });
});
