import { useState, Fragment } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatNumber } from '../../../utils/format';

const monthlyBurdenOf = (item) =>
  (!item || item.repaymentType !== 'equalPrincipal' ? Number(item?.monthlyInterest) : Number(item?.monthlyRepayment)) || 0;

function LoanFields({ item, onChange }) {
  const repaymentType = item.repaymentType || 'interestOnly';
  return (
    <>
      <div className="radio-group" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className={`radio-pill ${repaymentType === 'interestOnly' ? 'is-active' : ''}`}
          onClick={() => onChange('repaymentType', 'interestOnly')}
        >
          만기일시상환(이자만 매월 부담)
        </button>
        <button
          type="button"
          className={`radio-pill ${repaymentType === 'equalPrincipal' ? 'is-active' : ''}`}
          onClick={() => onChange('repaymentType', 'equalPrincipal')}
        >
          원금균등상환(매월 동일 금액 상환)
        </button>
      </div>
      <div className="field-grid three-col">
        <label className="field">
          <span className="field-label">대출 원금</span>
          <div className="field-input-row">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={item.principal ?? ''}
              onChange={(e) => onChange('principal', e.target.value === '' ? '' : Number(e.target.value))}
            />
            <span className="field-unit">만원</span>
          </div>
        </label>
        {repaymentType === 'interestOnly' ? (
          <label className="field">
            <span className="field-label">월 이자 금액</span>
            <div className="field-input-row">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={item.monthlyInterest ?? ''}
                onChange={(e) => onChange('monthlyInterest', e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span className="field-unit">만원</span>
            </div>
          </label>
        ) : (
          <label className="field">
            <span className="field-label">월 상환 금액</span>
            <div className="field-input-row">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={item.monthlyRepayment ?? ''}
                onChange={(e) => onChange('monthlyRepayment', e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span className="field-unit">만원</span>
            </div>
          </label>
        )}
        <label className="field">
          <span className="field-label">상환 기간</span>
          <div className="field-input-row">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={item.months ?? ''}
              onChange={(e) => onChange('months', e.target.value === '' ? '' : Number(e.target.value))}
            />
            <span className="field-unit">개월</span>
          </div>
        </label>
      </div>
    </>
  );
}

/**
 * 총 부채잔액·월 상환액을 한 번에 입력(simple)하거나, 대출 종류를 버튼(pill)으로 나열해
 * 클릭한 종류만 상환방식·원금·월 상환액·상환기간 입력창을 펼쳐서 보여주는(detailed) 방식을
 * 사용자가 선택할 수 있는 필드. detailed 모드에서는 기본 제공 종류(categories) 외에 이름을
 * 직접 정해 추가할 수 있는 대출 항목(customItems)도 함께 지원한다. 두 모드 모두 결과값은
 * balanceTotalPath, repaymentTotalPath에 저장되므로 기존 계산 로직(assets.debtStatus.totalBalance /
 * monthlyRepayment 기준)이 그대로 동작한다. 대출 종류별로 한 곳에만 입력하면 되므로 이중 입력
 * 우려가 없다.
 */
export default function DebtBreakdownField({ basePath, customPath, balanceTotalPath, repaymentTotalPath, modePath, categories }) {
  const { formData, setField } = useFormData();
  const breakdown = getIn(formData, basePath) || {};
  const customItems = getIn(formData, customPath) || [];
  const mode = getIn(formData, modePath) || 'simple';

  const [openKeys, setOpenKeys] = useState(() => {
    const initial = new Set();
    categories.forEach((c) => {
      const item = breakdown[c.key] || {};
      if (Number(item.principal) > 0) initial.add(c.key);
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

  const recomputeTotals = (nextBreakdown, nextCustomItems) => {
    const balanceSum =
      categories.reduce((s, c) => s + (Number(nextBreakdown[c.key]?.principal) || 0), 0) +
      nextCustomItems.reduce((s, item) => s + (Number(item.principal) || 0), 0);
    const repaymentSum =
      categories.reduce((s, c) => s + monthlyBurdenOf(nextBreakdown[c.key]), 0) +
      nextCustomItems.reduce((s, item) => s + monthlyBurdenOf(item), 0);
    setField(balanceTotalPath, balanceSum);
    setField(repaymentTotalPath, repaymentSum);
  };

  const update = (key, field, value) => {
    const nextItem = { ...(breakdown[key] || { repaymentType: 'interestOnly' }), [field]: value };
    const nextBreakdown = { ...breakdown, [key]: nextItem };
    setField(`${basePath}.${key}.${field}`, value);
    recomputeTotals(nextBreakdown, customItems);
  };

  // pill을 다시 눌러 패널을 접기만 하면 입력창이 숨겨질 뿐 원금·상환액은 그대로 남아 합계에
  // 계속 포함된다. "이 항목 삭제"는 값을 실제로 비우고 합계를 재계산한 뒤 패널도 닫는다.
  const removePresetItem = (key) => {
    const emptyItem = { repaymentType: 'interestOnly', principal: '', monthlyInterest: '', monthlyRepayment: '', months: '' };
    const nextBreakdown = { ...breakdown, [key]: emptyItem };
    setField(`${basePath}.${key}`, emptyItem);
    recomputeTotals(nextBreakdown, customItems);
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const addCustomItem = () => {
    const next = [...customItems, { name: '', repaymentType: 'interestOnly', principal: '', monthlyInterest: '', monthlyRepayment: '', months: '' }];
    setField(customPath, next);
    recomputeTotals(breakdown, next);
  };

  const removeCustomItem = (index) => {
    const next = customItems.filter((_, i) => i !== index);
    setField(customPath, next);
    recomputeTotals(breakdown, next);
  };

  const updateCustomItem = (index, key, value) => {
    const next = customItems.map((item, i) => (i === index ? { ...item, [key]: value } : item));
    setField(customPath, next);
    recomputeTotals(breakdown, next);
  };

  const balanceTotal = getIn(formData, balanceTotalPath);
  const repaymentTotal = getIn(formData, repaymentTotalPath);
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
          대출별로 자세히 입력
        </button>
      </div>

      {mode === 'simple' ? (
        <div className="field-grid">
          <label className="field">
            <span className="field-label">총 부채잔액 합계</span>
            <div className="field-input-row">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={balanceTotal ?? ''}
                onChange={(e) => setField(balanceTotalPath, e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span className="field-unit">만원</span>
            </div>
          </label>
          <label className="field">
            <span className="field-label">매월 납입 원리금 상환액 합계</span>
            <div className="field-input-row">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={repaymentTotal ?? ''}
                onChange={(e) => setField(repaymentTotalPath, e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span className="field-unit">만원</span>
            </div>
          </label>
        </div>
      ) : (
        <>
          <span className="field-label">해당하는 대출 종류를 눌러 상세 내용을 입력해 주세요</span>
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

          {openCategories.map((c) => {
            const item = breakdown[c.key] || { repaymentType: 'interestOnly' };
            return (
              <Fragment key={c.key}>
                <p className="field-label" style={{ marginTop: 14, marginBottom: 8 }}>{c.label}</p>
                <LoanFields item={item} onChange={(field, value) => update(c.key, field, value)} />
                <button type="button" className="repeatable-remove" onClick={() => removePresetItem(c.key)}>
                  이 항목 삭제
                </button>
              </Fragment>
            );
          })}

          <div className="repeatable-list" style={{ marginTop: 14 }}>
            <div className="repeatable-list-head">
              <span className="field-label">기본 항목 외 추가 대출</span>
            </div>
            {customItems.map((item, index) => (
              <div className="repeatable-item" key={index}>
                <label className="field" style={{ marginBottom: 10 }}>
                  <span className="field-label">대출 이름</span>
                  <input
                    type="text"
                    placeholder="예: 신용대출"
                    value={item.name}
                    onChange={(e) => updateCustomItem(index, 'name', e.target.value)}
                  />
                </label>
                <LoanFields item={item} onChange={(field, value) => updateCustomItem(index, field, value)} />
                <button type="button" className="repeatable-remove" onClick={() => removeCustomItem(index)}>
                  이 항목 삭제
                </button>
              </div>
            ))}
            <button type="button" className="repeatable-add" onClick={addCustomItem}>
              + 대출 항목 추가
            </button>
          </div>

          <table className="grade-table compact" style={{ marginTop: 18 }}>
            <thead>
              <tr><th>대출 종류</th><th style={{ textAlign: 'right' }}>원금</th><th style={{ textAlign: 'right' }}>월 상환부담</th></tr>
            </thead>
            <tbody>
              {openCategories.map((c) => {
                const item = breakdown[c.key] || {};
                return (
                  <tr key={c.key}>
                    <td>{c.label}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.principal) || 0)}만원</td>
                    <td className="num" style={{ textAlign: 'right' }}>{formatNumber(monthlyBurdenOf(item))}만원</td>
                  </tr>
                );
              })}
              {customItems.map((item, i) => (
                <tr key={`custom-${i}`}>
                  <td>{item.name || '(이름 미입력)'}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.principal) || 0)}만원</td>
                  <td className="num" style={{ textAlign: 'right' }}>{formatNumber(monthlyBurdenOf(item))}만원</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>합계</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatNumber(balanceTotal || 0)}만원</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatNumber(repaymentTotal || 0)}만원</td>
              </tr>
            </tbody>
          </table>
          <span className="field-helper">선택·추가하신 항목의 대출 원금·월 이자·상환액을 자동으로 합산한 값입니다</span>
        </>
      )}
    </div>
  );
}
