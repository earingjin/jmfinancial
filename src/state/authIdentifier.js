export const LOGIN_ID_PATTERN = /^\d{8}$/;
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;

export function normalizeLoginId(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeSignupLoginId(value) {
  return String(value ?? '').replace(/\D/g, '').slice(-8);
}

export function isValidLoginId(value) {
  return LOGIN_ID_PATTERN.test(normalizeLoginId(value));
}

export function toAuthEmail(identifier) {
  const value = normalizeLoginId(identifier);
  return value.includes('@') ? value : `${value}@jmfinancial.local`;
}

export function toPhoneLoginAuthEmail(loginId) {
  const value = normalizeLoginId(loginId);
  return isValidLoginId(value) ? `${value}@jmfinancial.local` : '';
}
