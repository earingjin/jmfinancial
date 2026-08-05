import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

/**
 * 연 수입을 입력받고, 옆에 자동 환산된 월 수입을 보여주는 필드.
 * annualPath에 입력한 값을 그대로 저장하는 동시에, monthlyPath(예: income.salary.monthly)에도
 * annual/12 값을 함께 저장해 기존 계산 로직(월 수입 기준)이 그대로 동작하도록 한다.
 */
export default function AnnualIncomeField({ annualPath, monthlyPath, label, helper }) {
  const { formData, setField } = useFormData();
  const annualValue = getIn(formData, annualPath);
  const monthlyValue = getIn(formData, monthlyPath);

  const handleChange = (e) => {
    const raw = e.target.value;
    const annual = raw === '' ? '' : Number(raw);
    setField(annualPath, annual);
    setField(monthlyPath, annual === '' ? '' : Math.round((annual / 12) * 10) / 10);
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="field-input-row">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={annualValue ?? ''}
          onChange={handleChange}
        />
        <span className="field-unit">만원(연)</span>
      </div>
      <span className="field-helper">
        월 환산 {monthlyValue || 0}만원{helper ? ` · ${helper}` : ''}
      </span>
    </label>
  );
}
