import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import FormattedNumberInput from './FormattedNumberInput';

/**
 * 사업소득과 기타 정기수입(임대수입 등)을 본인·배우자 구분 없이 하나의 목록에서 입력받는 필드.
 * 각 항목에 유형("사업소득"/"기타 수입")을 지정하면, "사업소득"으로 표시된 항목들의 합계는
 * businessMonthlyPath/businessAnnualPath(income.business)에, 나머지("기타 수입")는
 * otherIncomesPath(income.otherIncomes)에 자동으로 반영되어 기존 계산 로직(총소득 산출 시
 * 사업소득 포함, 기타 정기수입은 별도 집계)이 그대로 동작한다.
 */
export default function RegularIncomeListField({ path, businessMonthlyPath, businessAnnualPath, otherIncomesPath }) {
  const { formData, setField } = useFormData();
  const items = getIn(formData, path) || [];

  const sync = (nextItems) => {
    setField(path, nextItems);
    const businessAnnual = nextItems
      .filter((i) => i.type === 'business')
      .reduce((s, i) => s + (Number(i.annual) || 0), 0);
    const otherItems = nextItems.filter((i) => i.type !== 'business');
    setField(businessAnnualPath, businessAnnual);
    setField(businessMonthlyPath, Math.round(businessAnnual / 12));
    setField(otherIncomesPath, otherItems);
  };

  const addItem = () => sync([...items, { type: 'other', name: '', annual: '', years: '' }]);
  const removeItem = (index) => sync(items.filter((_, i) => i !== index));
  const updateItem = (index, key, value) => sync(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

  return (
    <div className="repeatable-list">
      <div className="repeatable-list-head">
        <span className="field-label">급여·연금 외 정기적으로 들어오는 수입 (사업소득, 임대수입 등)</span>
      </div>

      {items.map((item, index) => (
        <div className="repeatable-item" key={index}>
          <div className="radio-group" style={{ marginBottom: 10 }}>
            <button
              type="button"
              className={`radio-pill ${item.type !== 'business' ? 'is-active' : ''}`}
              onClick={() => updateItem(index, 'type', 'other')}
            >
              기타 수입
            </button>
            <button
              type="button"
              className={`radio-pill ${item.type === 'business' ? 'is-active' : ''}`}
              onClick={() => updateItem(index, 'type', 'business')}
            >
              사업소득
            </button>
          </div>
          <div className="field-grid three-col">
            <label className="field">
              <span className="field-label">수입 항목 이름</span>
              <input
                type="text"
                placeholder={item.type === 'business' ? '예: 사업소득' : '예: 임대수입'}
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">연간 수입 금액</span>
              <div className="field-input-row">
                <FormattedNumberInput
                  type="number"
                  value={item.annual}
                  onChange={(e) => updateItem(index, 'annual', e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="field-unit">만원</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">월수입 흐름 향후 유지예상 기간</span>
              <div className="field-input-row">
                <FormattedNumberInput
                  type="number"
                  value={item.years}
                  onChange={(e) => updateItem(index, 'years', e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="field-unit">년</span>
              </div>
            </label>
          </div>
          <button type="button" className="repeatable-remove" onClick={() => removeItem(index)}>
            이 항목 삭제
          </button>
        </div>
      ))}

      <button type="button" className="repeatable-add" onClick={addItem}>
        + 수입 항목 추가
      </button>
    </div>
  );
}
