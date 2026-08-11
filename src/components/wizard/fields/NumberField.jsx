import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

/**
 * 숫자 입력 필드. path는 "income.salary.monthly" 형태의 점 표기.
 */
export default function NumberField({ path, label, unit, helper, placeholder, min = 0, required = false }) {
  const { formData, setField } = useFormData();
  const value = getIn(formData, path);

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-input-row">
        <input
          type="number"
          min={min}
          inputMode="numeric"
          placeholder={placeholder}
          required={required}
          aria-required={required}
          value={value ?? ''}
          onChange={(e) => setField(path, e.target.value === '' ? '' : Number(e.target.value))}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </div>
      {helper && <span className="field-helper">{helper}</span>}
    </label>
  );
}
