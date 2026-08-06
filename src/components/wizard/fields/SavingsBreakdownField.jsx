import { useState, Fragment } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatNumber } from '../../../utils/format';

const LIQUID_PRESET_KEYS = ['deposit', 'savings', 'emergencyFund'];
// pensionAssetsBreakdown의 숫자 항목만 명시적으로 나열한다(otherItems는 배열이라 합산 대상이 아님 -
// "기타" 총액은 이미 그 배열의 합으로 계산되어 있는 값이라 여기서 다시 더하면 이중 계산이 된다).
const PENSION_BREAKDOWN_NUMERIC_KEYS = ['variableAnnuity', 'pensionSavingsAccount', 'irp', 'other'];

// 저축 종류의 "현재까지 누적된 금액"이 "4. 자산" 파트의 어느 값과 연동되는지 계산한다(사용자 승인된 매핑:
// 적금→현금성자산 적금, 주식→금융자산 주식, ISA·청약·파킹통장→현금성자산의 "기본 항목 외 추가" 목록,
// 변액연금·연금저축·IRP→연금자산의 각 항목(자산 파트의 "연금자산"이 변액연금·연금저축계좌·IRP개인퇴직계좌·
// 기타 4개 버튼으로 나뉘어 있고, 앞의 3개는 저축 파트와 연동, "기타"만 자산 파트에서 직접 입력)). direct
// 대상(금융자산 주식)은 단일 필드라 항상 편집 가능하고, pensionBreakdown 대상(변액연금·연금저축·IRP)도
// 각자 자산 파트의 전용 항목에 바로 쓰므로(다른 종류와 필드를 공유하지 않음) 항상 편집 가능하다. 현금성
// 자산 쪽(liquidBreakdown·liquidCustomItem)은 "항목별로 자세히 입력" 모드일 때만 편집 가능하다 - "총액
// 한번에 입력" 모드에서는 총액을 항목별로 되돌려 나눌 방법이 없어 사용자가 직접 입력한 총액을 덮어쓰지
// 않기 위함이다.
function resolveAssetLink(formData, assetLink) {
  if (!assetLink) return null;

  if (assetLink.type === 'direct') {
    return { value: getIn(formData, assetLink.path), editable: true };
  }
  if (assetLink.type === 'pensionBreakdown') {
    return { value: getIn(formData, `assets.pensionAssetsBreakdown.${assetLink.field}`), editable: true };
  }

  const liquidMode = getIn(formData, 'assets.liquidAssets.inputMode') || 'simple';
  const editable = liquidMode === 'detailed';

  if (assetLink.type === 'liquidBreakdown') {
    return { value: getIn(formData, `assets.liquidAssets.breakdown.${assetLink.field}`), editable };
  }
  if (assetLink.type === 'liquidCustomItem') {
    const items = getIn(formData, 'assets.liquidAssets.customItems') || [];
    const item = items.find((it) => it.name === assetLink.name);
    return { value: item ? item.amount : '', editable };
  }
  return null;
}

