import { getIn } from './pathUtils';
import {
  formatValidationDetailForUser,
  getTrustedValidationTarget,
  getWizardFieldLabel,
} from './userFacingErrors';
import { getWizardLocationForValidationMessage } from './wizardScreens';

const INTERNAL_PATH_START = /^(basic|income|spouse|expense|assets|scenarios)(?:\.[A-Za-z0-9_]+)+\s+/;
const ARRAY_INDEX = /\.\d+(?:\.|$)/;

const extractPath = (detail) => {
  const text = typeof detail === 'string' ? detail.trim() : '';
  if (!INTERNAL_PATH_START.test(text)) return null;
  return text.slice(0, text.indexOf(' '));
};

const messageSpecificity = (message) => {
  if (message.includes('0보다 커야')) return 4;
  if (message.includes('필수')) return 3;
  if (message.includes('정수') || message.includes('이하') || message.includes('이상')) return 2;
  return 1;
};

const selectMessage = (messages) => [...messages]
  .sort((a, b) => messageSpecificity(b) - messageSpecificity(a))[0];

const collectionPathOf = (path) => {
  if (!path || !ARRAY_INDEX.test(path)) return null;
  const parts = path.split('.');
  const index = parts.findIndex((part) => /^\d+$/.test(part));
  return index > 0 ? parts.slice(0, index).join('.') : null;
};

const snapshotValue = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

// 서버 검증 원문은 화면에 직접 노출하지 않는다. 허용된 필드만 입력 위치로 연결하고,
// 같은 path의 여러 검증 결과는 하나의 실제 수정 대상으로 묶는다.
export function normalizeServerValidationIssues(details, formData) {
  const grouped = new Map();
  (Array.isArray(details) ? details : []).filter(Boolean).forEach((detail, index) => {
    const raw = String(detail).trim();
    const path = extractPath(raw);
    const trustedTarget = getTrustedValidationTarget(raw, formData);
    const explicitLocation = path ? null : getWizardLocationForValidationMessage(raw, formData);
    const location = trustedTarget || explicitLocation || null;
    const collectionPath = collectionPathOf(path);
    const key = path ? `path:${path}` : `message:${raw}`;
    const message = formatValidationDetailForUser(raw, formData);
    const existing = grouped.get(key);
    if (existing) {
      existing.messages = [...new Set([...existing.messages, message])];
      existing.message = selectMessage(existing.messages);
      return;
    }
    grouped.set(key, {
      key: `server:${key}`,
      source: 'server',
      status: 'active',
      path,
      label: (path && getWizardFieldLabel(path, formData)) || explicitLocation?.label || message,
      message,
      messages: [message],
      stepIndex: location?.stepIndex ?? null,
      stepKey: location?.stepKey ?? null,
      screenId: location?.screenId ?? null,
      targetId: location?.targetId || trustedTarget?.path || null,
      valueSnapshot: path ? snapshotValue(getIn(formData, path)) : null,
      collectionPath,
      collectionLength: collectionPath && Array.isArray(getIn(formData, collectionPath))
        ? getIn(formData, collectionPath).length
        : null,
      order: index,
    });
  });
  return [...grouped.values()];
}

export function serverIssueStatus(issue, formData) {
  if (issue.source !== 'server' || !issue.path) return issue.status || 'active';
  const collection = issue.collectionPath ? getIn(formData, issue.collectionPath) : null;
  if (issue.collectionLength != null && (!Array.isArray(collection) || collection.length !== issue.collectionLength)) {
    return 'pending';
  }
  return snapshotValue(getIn(formData, issue.path)) === issue.valueSnapshot ? 'active' : 'pending';
}

export function mergeWizardValidationIssues(clientIssues, serverIssues, formData) {
  const merged = new Map();
  const add = (issue) => {
    const status = issue.source === 'server' ? serverIssueStatus(issue, formData) : 'active';
    const key = issue.path ? `path:${issue.path}` : issue.key;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...issue, status, messages: issue.messages || [issue.message] });
      return;
    }
    const messages = [...new Set([...(existing.messages || [existing.message]), ...(issue.messages || [issue.message])])];
    merged.set(key, {
      ...existing,
      ...(!existing.stepKey && issue.stepKey ? issue : {}),
      source: existing.source === issue.source ? existing.source : 'client+server',
      status: existing.status === 'active' || status === 'active' ? 'active' : 'pending',
      messages,
      message: selectMessage(messages),
    });
  };
  clientIssues.forEach(add);
  serverIssues.forEach(add);
  return [...merged.values()].sort((a, b) => (a.stepIndex ?? 99) - (b.stepIndex ?? 99) || (a.order ?? 0) - (b.order ?? 0));
}

