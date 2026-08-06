import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

/**
 * 월 금액을 입력받고, 연 금액(월×12)을 자동으로 계산해 annualPath에 함께 저장하는 필드.
 * 기존 계산 로직은 monthlyPath/annualPath를 그대로 읽으므로 값 산출 방식만 바뀔 뿐 영향이 없다.
 */
export default function AutoAnnualField({ monthlyPath, annualPath, label, unit = '만원', helper, disabled = false }) {
  const { formData, setField } = useFormData();
  const monthlyValue = getIn(formData, monthlyPath);
  const annualValue = Number(getIn(formData, annualPath)) || 0;

  const handleChange = (e) => {
    const raw = e.target.value;
    const monthly = raw === '' ? '' : Number(raw);
    setField(monthlyPath, monthly);
    setField(annualPath, monthly === '' ? '' : Math.round(monthly * 12));
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-input-row">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={monthlyValue ?? ''}
          onChange={handleChange}
          disabled={disabled}
        />
        <span className="field-unit">{unit}</span>
      </div>
      <span className="field-helper">
        연 환산 {annualValue}{unit}{helper ? ` · ${helper}` : ''}
      </span>
    </label>
  );
}
