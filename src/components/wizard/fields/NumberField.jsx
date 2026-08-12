import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import FormattedNumberInput from './FormattedNumberInput';

/**
 * 숫자 입력 필드. path는 "income.salary.monthly" 형태의 점 표기.
 */
export default function NumberField({ path, label, unit, helper, placeholder, min = 0, required = false, disabled = false, integerOnly = false, useGrouping = true, onValueChange }) {
  const { formData, setField } = useFormData();
  const value = getIn(formData, path);

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-input-row">
        <FormattedNumberInput
          min={min}
          inputMode={integerOnly ? 'numeric' : 'decimal'}
          integerOnly={integerOnly}
          useGrouping={useGrouping}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          aria-required={required}
          value={value ?? ''}
          onChange={(e) => {
            const nextValue = e.target.value === '' ? '' : Number(e.target.value);
            setField(path, nextValue);
            onValueChange?.(nextValue);
          }}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </div>
      {helper && <span className="field-helper">{helper}</span>}
    </label>
  );
}
