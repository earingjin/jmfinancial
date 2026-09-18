const explicitlyEnabled = import.meta.env.VITE_SAVINGS_DIAGNOSTICS === 'true';

export const savingsDiagnosticsEnabled = import.meta.env.DEV && explicitlyEnabled;

let eventSequence = 0;
let itemSequence = 0;

const ALLOWED_DETAIL_KEYS = new Set([
  'itemId', 'index', 'field', 'reason', 'errorKind', 'phase', 'result',
  'edited', 'composing', 'pending', 'hasError', 'disabled', 'readOnly',
  'changedFromStored', 'storedNameChanged', 'monthlyChanged', 'accumulatedChanged',
  'assetMatchCount', 'hasStoredName', 'hasLinkedAsset',
]);

// 진단 출력에는 실제 이름·금액·formData가 들어갈 수 없도록 허용된 비식별 필드만 남긴다.
export function sanitizeSavingsDiagnosticDetail(detail = {}) {
  return Object.fromEntries(Object.entries(detail).filter(([key, value]) => (
    ALLOWED_DETAIL_KEYS.has(key)
    && (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' || value == null)
  )));
}

export function createSavingsDiagnosticItemId() {
  itemSequence += 1;
  return `custom-savings-${itemSequence}`;
}

export function logSavingsDiagnostic(event, detail) {
  if (!savingsDiagnosticsEnabled) return;
  eventSequence += 1;
  console.info('[SavingsDiagnostics]', {
    sequence: eventSequence,
    event,
    ...sanitizeSavingsDiagnosticDetail(detail),
  });
}
