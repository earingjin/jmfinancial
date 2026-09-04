export const LOGIN_ID_PATTERN = /^[a-z0-9]{4,20}$/;

export function normalizeLoginId(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidLoginId(value) {
  return LOGIN_ID_PATTERN.test(normalizeLoginId(value));
}

export function toAuthEmail(identifier) {
  const value = normalizeLoginId(identifier);
  return value.includes('@') ? value : `${value}@jmfinancial.local`;
}
