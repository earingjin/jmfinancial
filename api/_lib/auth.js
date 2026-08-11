// Authorization 헤더의 Supabase 액세스 토큰을 검증한다.
// 순수 인증 유틸 — 여기에 재무 계산은 절대 넣지 않는다.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** 성공: { ok: true, user } / 실패: { ok: false, status, error } */
export async function requireUser(req) {
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, status: 500, error: '서버 인증 설정이 누락되었습니다.' };
  }

  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: '로그인이 필요합니다.' };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
  }
  return { ok: true, user: data.user };
}
