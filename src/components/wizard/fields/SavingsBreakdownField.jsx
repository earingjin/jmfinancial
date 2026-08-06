import { useState, Fragment } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatNumber } from '../../../utils/format';

// Step4Assets.jsx의 LIQUID_ASSET_CATEGORIES(assets.liquidAssets.breakdown)와 반드시 동일한 키
// 목록을 유지한다 - 여기 없는 항목이 있으면 저축 쪽에서 다른 항목을 수정할 때마다 그 항목 금액이
// 총액 재계산에서 빠져 조용히 0으로 취급된다.
const LIQUID_PRESET_KEYS = ['deposit', 'savings', 'cma', 'emergencyFund'];
// pensionAssetsBreakdown의 숫자 항목만 명시적으로 나열한다(otherItems는 배열이라 합산 대상이 아님 -
// "기타" 총액은 이미 그 배열의 합으로 계산되어 있는 값이라 여기서 다시 더하면 이중 계산이 된다).
const PENSION_BREAKDOWN_NUMERIC_KEYS = ['variableAnnuity', 'pensionSavingsAccount', 'irp', 'other'];

// 저축 종류의 "현재까지 누적된 금액"이 "4. 자산" 파트의 어느 값과 연동되는지 계산한다(사용자 승인된 매핑:
// 적금→현금성자산 적금, 주식→금융자산 주식, ISA·청약·파킹통장→현금성자산의 "기본 항목 외 추가" 목록,
// 변액연금·연금저축·IRP→연금자산의 각 항목(자산 파트의 "연금자산"이 변액연금·연금저축계좌·IRP개인퇴직계좌·
// 기타 4개 버튼으로 나뉘어 있고, 앞의 3개는 저축 파트와 연동, "기타"만 자산 파트에서 직접 입력)). 기본 항목
// 외 추가한 커스텀 저축 항목도 같은 방식(liquidCustomItem)으로, 사용자가 입력한 이름 그대로 현금성 자산의
// "기본 항목 외 추가" 목록과 연동된다. 현금성 자산 쪽(CategoryBreakdownField)도 항목별 입력만 지원하므로
// (총액 한번에 입력 모드 없음) 모든 연동 대상이 항상 편집 가능하다.
function resolveAssetLink(formData, assetLink) {
  if (!assetLink) return null;

  if (assetLink.type === 'direct') {
    return { value: getIn(formData, assetLink.path), editable: true };
  }
  if (assetLink.type === 'pensionBreakdown') {
    return { value: getIn(formData, `assets.pensionAssetsBreakdown.${assetLink.field}`), editable: true };
  }
  if (assetLink.type === 'liquidBreakdown') {
    return { value: getIn(formData, `assets.liquidAssets.breakdown.${assetLink.field}`), editable: true };
  }
  if (assetLink.type === 'liquidCustomItem') {
    const items = getIn(formData, 'assets.liquidAssets.customItems') || [];
    const item = items.find((it) => it.name === assetLink.name);
    return { value: item ? item.amount : '', editable: true };
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
 * 두지 않는다. "현재까지 누적된 금액"은 categories[].assetLink(기본 항목) 또는 이름 기반
 * liquidCustomItem 연동(기본 항목 외 추가 항목)으로 지정된 "4. 자산" 필드와 완전히 같은 값을
 * 공유한다(resolveAssetLink 참고) - 별도로 합산·저장하지 않아 이중 계산 우려가 없다. 종류별로
 * 자세히 입력하는 방식만 지원한다(총액을 한 번에 입력하는 방식은 항목별 상세 정보(개월수·이자율·
 * 누적액)를 받을 수 없어 제거됨). 결과값은 totalPath(월 저축액 합계)에 저장되므로 기존 계산 로직
 * (assets.savingsPlan.monthly 기준)이 그대로 동작한다.
 */
export default function SavingsBreakdownField({ basePath, customPath, totalPath, annualPath, categories }) {
  const { formData, setField } = useFormData();
  const breakdown = getIn(formData, basePath) || {};
  const customItems = getIn(formData, customPath) || [];

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

  const update = (key, field, value) => {
    const nextItem = { ...(breakdown[key] || {}), [field]: value };
    const nextBreakdown = { ...breakdown, [key]: nextItem };
    setField(`${basePath}.${key}.${field}`, value);
    recomputeTotal(nextBreakdown, customItems);
  };

  // 한 번 선택해 값을 입력한 기본 항목(적금·ISA 등)을 다시 비워 초기 상태로 되돌린다 - 패널을
  // 접는 것과 별개로, 입력해둔 월 저축액·개월수·이자율·누적금액을 실제로 지운다. 연동된 자산 값도
  // 함께 지워야(updateAccumulated) "4. 자산" 쪽에 옛 값이 그대로 남아있는 일이 없다.
  const removePresetItem = (key, assetLink) => {
    const emptyItem = { monthly: '', remainingMonths: '', interestRate: '' };
    const nextBreakdown = { ...breakdown, [key]: emptyItem };
    setField(`${basePath}.${key}`, emptyItem);
    recomputeTotal(nextBreakdown, customItems);
    if (assetLink) updateAccumulated(assetLink, '');
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // 현금성 자산(적금 breakdown 항목 또는 ISA/청약/파킹통장/커스텀 항목 같은 이름 기반 항목)의
  // 총액을 재계산한다.
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
    const next = [...customItems, { name: '', monthly: '', remainingMonths: '', interestRate: '' }];
    setField(customPath, next);
    recomputeTotal(breakdown, next);
  };

  const removeCustomItem = (index) => {
    const next = customItems.filter((_, i) => i !== index);
    setField(customPath, next);
    recomputeTotal(breakdown, next);
  };

  // 커스텀 저축 항목의 이름이 바뀌면, 그 이름으로 연동되어 있던 현금성 자산의 "기본 항목 외 추가"
  // 항목도 같은 이름으로 옮겨준다 - 그렇지 않으면 이름을 바꾸는 순간 기존에 입력해둔 누적금액과의
  // 연동이 끊겨(옛 이름 항목만 남고) 누적금액이 사라진 것처럼 보인다.
  const renameLinkedLiquidCustomItem = (oldName, newName) => {
    if (!oldName || oldName === newName) return;
    const liquidCustomItems = getIn(formData, 'assets.liquidAssets.customItems') || [];
    const idx = liquidCustomItems.findIndex((it) => it.name === oldName);
    if (idx < 0) return;
    const nextLiquidCustomItems = liquidCustomItems.map((it, i) => (i === idx ? { ...it, name: newName } : it));
    setField('assets.liquidAssets.customItems', nextLiquidCustomItems);
  };

  const updateCustomItem = (index, key, value) => {
    if (key === 'name') renameLinkedLiquidCustomItem(customItems[index]?.name, value);
    const next = customItems.map((item, i) => (i === index ? { ...item, [key]: value } : item));
    setField(customPath, next);
    recomputeTotal(breakdown, next);
  };

  const total = getIn(formData, totalPath);
  const annualTotal = annualPath ? getIn(formData, annualPath) : null;
  const openCategories = categories.filter((c) => openKeys.has(c.key));

  return (
    <div className="field">
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
              helper: `"4. 자산"의 ${c.assetLinkLabel}과 같은 값으로 연동됩니다`,
              onChange: (raw) => updateAccumulated(c.assetLink, raw),
            }
          : { value: '', editable: false, helper: null, onChange: () => {} };
        return (
          <Fragment key={c.key}>
            <p className="field-label" style={{ marginTop: 14, marginBottom: 8 }}>{c.label}</p>
            <SavingsItemFields item={item} onChange={(field, value) => update(c.key, field, value)} accumulated={accumulated} />
            <button type="button" className="repeatable-remove" onClick={() => removePresetItem(c.key, c.assetLink)}>
              이 항목 삭제
            </button>
          </Fragment>
        );
      })}

      <div className="repeatable-list" style={{ marginTop: 14 }}>
        <div className="repeatable-list-head">
          <span className="field-label">기본 항목 외 추가 저축</span>
        </div>
        {customItems.map((item, index) => {
          const hasName = !!item.name;
          const resolved = hasName ? resolveAssetLink(formData, { type: 'liquidCustomItem', name: item.name }) : null;
          const accumulated = resolved
            ? {
                value: resolved.value,
                editable: resolved.editable,
                helper: `"4. 자산"의 현금성 자산 > "${item.name}" 추가 항목과 같은 값으로 연동됩니다`,
                onChange: (raw) => updateAccumulated({ type: 'liquidCustomItem', name: item.name }, raw),
              }
            : {
                value: '',
                editable: false,
                helper: '저축 이름을 입력하면 "4. 자산"의 현금성 자산과 연동됩니다',
                onChange: () => {},
              };
          return (
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
                accumulated={accumulated}
              />
              <button type="button" className="repeatable-remove" onClick={() => removeCustomItem(index)}>
                이 항목 삭제
              </button>
            </div>
          );
        })}
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

      {annualPath && (
        <p className="field-helper" style={{ marginTop: 10 }}>연 환산 {formatNumber(annualTotal || 0)}만원</p>
      )}
    </div>
  );
}
