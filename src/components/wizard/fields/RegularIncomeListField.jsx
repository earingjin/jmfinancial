import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import FormattedNumberInput from './FormattedNumberInput';

/**
 * 기타 정기수입(임대수입 등)을 본인·배우자 구분 없이 하나의 목록에서 입력받는 필드.
 * 기존 사업소득 데이터는 그대로 두고, 새로 추가하거나 수정하는 항목만 기타 수입으로 반영한다.
 */
export default function RegularIncomeListField({ path, otherIncomesPath }) {
  const { formData, setField } = useFormData();
  const items = getIn(formData, path) || [];

  const sync = (nextItems) => {
    setField(path, nextItems);
    const otherItems = nextItems.filter((i) => i.type !== 'business');
    setField(otherIncomesPath, otherItems);
  };

  const addItem = () => sync([...items, { type: 'other', name: '', annual: '', years: '' }]);
  const removeItem = (index) => sync(items.filter((_, i) => i !== index));
  const updateItem = (index, key, value) => sync(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

  return (
    <div className="repeatable-list">
      <div className="repeatable-list-head">
        <span className="field-label">급여·연금 외 정기적으로 들어오는 수입 (임대수입, 배당수입 등)</span>
      </div>

      {items.map((item, index) => item.type !== 'business' && (
        <div className="repeatable-item" key={index}>
          <div className="field-grid three-col">
            <label className="field">
              <span className="field-label">수입 항목 이름</span>
              <input
                type="text"
                placeholder="예: 임대수입, 배당수입 등"
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">연간 수입 금액</span>
              <div className="field-input-row">
                <FormattedNumberInput
                  type="number"
                  min={0}
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
