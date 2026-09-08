import { createHmac, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { isValidLoginId, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, toPhoneLoginAuthEmail } from '../src/state/authIdentifier.js';
import { deletePlannerUserData } from './_lib/accountData.js';

const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_ID_ATTEMPT_LIMIT = 5;
const RESET_IP_ATTEMPT_LIMIT = 20;
const MAX_RATE_LIMIT_KEYS = 5_000;
const MIN_RESPONSE_MS = 650;
const attempts = new Map();
const rateLimitSecret = randomBytes(32);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function parseBody(body) {
  if (typeof body === 'string') return JSON.parse(body);
  return body;
}

function isAllowedBrowserRequest(req) {
  const contentType = req.headers?.['content-type'] || '';
  if (!contentType.toLowerCase().startsWith('application/json')) return false;
  if (req.headers?.['sec-fetch-site'] === 'cross-site') return false;

  const origin = req.headers?.origin;
  if (!origin) return true;
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function validateResetAccountInput(body) {
  let input;
  try {
    const serialized = typeof body === 'string' ? body : JSON.stringify(body);
    if (!serialized || serialized.length > 2_048) return { ok: false };
    input = parseBody(body);
  } catch {
    return { ok: false };
  }

  const loginId = typeof input?.loginId === 'string' ? input.loginId.trim() : '';
  const password = typeof input?.password === 'string' ? input.password : '';
  const passwordConfirm = typeof input?.passwordConfirm === 'string' ? input.passwordConfirm : '';

  if (!isValidLoginId(loginId)) return { ok: false };
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return { ok: false };
  if (password !== passwordConfirm) return { ok: false };
  return { ok: true, loginId, password };
}

function requestIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp) return realIp.trim();
  return req.socket?.remoteAddress || 'unknown';
}

function rateLimitKey(scope, value) {
  return createHmac('sha256', rateLimitSecret).update(`${scope}:${value}`).digest('hex');
}

function consumeBucket(key, limit, now) {
  const current = attempts.get(key);
  if (!current || now - current.startedAt >= RESET_WINDOW_MS) {
    attempts.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function consumeResetAttempt(req, loginId, now = Date.now()) {
  if (attempts.size >= MAX_RATE_LIMIT_KEYS) {
    for (const [key, value] of attempts) {
      if (now - value.startedAt >= RESET_WINDOW_MS) attempts.delete(key);
    }
    if (attempts.size >= MAX_RATE_LIMIT_KEYS) return false;
  }

  const ipAllowed = consumeBucket(rateLimitKey('ip', requestIp(req)), RESET_IP_ATTEMPT_LIMIT, now);
  const idAllowed = consumeBucket(rateLimitKey('id', loginId), RESET_ID_ATTEMPT_LIMIT, now);
  return ipAllowed && idAllowed;
}

export function clearResetAttemptsForTests() {
  attempts.clear();
}

function createClients() {
  const url = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey) return null;

  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  return {
    admin: createClient(url, serviceRoleKey, options),
    passwordClient: createClient(url, publishableKey, options),
  };
}

async function findResettableAccount(admin, loginId) {
  const internalEmail = toPhoneLoginAuthEmail(loginId);
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('email', internalEmail)
    .maybeSingle();

  if (profileError) throw new Error('profile lookup failed', { cause: profileError });
  // 관리자 계정의 비밀번호를 8자리 아이디만으로 바꾸면 전체 사용자 데이터가 위험해진다.
  // 존재하지 않는 계정과 같은 응답을 사용해 역할·존재 여부는 노출하지 않는다.
  if (!profile || profile.role === 'admin') return null;

  const { data, error } = await admin.auth.admin.getUserById(profile.id);
  if (error) throw new Error('auth user lookup failed', { cause: error });
  if (!data?.user || data.user.email !== internalEmail) return null;
  return data.user;
}

export async function performAccountReset({ admin, passwordClient, loginId, password }) {
  const user = await findResettableAccount(admin, loginId);
  if (!user) return;

  // Auth 비밀번호 변경과 public DB 삭제는 하나의 DB 트랜잭션으로 묶을 수 없다.
  // 새 비밀번호를 먼저 설정하면 뒤의 삭제 실패 시 요청자가 기존 재무정보를 열 수 있으므로,
  // 노출 방지를 우선해 public 연결 데이터를 원자적으로 먼저 삭제한다. 재시도는 멱등적이다.
  await deletePlannerUserData(admin, user.id, { deleteProfile: false });

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: { login_id: loginId, name: null },
  });
  if (updateError) throw new Error('password update failed', { cause: updateError });

  // 새 비밀번호로 만든 서버 전용 일회성 세션까지 global sign-out하여 모든 refresh token을
  // 폐기한다. 이미 발급된 access JWT는 Supabase 특성상 만료 전까지 유효할 수 있다.
  const { data: signInData, error: signInError } = await passwordClient.auth.signInWithPassword({
    email: toPhoneLoginAuthEmail(loginId),
    password,
  });
  if (signInError || !signInData?.session?.access_token) {
    throw new Error('session revocation login failed', { cause: signInError });
  }
  const { error: signOutError } = await admin.auth.admin.signOut(signInData.session.access_token, 'global');
  if (signOutError) throw new Error('session revocation failed', { cause: signOutError });
}

export function createResetAccountHandler({
  getClients = createClients,
  resetAccount = performAccountReset,
  consumeAttempt = consumeResetAttempt,
  minimumResponseMs = MIN_RESPONSE_MS,
  wait = sleep,
} = {}) {
  return async function handler(req, res) {
    const startedAt = Date.now();
    res.setHeader?.('Cache-Control', 'no-store');

    const finishDelay = async () => {
      const remaining = minimumResponseMs - (Date.now() - startedAt);
      if (remaining > 0) await wait(remaining);
    };

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST 요청만 허용합니다.' });
      return;
    }

    if (!isAllowedBrowserRequest(req)) {
      await finishDelay();
      res.status(403).json({ error: '계정 초기화 요청을 처리할 수 없습니다.' });
      return;
    }

    const validation = validateResetAccountInput(req.body);
    if (!validation.ok) {
      await finishDelay();
      res.status(400).json({ error: '입력값을 확인해 주세요.' });
      return;
    }

    if (!consumeAttempt(req, validation.loginId)) {
      await finishDelay();
      res.setHeader?.('Retry-After', String(Math.ceil(RESET_WINDOW_MS / 1000)));
      res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
      return;
    }

    const clients = getClients();
    if (!clients) {
      await finishDelay();
      res.status(500).json({ error: '계정 초기화 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      return;
    }

    try {
      await resetAccount({ ...clients, loginId: validation.loginId, password: validation.password });
      await finishDelay();
      // 계정 미존재·관리자 계정도 같은 상태와 본문을 사용해 account enumeration을 줄인다.
      res.status(200).json({ reset: true });
    } catch {
      await finishDelay();
      res.status(500).json({ error: '계정 초기화 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  };
}

export default createResetAccountHandler();
