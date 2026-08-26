// "새 진단 시작"/"다시 입력하기" 계열 진입점에서 FormProvider의 formData 세션을 완전히 새로
// 시작해야 하는지 판정하는 순수 함수. restart(처음부터 다시 입력하기 / 결과 화면의 다시
// 입력하기)는 지금 formData를 버리는 흐름이므로 항상 리셋하고, startDiagnosis(자산진단
// 시작하기)는 직전 formData 세션으로 이미 진단을 완료·저장한 뒤일 때만 리셋한다 - 위저드를
// 다 채우지 않고 홈으로 나왔다가 되돌아온 미완성 이어쓰기는 그대로 보존해야 하기 때문이다.
// App.jsx는 supabase 클라이언트 등 무거운 트리를 정적으로 import하므로, 이 판정만 App.jsx 밖의
// 별도 모듈로 분리해 App.jsx를 렌더링하지 않고도 단위 테스트할 수 있게 한다.
export function shouldResetFormSession(trigger, formSessionConsumed) {
  if (trigger === 'restart') return true;
  if (trigger === 'startDiagnosis') return Boolean(formSessionConsumed);
  return false;
}

// 서버 draft를 지우고 나서야 로컬 formData 세션을 새로 시작한다. 로컬(FormProvider) 상태만
// 리셋하면, 계산 실패처럼 completePlannerSubmission(→ deleteDraft)까지 가지 못한 경로에서는
// Supabase에 남아있는 기존 draft가 지워지지 않아 - 그 상태로 새 진단을 시작한 뒤 저장 전에
// 새로고침하면 그 기존 draft가 다시 복원될 수 있다. deleteDraft는 항상 호출부(App.jsx)가 가진
// 기존 함수(state/draftStorage.js)를 그대로 주입받아 재사용하고, 여기서 새 Supabase 호출을
// 만들지 않는다. 삭제가 실패하면 onReset을 호출하지 않고 실패만 알려 사용자 데이터(formData·
// 화면 상태)를 조용히 잘못 초기화하지 않는다.
export async function resetFormSessionWithServerCleanup({ userId, deleteDraft, onReset }) {
  try {
    await deleteDraft(userId);
  } catch {
    return { ok: false };
  }
  onReset();
  return { ok: true };
}
