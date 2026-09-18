import { useEffect, useRef, useState, Fragment } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn, setIn } from '../../../state/pathUtils';
import { formatNumber, formatWon } from '../../../utils/format';
import FormattedNumberInput from './FormattedNumberInput';
import TotalAmountBox from './TotalAmountBox';
import { ConfirmModal } from '../../common/AppDialog';
import {
  createSavingsDiagnosticItemId,
  logSavingsDiagnostic,
  savingsDiagnosticsEnabled,
} from './savingsDiagnostics';

// Step4Assets.jsx의 LIQUID_ASSET_CATEGORIES(assets.liquidAssets.breakdown)와 반드시 동일한 키
// 목록을 유지한다 - 여기 없는 항목이 있으면 저축 쪽에서 다른 항목을 수정할 때마다 그 항목 금액이
// 총액 재계산에서 빠져 조용히 0으로 취급된다.
const LIQUID_PRESET_KEYS = ['deposit', 'savings', 'cma', 'subscription', 'emergencyFund'];
const FINANCIAL_DETAIL_KEYS = ['stocks', 'funds', 'bonds'];
const PENSION_DETAIL_KEYS = ['variableAnnuity', 'pensionSavingsAccount', 'irp', 'selfRetirementPension'];
export const DUPLICATE_SAVINGS_NAME_ERROR = '이미 기본 항목에 있는 저축 이름입니다. 다른 저축을 추가하려면 이름을 변경해 주세요.';
export const REQUIRED_SAVINGS_NAME_ERROR = '저축 이름을 입력해 주세요.';
export const AMBIGUOUS_SAVINGS_ASSET_ERROR = '같은 이름의 자산이 여러 개 있어 이름을 안전하게 변경할 수 없습니다.';

// oxlint-disable-next-line react/only-export-components
export function normalizeSavingsName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// 기본 항목의 실제 라벨은 호출부가 전달한 categories를 그대로 사용한다. 별도의 예약어 목록을
// 만들지 않아 화면의 기본 항목 정의와 중복 검증이 어긋나지 않게 한다.
// oxlint-disable-next-line react/only-export-components
export function getCustomSavingsNameError({ value, index, nameEdits, items, categories, formData }) {
  const normalized = normalizeSavingsName(value);
  if (normalized === '') return REQUIRED_SAVINGS_NAME_ERROR;
  if (categories.some((category) => normalizeSavingsName(category.label) === normalized)) {
    return DUPLICATE_SAVINGS_NAME_ERROR;
  }
  const duplicatesCustom = items.some((item, itemIndex) => {
    if (itemIndex === index) return false;
    const storedOtherName = normalizeSavingsName(item.name);
    const draftOtherName = nameEdits[itemIndex]?.edited
      ? normalizeSavingsName(nameEdits[itemIndex].value)
      : storedOtherName;
    return storedOtherName === normalized || draftOtherName === normalized;
  });
  if (duplicatesCustom) return DUPLICATE_SAVINGS_NAME_ERROR;

  const storedName = items[index]?.name || '';
  if (storedName && storedName !== value) {
    const assets = getIn(formData, 'assets.liquidAssets.customItems') || [];
    if (assets.filter((asset) => asset.name === storedName).length > 1) return AMBIGUOUS_SAVINGS_ASSET_ERROR;
  }
  return null;
}

// oxlint-disable-next-line react/only-export-components
export function initialCustomSavingsNameState(items) {
  return items.map((item) => ({ value: item.name || '', edited: false, composing: false }));
}

// oxlint-disable-next-line react/only-export-components
export function commitCustomSavingsNameData({ formData, customPath, index, value }) {
  const items = getIn(formData, customPath) || [];
  const storedName = items[index]?.name || '';
  if (storedName === value) return formData;

  const assets = getIn(formData, 'assets.liquidAssets.customItems') || [];
  const matchingIndexes = storedName ? assets.reduce((indexes, asset, assetIndex) => (
    asset.name === storedName ? [...indexes, assetIndex] : indexes
  ), []) : [];
  if (matchingIndexes.length > 1) return formData;

  let next = setIn(formData, customPath, items.map((item, itemIndex) => (
    itemIndex === index ? { ...item, name: value } : item
  )));
  if (!storedName) return next;
  if (matchingIndexes.length !== 1) return next;
  next = setIn(next, 'assets.liquidAssets.customItems', assets.map((asset, assetIndex) => (
    assetIndex === matchingIndexes[0] ? { ...asset, name: value } : asset
  )));
  return next;
}

// oxlint-disable-next-line react/only-export-components
export function CustomSavingsNameField({
  index, value, error, onChange, onBlur, onCompositionStart, onCompositionEnd, savingsDiagnostic,
}) {
  return <label className="field" style={{ marginBottom: 10 }}>
    <span className="field-label">저축 이름</span>
    <input
      type="text"
      name={`savings-custom-name-${index}`}
      autoComplete="off"
      placeholder="예: 저축보험"
      value={value}
      id={`assets.savingsPlan.customItems.${index}.name`}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `savings-custom-name-error-${index}` : undefined}
      onChange={(event) => {
        if (savingsDiagnostic) logSavingsDiagnostic('name_native_change', savingsDiagnostic);
        onChange(event.target.value);
      }}
      onBlur={(event) => {
        if (savingsDiagnostic) logSavingsDiagnostic('name_native_blur', savingsDiagnostic);
        onBlur(event);
      }}
      onCompositionStart={(event) => {
        if (savingsDiagnostic) logSavingsDiagnostic('name_composition_start', savingsDiagnostic);
        onCompositionStart(event);
      }}
      onCompositionEnd={(event) => {
        if (savingsDiagnostic) logSavingsDiagnostic('name_composition_end', savingsDiagnostic);
        onCompositionEnd(event.currentTarget.value);
      }}
    />
    {error && <span
      id={`savings-custom-name-error-${index}`}
      className="field-helper"
      style={{ color: 'var(--red)' }}
      role="alert"
    >{error}</span>}
  </label>;
}

