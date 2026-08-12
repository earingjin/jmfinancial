import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import FormattedNumberInput from './FormattedNumberInput';

/**
 * 개월 수를 저장하는 필드를 "N년 N개월" 형태의 두 입력칸으로 나눠서 입력받는 필드.
 * 실제 저장값(monthsPath)은 항상 두 값을 합친 총 개월 수로 통일된다.
 */
export default function RemainingTermField({ monthsPath, label, helper }) {
  const { formData, setField } = useFormData();
  const months = getIn(formData, monthsPath);
  const totalMonths = months === '' || months === undefined || months === null ? '' : Number(months) || 0;
  const yearsPart = totalMonths === '' ? '' : Math.floor(totalMonths / 12);
  const monthsPart = totalMonths === '' ? '' : totalMonths % 12;

  const setParts = (nextYears, nextMonths) => {
    const y = nextYears === '' ? 0 : Number(nextYears);
    const m = nextMonths === '' ? 0 : Number(nextMonths);
    setField(monthsPath, y * 12 + m);
  };

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="field-input-row">
        <FormattedNumberInput
          type="number"
          min={0}
          inputMode="numeric"
          value={yearsPart}
          onChange={(e) => setParts(e.target.value, monthsPart)}
        />
        <span className="field-unit">년</span>
        <FormattedNumberInput
          type="number"
          min={0}
          max={11}
          inputMode="numeric"
          value={monthsPart}
          onChange={(e) => setParts(yearsPart, e.target.value)}
        />
        <span className="field-unit">개월</span>
      </div>
      {helper && <span className="field-helper">{helper}</span>}
    </div>
  );
}
