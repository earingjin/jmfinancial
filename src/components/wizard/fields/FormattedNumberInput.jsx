import { forwardRef, useState } from 'react';
import { formatNumericText, normalizeNumericText } from './numericInputText';

/**
 * A text-backed numeric input that displays thousands separators while keeping
 * the same onChange contract as a native number input (target.value is plain).
 */
const FormattedNumberInput = forwardRef(function FormattedNumberInput(
  { value, onChange, onBlur, min, max, inputMode = 'decimal', integerOnly = false, useGrouping = true, ...props },
  ref,
) {
  // 상위 필드는 저장값을 Number로 보관하므로 사용자가 "2."까지 입력한 순간 2로 바뀔 수 있다.
  // 포커스가 있는 동안에는 입력 문자열을 별도로 유지해 "2." 다음에 "5"를 이어서 입력할 수 있게 한다.
  const [editingValue, setEditingValue] = useState(null);
  const [integerError, setIntegerError] = useState(false);

  const handleChange = (event) => {
    const allowsNegative = min == null || Number(min) < 0;
    // Integer fields used to turn "24.5" into "24".  Do not silently save a
    // different value from the one the user entered.
    if (integerOnly && String(event.target.value).replace(/,/g, '').includes('.')) {
      setIntegerError(true);
      return;
    }
    const normalized = normalizeNumericText(event.target.value, { integerOnly, allowsNegative });

    if (normalized === '-' || normalized === '.' || normalized === '-.') return;
    setIntegerError(false);
    setEditingValue(normalized);

    onChange?.({
      ...event,
      target: { ...event.target, value: normalized },
      currentTarget: { ...event.currentTarget, value: normalized },
    });
  };

  return (
    <>
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode={inputMode}
        value={formatNumericText(editingValue ?? value, integerOnly, useGrouping)}
        onChange={handleChange}
        onBlur={(event) => {
          setEditingValue(null);
          onBlur?.(event);
        }}
        aria-invalid={integerError || undefined}
        data-min={min}
        data-max={max}
      />
      {integerError && <span className="field-helper field-helper--error">정수만 입력할 수 있습니다.</span>}
    </>
  );
});

export default FormattedNumberInput;