// 저축 종류의 "현재까지 누적된 금액"이 "4. 자산" 파트의 어느 값과 연동되는지 계산한다(사용자 승인된 매핑:
// 적금→현금성자산 적금, 주식→금융자산 주식, ISA·청약·파킹통장→현금성자산의 "기본 항목 외 추가" 목록,
// 변액연금·연금저축·IRP→연금자산의 각 항목(자산 파트의 "연금자산"이 변액연금·연금저축계좌·IRP개인퇴직계좌·
// 기타 4개 버튼으로 나뉘어 있고, 앞의 3개는 저축 파트와 연동, "기타"만 자산 파트에서 직접 입력)). 기본 항목
// 외 추가한 커스텀 저축 항목도 같은 방식(liquidCustomItem)으로, 사용자가 입력한 이름 그대로 현금성 자산의
// "기본 항목 외 추가" 목록과 연동된다. 현금성 자산 쪽(CategoryBreakdownField)도 항목별 입력만 지원하므로
// (총액 한번에 입력 모드 없음) 모든 연동 대상이 항상 편집 가능하다.
// 저축 카테고리 버튼(적금·ISA 등)의 "선택" 상태 - openKeys(로컬 React 상태, 패널을 접고 펼치는
// 화면 전용 상태)와 완전히 분리해 formData(selectedCategories)에 저장한다. selectedCategories가
// 명시적으로 배열이면(빈 배열 포함) 그것만 신뢰하고, 배열이 아니면(이 필드 자체가 없던 과거 저장
// 데이터) 기존처럼 월 저축액이 양수인 항목만 선택된 것으로 복원한다 - 과거 사용자의 저축 항목이
// 갑자기 화면에서 사라지지 않게 하기 위함이다. api/_lib/validate.js·wizardRequiredFields.js도
// 동일한 규칙을 각자 독립적으로 구현해 서버가 이 판정을 프론트(openKeys)에 의존하지 않게 한다.
// oxlint-disable-next-line react/only-export-components
export function isCategorySelected(selectedCategories, breakdown, key) {
  if (Array.isArray(selectedCategories)) return selectedCategories.includes(key);
  return Number(breakdown?.[key]?.monthly) > 0;
}

// oxlint-disable-next-line react/only-export-components
export function selectedKeysFrom(selectedCategories, breakdown, categoryKeys) {
  return categoryKeys.filter((key) => isCategorySelected(selectedCategories, breakdown, key));
}

const isBlank = (value) => value === '' || value == null;

const canActivateLinkedDetailed = ({ mode, simpleInputStored, total, simpleTotal, value }) => (
  mode === 'simple'
  && simpleInputStored !== true
  && isBlank(total)
  && isBlank(simpleTotal)
  && value !== ''
);

// 저축의 주식 누적액은 금융자산 상세값과 같은 필드를 공유한다. 보호할 간편 총액이 없는
// 신규 상태에서만 상세입력을 활성화하고, 그 외에는 기존 간편 총액을 그대로 보존한다.
// oxlint-disable-next-line react/only-export-components
export function updateDirectLinkedAsset(formData, setField, path, raw) {
  const value = raw === '' ? '' : Number(raw);
  setField(path, value);

  if (path !== 'assets.financialAssets.stocks') return;

  const financial = getIn(formData, 'assets.financialAssets') || {};
  const nextFinancial = { ...financial, stocks: value };
  const otherItems = Array.isArray(financial.otherItems) ? financial.otherItems : [];
  const hasDetailedInput = FINANCIAL_DETAIL_KEYS.some((key) => !isBlank(nextFinancial[key]))
    || otherItems.some((item) => !isBlank(item?.amount));
  const detailedTotal = FINANCIAL_DETAIL_KEYS.reduce(
    (total, key) => total + (Number(nextFinancial[key]) || 0),
    0
  ) + otherItems.reduce((total, item) => total + (Number(item?.amount) || 0), 0);

  if (financial.inputMode === 'detailed') {
    setField('assets.financialAssets.total', hasDetailedInput ? detailedTotal : '');
    return;
  }

  const canActivateDetailed = canActivateLinkedDetailed({
    mode: financial.inputMode,
    simpleInputStored: financial.simpleInputStored,
    total: financial.total,
    simpleTotal: financial.simpleTotal,
    value,
  });
  if (!canActivateDetailed) return;

  setField('assets.financialAssets.inputMode', 'detailed');
  setField('assets.financialAssets.total', detailedTotal);
}

// oxlint-disable-next-line react/only-export-components
export function updateLinkedLiquidAsset(formData, setField, assetLink, raw) {
  const value = raw === '' ? '' : Number(raw);
  const liquid = getIn(formData, 'assets.liquidAssets') || {};
  const breakdown = liquid.breakdown || {};
  const customItems = Array.isArray(liquid.customItems) ? liquid.customItems : [];
  let nextBreakdown = breakdown;
  let nextCustomItems = customItems;

  if (assetLink.type === 'liquidBreakdown') {
    nextBreakdown = { ...breakdown, [assetLink.field]: value };
    setField(`assets.liquidAssets.breakdown.${assetLink.field}`, value);
  } else {
    const matchingIndexes = customItems.reduce((indexes, item, index) => (
      item.name === assetLink.name ? [...indexes, index] : indexes
    ), []);
    // 이름만 같은 항목이 여러 개면 어느 자산이 연결 대상인지 판별할 수 없다. 잘못된 자산을
    // 수정하는 것보다 변경을 중단한다. 빈 값으로 존재하지 않는 항목을 새로 만드는 것도 금지해,
    // 저축 항목을 무입력 상태로 취소할 때 빈 자산 행이 생기지 않게 한다.
    if (matchingIndexes.length > 1 || (matchingIndexes.length === 0 && value === '')) return;
    const index = matchingIndexes[0];
    nextCustomItems = index != null
      ? customItems.map((item, itemIndex) => (itemIndex === index ? { ...item, amount: value } : item))
      : [...customItems, { name: assetLink.name, amount: value }];
    setField('assets.liquidAssets.customItems', nextCustomItems);
  }

  const detailedTotal = LIQUID_PRESET_KEYS.reduce(
    (total, key) => total + (Number(nextBreakdown[key]) || 0),
    0
  ) + nextCustomItems.reduce((total, item) => total + (Number(item.amount) || 0), 0);

  if (liquid.inputMode === 'detailed') {
    setField('assets.liquidAssets.total', detailedTotal);
    return;
  }

  if (!canActivateLinkedDetailed({
    mode: liquid.inputMode,
    simpleInputStored: liquid.simpleInputStored,
    total: liquid.total,
    simpleTotal: liquid.simpleTotal,
    value,
  })) return;

  setField('assets.liquidAssets.inputMode', 'detailed');
  setField('assets.liquidAssets.total', detailedTotal);
}

