import { createClient } from '@supabase/supabase-js';
import { requireUser } from './_lib/auth.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'DELETE 요청만 허용합니다.' });
    return;
  }

  const auth = await requireUser(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_PATTERN.test(id)) {
    res.status(400).json({ error: '삭제할 결과 ID가 올바르지 않습니다.' });
    return;
  }

  const authorization = req.headers.authorization;
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    },
  );

  const { data, error } = await supabase
    .from('planner_results')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select('id')
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: '결과를 영구 삭제하지 못했습니다.' });
    return;
  }
  if (!data) {
    res.status(404).json({ error: '삭제할 결과를 찾을 수 없거나 삭제 권한이 없습니다.' });
    return;
  }

  res.status(200).json({ deleted: true, id: data.id });
}
