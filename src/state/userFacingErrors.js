import { getWizardRequiredFieldDefinitions } from './wizardRequiredFields';
import { getWizardLocationForPath } from './wizardScreens';

const INTERNAL_PATH_PREFIXES = ['basic', 'income', 'spouse', 'expense', 'assets', 'scenarios'];
const INTERNAL_PATH_START = new RegExp(`^(${INTERNAL_PATH_PREFIXES.join('|')})(?:\\.[A-Za-z0-9_]+)+\\s+`);
const INTERNAL_REFERENCE = new RegExp(`(?:^|["'\\s])(?:${INTERNAL_PATH_PREFIXES.join('|')})(?:\\.[A-Za-z0-9_]+)+`);
const INTERNAL_SECTION = new RegExp(`^["']?(?:${INTERNAL_PATH_PREFIXES.join('|')})["']?\\s+섹션`);
const TECHNICAL_ERROR = /(?:TypeError|ReferenceError|SyntaxError|Error:|Supabase|PostgREST|(?:^|\s)[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z0-9_.]+)/i;

const CALCULATION_API_MESSAGES = new Set([
  'POST 요청만 허용됩니다.',
  '로그인이 필요합니다.',
  '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  '서버 인증 설정이 누락되었습니다.',
  '요청 데이터가 너무 큽니다.',
  '요청 본문이 올바른 JSON 형식이 아닙니다.',
  '입력값을 다시 확인해 주세요.',
  '계산 중 오류가 발생했습니다.',
]);

function hasFinalConsonant(text) {
  const last = String(text || '').trim().at(-1);
  const code = last?.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

function withTopicParticle(label) {
  return `${label}${hasFinalConsonant(label) ? '은' : '는'}`;
}

function withSubjectParticle(label) {
  return `${label}${hasFinalConsonant(label) ? '이' : '가'}`;
}

function getWizardFieldLabels(formData) {
  const definitions = getWizardRequiredFieldDefinitions(formData);
  return new Map(Object.values(definitions).flat().map(([path, label]) => [path, label]));
}

export function getWizardFieldLabel(path, formData) {
  return getWizardFieldLabels(formData).get(path) || null;
}

function extractInternalPath(message) {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text.match(INTERNAL_PATH_START)) return null;
  return text.slice(0, text.indexOf(' '));
}

export function getTrustedValidationTarget(detail, formData) {
  const path = extractInternalPath(detail);
  if (!path || !getWizardFieldLabels(formData).has(path)) return null;
  const location = getWizardLocationForPath(path, Boolean(getInSafe(formData, 'basic.hasSpouse')));
  return location ? { path, ...location } : null;
}

function getInSafe(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value);
}

export function formatValidationDetailForUser(detail, formData) {
  const message = typeof detail === 'string' ? detail.trim() : '';
  if (!message) return '입력값을 다시 확인해 주세요.';

  const pathMatch = message.match(INTERNAL_PATH_START);
  if (!pathMatch) {
    if (INTERNAL_REFERENCE.test(message) || INTERNAL_SECTION.test(message) || TECHNICAL_ERROR.test(message)) {
      return '입력값을 다시 확인해 주세요.';
    }
    return message;
  }

  const path = extractInternalPath(message);
  const label = getWizardFieldLabels(formData).get(path);
  if (!label) return '입력값을 다시 확인해 주세요.';

  const remainder = message.slice(path.length).trim();
  if (remainder.startsWith('값은 ')) return `${withTopicParticle(label)} ${remainder.slice(3)}`;
  if (remainder.startsWith('값이 ')) return `${withSubjectParticle(label)} ${remainder.slice(3)}`;
  if (remainder.startsWith('출생년도가 ')) return `${withSubjectParticle(label)} ${remainder.slice(6)}`;
  return `${label} ${remainder}`;
}

export function formatValidationDetailsForUser(details, formData) {
  const messages = (Array.isArray(details) ? details : [])
    .filter(Boolean)
    .map((detail) => formatValidationDetailForUser(detail, formData));
  return [...new Set(messages)];
}

export function toUserFacingCalculationError(message) {
  return CALCULATION_API_MESSAGES.has(message)
    ? message
    : '계산 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export function toKnownUserMessage(message, allowedMessages, fallback) {
  return allowedMessages?.includes(message) ? message : fallback;
}

export function containsTechnicalErrorText(message) {
  const text = typeof message === 'string' ? message : '';
  return INTERNAL_REFERENCE.test(text) || INTERNAL_SECTION.test(text) || TECHNICAL_ERROR.test(text);
}