function SavingsItemFields({ item, onChange, accumulated }) {
  return (
    <div className="field-grid three-col">
      <label className="field">
        <span className="field-label">월 저축액</span>
        <div className="field-input-row">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={item.monthly ?? ''}
            onChange={(e) => onChange('monthly', e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className="field-unit">만원</span>
        </div>
      </label>
      <label className="field">
        <span className="field-label">앞으로 저축할 개월수</span>
        <div className="field-input-row">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={item.remainingMonths ?? ''}
            onChange={(e) => onChange('remainingMonths', e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className="field-unit">개월</span>
        </div>
      </label>
      <label className="field">
        <span className="field-label">이자율</span>
        <div className="field-input-row">
          <input
            type="number"
            inputMode="numeric"
            value={item.interestRate ?? ''}
            onChange={(e) => onChange('interestRate', e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className="field-unit">%</span>
        </div>
      </label>
      <label className="field">
        <span className="field-label">현재까지 누적된 금액</span>
        <div className="field-input-row">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={accumulated.value ?? ''}
            readOnly={!accumulated.editable}
            onChange={accumulated.editable ? (e) => accumulated.onChange(e.target.value) : undefined}
          />
          <span className="field-unit">만원</span>
        </div>
        {accumulated.helper && <span className="field-helper">{accumulated.helper}</span>}
      </label>
    </div>
  );
}

/**
 * 저축 종류(적금·ISA·IRP 등)별로 월 저축액·앞으로 저축할 개월수·이자율·현재까지 누적된 금액을 각각
 * 입력받는 필드. 적금과 IRP처럼 저축 종류마다 남은 납입 기간·이자율·누적액이 서로 다를 수 있어
 * (DebtBreakdownField의 대출 종류별 상환기간·이자율 구조와 동일한 이유) 종류 전체에 하나의 값만
 * 두지 않는다. "현재까지 누적된 금액"은 categories[].assetLink로 지정된 "4. 자산" 필드와 완전히
 * 같은 값을 공유한다(resolveAssetLink 참고) - 별도로 합산·저장하지 않아 이중 계산 우려가 없다.
 * 총액으로 한번에 입력(simple) 모드에서는 월 저축액 합계만 입력받고, 항목별 모드(detailed)에서만
 * 종류별 상세 입력창을 펼쳐서 보여준다. 두 모드 모두 결과값은 totalPath(월 저축액 합계)에 저장되므로
 * 기존 계산 로직(assets.savingsPlan.monthly 기준)이 그대로 동작한다.
 */
export default function SavingsBreakdownField({ basePath, customPath, totalPath, annualPath, modePath, categories }) {
  const { formData, setField } = useFormData();
  const breakdown = getIn(formData, basePath) || {};
  const customItems = getIn(formData, customPath) || [];
  const mode = getIn(formData, modePath) || 'simple';

  const [openKeys, setOpenKeys] = useState(() => {
    const initial = new Set();
    categories.forEach((c) => {
      const item = breakdown[c.key] || {};
      if (Number(item.monthly) > 0) initial.add(c.key);
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
    const presetSum = categories.reduce((s, c) => s + (Number(nextBreakdown[c.key]?.monthly) || 0), 0);
    const customSum = nextCustomItems.reduce((s, item) => s + (Number(item.monthly) || 0), 0);
    const sum = presetSum + customSum;
    setField(totalPath, sum);
    if (annualPath) setField(annualPath, Math.round(sum * 12));
  };

  const handleTotalChange = (raw) => {
    const value = raw === '' ? '' : Number(raw);
    setField(totalPath, value);
    if (annualPath) setField(annualPath, value === '' ? '' : Math.round(value * 12));
  };

  const update = (key, field, value) => {
    const nextItem = { ...(breakdown[key] || {}), [field]: value };
    const nextBreakdown = { ...breakdown, [key]: nextItem };
    setField(`${basePath}.${key}.${field}`, value);
    recomputeTotal(nextBreakdown, customItems);
  };

  // 현금성 자산(적금 breakdown 항목 또는 ISA/청약/파킹통장 같은 커스텀 항목)의 총액을 재계산한다.
  const recomputeLiquidAssetsTotal = (nextLiquidBreakdown, nextLiquidCustomItems) => {
    const presetSum = LIQUID_PRESET_KEYS.reduce((s, k) => s + (Number(nextLiquidBreakdown[k]) || 0), 0);
    const customSum = nextLiquidCustomItems.reduce((s, item) => s + (Number(item.amount) || 0), 0);
    setField('assets.liquidAssets.total', presetSum + customSum);
  };

  const updateAccumulated = (assetLink, raw) => {
    const value = raw === '' ? '' : Number(raw);

    if (assetLink.type === 'direct') {
      setField(assetLink.path, value);
      return;
    }

    if (assetLink.type === 'pensionBreakdown') {
      const pensionBreakdown = getIn(formData, 'assets.pensionAssetsBreakdown') || {};
      const nextPensionBreakdown = { ...pensionBreakdown, [assetLink.field]: value };
      setField(`assets.pensionAssetsBreakdown.${assetLink.field}`, value);
      const pensionTotal = PENSION_BREAKDOWN_NUMERIC_KEYS.reduce((s, k) => s + (Number(nextPensionBreakdown[k]) || 0), 0);
      setField('assets.pensionAssets', pensionTotal);
      return;
    }

    const liquidBreakdown = getIn(formData, 'assets.liquidAssets.breakdown') || {};
    const liquidCustomItems = getIn(formData, 'assets.liquidAssets.customItems') || [];

    if (assetLink.type === 'liquidBreakdown') {
      const nextBreakdown = { ...liquidBreakdown, [assetLink.field]: value };
      setField(`assets.liquidAssets.breakdown.${assetLink.field}`, value);
      recomputeLiquidAssetsTotal(nextBreakdown, liquidCustomItems);
    } else if (assetLink.type === 'liquidCustomItem') {
      const idx = liquidCustomItems.findIndex((it) => it.name === assetLink.name);
      const nextCustomItems =
        idx >= 0
          ? liquidCustomItems.map((it, i) => (i === idx ? { ...it, amount: value } : it))
          : [...liquidCustomItems, { name: assetLink.name, amount: value }];
      setField('assets.liquidAssets.customItems', nextCustomItems);
      recomputeLiquidAssetsTotal(liquidBreakdown, nextCustomItems);
    }
  };

  const addCustomItem = () => {
    const next = [...customItems, { name: '', monthly: '', remainingMonths: '', interestRate: '', accumulated: '' }];
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

  const total = getIn(formData, totalPath);
  const annualTotal = annualPath ? getIn(formData, annualPath) : null;
  const openCategories = categories.filter((c) => openKeys.has(c.key));

  return (
    <div className="field">
      <span className="field-label">입력 방식을 선택해 주세요</span>
      <div className="radio-group" style={{ marginTop: 8, marginBottom: 14 }}>
        <button type="button" className={`radio-pill ${mode === 'simple' ? 'is-active' : ''}`} onClick={() => setField(modePath, 'simple')}>
          총액으로 한번에 입력
        </button>
        <button type="button" className={`radio-pill ${mode === 'detailed' ? 'is-active' : ''}`} onClick={() => setField(modePath, 'detailed')}>
          저축 종류별로 자세히 입력
        </button>
      </div>

      {mode === 'simple' ? (
        <div className="field-grid">
          <label className="field">
            <span className="field-label">월 저축액 합계</span>
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
          <span className="field-label">해당하는 저축 종류를 눌러 상세 내용을 입력해 주세요</span>
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
            const item = breakdown[c.key] || {};
            const resolved = resolveAssetLink(formData, c.assetLink);
            const accumulated = resolved
              ? {
                  value: resolved.value,
                  editable: resolved.editable,
                  helper: !resolved.editable
                    ? `자산 파트의 현금성 자산이 "항목별로 자세히 입력" 모드일 때 연동됩니다`
                    : `"4. 자산"의 ${c.assetLinkLabel}과 같은 값으로 연동됩니다`,
                  onChange: (raw) => updateAccumulated(c.assetLink, raw),
                }
              : { value: '', editable: false, helper: null, onChange: () => {} };
            return (
              <Fragment key={c.key}>
                <p className="field-label" style={{ marginTop: 14, marginBottom: 8 }}>{c.label}</p>
                <SavingsItemFields item={item} onChange={(field, value) => update(c.key, field, value)} accumulated={accumulated} />
              </Fragment>
            );
          })}

          <div className="repeatable-list" style={{ marginTop: 14 }}>
            <div className="repeatable-list-head">
              <span className="field-label">기본 항목 외 추가 저축</span>
            </div>
            {customItems.map((item, index) => (
              <div className="repeatable-item" key={index}>
                <label className="field" style={{ marginBottom: 10 }}>
                  <span className="field-label">저축 이름</span>
                  <input
                    type="text"
                    placeholder="예: 저축보험"
                    value={item.name}
                    onChange={(e) => updateCustomItem(index, 'name', e.target.value)}
                  />
                </label>
                <SavingsItemFields
                  item={item}
                  onChange={(field, value) => updateCustomItem(index, field, value)}
                  accumulated={{
                    value: item.accumulated,
                    editable: true,
                    helper: '자산 파트와 연동되지 않는 참고용 항목입니다',
                    onChange: (raw) => updateCustomItem(index, 'accumulated', raw === '' ? '' : Number(raw)),
                  }}
                />
                <button type="button" className="repeatable-remove" onClick={() => removeCustomItem(index)}>
                  이 항목 삭제
                </button>
              </div>
            ))}
            <button type="button" className="repeatable-add" onClick={addCustomItem}>
              + 저축 항목 추가
            </button>
          </div>

          <table className="grade-table compact" style={{ marginTop: 18 }}>
            <thead>
              <tr>
                <th>저축 종류</th>
                <th style={{ textAlign: 'right' }}>월 저축액</th>
                <th style={{ textAlign: 'right' }}>남은 개월수</th>
                <th style={{ textAlign: 'right' }}>이자율</th>
              </tr>
            </thead>
            <tbody>
              {openCategories.map((c) => {
                const item = breakdown[c.key] || {};
                return (
                  <tr key={c.key}>
                    <td>{c.label}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.monthly) || 0)}만원</td>
                    <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.remainingMonths) || 0)}개월</td>
                    <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.interestRate) || 0)}%</td>
                  </tr>
                );
              })}
              {customItems.map((item, i) => (
                <tr key={`custom-${i}`}>
                  <td>{item.name || '(이름 미입력)'}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.monthly) || 0)}만원</td>
                  <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.remainingMonths) || 0)}개월</td>
                  <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.interestRate) || 0)}%</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>합계</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatNumber(total || 0)}만원</td>
                <td className="num" style={{ textAlign: 'right' }}>-</td>
                <td className="num" style={{ textAlign: 'right' }}>-</td>
              </tr>
            </tbody>
          </table>
          <span className="field-helper">선택·추가하신 항목의 월 저축액을 자동으로 합산한 값입니다. 개월수·이자율·누적액은 항목별로 다를 수 있어 합산하지 않습니다.</span>
        </>
      )}

      {annualPath && (
        <p className="field-helper" style={{ marginTop: 10 }}>연 환산 {formatNumber(annualTotal || 0)}만원</p>
      )}
    </div>
  );
}
