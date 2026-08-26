import { describe, expect, it, vi } from 'vitest';
import { resetFormSessionWithServerCleanup, shouldResetFormSession } from './formSessionPolicy.js';

// Case B(코드리뷰 후속): v1 초안을 이어서 완료한 뒤 같은 세션에서 새 진단을 시작해도
// FormProvider의 formData(및 retirementSavingsInputVersion)가 이전 세션 것으로 남지 않아야 한다.
// App.jsx는 restart/startDiagnosis에서 이 판정 결과에 따라 FormProvider를 리셋한다.
//
// 버그 수정: restart(처음부터 다시 입력하기 / 다시 입력하기)를 "항상 리셋"으로 두면, 계산이
// 막 실패했을 뿐 아직 저장된 적 없는 정상 입력값이 남아있는 상태에서도 리셋(=서버 draft 삭제 +
// formData 초기화)이 일어나 방금 입력한 내용이 통째로 사라진다(실사용자 리포트: "진단결과 누르니
// 로그인이 만료됐다고 뜨고, 다시 로그인했더니 입력한 게 다 사라졌다"). startDiagnosis와 동일하게
// "직전 세션이 이미 완료·저장된 뒤"에만 리셋하도록 통일한다.
describe('shouldResetFormSession', () => {
  it('restart(처음부터 다시 입력하기 / 다시 입력하기)는 직전 세션이 이미 완료·저장된 뒤에만 리셋한다', () => {
    expect(shouldResetFormSession('restart', true)).toBe(true);
  });

  it('회귀 방지: restart라도 직전 세션이 저장된 적 없으면(계산 실패 등) 리셋하지 않는다', () => {
    expect(shouldResetFormSession('restart', false)).toBe(false);
  });

  it('Case B: startDiagnosis(자산진단 시작하기)는 직전 formData 세션이 이미 완료·저장된 뒤에만 리셋한다', () => {
    expect(shouldResetFormSession('startDiagnosis', true)).toBe(true);
  });

  it('startDiagnosis는 위저드를 다 채우지 않고 홈에 나갔다 돌아온 미완성 이어쓰기는 리셋하지 않는다', () => {
    expect(shouldResetFormSession('startDiagnosis', false)).toBe(false);
  });

  it('알 수 없는 트리거는 안전하게 리셋하지 않는다', () => {
    expect(shouldResetFormSession('unknown', true)).toBe(false);
  });
});

// 코드리뷰 후속: resetFormSession()이 로컬 FormProvider만 리셋하면, 계산 실패처럼
// completePlannerSubmission(→ deleteDraft)까지 가지 못한 경로에서는 Supabase에 남아있는 기존
// draft가 지워지지 않아 새로고침 시 되살아날 수 있다. resetFormSessionWithServerCleanup은
// "서버 draft 삭제 성공 → 로컬 세션 리셋" 순서를 강제하고, 삭제가 실패하면 로컬 세션을 절대
// 건드리지 않는다.
describe('resetFormSessionWithServerCleanup', () => {
  it('Case 1: 새 진단 reset 시 주입된 deleteDraft(기존 draftStorage.js 함수)를 userId로 호출한다', async () => {
    const deleteDraft = vi.fn().mockResolvedValue(undefined);
    const onReset = vi.fn();
    await resetFormSessionWithServerCleanup({ userId: 'user-1', deleteDraft, onReset });
    expect(deleteDraft).toHaveBeenCalledWith('user-1');
    expect(deleteDraft).toHaveBeenCalledOnce();
  });

  it('Case 4: draft 삭제 성공 후에만 onReset(로컬 v2 세션 초기화)이 호출되고, ok:true를 반환한다', async () => {
    const deleteDraft = vi.fn().mockResolvedValue(undefined);
    const onReset = vi.fn();
    const result = await resetFormSessionWithServerCleanup({ userId: 'user-1', deleteDraft, onReset });
    expect(onReset).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
  });

  it('Case 5: draft 삭제 실패 시 onReset을 호출하지 않아(=기존 세션 유지) ok:false를 반환한다', async () => {
    const deleteDraft = vi.fn().mockRejectedValue(new Error('network down'));
    const onReset = vi.fn();
    const result = await resetFormSessionWithServerCleanup({ userId: 'user-1', deleteDraft, onReset });
    expect(onReset).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false });
  });
});
