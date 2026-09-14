import { isValidLoginId, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../state/authIdentifier.js';

export function validateResetPassword(password, passwordConfirm) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) return '새 비밀번호가 너무 깁니다.';
  if (password !== passwordConfirm) return '새 비밀번호가 서로 일치하지 않습니다.';
  return '';
}

export async function requestAccountReset({ loginId, password, passwordConfirm }, fetchImpl = fetch) {
  if (!isValidLoginId(loginId)) return { ok: false, error: '휴대폰 번호 뒤 8자리를 입력해 주세요.' };
  const passwordError = validateResetPassword(password, passwordConfirm);
  if (passwordError) return { ok: false, error: passwordError };

  try {
    const response = await fetchImpl('/api/reset-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password, passwordConfirm }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: body.error || '계정 초기화 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: '계정 초기화 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }
}
