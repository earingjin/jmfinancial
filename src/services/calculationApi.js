import { supabase } from '../lib/supabaseClient';

const postCalculation = (formData, accessToken, fetchImpl) => fetchImpl('/api/calculate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify(formData),
});

// 저장된 액세스 토큰이 만료 시점에 걸린 경우 세션을 한 번 갱신한 뒤 동일 요청을 재시도한다.
// 인증 실패를 곧바로 로그아웃으로 연결하지 않아 사용자의 입력 화면과 세션을 불필요하게 잃지 않는다.
export async function requestCalculation(formData, { auth = supabase.auth, fetchImpl = fetch } = {}) {
  const { data: { session } } = await auth.getSession();
  if (!session?.access_token) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');

  let response = await postCalculation(formData, session.access_token, fetchImpl);
  if (response.status !== 401) return response;

  const { data, error } = await auth.refreshSession();
  const refreshedSession = data?.session;
  if (error || !refreshedSession?.access_token) return response;

  response = await postCalculation(formData, refreshedSession.access_token, fetchImpl);
  return response;
}