// oxlint-disable-next-line react/only-export-components
export function hasEnteredSavingsDetails(item) {
  return ['monthly', 'remainingMonths', 'interestRate'].some((field) => !isBlank(item?.[field]));
}

// oxlint-disable-next-line react/only-export-components
export function getLinkedSavingsAssetState(formData, assetLink) {
  if (!assetLink) return { count: 0, indexes: [] };
  if (assetLink.type === 'direct') {
    return { count: isBlank(getIn(formData, assetLink.path)) ? 0 : 1, indexes: [] };
  }
  if (assetLink.type === 'pensionBreakdown') {
    const value = getIn(formData, `assets.pensionAssetsBreakdown.${assetLink.field}`);
    return { count: isBlank(value) ? 0 : 1, indexes: [] };
  }
  if (assetLink.type === 'liquidBreakdown') {
    const value = getIn(formData, `assets.liquidAssets.breakdown.${assetLink.field}`);
    return { count: isBlank(value) ? 0 : 1, indexes: [] };
  }
  if (assetLink.type === 'liquidCustomItem') {
    const items = getIn(formData, 'assets.liquidAssets.customItems') || [];
    const indexes = items.reduce((matches, item, index) => (
      item.name === assetLink.name ? [...matches, index] : matches
    ), []);
    return { count: indexes.length, indexes };
  }
  return { count: 0, indexes: [] };
}

function removeLinkedSavingsAsset(formData, assetLink, assetState) {
  let next = formData;
  if (assetLink.type === 'direct') {
    next = setIn(next, assetLink.path, '');
    const financial = getIn(next, 'assets.financialAssets') || {};
    if (financial.inputMode === 'detailed') {
      const total = FINANCIAL_DETAIL_KEYS.reduce((sum, key) => sum + (Number(financial[key]) || 0), 0)
        + (financial.otherItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      next = setIn(next, 'assets.financialAssets.total', total);
    }
    return next;
  }
  if (assetLink.type === 'pensionBreakdown') {
    next = setIn(next, `assets.pensionAssetsBreakdown.${assetLink.field}`, '');
    if (getIn(next, 'assets.pensionAssetsInputMode') === 'detailed') {
      const breakdown = getIn(next, 'assets.pensionAssetsBreakdown') || {};
      const keys = next.basic?.hasSpouse === true
        ? [...PENSION_DETAIL_KEYS, 'spouseRetirementPension']
        : PENSION_DETAIL_KEYS;
      const total = keys.reduce((sum, key) => sum + (Number(breakdown[key]) || 0), 0)
        + (breakdown.otherItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      next = setIn(next, 'assets.pensionAssets', total);
    }
    return next;
  }
  const liquid = getIn(next, 'assets.liquidAssets') || {};
  const breakdown = liquid.breakdown || {};
  let customItems = Array.isArray(liquid.customItems) ? liquid.customItems : [];
  if (assetLink.type === 'liquidBreakdown') {
    next = setIn(next, `assets.liquidAssets.breakdown.${assetLink.field}`, '');
  } else if (assetLink.type === 'liquidCustomItem') {
    const targetIndex = assetState.indexes[0];
    customItems = customItems.filter((_, index) => index !== targetIndex);
    next = setIn(next, 'assets.liquidAssets.customItems', customItems);
  }
  if (liquid.inputMode === 'detailed') {
    const nextBreakdown = getIn(next, 'assets.liquidAssets.breakdown') || breakdown;
    const total = LIQUID_PRESET_KEYS.reduce((sum, key) => sum + (Number(nextBreakdown[key]) || 0), 0)
      + customItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    next = setIn(next, 'assets.liquidAssets.total', total);
  }
  return next;
}

// 저축과 자산을 함께 지우는 경우 두 변경을 하나의 formData 갱신으로 계산한다.
// oxlint-disable-next-line react/only-export-components
export function removeSavingsWithAssetChoice({
  formData, kind, key, index, assetLink, deleteAsset, basePath, customPath,
  totalPath, annualPath, selectedPath, categoryKeys,
}) {
  const assetState = getLinkedSavingsAssetState(formData, assetLink);
  if (deleteAsset && assetState.count !== 1) return formData;

  const breakdown = getIn(formData, basePath) || {};
  const customItems = getIn(formData, customPath) || [];
  let nextBreakdown = breakdown;
  let nextCustomItems = customItems;
  let next = formData;
  if (kind === 'preset') {
    nextBreakdown = { ...breakdown, [key]: { monthly: '', remainingMonths: '', interestRate: '' } };
    next = setIn(next, `${basePath}.${key}`, nextBreakdown[key]);
    const selected = getIn(next, selectedPath) || [];
    next = setIn(next, selectedPath, selected.filter((selectedKey) => selectedKey !== key));
  } else {
    nextCustomItems = customItems.filter((_, itemIndex) => itemIndex !== index);
    next = setIn(next, customPath, nextCustomItems);
  }

  const monthly = categoryKeys.reduce(
    (sum, categoryKey) => sum + (Number(nextBreakdown[categoryKey]?.monthly) || 0), 0
  ) + nextCustomItems.reduce((sum, item) => sum + (Number(item.monthly) || 0), 0);
  next = setIn(next, totalPath, monthly);
  if (annualPath) next = setIn(next, annualPath, Math.round(monthly * 12));
  return deleteAsset ? removeLinkedSavingsAsset(next, assetLink, assetState) : next;
}

// 자산 누적액은 저축 월 납입정보와 의미가 다르고 생성 출처도 저장하지 않는다. 따라서 저축 항목을
// 삭제할 때는 저축 데이터와 선택 상태만 비우며, 연결 자산은 고정 필드/이름 기반 항목 모두 보존한다.
// oxlint-disable-next-line react/only-export-components
export function clearPresetSavingsItem({
  breakdown, customItems, categories, key, basePath, totalPath, annualPath,
  selectedPath, selectedKeys, setField,
}) {
  const emptyItem = { monthly: '', remainingMonths: '', interestRate: '' };
  const nextBreakdown = { ...breakdown, [key]: emptyItem };
  const presetSum = categories.reduce((sum, category) => sum + (Number(nextBreakdown[category.key]?.monthly) || 0), 0);
  const customSum = customItems.reduce((sum, item) => sum + (Number(item.monthly) || 0), 0);
  const nextTotal = presetSum + customSum;

  setField(`${basePath}.${key}`, emptyItem);
  setField(totalPath, nextTotal);
  if (annualPath) setField(annualPath, Math.round(nextTotal * 12));
  setField(selectedPath, selectedKeys.filter((selectedKey) => selectedKey !== key));
}

// oxlint-disable-next-line react/only-export-components
export function updateLinkedPensionAsset(formData, setField, field, raw) {
  const value = raw === '' ? '' : Number(raw);
  const assets = getIn(formData, 'assets') || {};
  const breakdown = assets.pensionAssetsBreakdown || {};
  const nextBreakdown = { ...breakdown, [field]: value };
  const otherItems = Array.isArray(breakdown.otherItems) ? breakdown.otherItems : [];
  const activeKeys = formData.basic?.hasSpouse === true
    ? [...PENSION_DETAIL_KEYS, 'spouseRetirementPension']
    : PENSION_DETAIL_KEYS;
  const hasDetailedInput = activeKeys.some((key) => !isBlank(nextBreakdown[key]))
    || otherItems.some((item) => !isBlank(item?.amount));
  const detailedTotal = activeKeys.reduce(
    (total, key) => total + (Number(nextBreakdown[key]) || 0),
    0
  ) + otherItems.reduce((total, item) => total + (Number(item.amount) || 0), 0);

  setField(`assets.pensionAssetsBreakdown.${field}`, value);

  if (assets.pensionAssetsInputMode === 'detailed') {
    setField('assets.pensionAssets', hasDetailedInput ? detailedTotal : '');
    return;
  }

  if (!canActivateLinkedDetailed({
    mode: assets.pensionAssetsInputMode,
    simpleInputStored: assets.pensionAssetsSimpleInputStored,
    total: assets.pensionAssets,
    simpleTotal: assets.pensionAssetsSimpleTotal,
    value,
  })) return;

  setField('assets.pensionAssetsInputMode', 'detailed');
  setField('assets.pensionAssets', detailedTotal);
}

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
    const matches = items.filter((it) => it.name === assetLink.name);
    return {
      value: matches[0]?.amount ?? '',
      editable: matches.length <= 1,
      ambiguous: matches.length > 1,
      matchCount: matches.length,
    };
  }
  return null;
}

