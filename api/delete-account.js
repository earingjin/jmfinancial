import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_lib/auth.js';
import { deletePlannerUserData } from './_lib/accountData.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 허용합니다.' });
    return;
  }

  const auth = await requireUser(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.VITE_SUPABASE_URL || !serviceRoleKey) {
    res.status(500).json({ error: '서버 설정이 누락되어 회원탈퇴를 처리할 수 없습니다.' });
    return;
  }

  // 사용자 자신의 세션 토큰으로 신원만 확인하고(requireUser), 실제 삭제는 RLS 정책 여부와
  // 무관하게 확실히 지워지도록 service role 클라이언트로 처리한다. 연결 데이터와 profile은
  // DB 함수의 한 트랜잭션에서 삭제하고, auth.users 삭제는 마지막에 수행한다.
  const admin = createClient(process.env.VITE_SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = auth.user.id;

  try {
    await deletePlannerUserData(admin, userId, { deleteProfile: true });
  } catch {
    res.status(500).json({ error: '회원 정보를 삭제하지 못했습니다.' });
    return;
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    res.status(500).json({ error: '계정을 삭제하지 못했습니다.' });
    return;
  }

  res.status(200).json({ deleted: true });
}
