import { forwardRef } from 'react';

function formatNumericText(value, integerOnly = false, useGrouping = true) {
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

/**
 * A text-backed numeric input that displays thousands separators while keeping
 * the same onChange contract as a native number input (target.value is plain).
 */
const FormattedNumberInput = forwardRef(function FormattedNumberInput(
  { value, onChange, min, max, inputMode = 'decimal', integerOnly = false, useGrouping = true, ...props },
  ref,
) {
  const handleChange = (event) => {
    const raw = event.target.value.replace(/,/g, '').replace(/[^\d.-]/g, '');
    const allowsNegative = min == null || Number(min) < 0;
    const unsigned = raw.replace(/-/g, '');
    const normalized = `${allowsNegative && raw.startsWith('-') ? '-' : ''}${integerOnly
      ? unsigned.split('.')[0]
      : unsigned.replace(/\.(?=.*\.)/g, '')}`;

    if (normalized === '-' || normalized === '.' || normalized === '-.') return;

    onChange?.({
      ...event,
      target: { ...event.target, value: normalized },
      currentTarget: { ...event.currentTarget, value: normalized },
    });
  };

  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode={inputMode}
      value={formatNumericText(value, integerOnly, useGrouping)}
      onChange={handleChange}
      data-min={min}
      data-max={max}
    />
  );
});

export default FormattedNumberInput;
