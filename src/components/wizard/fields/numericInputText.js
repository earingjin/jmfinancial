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

export function normalizeNumericText(value, { integerOnly = false, allowsNegative = true } = {}) {
  const raw = String(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
  const unsigned = raw.replace(/-/g, '');
  return `${allowsNegative && raw.startsWith('-') ? '-' : ''}${integerOnly
    ? unsigned.split('.')[0]
    : unsigned.replace(/\.(?=.*\.)/g, '')}`;
}