// oxlint-disable-next-line react/only-export-components
export function SavingsItemFields({ item, onChange, accumulated, disabled = false, savingsDiagnostic }) {
  return (
    <div className="field-grid three-col">
      <label className="field">
        <span className="field-label">월 저축액</span>
        <div className="field-input-row">
          <FormattedNumberInput
            type="number"
            min={0}
            inputMode="numeric"
            value={item.monthly ?? ''}
            disabled={disabled}
            savingsDiagnostic={savingsDiagnostic ? { ...savingsDiagnostic, field: 'monthly' } : undefined}
            onChange={(e) => onChange('monthly', e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className="field-unit">만원</span>
        </div>
      </label>
      <label className="field">
        <span className="field-label">앞으로 저축할 개월수</span>
        <div className="field-input-row">
          <FormattedNumberInput
            type="number"
            min={0}
            inputMode="numeric"
            value={item.remainingMonths ?? ''}
            disabled={disabled}
            onChange={(e) => onChange('remainingMonths', e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className="field-unit">개월</span>
        </div>
      </label>
      <label className="field">
        <span className="field-label">수익률(이자율, 배당율)</span>
        <div className="field-input-row">
          <FormattedNumberInput
            type="number"
            inputMode="numeric"
            value={item.interestRate ?? ''}
            disabled={disabled}
            onChange={(e) => onChange('interestRate', e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className="field-unit">%</span>
        </div>
      </label>
      <label className="field">
        <span className="field-label">현재까지 누적된 금액</span>
        <div className="field-input-row">
          <FormattedNumberInput
            type="number"
            min={0}
            inputMode="numeric"
            value={accumulated.value ?? ''}
            disabled={disabled}
            readOnly={!disabled && !accumulated.editable}
            savingsDiagnostic={savingsDiagnostic ? { ...savingsDiagnostic, field: 'accumulated' } : undefined}
            onChange={!disabled && accumulated.editable ? (e) => accumulated.onChange(e.target.value) : undefined}
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
export default function SavingsBreakdownField({ basePath, customPath, totalPath, annualPath, selectedPath, categories }) {
  const { formData, setField, setFormData, registerNavigationGuard } = useFormData();
  const breakdown = getIn(formData, basePath) || {};
  const customItems = getIn(formData, customPath) || [];
  const categoryKeys = categories.map((c) => c.key);
  // formData에 저장된 실제 선택 상태(재진입해도 유지됨). pill 재클릭은 아래 openKeys(패널
  // 접기/펼치기)만 바꾸고, 이 값은 "이 항목 삭제"를 눌러야만 바뀐다.
  const selectedKeys = selectedKeysFrom(getIn(formData, selectedPath), breakdown, categoryKeys);

  const [openKeys, setOpenKeys] = useState(() => new Set(selectedKeys));
  const [pendingRemoval, setPendingRemoval] = useState(null);
  // 중복 입력 문자열은 자동저장 대상인 formData와 분리해 보관한다. 기존 초안의 중복 이름은 그대로
  // 표시하되 초기 오류로 만들지 않고, 사용자가 실제로 이름을 편집한 행에만 신규 검증을 적용한다.
  const [nameEdits, setNameEdits] = useState(() => initialCustomSavingsNameState(customItems));
  const diagnosticIdsRef = useRef(customItems.map(() => createSavingsDiagnosticItemId()));
  const diagnosticPreviousRef = useRef(new Map());
  const diagnosticExpectationsRef = useRef(new Map());
  while (diagnosticIdsRef.current.length < customItems.length) {
    diagnosticIdsRef.current.push(createSavingsDiagnosticItemId());
  }
  if (diagnosticIdsRef.current.length > customItems.length) {
    diagnosticIdsRef.current = diagnosticIdsRef.current.slice(0, customItems.length);
  }

  const diagnosticIdAt = (index) => diagnosticIdsRef.current[index];
  const diagnosticAssetMatches = (name) => {
    if (!name) return [];
    const assets = getIn(formData, 'assets.liquidAssets.customItems') || [];
    return assets.filter((asset) => asset.name === name);
  };
  const expectDiagnosticChange = (index, field, value) => {
    if (!savingsDiagnosticsEnabled) return;
    const itemId = diagnosticIdAt(index);
    if (!itemId) return;
    diagnosticExpectationsRef.current.set(`${itemId}:${field}`, { value, reflected: false });
  };

  // 아직 선택하지 않은 항목을 처음 누르면 selectedCategories에 추가하고(월 저축액은 자동으로
  // 채우지 않는다 - 선택 상태와 실제 금액은 분리한다) 패널을 연다. 이미 선택된 항목을 다시
  // 누르면 선택 상태는 그대로 두고 패널만 접거나 편다("이 항목 삭제"만이 선택을 해제한다).
  const toggle = (key) => {
    if (!selectedKeys.includes(key)) {
      setField(selectedPath, Array.from(new Set([...selectedKeys, key])));
      setOpenKeys((prev) => new Set(prev).add(key));
      return;
    }
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

  const removalConfig = {
    basePath, customPath, totalPath, annualPath, selectedPath, categoryKeys,
  };

  const applyPresetRemoval = (key, assetLink, deleteAsset = false) => {
    setFormData((current) => removeSavingsWithAssetChoice({
      formData: current, kind: 'preset', key, assetLink, deleteAsset, ...removalConfig,
    }));
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // 단순 선택만 한 빈 항목은 즉시 선택 상태만 제거한다. 실제 저축정보가 있으면 확인을 받은 뒤
  // 저축정보만 삭제하며, 출처를 판별할 수 없는 기존 자산 누적액은 어느 경우에도 변경하지 않는다.
  const removePresetItem = (key, label, assetLink) => {
    if (!hasEnteredSavingsDetails(breakdown[key])) {
      applyPresetRemoval(key, assetLink, false);
      return;
    }
    const assetState = getLinkedSavingsAssetState(formData, assetLink);
    setPendingRemoval({ kind: 'preset', key, label, assetLink, assetCount: assetState.count });
  };

  const updateAccumulated = (assetLink, raw) => {
    if (assetLink.type === 'direct') {
      updateDirectLinkedAsset(formData, setField, assetLink.path, raw);
      return;
    }

    if (assetLink.type === 'pensionBreakdown') {
      updateLinkedPensionAsset(formData, setField, assetLink.field, raw);
      return;
    }

    if (assetLink.type === 'liquidBreakdown' || assetLink.type === 'liquidCustomItem') {
      updateLinkedLiquidAsset(formData, setField, assetLink, raw);
    }
  };

  const addCustomItem = () => {
    const next = [...customItems, { name: '', monthly: '', remainingMonths: '', interestRate: '' }];
    diagnosticIdsRef.current = [...diagnosticIdsRef.current, createSavingsDiagnosticItemId()];
    setNameEdits((edits) => [...edits, { value: '', edited: true, composing: false }]);
    setField(customPath, next);
    recomputeTotal(breakdown, next);
  };

  const removeCustomLocalState = (index) => {
    const removedId = diagnosticIdAt(index);
    diagnosticIdsRef.current = diagnosticIdsRef.current.filter((_, itemIndex) => itemIndex !== index);
    if (removedId) {
      diagnosticPreviousRef.current.delete(removedId);
      for (const key of diagnosticExpectationsRef.current.keys()) {
        if (key.startsWith(`${removedId}:`)) diagnosticExpectationsRef.current.delete(key);
      }
    }
    setNameEdits((edits) => edits.filter((_, itemIndex) => itemIndex !== index));
  };

  const applyCustomRemoval = (index, assetLink, deleteAsset = false) => {
    setFormData((current) => removeSavingsWithAssetChoice({
      formData: current, kind: 'custom', index, assetLink, deleteAsset, ...removalConfig,
    }));
    removeCustomLocalState(index);
  };

  const removeCustomItem = (index) => {
    const item = customItems[index] || {};
    const storedName = item.name || '';
    const assetLink = { type: 'liquidCustomItem', name: storedName };
    if (!storedName && !hasEnteredSavingsDetails(item)) {
      applyCustomRemoval(index, assetLink, false);
      return;
    }
    const assetState = getLinkedSavingsAssetState(formData, assetLink);
    setPendingRemoval({
      kind: 'custom', index, label: storedName || '추가 저축', assetLink, assetCount: assetState.count,
    });
  };

  const confirmPendingRemoval = (deleteAsset) => {
    if (!pendingRemoval) return;
    if (pendingRemoval.kind === 'preset') {
      applyPresetRemoval(pendingRemoval.key, pendingRemoval.assetLink, deleteAsset);
    } else {
      applyCustomRemoval(pendingRemoval.index, pendingRemoval.assetLink, deleteAsset);
    }
    setPendingRemoval(null);
  };

  // 커스텀 저축 항목의 이름이 바뀌면, 그 이름으로 연동되어 있던 현금성 자산의 "기본 항목 외 추가"
  // 항목도 같은 이름으로 옮겨준다 - 그렇지 않으면 이름을 바꾸는 순간 기존에 입력해둔 누적금액과의
  // 연동이 끊겨(옛 이름 항목만 남고) 누적금액이 사라진 것처럼 보인다.
  const updateCustomItem = (index, key, value) => {
    const next = customItems.map((item, i) => (i === index ? { ...item, [key]: value } : item));
    setField(customPath, next);
    recomputeTotal(breakdown, next);
  };

  const nameErrorAt = (index, edits = nameEdits, value = edits[index]?.value ?? customItems[index]?.name ?? '') => {
    if (!edits[index]?.edited) return null;
    return getCustomSavingsNameError({ value, index, nameEdits: edits, items: customItems, categories, formData });
  };

  const updateCustomItemNameDraft = (index, patch) => {
    const currentEdit = nameEdits[index];
    logSavingsDiagnostic('name_change_handler', {
      itemId: diagnosticIdAt(index),
      index,
      edited: true,
      composing: patch.composing ?? currentEdit?.composing ?? false,
      changedFromStored: Object.hasOwn(patch, 'value')
        ? patch.value !== (customItems[index]?.name || '')
        : currentEdit?.value !== (customItems[index]?.name || ''),
    });
    setNameEdits((edits) => edits.map((edit, itemIndex) => (
      itemIndex === index ? { ...edit, ...patch, edited: true } : edit
    )));
  };

  const focusCustomItemName = (index) => {
    document.getElementById(`assets.savingsPlan.customItems.${index}.name`)?.focus();
  };

  const commitCustomItemName = (index, value = nameEdits[index]?.value ?? '') => {
    const itemId = diagnosticIdAt(index);
    const assetMatchCount = diagnosticAssetMatches(customItems[index]?.name || '').length;
    logSavingsDiagnostic('name_commit_attempt', {
      itemId, index, edited: Boolean(nameEdits[index]?.edited),
      composing: Boolean(nameEdits[index]?.composing), assetMatchCount,
    });
    const edits = nameEdits.map((edit, itemIndex) => (
      itemIndex === index ? { ...edit, value, composing: false, edited: true } : edit
    ));
    if (nameEdits[index]?.composing) {
      logSavingsDiagnostic('name_commit_blocked', { itemId, index, reason: 'composing' });
      return false;
    }
    setNameEdits(edits);
    const error = nameErrorAt(index, edits, value);
    if (error) {
      const errorKind = error === REQUIRED_SAVINGS_NAME_ERROR
        ? 'required'
        : error === DUPLICATE_SAVINGS_NAME_ERROR
          ? 'duplicate'
          : error === AMBIGUOUS_SAVINGS_ASSET_ERROR ? 'ambiguous_asset' : 'other';
      logSavingsDiagnostic('name_commit_blocked', {
        itemId, index, reason: 'validation', errorKind, assetMatchCount,
      });
      focusCustomItemName(index);
      return false;
    }
    expectDiagnosticChange(index, 'name', value);
    logSavingsDiagnostic('name_commit_scheduled', { itemId, index, assetMatchCount });
    setFormData((current) => commitCustomSavingsNameData({ formData: current, customPath, index, value }));
    setNameEdits((current) => current.map((edit, itemIndex) => (
      itemIndex === index ? { ...edit, value, edited: false, composing: false } : edit
    )));
    return true;
  };

  const commitAllCustomItemNames = () => {
    const firstInvalidIndex = nameEdits.findIndex((edit, index) => (
      edit.edited && (edit.composing || nameErrorAt(index))
    ));
    if (firstInvalidIndex >= 0) {
      const error = nameErrorAt(firstInvalidIndex);
      logSavingsDiagnostic('name_commit_blocked', {
        itemId: diagnosticIdAt(firstInvalidIndex),
        index: firstInvalidIndex,
        reason: nameEdits[firstInvalidIndex]?.composing ? 'composing' : 'validation',
        errorKind: error === REQUIRED_SAVINGS_NAME_ERROR
          ? 'required'
          : error === DUPLICATE_SAVINGS_NAME_ERROR
            ? 'duplicate'
            : error === AMBIGUOUS_SAVINGS_ASSET_ERROR ? 'ambiguous_asset' : error ? 'other' : 'none',
        assetMatchCount: diagnosticAssetMatches(customItems[firstInvalidIndex]?.name || '').length,
      });
      focusCustomItemName(firstInvalidIndex);
      return false;
    }
    const pending = nameEdits.reduce((indexes, edit, index) => (
      edit.edited && edit.value !== (customItems[index]?.name || '') ? [...indexes, index] : indexes
    ), []);
    if (pending.length === 0) return true;
    pending.forEach((index) => {
      const itemId = diagnosticIdAt(index);
      const assetMatchCount = diagnosticAssetMatches(customItems[index]?.name || '').length;
      logSavingsDiagnostic('name_commit_attempt', {
        itemId, index, edited: true, composing: false, assetMatchCount, phase: 'navigation',
      });
      expectDiagnosticChange(index, 'name', nameEdits[index].value);
      logSavingsDiagnostic('name_commit_scheduled', { itemId, index, assetMatchCount, phase: 'navigation' });
    });
    setFormData((current) => pending.reduce((next, index) => commitCustomSavingsNameData({
      formData: next, customPath, index, value: nameEdits[index].value,
    }), current));
    setNameEdits((edits) => edits.map((edit, index) => (
      pending.includes(index) ? { ...edit, edited: false, composing: false } : edit
    )));
    return true;
  };

  useEffect(() => registerNavigationGuard?.(commitAllCustomItemNames));

  useEffect(() => {
    logSavingsDiagnostic('savings_breakdown_render', {
      result: customItems.length > 0 ? 'has_custom_items' : 'no_custom_items',
    });
  }, [customItems.length]);

  useEffect(() => {
    if (!savingsDiagnosticsEnabled) return;
    customItems.forEach((item, index) => {
      const itemId = diagnosticIdAt(index);
      if (!itemId) return;
      const nameEdit = nameEdits[index] || { value: item.name || '', edited: false, composing: false };
      const nameError = nameErrorAt(index);
      const namePending = nameEdit.edited && nameEdit.value !== (item.name || '');
      const assetMatches = diagnosticAssetMatches(item.name || '');
      const accumulatedValue = assetMatches.length === 1 ? assetMatches[0].amount : '';
      const snapshot = { name: item.name || '', monthly: item.monthly ?? '', accumulated: accumulatedValue };
      const previous = diagnosticPreviousRef.current.get(itemId);
      const disabled = Boolean(nameError) || namePending;
      const accumulatedReadOnly = !disabled && !item.name;
      const errorKind = nameError === REQUIRED_SAVINGS_NAME_ERROR
        ? 'required'
        : nameError === DUPLICATE_SAVINGS_NAME_ERROR
          ? 'duplicate'
          : nameError === AMBIGUOUS_SAVINGS_ASSET_ERROR ? 'ambiguous_asset' : nameError ? 'other' : 'none';
      logSavingsDiagnostic('item_render', {
        itemId, index,
        edited: Boolean(nameEdit.edited),
        composing: Boolean(nameEdit.composing),
        pending: namePending,
        hasError: Boolean(nameError),
        errorKind,
        disabled,
        readOnly: false,
        hasStoredName: Boolean(item.name),
        hasLinkedAsset: assetMatches.length > 0,
        assetMatchCount: assetMatches.length,
        storedNameChanged: previous ? previous.name !== snapshot.name : false,
        monthlyChanged: previous ? previous.monthly !== snapshot.monthly : false,
        accumulatedChanged: previous ? previous.accumulated !== snapshot.accumulated : false,
      });
      logSavingsDiagnostic('input_state', { itemId, index, field: 'name', disabled: false, readOnly: false });
      logSavingsDiagnostic('input_state', { itemId, index, field: 'monthly', disabled, readOnly: false });
      logSavingsDiagnostic('input_state', {
        itemId, index, field: 'accumulated', disabled, readOnly: accumulatedReadOnly,
      });

      for (const field of ['name', 'monthly', 'accumulated']) {
        const key = `${itemId}:${field}`;
        const expectation = diagnosticExpectationsRef.current.get(key);
        if (!expectation) continue;
        const currentValue = snapshot[field];
        if (Object.is(currentValue, expectation.value) && !expectation.reflected) {
          expectation.reflected = true;
          logSavingsDiagnostic('state_change_reflected', { itemId, index, field, result: 'applied' });
        } else if (!expectation.reflected && !Object.is(currentValue, expectation.value)) {
          logSavingsDiagnostic('state_change_reflected', { itemId, index, field, result: 'not_applied' });
          diagnosticExpectationsRef.current.delete(key);
        } else if (expectation.reflected && !Object.is(currentValue, expectation.value)) {
          logSavingsDiagnostic('state_change_reflected', { itemId, index, field, result: 'reverted' });
          diagnosticExpectationsRef.current.delete(key);
        }
      }
      diagnosticPreviousRef.current.set(itemId, snapshot);
    });
  });

  const total = getIn(formData, totalPath);
  const annualTotal = annualPath ? getIn(formData, annualPath) : null;
  // selectedCategoryList: 선택된 항목 전체(패널이 접혀 있어도 합계·요약표에는 계속 표시된다).
  // openCategories: 그중 지금 패널이 펼쳐져 입력창이 보이는 항목만.
  const selectedCategoryList = categories.filter((c) => selectedKeys.includes(c.key));
  const openCategories = selectedCategoryList.filter((c) => openKeys.has(c.key));

  return (
    <div className="field">
      <span className="field-label">해당하는 저축 종류를 눌러 상세 내용을 입력해 주세요</span>
      <div className="checkbox-group" style={{ marginTop: 8, marginBottom: 14 }}>
        {categories.map((c) => (
          <button
            type="button"
            key={c.key}
            className={`checkbox-pill ${selectedKeys.includes(c.key) ? 'is-active' : ''}`}
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
              helper: resolved.ambiguous
                ? `같은 이름의 연결 자산이 ${resolved.matchCount}개 있어 누적액을 수정할 수 없습니다. "4. 자산"에서 항목 이름을 구분하거나 중복 항목을 정리해 주세요.`
                : `"4. 자산"의 ${c.assetLinkLabel}과 같은 값으로 연동됩니다`,
              onChange: (raw) => updateAccumulated(c.assetLink, raw),
            }
          : { value: '', editable: false, helper: null, onChange: () => {} };
        return (
          <Fragment key={c.key}>
            <p className="field-label" style={{ marginTop: 14, marginBottom: 8 }}>{c.label}</p>
            <SavingsItemFields item={item} onChange={(field, value) => update(c.key, field, value)} accumulated={accumulated} />
            <button type="button" className="repeatable-remove" onClick={() => removePresetItem(c.key, c.label, c.assetLink)}>
              이 항목 삭제
            </button>
          </Fragment>
        );
      })}

      <div className="repeatable-list" style={{ marginTop: 14 }}>
        <div className="repeatable-list-head">
          <span className="field-label">기본 항목 외 추가 저축</span>
          {savingsDiagnosticsEnabled && <span
            className="field-helper"
            data-testid="savings-diagnostics-active"
            style={{ marginLeft: 8 }}
          >개발 진단 활성화</span>}
        </div>
        {customItems.map((item, index) => {
          const nameEdit = nameEdits[index] || { value: item.name || '', edited: false, composing: false };
          const nameError = nameErrorAt(index);
          const namePending = nameEdit.edited && nameEdit.value !== (item.name || '');
          const hasName = !!item.name;
          const resolved = hasName ? resolveAssetLink(formData, { type: 'liquidCustomItem', name: item.name }) : null;
          const accumulated = resolved
            ? {
                value: resolved.value,
                editable: resolved.editable,
                helper: resolved.ambiguous
                  ? `같은 이름의 연결 자산이 ${resolved.matchCount}개 있어 누적액을 수정할 수 없습니다. "4. 자산"에서 항목 이름을 구분하거나 중복 항목을 정리해 주세요.`
                  : `"4. 자산"의 현금성 자산 > "${item.name}" 추가 항목과 같은 값으로 연동됩니다`,
                onChange: (raw) => {
                  const value = raw === '' ? '' : Number(raw);
                  logSavingsDiagnostic('accumulated_change_handler', {
                    itemId: diagnosticIdAt(index), index, field: 'accumulated',
                    assetMatchCount: diagnosticAssetMatches(item.name).length,
                  });
                  expectDiagnosticChange(index, 'accumulated', value);
                  updateAccumulated({ type: 'liquidCustomItem', name: item.name }, raw);
                },
              }
            : {
                value: '',
                editable: false,
                helper: '저축 이름을 입력하면 "4. 자산"의 현금성 자산과 연동됩니다',
                onChange: () => {},
              };
          return (
            <div className="repeatable-item" key={index}>
              <CustomSavingsNameField
                index={index}
                value={nameEdit.value}
                error={nameError}
                onChange={(value) => updateCustomItemNameDraft(index, { value })}
                onBlur={(event) => commitCustomItemName(index, event.currentTarget.value)}
                onCompositionStart={() => updateCustomItemNameDraft(index, { composing: true })}
                onCompositionEnd={(value) => updateCustomItemNameDraft(index, { value, composing: false })}
                savingsDiagnostic={{ itemId: diagnosticIdAt(index), index, field: 'name' }}
              />
              <SavingsItemFields
                item={item}
                onChange={(field, value) => {
                  if (field === 'monthly') {
                    logSavingsDiagnostic('monthly_change_handler', {
                      itemId: diagnosticIdAt(index), index, field: 'monthly',
                      assetMatchCount: diagnosticAssetMatches(item.name).length,
                    });
                    expectDiagnosticChange(index, 'monthly', value);
                  }
                  updateCustomItem(index, field, value);
                }}
                accumulated={accumulated}
                disabled={Boolean(nameError) || namePending}
                savingsDiagnostic={{ itemId: diagnosticIdAt(index), index }}
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

      <table className="grade-table compact finance-summary-desktop" style={{ marginTop: 18 }}>
        <thead>
          <tr>
            <th>저축 종류</th>
            <th style={{ textAlign: 'right' }}>월 저축액</th>
            <th style={{ textAlign: 'right' }}>남은 개월수</th>
            <th style={{ textAlign: 'right' }}>이자율</th>
          </tr>
        </thead>
        <tbody>
          {selectedCategoryList.map((c) => {
            const item = breakdown[c.key] || {};
            return (
              <tr key={c.key}>
                <td>{c.label}</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatWon(Number(item.monthly) || 0)}</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.remainingMonths) || 0)}개월</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.interestRate) || 0)}%</td>
              </tr>
            );
          })}
          {customItems.map((item, i) => (
            <tr key={`custom-${i}`}>
              <td>{item.name || '(이름 미입력)'}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(Number(item.monthly) || 0)}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.remainingMonths) || 0)}개월</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatNumber(Number(item.interestRate) || 0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="finance-summary-mobile finance-summary-mobile--spaced">
        <div className="income-summary-group">
          <h4>저축 항목</h4>
          {selectedCategoryList.map((c) => {
            const item = breakdown[c.key] || {};
            return (
              <div className="income-summary-item income-summary-item--child" key={c.key}>
                <div className="income-summary-item-main"><span>{c.label}</span><strong>{formatWon(Number(item.monthly) || 0)}</strong></div>
                <p>남은 기간 · {formatNumber(Number(item.remainingMonths) || 0)}개월</p>
                <p>수익률 · {formatNumber(Number(item.interestRate) || 0)}%</p>
              </div>
            );
          })}
          {customItems.map((item, i) => (
            <div className="income-summary-item income-summary-item--child" key={`custom-mobile-${i}`}>
              <div className="income-summary-item-main"><span>{item.name || '(이름 미입력)'}</span><strong>{formatWon(Number(item.monthly) || 0)}</strong></div>
              <p>남은 기간 · {formatNumber(Number(item.remainingMonths) || 0)}개월</p>
              <p>수익률 · {formatNumber(Number(item.interestRate) || 0)}%</p>
            </div>
          ))}
        </div>
      </div>
      <TotalAmountBox label="저축 합계" amount={Number(total) || 0} valueLabel="총액은" />
      <span className="field-helper">선택·추가하신 항목의 월 저축액을 자동으로 합산한 값입니다. 개월수·이자율·누적액은 항목별로 다를 수 있어 합산하지 않습니다.</span>

      {annualPath && (
        <p className="field-helper" style={{ marginTop: 10 }}>연 환산 {formatWon(annualTotal || 0)}</p>
      )}
      {pendingRemoval && <ConfirmModal
        title="저축 항목을 삭제할까요?"
        description={pendingRemoval.assetCount === 1
          ? `${pendingRemoval.label} 저축과 연결 자산이 있습니다. 삭제할 범위를 선택해 주세요.`
          : pendingRemoval.assetCount > 1
            ? `${pendingRemoval.label}과 이름이 같은 자산이 여러 개 있어 연결 대상을 안전하게 특정할 수 없습니다. 자산은 삭제하지 않고 저축만 삭제할 수 있습니다.`
            : `${pendingRemoval.label}과 연결된 자산이 없습니다. 저축만 삭제할 수 있습니다.`}
        cancelLabel="취소"
        secondaryLabel={pendingRemoval.assetCount === 1 ? '저축만 삭제하고 자산 유지' : undefined}
        confirmLabel={pendingRemoval.assetCount === 1 ? '저축과 연결 자산 모두 삭제' : '저축만 삭제'}
        destructive
        onCancel={() => setPendingRemoval(null)}
        onSecondary={() => confirmPendingRemoval(false)}
        onConfirm={() => confirmPendingRemoval(pendingRemoval.assetCount === 1)}
      />}
    </div>
  );
}
