import { useState } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

/**
 * 총액을 한 번에 입력(simple)하거나, 세부 항목을 버튼(pill)으로 나열해 클릭한 항목만
 * 금액 입력창을 펼쳐서 보여주는(detailed) 방식을 사용자가 선택할 수 있는 필드.
 * 두 모드 모두 결과값은 totalPath(예: assets.currentLivingCost.monthly)에 저장되므로
 * 기존 계산 로직(합계 금액 기준)이 그대로 동작한다.
 * annualPath를 넘기면 월 합계×12(연 환산액)도 함께 자동 저장한다.
 */
export default function ExpenseBreakdownField({
  basePath,
  totalPath,
  annualPath,
  modePath,
  categories,
  totalLabel = '월 합계',
  annualLabel = '연 합계',
}) {
  const { formData, setField } = useFormData();
  const breakdown = getIn(formData, basePath) || {};
  const total = getIn(formData, totalPath);
  const annualTotal = annualPath ? getIn(formData, annualPath) : null;
  const mode = getIn(formData, modePath) || 'simple';

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

  const handleBreakdownChange = (key, raw) => {
    const value = raw === '' ? '' : Number(raw);
    const nextBreakdown = { ...breakdown, [key]: value };
    setField(`${basePath}.${key}`, value);
    const sum = categories.reduce((s, c) => s + (Number(nextBreakdown[c.key]) || 0), 0);
    setField(totalPath, sum);
    if (annualPath) setField(annualPath, Math.round(sum * 12));
  };

  const handleTotalChange = (raw) => {
    const value = raw === '' ? '' : Number(raw);
    setField(totalPath, value);
    if (annualPath) setField(annualPath, value === '' ? '' : Math.round(value * 12));
  };

  const openCategories = categories.filter((c) => openKeys.has(c.key));

  return (
    <div className="field">
      <span className="field-label">입력 방식을 선택해 주세요</span>
      <div className="radio-group" style={{ marginTop: 8, marginBottom: 14 }}>
        <button
          type="button"
          className={`radio-pill ${mode === 'simple' ? 'is-active' : ''}`}
          onClick={() => setField(modePath, 'simple')}
        >
          총액으로 한번에 입력
        </button>
        <button
          type="button"
          className={`radio-pill ${mode === 'detailed' ? 'is-active' : ''}`}
          onClick={() => setField(modePath, 'detailed')}
        >
          항목별로 자세히 입력
        </button>
      </div>

      {mode === 'simple' ? (
        <div className="field-grid">
          <label className="field">
            <span className="field-label">{totalLabel}</span>
            <div className="field-input-row">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={total ?? ''}
                onChange={(e) => handleTotalChange(e.target.value)}
              />
              <span className="field-unit">만원</span>
            </div>
          </label>
        </div>
      ) : (
        <>
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

          {openCategories.length > 0 && (
            <div className="field-grid three-col">
              {openCategories.map((c) => (
                <label className="field" key={c.key}>
                  <span className="field-label">{c.label}</span>
                  <div className="field-input-row">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={breakdown[c.key] ?? ''}
                      onChange={(e) => handleBreakdownChange(c.key, e.target.value)}
                    />
                    <span className="field-unit">만원</span>
                  </div>
                </label>
              ))}
            </div>
          )}

          <table className="grade-table compact" style={{ marginTop: 16 }}>
            <thead>
              <tr><th>항목</th><th style={{ textAlign: 'right' }}>금액</th></tr>
            </thead>
            <tbody>
              {openCategories.map((c) => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{Number(breakdown[c.key]) || 0}만원</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>{totalLabel}</td>
                <td className="num" style={{ textAlign: 'right' }}>{total || 0}만원</td>
              </tr>
              {annualPath && (
                <tr className="total-row">
                  <td>{annualLabel}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{annualTotal || 0}만원</td>
                </tr>
              )}
            </tbody>
          </table>
          <span className="field-helper">선택하신 항목 금액을 자동으로 합산한 값입니다</span>
        </>
      )}
    </div>
  );
}
