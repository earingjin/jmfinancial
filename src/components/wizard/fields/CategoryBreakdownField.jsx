import { useState } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatWon } from '../../../utils/format';
import FormattedNumberInput from './FormattedNumberInput';
import TotalAmountBox from './TotalAmountBox';

/**
 * 항목 종류를 버튼(pill)으로 나열해 클릭한 종류만 금액 입력창을 펼쳐서 보여주는 필드.
 * 기본 제공 종류(categories) 외에 사용자가 이름을 직접 정해 추가할 수 있는 항목(customItems)도
 * 함께 지원한다. 결과값은 totalPath(예: assets.liquidAssets.total)에 저장되므로 기존 계산 로직
 * (합계 금액 기준)이 그대로 동작한다. 총액을 한 번에 입력하는 방식은 지원하지 않는다 - 항목별 금액이
 * 없으면 다른 필드(예: 저축 쪽의 "현재까지 누적된 금액")와 이름으로 연동할 방법이 없기 때문이다.
 * annualPath를 넘기면 총액×12(연 환산액)도 함께 자동 저장한다(월 단위 흐름에만 해당, 잔액성 항목은 생략).
 * 저축·현금성 자산 등 "기본 항목 + 자유 추가 항목" 구조가 필요한 곳에서 공통으로 재사용한다.
 */
export default function CategoryBreakdownField({
  basePath,
  customPath,
  totalPath,
  annualPath,
  categories,
  totalLabel = '합계',
  annualLabel = '연 합계',
  pillPrompt = '해당하는 항목을 누르면 상세한 지출항목을 입력할 수 있습니다.',
  customListLabel = '기본 항목 외 추가',
  customNameLabel = '이름',
  customNamePlaceholder = '예: 기타',
  customAmountLabel = '금액',
  addItemLabel = '항목 추가',
}) {
  const { formData, setField } = useFormData();
  const breakdown = getIn(formData, basePath) || {};
  const customItems = getIn(formData, customPath) || [];
  const total = getIn(formData, totalPath);
  const annualTotal = annualPath ? getIn(formData, annualPath) : null;

  const [openKeys, setOpenKeys] = useState(() => {
    const initial = new Set();
    categories.forEach((c) => {
      if (Number(breakdown[c.key]) > 0) initial.add(c.key);
    });
    return initial;
  });

  const toggle = (key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const recomputeTotal = (nextBreakdown, nextCustomItems) => {
    const presetSum = categories.reduce((s, c) => s + (Number(nextBreakdown[c.key]) || 0), 0);
    const customSum = nextCustomItems.reduce((s, item) => s + (Number(item.amount) || 0), 0);
    const sum = presetSum + customSum;
    setField(totalPath, sum);
    if (annualPath) setField(annualPath, Math.round(sum * 12));
  };

  const handleBreakdownChange = (key, raw) => {
    const value = raw === '' ? '' : Number(raw);
    const nextBreakdown = { ...breakdown, [key]: value };
    setField(`${basePath}.${key}`, value);
    recomputeTotal(nextBreakdown, customItems);
  };

  // pill을 다시 눌러 패널을 접기만 하면 입력창이 숨겨질 뿐 값은 그대로 남아 합계에 계속
  // 포함된다. "이 항목 삭제"는 값을 실제로 비우고 합계를 재계산한 뒤 패널도 닫는다.
  const removePresetItem = (key) => {
    const nextBreakdown = { ...breakdown, [key]: '' };
    setField(`${basePath}.${key}`, '');
    recomputeTotal(nextBreakdown, customItems);
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const addCustomItem = () => {
    const next = [...customItems, { name: '', amount: '' }];
    setField(customPath, next);
    recomputeTotal(breakdown, next);
  };

  const removeCustomItem = (index) => {
    const next = customItems.filter((_, i) => i !== index);
    setField(customPath, next);
    recomputeTotal(breakdown, next);
  };

  const updateCustomItem = (index, key, value) => {
    const next = customItems.map((item, i) => (i === index ? { ...item, [key]: value } : item));
    setField(customPath, next);
    recomputeTotal(breakdown, next);
  };

  const openCategories = categories.filter((c) => openKeys.has(c.key));

  return (
    <div className="field">
      <span className="field-label">{pillPrompt}</span>
      <div className="checkbox-group" style={{ marginTop: 8, marginBottom: 14 }}>
        {categories.map((c) => (
          <button
            type="button"
            key={c.key}
            className={`checkbox-pill ${openKeys.has(c.key) ? 'is-active' : ''}`}
            onClick={() => toggle(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {openCategories.length > 0 && (
        <div className="field-grid three-col">
          {openCategories.map((c) => (
            <label className="field" key={c.key}>
              <span className="field-label">{c.label}</span>
              <div className="field-input-row">
                <FormattedNumberInput
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={breakdown[c.key] ?? ''}
                  onChange={(e) => handleBreakdownChange(c.key, e.target.value)}
                />
                <span className="field-unit">만원</span>
              </div>
              <button type="button" className="repeatable-remove" onClick={() => removePresetItem(c.key)}>
                이 항목 삭제
              </button>
            </label>
          ))}
        </div>
      )}

      <div className="repeatable-list" style={{ marginTop: 14 }}>
        <div className="repeatable-list-head">
          <span className="field-label">{customListLabel}</span>
        </div>
        {customItems.map((item, index) => (
          <div className="repeatable-item" key={index}>
            <div className="field-grid three-col">
              <label className="field">
                <span className="field-label">{customNameLabel}</span>
                <input
                  type="text"
                  placeholder={customNamePlaceholder}
                  value={item.name}
                  onChange={(e) => updateCustomItem(index, 'name', e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{customAmountLabel}</span>
                <div className="field-input-row">
                  <FormattedNumberInput
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={item.amount ?? ''}
                    onChange={(e) => updateCustomItem(index, 'amount', e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  <span className="field-unit">만원</span>
                </div>
              </label>
            </div>
            <button type="button" className="repeatable-remove" onClick={() => removeCustomItem(index)}>
              이 항목 삭제
            </button>
          </div>
        ))}
        <button type="button" className="repeatable-add" onClick={addCustomItem}>
          + {addItemLabel}
        </button>
      </div>

      <table className="grade-table compact" style={{ marginTop: 16 }}>
        <thead>
          <tr><th>항목</th><th style={{ textAlign: 'right' }}>금액</th></tr>
        </thead>
        <tbody>
          {openCategories.map((c) => (
            <tr key={c.key}>
              <td>{c.label}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(Number(breakdown[c.key]) || 0)}</td>
            </tr>
          ))}
          {customItems.map((item, i) => (
            <tr key={`custom-${i}`}>
              <td>{item.name || '(이름 미입력)'}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(Number(item.amount) || 0)}</td>
            </tr>
          ))}
          {annualPath && (
            <tr className="total-row">
              <td>{annualLabel}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(annualTotal || 0)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <TotalAmountBox label={totalLabel} amount={Number(total) || 0} valueLabel="총액은" />
      <span className="field-helper">선택·추가하신 항목 금액을 자동으로 합산한 값입니다</span>
    </div>
  );
}
