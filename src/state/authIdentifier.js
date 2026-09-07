export const LOGIN_ID_PATTERN = /^\d{8}$/;

export function normalizeLoginId(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeSignupLoginId(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8);
}

export function isValidLoginId(value) {
  return LOGIN_ID_PATTERN.test(normalizeLoginId(value));
}

export function toAuthEmail(identifier) {
  const value = normalizeLoginId(identifier);
  return value.includes('@') ? value : `${value}@jmfinancial.local`;
}
