import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

export default function ToggleField({ path, label, description }) {
  const { formData, setField } = useFormData();
  const value = !!getIn(formData, path);

  return (
    <button
      type="button"
      className={`scenario-toggle ${value ? 'is-on' : ''}`}
      onClick={() => setField(path, !value)}
    >
      <span className="scenario-toggle-switch" aria-hidden="true" />
      <span className="scenario-toggle-text">
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </span>
      <span className="scenario-toggle-state">{value ? '적용 중 (클릭하여 끄기)' : '이 방법 적용하기'}</span>
    </button>
  );
}
