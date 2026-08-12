import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatNumber } from '../../../utils/format';
import FormattedNumberInput from './FormattedNumberInput';

/**
 * 월 수입을 입력받고, 옆에 자동 환산된 연 수입을 보여주는 필드.
 * monthlyPath에 입력한 값을 그대로 저장하는 동시에, annualPath(예: income.salary.annual)에도
 * monthly*12 값을 함께 저장해 기존 계산 로직과의 호환을 유지한다.
 */
export default function MonthlyIncomeField({ monthlyPath, annualPath, label, helper }) {
  const { formData, setField } = useFormData();
  const monthlyValue = getIn(formData, monthlyPath);
  const annualValue = getIn(formData, annualPath);

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
        <FormattedNumberInput
          type="number"
          min={0}
          inputMode="numeric"
          value={monthlyValue ?? ''}
          onChange={handleChange}
        />
        <span className="field-unit">만원(월)</span>
      </div>
      <span className="field-helper">
        연 환산 {formatNumber(annualValue || 0)}만원{helper ? ` · ${helper}` : ''}
      </span>
    </label>
  );
}
