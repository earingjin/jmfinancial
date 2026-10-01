import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 허용합니다.' });

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: '서버 설정을 확인해 주세요.' });

  const page = Number(req.query?.page ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    return res.status(400).json({ error: '페이지 번호가 올바르지 않습니다.' });
  }

  try {
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: profile, error: profileError } = await admin
      .from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== 'admin') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });

    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 50 });
    if (error) throw error;
    return res.status(200).json({
      users: data.users.map((user) => ({
        id: user.id,
        createdAt: user.created_at,
        name: user.user_metadata?.name || '',
        company: user.user_metadata?.company || '',
      })),
      hasMore: data.users.length === 50,
    });
  } catch {
    return res.status(500).json({ error: '회원 정보를 불러오지 못했습니다.' });
  }
}
