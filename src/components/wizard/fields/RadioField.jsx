import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

export default function RadioField({ path, label, options, helper }) {
  const { formData, setField } = useFormData();
  const value = getIn(formData, path);

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="radio-group">
        {options.map((opt) => (
          <button
            type="button"
            key={opt.value}
            className={`radio-pill ${value === opt.value ? 'is-active' : ''}`}
            onClick={() => setField(path, opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {helper && <span className="field-helper">{helper}</span>}
    </div>
  );
}
