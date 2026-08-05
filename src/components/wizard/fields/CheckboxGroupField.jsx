import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

export default function CheckboxGroupField({ path, label, options }) {
  const { formData, setField } = useFormData();
  const values = getIn(formData, path) || [];

  const toggle = (val) => {
    const next = values.includes(val) ? values.filter((v) => v !== val) : [...values, val];
    setField(path, next);
  };

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="checkbox-group">
        {options.map((opt) => (
          <label key={opt.value} className={`checkbox-pill ${values.includes(opt.value) ? 'is-active' : ''}`}>
            <input
              type="checkbox"
              checked={values.includes(opt.value)}
              onChange={() => toggle(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
