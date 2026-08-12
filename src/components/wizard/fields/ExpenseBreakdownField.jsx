import { useState, useEffect } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatNumber } from '../../../utils/format';
import FormattedNumberInput from './FormattedNumberInput';
import RepeatableList from './RepeatableList';

/**
 * 세부 항목을 버튼(pill)으로 나열해 클릭한 항목만 금액 입력창을 펼쳐서 보여주는 필드.
 * key가 'other'인 항목은 단일 금액 입력이 아니라 종류별(name+amount) 반복 입력 목록으로
 * 보여주고, 그 합계만 그대로 basePath.other에 반영한다("기타 금융자산" 등과 동일한 패턴).
 * 결과값은 totalPath(예: assets.currentLivingCost.monthly)에 저장되므로 기존 계산
 * 로직(합계 금액 기준)은 그대로 동작한다. annualPath를 넘기면 월 합계×12(연 환산액)도
 * 함께 자동 저장한다.
 */
export default function ExpenseBreakdownField({
  basePath,
  totalPath,
  annualPath,
  categories,
  totalLabel = '월 합계',
  annualLabel = '연 합계',
}) {
  const { formData, setField } = useFormData();
  const breakdown = getIn(formData, basePath) || {};
  const total = getIn(formData, totalPath);
  const annualTotal = annualPath ? getIn(formData, annualPath) : null;

  const [openKeys, setOpenKeys] = useState(() => {
    const otherItemsInit = getIn(formData, `${basePath}.otherItems`) || [];
    const initial = new Set();
    categories.forEach((c) => {
      if (c.key === 'other') {
        if (otherItemsInit.length > 0 || Number(breakdown.other) > 0) initial.add(c.key);
      } else if (Number(breakdown[c.key]) > 0) {
        initial.add(c.key);
      }
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

  const recomputeTotal = (nextBreakdown) => {
    const sum = categories.reduce((s, c) => s + (Number(nextBreakdown[c.key]) || 0), 0);
    setField(totalPath, sum);
    if (annualPath) setField(annualPath, Math.round(sum * 12));
  };

  const handleBreakdownChange = (key, raw) => {
    const value = raw === '' ? '' : Number(raw);
    const nextBreakdown = { ...breakdown, [key]: value };
    setField(`${basePath}.${key}`, value);
    recomputeTotal(nextBreakdown);
  };

  const handleTotalChange = (raw) => {
    const value = raw === '' ? '' : Number(raw);
    setField(totalPath, value);
    if (annualPath) setField(annualPath, value === '' ? '' : Math.round(value * 12));
  };

  // pill을 다시 눌러 패널을 접기만 하면 입력창이 숨겨질 뿐 값은 그대로 남아 합계에 계속
  // 포함된다. "이 항목 삭제"는 값을 실제로 비우고 합계를 재계산한 뒤 패널도 닫는다.
  const removePresetItem = (key) => {
    const nextBreakdown = { ...breakdown, [key]: '' };
    setField(`${basePath}.${key}`, '');
    recomputeTotal(nextBreakdown);
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // "기타" 항목은 종류별(name)로 나눠 입력받고, 합계만 basePath.other에 반영한다.
  // 그 합계 변경이 다시 전체 항목 합계(totalPath)에도 반영되도록 함께 재계산한다.
  const otherItemsPath = `${basePath}.otherItems`;
  const otherItems = getIn(formData, otherItemsPath) || [];
  const otherTotal = otherItems.reduce((s, item) => s + (Number(item.amount) || 0), 0);

  useEffect(() => {
    if (Number(breakdown.other) === otherTotal) return;
    setField(`${basePath}.other`, otherTotal);
    recomputeTotal({ ...breakdown, other: otherTotal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherTotal]);

  const openCategories = categories.filter((c) => openKeys.has(c.key));
  const openNumberCategories = openCategories.filter((c) => c.key !== 'other');

  return (
    <div className="field">
      <label className="field" style={{ marginBottom: 16 }}>
        <span className="field-label">현재 월 생활비</span>
        <div className="field-input-row">
          <FormattedNumberInput
            type="number"
            min={0}
            inputMode="numeric"
            value={total ?? ''}
            onChange={(e) => handleTotalChange(e.target.value)}
          />
          <span className="field-unit">만원</span>
        </div>
        <span className="field-helper">세부 항목 버튼을 선택하지 않고 월 생활비 총액만 입력할 수 있습니다</span>
      </label>
      <span className="field-label">해당하는 항목을 눌러 금액을 입력해 주세요</span>
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

      {openNumberCategories.length > 0 && (
        <div className="field-grid three-col">
          {openNumberCategories.map((c) => (
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

      {openKeys.has('other') && (
        <RepeatableList
          path={otherItemsPath}
          label="기타지출 세부 항목"
          addLabel="기타지출 추가"
          emptyItem={{ name: '', amount: '' }}
          renderItem={(item, _i, update) => (
            <div className="field-grid three-col">
              <label className="field">
                <span className="field-label">종류</span>
                <input type="text" placeholder="예: 반려동물 비용" value={item.name} onChange={(e) => update('name', e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">금액</span>
                <div className="field-input-row">
                  <FormattedNumberInput value={item.amount} onChange={(e) => update('amount', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
            </div>
          )}
        />
      )}

      {openCategories.length > 0 && (
        <table className="grade-table compact" style={{ marginTop: 16 }}>
          <thead>
            <tr><th>항목</th><th style={{ textAlign: 'right' }}>금액</th></tr>
          </thead>
          <tbody>
            {openCategories.map((c) => (
              <tr key={c.key}>
                <td>{c.label}</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(breakdown[c.key]) || 0)}만원</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>{totalLabel}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatNumber(total || 0)}만원</td>
            </tr>
            {annualPath && (
              <tr className="total-row">
                <td>{annualLabel}</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatNumber(annualTotal || 0)}만원</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      {openCategories.length > 0 && (
        <span className="field-helper">선택하신 항목 금액을 자동으로 합산한 값입니다</span>
      )}
    </div>
  );
}
