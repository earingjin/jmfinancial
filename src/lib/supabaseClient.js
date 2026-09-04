import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// A10: url/key가 없으면 createClient가 즉시 throw해 이 모듈을 import하는 시점에 앱 전체가 죽는다
// (main.jsx가 React를 mount하기도 전이라 ErrorBoundary도 잡지 못하고 흰 화면만 남는다). 더미 URL/
// 키나 service_role로 대체하지 않고, 여기서는 안전하게 실패(supabase=null)만 하고 실제 안내 화면
// 전환은 main.jsx가 supabaseConfigured를 보고 결정한다.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error('Supabase 환경변수(VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)가 설정되지 않았습니다.');
}

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
      },
    })
  : null;
