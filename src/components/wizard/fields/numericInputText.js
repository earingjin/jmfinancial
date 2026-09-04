export function formatNumericText(value, integerOnly = false, useGrouping = true) {
  if (value === '' || value == null) return '';

  const rawValue = String(value).replace(/,/g, '');
  const raw = integerOnly ? rawValue.split('.')[0] : rawValue;
  const sign = raw.startsWith('-') ? '-' : '';
  const unsigned = sign ? raw.slice(1) : raw;
  const [integer = '', ...fractionParts] = unsigned.split('.');
  const groupedInteger = useGrouping
    ? (integer || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : (integer || '0');
  const fraction = fractionParts.length > 0 ? `.${fractionParts.join('')}` : '';

  return `${sign}${groupedInteger}${fraction}`;
}

export function normalizeNumericText(value, { integerOnly = false, allowsNegative = true, max } = {}) {
  const result = getNumericInputUpdate(value, { integerOnly, allowsNegative, max });
  return result.shouldCommit ? result.value : String(value ?? '').replace(/,/g, '');
}

/**
 * Classifies user-entered numeric text before it reaches form state.
 * Commas are presentation-only; every other character must already form a
 * valid numeric value (or an intermediate value such as "2.").
 */
export function getNumericInputUpdate(value, { integerOnly = false, allowsNegative = true, max } = {}) {
  const normalized = String(value ?? '').replace(/,/g, '');

  if (normalized === '') return { shouldCommit: true, value: '' };

  if (!allowsNegative && normalized.startsWith('-')) {
    return { shouldCommit: false, error: 'negative' };
  }

  if (!/^-?\d*(?:\.\d*)?$/.test(normalized)) {
    return { shouldCommit: false, error: 'numeric' };
  }

  if (integerOnly && normalized.includes('.')) {
    return { shouldCommit: false, error: 'integer' };
  }

  if (max !== undefined && max !== null && max !== '' && Number(normalized) > Number(max)) {
    return { shouldCommit: false, error: 'max', max: Number(max) };
  }

  return { shouldCommit: true, value: normalized };
}
