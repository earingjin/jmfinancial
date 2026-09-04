import { forwardRef, useState } from 'react';
import { formatNumericText, getNumericInputUpdate } from './numericInputText';

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
  const [inputError, setInputError] = useState(null);

  const handleChange = (event) => {
    const allowsNegative = min == null || Number(min) < 0;
    const update = getNumericInputUpdate(event.target.value, { integerOnly, allowsNegative, max });

    if (!update.shouldCommit) {
      setInputError(update.error);
      // Keep the original text available for correction, but never forward a
      // transformed version of invalid input to form state.
      if (update.error !== 'integer') setEditingValue(String(event.target.value));
      return;
    }

    const normalized = update.value;

    if (normalized === '-' || normalized === '.' || normalized === '-.') return;
    setInputError(null);
    setEditingValue(normalized);

    onChange?.({
      ...event,
      target: { ...event.target, value: normalized },
      currentTarget: { ...event.currentTarget, value: normalized },
    });
  };

  const inputValue = editingValue ?? value;
  const displayValue = inputError && editingValue != null
    ? editingValue
    : formatNumericText(inputValue, integerOnly, useGrouping);
  const errorMessage = inputError === 'integer'
    ? '정수만 입력할 수 있습니다.'
    : inputError === 'negative'
      ? '0 이상의 숫자만 입력할 수 있습니다.'
      : inputError === 'numeric'
        ? '숫자만 입력할 수 있습니다.'
        : inputError === 'max'
          ? `${max} 이하로 입력해 주세요.`
          : null;

  return (
    <>
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode={inputMode}
        value={displayValue}
        onChange={handleChange}
        onBlur={(event) => {
          setEditingValue(null);
          onBlur?.(event);
        }}
        aria-invalid={inputError ? true : undefined}
        data-min={min}
        data-max={max}
      />
      {errorMessage && <span className="field-helper field-helper--error">{errorMessage}</span>}
    </>
  );
});

export default FormattedNumberInput;
