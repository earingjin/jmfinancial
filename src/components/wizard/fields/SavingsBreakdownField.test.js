import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildAggregates } from '../../../../api/_lib/aggregate';
import { buildCanonicalInput } from '../../../../api/_lib/canonicalInput';
import { initialFormData } from '../../../state/initialFormData';
import { mergeDraft } from '../../../state/draftStorage';
import { setIn } from '../../../state/pathUtils';
import { changeTotalInputMode } from './inputModeTransitions';
import {
  clearPresetSavingsItem,
  commitCustomSavingsNameData,
  CustomSavingsNameField,
  AMBIGUOUS_SAVINGS_ASSET_ERROR,
  DUPLICATE_SAVINGS_NAME_ERROR,
  getCustomSavingsNameError,
  hasEnteredSavingsDetails,
  initialCustomSavingsNameState,
  isCategorySelected,
  getLinkedSavingsAssetState,
  REQUIRED_SAVINGS_NAME_ERROR,
  removeSavingsWithAssetChoice,
  SavingsItemFields,
  selectedKeysFrom,
  updateDirectLinkedAsset,
  updateLinkedLiquidAsset,
  updateLinkedPensionAsset,
} from './SavingsBreakdownField.jsx';
import { SAVINGS_CATEGORIES } from '../steps/Step3Savings.jsx';

globalThis.React = React;

const CATEGORY_KEYS = ['installment', 'isa', 'irp'];

function stateHarness(source) {
  let formData = source;
  return { get: () => formData, setField: (path, value) => { formData = setIn(formData, path, value); } };
}

function changeFinancialMode(harness, nextMode, confirmChange) {
  const financial = harness.get().assets.financialAssets;
  const otherTotal = (financial.otherItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const detailedTotal = ['stocks', 'funds', 'bonds'].reduce((sum, key) => sum + (Number(financial[key]) || 0), 0) + otherTotal;
  const detailedHasInput = ['stocks', 'funds', 'bonds'].some((key) => financial[key] !== '' && financial[key] != null)
    || (financial.otherItems || []).some((item) => item?.amount !== '' && item?.amount != null);
  return changeTotalInputMode({
    formData: harness.get(), setField: harness.setField, nextMode, detailedTotal, detailedHasInput,
    modePath: 'assets.financialAssets.inputMode', totalPath: 'assets.financialAssets.total',
    simpleTotalPath: 'assets.financialAssets.simpleTotal', simpleStoredPath: 'assets.financialAssets.simpleInputStored',
    totalLabel: '금융자산 총액', confirmChange,
  });
}

describe('사용자 추가 저축 이름 편집과 확정', () => {
  const items = (names) => names.map((name) => ({ name, monthly: 10, remainingMonths: '', interestRate: '' }));
  const edits = (values, edited = true) => values.map((value) => ({ value, edited, composing: false }));
  const errorFor = ({ value, index, names, values = names, formData = initialFormData }) => getCustomSavingsNameError({
    value, index, nameEdits: edits(values), items: items(names), categories: SAVINGS_CATEGORIES, formData,
  });

  it.each(SAVINGS_CATEGORIES.map(({ label }) => [label]))('기본 항목 %s은 선택 여부와 무관하게 중복이다', (label) => {
    expect(errorFor({ value: label, index: 0, names: [''], values: [label] })).toBe(DUPLICATE_SAVINGS_NAME_ERROR);
  });

  it.each([[' 적금 '], ['isa'], [' IsA ']])('%s은 공백·대소문자를 정규화해 기본 이름과 비교한다', (value) => {
    expect(errorFor({ value, index: 0, names: [''], values: [value] })).toBe(DUPLICATE_SAVINGS_NAME_ERROR);
  });

  it('빈 이름은 필수 오류이고 다른 추가 저축과 같은 이름은 중복 오류이다', () => {
    expect(errorFor({ value: '   ', index: 0, names: [''], values: ['   '] })).toBe(REQUIRED_SAVINGS_NAME_ERROR);
    expect(errorFor({ value: '여행 적금', index: 1, names: ['여행 적금', ''], values: ['여행 적금', '여행 적금'] }))
      .toBe(DUPLICATE_SAVINGS_NAME_ERROR);
  });

  it('다른 행이 편집 중이면 그 행의 임시 이름과 아직 확정된 이름을 모두 예약한다', () => {
    const formData = structuredClone(initialFormData);
    const currentItems = items(['기존 이름', '다른 이름']);
    const currentEdits = edits(['새 이름', '기존 이름']);
    expect(getCustomSavingsNameError({
      value: '기존 이름', index: 1, nameEdits: currentEdits,
      items: currentItems, categories: SAVINGS_CATEGORIES, formData,
    })).toBe(DUPLICATE_SAVINGS_NAME_ERROR);
  });

  it('입력 중간값과 최종 중복값은 확정 전 formData와 연결 자산을 변경하지 않는다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = items(['여행 적금', '']);
    formData.assets.liquidAssets.customItems = [{ name: '기존 이름', amount: 1000 }];
    const before = structuredClone(formData);
    let nameEdits = initialCustomSavingsNameState(formData.assets.savingsPlan.customItems);
    nameEdits = nameEdits.map((edit, index) => index === 1 ? { ...edit, value: '여행 적그', edited: true } : edit);
    nameEdits = nameEdits.map((edit, index) => index === 1 ? { ...edit, value: '여행 적금', edited: true } : edit);
    expect(nameEdits[1].value).toBe('여행 적금');
    expect(formData).toEqual(before);
  });

  it('유효한 전체 이름을 확정하면 저축 이름과 유일한 연결 자산 이름을 한 번에 변경한다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = items(['여행 적그']);
    formData.assets.liquidAssets.customItems = [{ name: '여행 적그', amount: 1000 }];
    const next = commitCustomSavingsNameData({
      formData, customPath: 'assets.savingsPlan.customItems', index: 0, value: '여행 적금',
    });
    expect(next.assets.savingsPlan.customItems[0].name).toBe('여행 적금');
    expect(next.assets.liquidAssets.customItems).toEqual([{ name: '여행 적금', amount: 1000 }]);
    expect(next.assets.liquidAssets.total).toBe(formData.assets.liquidAssets.total);
  });

  it('신규 항목의 유효한 이름 확정은 자산 항목을 새로 만들지 않는다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = items(['']);
    const next = commitCustomSavingsNameData({
      formData, customPath: 'assets.savingsPlan.customItems', index: 0, value: '여행 적금',
    });
    expect(next.assets.savingsPlan.customItems[0].name).toBe('여행 적금');
    expect(next.assets.liquidAssets.customItems).toEqual([]);
  });

  it('동일한 기존 이름 자산이 여러 개면 오류를 내고 원자적 이름 변경도 중단한다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = items(['기존 이름']);
    formData.assets.liquidAssets.customItems = [{ name: '기존 이름', amount: 100 }, { name: '기존 이름', amount: 200 }];
    expect(errorFor({ value: '새 이름', index: 0, names: ['기존 이름'], values: ['새 이름'], formData }))
      .toBe(AMBIGUOUS_SAVINGS_ASSET_ERROR);
    expect(commitCustomSavingsNameData({
      formData, customPath: 'assets.savingsPlan.customItems', index: 0, value: '새 이름',
    })).toBe(formData);
  });

  it('중복 원인 행 삭제 후 오류는 자동 해제되고 전체 임시 이름은 유지된다', () => {
    const formData = structuredClone(initialFormData);
    const currentItems = items(['여행 적금', '']);
    const currentEdits = edits(['여행 적금', '여행 적금']);
    expect(getCustomSavingsNameError({
      value: currentEdits[1].value, index: 1, nameEdits: currentEdits,
      items: currentItems, categories: SAVINGS_CATEGORIES, formData,
    })).toBe(DUPLICATE_SAVINGS_NAME_ERROR);
    const remainingItems = currentItems.slice(1);
    const remainingEdits = currentEdits.slice(1);
    expect(getCustomSavingsNameError({
      value: remainingEdits[0].value, index: 0, nameEdits: remainingEdits,
      items: remainingItems, categories: SAVINGS_CATEGORIES, formData,
    })).toBeNull();
    expect(remainingEdits[0].value).toBe('여행 적금');
    expect(remainingItems[0].name).toBe('');
  });

  it('다른 중복 원인이 남으면 행을 하나 삭제해도 오류를 유지한다', () => {
    const formData = structuredClone(initialFormData);
    expect(getCustomSavingsNameError({
      value: '여행 적금', index: 0, nameEdits: edits(['여행 적금', '여행 적금']),
      items: items(['', '여행 적금']), categories: SAVINGS_CATEGORIES, formData,
    })).toBe(DUPLICATE_SAVINGS_NAME_ERROR);
  });

  it('편집 중이거나 조합 중인 이름은 확정 전 금액 입력을 비활성화한다', () => {
    const nameEdit = { value: '여행 적금', edited: true, composing: true };
    const pending = nameEdit.edited && nameEdit.value !== '';
    const html = renderToStaticMarkup(React.createElement(SavingsItemFields, {
      item: { monthly: 10, remainingMonths: 12, interestRate: 2 }, onChange: () => {},
      accumulated: { value: 1000, editable: true, onChange: () => {} }, disabled: pending || nameEdit.composing,
    }));
    expect(html.match(/disabled=""/g)).toHaveLength(4);
  });

  it('이름 필드는 blur와 한글 조합 이벤트를 받으며 임시 문자열을 그대로 표시한다', () => {
    const html = renderToStaticMarkup(React.createElement(CustomSavingsNameField, {
      index: 0, value: '여행 적금', error: DUPLICATE_SAVINGS_NAME_ERROR,
      onChange: vi.fn(), onBlur: vi.fn(), onCompositionStart: vi.fn(), onCompositionEnd: vi.fn(),
    }));
    expect(html).toContain('value="여행 적금"');
    expect(html).toContain('id="assets.savingsPlan.customItems.0.name"');
    expect(html).toContain(DUPLICATE_SAVINGS_NAME_ERROR);
  });

  it('기존 중복 초안은 미편집 상태로 무손실 초기화되고 계산 결과도 유지된다', () => {
    const saved = structuredClone(initialFormData);
    saved.assets.savingsPlan.inputMode = 'detailed';
    saved.assets.savingsPlan.breakdown.installment.monthly = 30;
    saved.assets.savingsPlan.customItems = [{ name: '적금', monthly: 20, remainingMonths: '', interestRate: '' }];
    saved.assets.savingsPlan.monthly = 50;
    saved.assets.savingsPlan.annual = 600;
    const restored = mergeDraft(initialFormData, JSON.parse(JSON.stringify(saved)));
    expect(initialCustomSavingsNameState(restored.assets.savingsPlan.customItems))
      .toEqual([{ value: '적금', edited: false, composing: false }]);
    expect(buildAggregates(buildCanonicalInput(restored)).totalSavingsAnnual).toBe(600);
  });

  it('확정 전 임시 이름은 자동저장 payload와 새로고침 복원값에 포함되지 않는다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = items(['']);
    const nameEdits = [{ value: '여행 적금', edited: true, composing: false }];
    const restored = mergeDraft(initialFormData, JSON.parse(JSON.stringify(formData)));
    expect(nameEdits[0].value).toBe('여행 적금');
    expect(restored.assets.savingsPlan.customItems[0].name).toBe('');
  });

  it('정상 확정 이름은 자동저장 payload에서 그대로 복원된다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = items(['']);
    const committed = commitCustomSavingsNameData({
      formData, customPath: 'assets.savingsPlan.customItems', index: 0, value: '여행 적금',
    });
    const restored = mergeDraft(initialFormData, JSON.parse(JSON.stringify(committed)));
    expect(restored.assets.savingsPlan.customItems[0].name).toBe('여행 적금');
  });
});

describe('저축 주식 누적액의 금융자산 연동', () => {
  it('보호할 간편 총액이 없는 신규 상태에서는 상세 모드와 총액 4,000을 활성화한다', () => {
    const harness = stateHarness(structuredClone(initialFormData));

    updateDirectLinkedAsset(harness.get(), harness.setField, 'assets.financialAssets.stocks', '4000');

    expect(harness.get().assets.financialAssets).toMatchObject({
      inputMode: 'detailed', stocks: 4000, total: 4000,
      simpleTotal: '', simpleInputStored: false,
    });
  });

  it('상세 상태의 기존 펀드 2,000과 새 주식 4,000을 합산한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.financialAssets, { inputMode: 'detailed', funds: 2000, total: 2000 });
    const harness = stateHarness(formData);

    updateDirectLinkedAsset(harness.get(), harness.setField, 'assets.financialAssets.stocks', '4000');

    expect(harness.get().assets.financialAssets).toMatchObject({ stocks: 4000, funds: 2000, total: 6000 });
  });

  it('저장된 간편 총액 1억원을 덮어쓰거나 상세 모드로 자동 전환하지 않는다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.financialAssets, {
      inputMode: 'simple', total: 10000, simpleTotal: 10000, simpleInputStored: true,
    });
    const harness = stateHarness(formData);

    updateDirectLinkedAsset(harness.get(), harness.setField, 'assets.financialAssets.stocks', '4000');

    expect(harness.get().assets.financialAssets).toMatchObject({
      inputMode: 'simple', total: 10000, simpleTotal: 10000, simpleInputStored: true, stocks: 4000,
    });
  });

  it('보호된 간편 총액에서 상세 전환을 취소하거나 승인하는 기존 확인 흐름을 유지한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.financialAssets, {
      inputMode: 'simple', total: 10000, simpleTotal: 10000, simpleInputStored: true, stocks: 4000,
    });
    const harness = stateHarness(formData);
    const cancel = vi.fn(() => false);

    expect(changeFinancialMode(harness, 'detailed', cancel)).toBe(false);
    expect(cancel).toHaveBeenCalledOnce();
    expect(harness.get().assets.financialAssets).toMatchObject({ inputMode: 'simple', total: 10000 });

    const approve = vi.fn(() => true);
    expect(changeFinancialMode(harness, 'detailed', approve)).toBe(true);
    expect(approve).toHaveBeenCalledOnce();
    expect(harness.get().assets.financialAssets).toMatchObject({
      inputMode: 'detailed', total: 4000, simpleTotal: 10000, simpleInputStored: true,
    });
  });

  it('상세 상태에서 주식 삭제 시 펀드·채권·기타는 유지하고 합계에서 주식만 제거한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.financialAssets, {
      inputMode: 'detailed', total: 10000, stocks: 4000, funds: 2000, bonds: 1000,
      other: 3000, otherItems: [{ name: '가상자산', amount: 3000 }],
    });
    const harness = stateHarness(formData);

    updateDirectLinkedAsset(harness.get(), harness.setField, 'assets.financialAssets.stocks', '');

    expect(harness.get().assets.financialAssets).toMatchObject({
      inputMode: 'detailed', total: 6000, stocks: '', funds: 2000, bonds: 1000,
      other: 3000, otherItems: [{ name: '가상자산', amount: 3000 }],
    });
  });

  it('간편 총액 필드가 하나라도 남아 있으면 신규 상태로 오인하지 않는다', () => {
    for (const protectedValues of [
      { total: 10000, simpleTotal: '', simpleInputStored: false },
      { total: '', simpleTotal: 10000, simpleInputStored: false },
      { total: '', simpleTotal: '', simpleInputStored: true },
    ]) {
      const formData = structuredClone(initialFormData);
      Object.assign(formData.assets.financialAssets, protectedValues);
      const harness = stateHarness(formData);

      updateDirectLinkedAsset(harness.get(), harness.setField, 'assets.financialAssets.stocks', '4000');

      expect(harness.get().assets.financialAssets.inputMode).toBe('simple');
      expect(harness.get().assets.financialAssets.total).toBe(protectedValues.total);
      expect(harness.get().assets.financialAssets.simpleTotal).toBe(protectedValues.simpleTotal);
    }
  });
});

describe('저축 누적액의 현금성 자산 연동', () => {
  it.each(['파킹통장', 'ISA'])('%s 무입력 취소는 빈 자산 항목을 생성하지 않는다', (name) => {
    const harness = stateHarness(structuredClone(initialFormData));

    updateLinkedLiquidAsset(
      harness.get(), harness.setField,
      { type: 'liquidCustomItem', name },
      ''
    );

    expect(harness.get().assets.liquidAssets.customItems).toEqual([]);
    expect(harness.get().assets.liquidAssets.total).toBe('');
  });

  it.each(['파킹통장', 'ISA'])('기존 %s 자산은 저축 무입력 취소로 변경되지 않는다', (name) => {
    const formData = structuredClone(initialFormData);
    formData.assets.liquidAssets.inputMode = 'detailed';
    formData.assets.liquidAssets.customItems = [{ name, amount: 2500 }];
    formData.assets.liquidAssets.total = 2500;
    formData.assets.savingsPlan.selectedCategories = [name === 'ISA' ? 'isa' : 'parkingAccount'];
    const beforeAssets = structuredClone(formData.assets.liquidAssets);
    const harness = stateHarness(formData);

    clearPresetSavingsItem({
      breakdown: harness.get().assets.savingsPlan.breakdown,
      customItems: [],
      categories: [{ key: name === 'ISA' ? 'isa' : 'parkingAccount' }],
      key: name === 'ISA' ? 'isa' : 'parkingAccount',
      basePath: 'assets.savingsPlan.breakdown',
      totalPath: 'assets.savingsPlan.monthly',
      annualPath: 'assets.savingsPlan.annual',
      selectedPath: 'assets.savingsPlan.selectedCategories',
      selectedKeys: harness.get().assets.savingsPlan.selectedCategories,
      setField: harness.setField,
    });

    expect(harness.get().assets.liquidAssets).toEqual(beforeAssets);
    expect(harness.get().assets.savingsPlan.selectedCategories).toEqual([]);
  });

  it('동일 이름 자산이 여러 개면 어느 항목도 수정하지 않는다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.liquidAssets.inputMode = 'detailed';
    formData.assets.liquidAssets.customItems = [
      { name: '파킹통장', amount: 1000 },
      { name: '파킹통장', amount: 2000 },
    ];
    formData.assets.liquidAssets.total = 3000;
    const before = structuredClone(formData.assets.liquidAssets);
    const harness = stateHarness(formData);

    updateLinkedLiquidAsset(
      harness.get(), harness.setField,
      { type: 'liquidCustomItem', name: '파킹통장' },
      '5000'
    );

    expect(harness.get().assets.liquidAssets).toEqual(before);
  });

  it('보호할 간편 총액이 없으면 상세 모드로 전환하고 여러 연동값을 합산한다', () => {
    const harness = stateHarness(structuredClone(initialFormData));

    updateLinkedLiquidAsset(harness.get(), harness.setField, { type: 'liquidBreakdown', field: 'savings' }, '6000');
    updateLinkedLiquidAsset(harness.get(), harness.setField, { type: 'liquidBreakdown', field: 'subscription' }, '500');
    updateLinkedLiquidAsset(harness.get(), harness.setField, { type: 'liquidCustomItem', name: 'ISA' }, '700');

    expect(harness.get().assets.liquidAssets).toMatchObject({
      inputMode: 'detailed', total: 7200,
      breakdown: { savings: 6000, subscription: 500 },
      customItems: [{ name: 'ISA', amount: 700 }],
      simpleTotal: '', simpleInputStored: false,
    });
  });

  it('기존 간편 총액이 있으면 상세값만 저장하고 모드와 총액을 보호한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.liquidAssets, {
      inputMode: 'simple', total: 10000, simpleTotal: 10000, simpleInputStored: true,
    });
    const harness = stateHarness(formData);

    updateLinkedLiquidAsset(harness.get(), harness.setField, { type: 'liquidBreakdown', field: 'savings' }, '4000');

    expect(harness.get().assets.liquidAssets).toMatchObject({
      inputMode: 'simple', total: 10000, simpleTotal: 10000, simpleInputStored: true,
      breakdown: { savings: 4000 },
    });
  });

  it('상세 상태에서 연동값 삭제 시 다른 현금성 자산을 유지하고 합계를 다시 계산한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.liquidAssets, {
      inputMode: 'detailed', total: 7000,
      breakdown: { ...formData.assets.liquidAssets.breakdown, savings: 4000, deposit: 2000 },
      customItems: [{ name: 'ISA', amount: 1000 }],
    });
    const harness = stateHarness(formData);

    updateLinkedLiquidAsset(harness.get(), harness.setField, { type: 'liquidBreakdown', field: 'savings' }, '');

    expect(harness.get().assets.liquidAssets).toMatchObject({
      inputMode: 'detailed', total: 3000,
      breakdown: { savings: '', deposit: 2000 },
      customItems: [{ name: 'ISA', amount: 1000 }],
    });
  });
});

describe('저축 기본 항목 취소 시 기존 자산 보호', () => {
  const linkedCases = [
    ['installment', (formData) => { formData.assets.liquidAssets.breakdown.savings = 1000; }],
    ['subscription', (formData) => { formData.assets.liquidAssets.breakdown.subscription = 1100; }],
    ['stocks', (formData) => { formData.assets.financialAssets.stocks = 1200; }],
    ['variableAnnuity', (formData) => { formData.assets.pensionAssetsBreakdown.variableAnnuity = 1300; }],
    ['pensionSavings', (formData) => { formData.assets.pensionAssetsBreakdown.pensionSavingsAccount = 1400; }],
    ['irp', (formData) => { formData.assets.pensionAssetsBreakdown.irp = 1500; }],
  ];

  it.each(linkedCases)('%s 단순 선택 취소는 연결 자산과 자산 합계를 유지한다', (key, setAsset) => {
    const formData = structuredClone(initialFormData);
    setAsset(formData);
    formData.assets.liquidAssets.total = 2100;
    formData.assets.financialAssets.total = 2200;
    formData.assets.pensionAssets = 4200;
    formData.assets.savingsPlan.selectedCategories = [key];
    const assetsBefore = structuredClone({
      liquidAssets: formData.assets.liquidAssets,
      financialAssets: formData.assets.financialAssets,
      pensionAssets: formData.assets.pensionAssets,
      pensionAssetsBreakdown: formData.assets.pensionAssetsBreakdown,
    });
    const harness = stateHarness(formData);

    clearPresetSavingsItem({
      breakdown: harness.get().assets.savingsPlan.breakdown,
      customItems: [], categories: [{ key }], key,
      basePath: 'assets.savingsPlan.breakdown',
      totalPath: 'assets.savingsPlan.monthly', annualPath: 'assets.savingsPlan.annual',
      selectedPath: 'assets.savingsPlan.selectedCategories', selectedKeys: [key],
      setField: harness.setField,
    });

    expect({
      liquidAssets: harness.get().assets.liquidAssets,
      financialAssets: harness.get().assets.financialAssets,
      pensionAssets: harness.get().assets.pensionAssets,
      pensionAssetsBreakdown: harness.get().assets.pensionAssetsBreakdown,
    }).toEqual(assetsBefore);
    expect(harness.get().assets.savingsPlan.selectedCategories).toEqual([]);
    expect(harness.get().assets.savingsPlan.monthly).toBe(0);
  });

  it('입력된 저축정보는 확인 대상이며 취소하는 동안 전체 데이터가 바뀌지 않는다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.selectedCategories = ['installment'];
    formData.assets.savingsPlan.breakdown.installment.monthly = 30;
    formData.assets.liquidAssets.breakdown.savings = 1000;
    const before = structuredClone(formData);

    expect(hasEnteredSavingsDetails(formData.assets.savingsPlan.breakdown.installment)).toBe(true);
    // 확인창에서 취소하면 clearPresetSavingsItem을 호출하지 않는다.
    expect(formData).toEqual(before);
  });

  it('확인 후 저축정보만 삭제하고 자산 및 자산 합계는 보존한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.savingsPlan.breakdown.installment, {
      monthly: 30, remainingMonths: 12, interestRate: 3,
    });
    formData.assets.savingsPlan.breakdown.irp.monthly = 20;
    formData.assets.savingsPlan.selectedCategories = ['installment', 'irp'];
    formData.assets.savingsPlan.monthly = 50;
    formData.assets.savingsPlan.annual = 600;
    formData.assets.liquidAssets.breakdown.savings = 1000;
    formData.assets.liquidAssets.total = 1000;
    const assetsBefore = structuredClone(formData.assets.liquidAssets);
    const harness = stateHarness(formData);

    clearPresetSavingsItem({
      breakdown: harness.get().assets.savingsPlan.breakdown,
      customItems: [], categories: [{ key: 'installment' }, { key: 'irp' }], key: 'installment',
      basePath: 'assets.savingsPlan.breakdown', totalPath: 'assets.savingsPlan.monthly',
      annualPath: 'assets.savingsPlan.annual', selectedPath: 'assets.savingsPlan.selectedCategories',
      selectedKeys: ['installment', 'irp'], setField: harness.setField,
    });

    expect(harness.get().assets.liquidAssets).toEqual(assetsBefore);
    expect(harness.get().assets.savingsPlan.monthly).toBe(20);
    expect(harness.get().assets.savingsPlan.annual).toBe(240);
    expect(harness.get().assets.savingsPlan.selectedCategories).toEqual(['irp']);
  });

  it('취소 상태를 자동저장 payload로 직렬화해 다시 불러와도 선택 해제와 기존 자산이 유지된다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.selectedCategories = ['parkingAccount'];
    formData.assets.liquidAssets.inputMode = 'detailed';
    formData.assets.liquidAssets.customItems = [{ name: '파킹통장', amount: 2500 }];
    formData.assets.liquidAssets.total = 2500;
    const harness = stateHarness(formData);

    clearPresetSavingsItem({
      breakdown: harness.get().assets.savingsPlan.breakdown,
      customItems: [], categories: [{ key: 'parkingAccount' }], key: 'parkingAccount',
      basePath: 'assets.savingsPlan.breakdown', totalPath: 'assets.savingsPlan.monthly',
      annualPath: 'assets.savingsPlan.annual', selectedPath: 'assets.savingsPlan.selectedCategories',
      selectedKeys: ['parkingAccount'], setField: harness.setField,
    });

    const savedPayload = JSON.parse(JSON.stringify(harness.get()));
    const restored = mergeDraft(initialFormData, savedPayload);
    expect(restored.assets.savingsPlan.selectedCategories).toEqual([]);
    expect(restored.assets.liquidAssets.customItems).toEqual([{ name: '파킹통장', amount: 2500 }]);
    expect(restored.assets.liquidAssets.total).toBe(2500);
  });
});

describe('저축 누적액의 연금자산 연동', () => {
  it('보호할 간편 총액이 없으면 상세 모드로 전환하고 여러 연동값을 합산한다', () => {
    const harness = stateHarness(structuredClone(initialFormData));

    updateLinkedPensionAsset(harness.get(), harness.setField, 'variableAnnuity', '3000');
    updateLinkedPensionAsset(harness.get(), harness.setField, 'pensionSavingsAccount', '2000');
    updateLinkedPensionAsset(harness.get(), harness.setField, 'irp', '1000');

    expect(harness.get().assets).toMatchObject({
      pensionAssetsInputMode: 'detailed', pensionAssets: 6000,
      pensionAssetsSimpleTotal: '', pensionAssetsSimpleInputStored: false,
      pensionAssetsBreakdown: { variableAnnuity: 3000, pensionSavingsAccount: 2000, irp: 1000 },
    });
  });

  it('기존 간편 총액이 있으면 상세값만 저장하고 모드와 총액을 보호한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets, {
      pensionAssetsInputMode: 'simple', pensionAssets: 10000,
      pensionAssetsSimpleTotal: 10000, pensionAssetsSimpleInputStored: true,
    });
    const harness = stateHarness(formData);

    updateLinkedPensionAsset(harness.get(), harness.setField, 'variableAnnuity', '4000');

    expect(harness.get().assets).toMatchObject({
      pensionAssetsInputMode: 'simple', pensionAssets: 10000,
      pensionAssetsSimpleTotal: 10000, pensionAssetsSimpleInputStored: true,
      pensionAssetsBreakdown: { variableAnnuity: 4000 },
    });
  });

  it('상세 상태에서 연동값 삭제 시 다른 연금자산을 유지하고 합계를 다시 계산한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets, { pensionAssetsInputMode: 'detailed', pensionAssets: 10000 });
    Object.assign(formData.assets.pensionAssetsBreakdown, {
      variableAnnuity: 4000, pensionSavingsAccount: 2000, irp: 1000,
      selfRetirementPension: 2000, other: 1000,
      otherItems: [{ name: '퇴직연금', amount: 1000 }],
    });
    const harness = stateHarness(formData);

    updateLinkedPensionAsset(harness.get(), harness.setField, 'variableAnnuity', '');

    expect(harness.get().assets).toMatchObject({
      pensionAssetsInputMode: 'detailed', pensionAssets: 6000,
      pensionAssetsBreakdown: {
        variableAnnuity: '', pensionSavingsAccount: 2000, irp: 1000,
        selfRetirementPension: 2000, otherItems: [{ name: '퇴직연금', amount: 1000 }],
      },
    });
  });

  it('퇴직연금 입력으로 보관된 simple 총액도 보호한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets, {
      pensionAssetsInputMode: 'simple', pensionAssets: 5000,
      pensionAssetsSimpleTotal: 5000, pensionAssetsSimpleInputStored: true,
    });
    formData.assets.pensionAssetsBreakdown.selfRetirementPension = 5000;
    const harness = stateHarness(formData);

    updateLinkedPensionAsset(harness.get(), harness.setField, 'irp', '1000');

    expect(harness.get().assets).toMatchObject({
      pensionAssetsInputMode: 'simple', pensionAssets: 5000,
      pensionAssetsSimpleTotal: 5000, pensionAssetsSimpleInputStored: true,
      pensionAssetsBreakdown: { selfRetirementPension: 5000, irp: 1000 },
    });
  });
});

describe('저축 삭제 전 자산 처리 선택', () => {
  const removalPaths = {
    basePath: 'assets.savingsPlan.breakdown',
    customPath: 'assets.savingsPlan.customItems',
    totalPath: 'assets.savingsPlan.monthly',
    annualPath: 'assets.savingsPlan.annual',
    selectedPath: 'assets.savingsPlan.selectedCategories',
    categoryKeys: SAVINGS_CATEGORIES.map(({ key }) => key),
  };

  const removeCustom = (formData, deleteAsset, index = 0) => removeSavingsWithAssetChoice({
    formData, kind: 'custom', index,
    assetLink: { type: 'liquidCustomItem', name: formData.assets.savingsPlan.customItems[index]?.name || '' },
    deleteAsset, ...removalPaths,
  });

  it('추가 저축과 정확히 하나인 연결 자산을 한 상태 갱신 결과에서 함께 삭제하고 합계를 다시 계산한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.savingsPlan, {
      inputMode: 'detailed', monthly: 30, annual: 360,
      customItems: [{ name: '여행 적금', monthly: 30, remainingMonths: 12, interestRate: 3 }],
    });
    Object.assign(formData.assets.liquidAssets, {
      inputMode: 'detailed', total: 160,
      customItems: [{ name: '여행 적금', amount: 60 }, { name: '비상 여행비', amount: 100 }],
    });

    const next = removeCustom(formData, true);

    expect(next.assets.savingsPlan.customItems).toEqual([]);
    expect(next.assets.savingsPlan).toMatchObject({ monthly: 0, annual: 0 });
    expect(next.assets.liquidAssets.customItems).toEqual([{ name: '비상 여행비', amount: 100 }]);
    expect(next.assets.liquidAssets.total).toBe(100);
    expect(formData.assets.savingsPlan.customItems).toHaveLength(1);
  });

  it('추가 저축만 삭제하면 연결 자산의 이름·금액과 무관한 자산을 모두 유지한다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = [{ name: '여행 적금', monthly: 10, remainingMonths: '', interestRate: '' }];
    formData.assets.savingsPlan.monthly = 10;
    formData.assets.savingsPlan.annual = 120;
    formData.assets.liquidAssets.customItems = [
      { name: '여행 적금', amount: 60 }, { name: '생활비', amount: 200 },
    ];
    const beforeAssets = structuredClone(formData.assets.liquidAssets);

    const next = removeCustom(formData, false);

    expect(next.assets.savingsPlan.customItems).toEqual([]);
    expect(next.assets.liquidAssets).toEqual(beforeAssets);
  });

  it('취소 상태에서는 삭제 함수를 호출하지 않으므로 원본 전체 데이터가 그대로다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = [{ name: '여행 적금', monthly: 10 }];
    formData.assets.liquidAssets.customItems = [{ name: '여행 적금', amount: 60 }];
    const before = structuredClone(formData);
    expect(formData).toEqual(before);
  });

  it('연결 자산이 없으면 추가 저축만 삭제하고 자산을 만들거나 변경하지 않는다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = [{ name: '여행 적금', monthly: 10 }];
    const next = removeCustom(formData, false);
    expect(next.assets.savingsPlan.customItems).toEqual([]);
    expect(next.assets.liquidAssets.customItems).toEqual([]);
  });

  it('동일 이름 자산이 여러 개면 함께 삭제를 거부하고, 저축만 삭제할 때도 모든 자산을 보존한다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = [{ name: '여행 적금', monthly: 10 }];
    formData.assets.liquidAssets.customItems = [
      { name: '여행 적금', amount: 60 }, { name: '여행 적금', amount: 70 },
    ];
    expect(removeCustom(formData, true)).toBe(formData);
    const savingsOnly = removeCustom(formData, false);
    expect(savingsOnly.assets.savingsPlan.customItems).toEqual([]);
    expect(savingsOnly.assets.liquidAssets.customItems).toEqual(formData.assets.liquidAssets.customItems);
  });

  it('입력값 없는 신규 추가 저축 삭제는 빈 자산을 만들지 않는다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = [{ name: '', monthly: '', remainingMonths: '', interestRate: '' }];
    const next = removeCustom(formData, false);
    expect(next.assets.savingsPlan.customItems).toEqual([]);
    expect(next.assets.liquidAssets.customItems).toEqual([]);
  });

  it.each([
    ['현금성 고정 필드', 'installment', { type: 'liquidBreakdown', field: 'savings' }, (data) => {
      data.assets.liquidAssets.inputMode = 'detailed';
      data.assets.liquidAssets.breakdown.savings = 60;
      data.assets.liquidAssets.total = 160;
      data.assets.liquidAssets.customItems = [{ name: '무관 자산', amount: 100 }];
    }, (next) => expect(next.assets.liquidAssets).toMatchObject({ total: 100, breakdown: { savings: '' } })],
    ['금융자산 직접 필드', 'stocks', { type: 'direct', path: 'assets.financialAssets.stocks' }, (data) => {
      data.assets.financialAssets.inputMode = 'detailed';
      data.assets.financialAssets.stocks = 60;
      data.assets.financialAssets.funds = 100;
      data.assets.financialAssets.total = 160;
    }, (next) => expect(next.assets.financialAssets).toMatchObject({ stocks: '', funds: 100, total: 100 })],
    ['연금자산 고정 필드', 'irp', { type: 'pensionBreakdown', field: 'irp' }, (data) => {
      data.assets.pensionAssetsInputMode = 'detailed';
      data.assets.pensionAssetsBreakdown.irp = 60;
      data.assets.pensionAssetsBreakdown.variableAnnuity = 100;
      data.assets.pensionAssets = 160;
    }, (next) => {
      expect(next.assets.pensionAssetsBreakdown.irp).toBe('');
      expect(next.assets.pensionAssets).toBe(100);
    }],
    ['이름 기반 추가 필드', 'parkingAccount', { type: 'liquidCustomItem', name: '파킹통장' }, (data) => {
      data.assets.liquidAssets.inputMode = 'detailed';
      data.assets.liquidAssets.customItems = [{ name: '파킹통장', amount: 60 }, { name: '무관 자산', amount: 100 }];
      data.assets.liquidAssets.total = 160;
    }, (next) => expect(next.assets.liquidAssets).toMatchObject({ total: 100, customItems: [{ name: '무관 자산', amount: 100 }] })],
  ])('기본 저축 %s는 사용자가 함께 삭제를 선택했을 때 해당 자산만 초기화한다', (_label, key, assetLink, setup, assertAsset) => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.breakdown[key].monthly = 10;
    formData.assets.savingsPlan.selectedCategories = [key];
    formData.assets.savingsPlan.monthly = 10;
    formData.assets.savingsPlan.annual = 120;
    setup(formData);

    const next = removeSavingsWithAssetChoice({
      formData, kind: 'preset', key, assetLink, deleteAsset: true, ...removalPaths,
    });

    expect(next.assets.savingsPlan.breakdown[key]).toEqual({ monthly: '', remainingMonths: '', interestRate: '' });
    expect(next.assets.savingsPlan.selectedCategories).toEqual([]);
    expect(next.assets.savingsPlan).toMatchObject({ monthly: 0, annual: 0 });
    assertAsset(next);
  });

  it('자산 유지 후 같은 이름 저축은 현 스키마에서 기존 자산과 구분되지 않음을 명시적으로 고정한다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.customItems = [{ name: '여행 적금', monthly: 10 }];
    formData.assets.liquidAssets.customItems = [{ name: '여행 적금', amount: 60 }];
    const retained = removeCustom(formData, false);
    retained.assets.savingsPlan.customItems = [{ name: '여행 적금', monthly: '' }];

    expect(getLinkedSavingsAssetState(retained, { type: 'liquidCustomItem', name: '여행 적금' }).count).toBe(1);
  });
});

// 저축 카테고리 버튼 "선택" 상태는 openKeys(로컬 UI 상태, 패널 접기/펼치기 전용)와 완전히 분리된
// assets.savingsPlan.selectedCategories(formData)로 판정한다. 이 필드가 명시적으로 배열이면
// 그것을 그대로 따르고(빈 배열 포함), 배열이 아니면(레거시 저장 데이터) 월 저축액이 양수인
// 항목만 선택된 것으로 복원한다.
describe('isCategorySelected', () => {
  it('명시적 배열이 있으면 그 배열만 신뢰한다(월액이 양수여도 배열에 없으면 미선택)', () => {
    const breakdown = { installment: { monthly: '' }, isa: { monthly: 30 } };
    expect(isCategorySelected(['installment'], breakdown, 'installment')).toBe(true);
    expect(isCategorySelected(['installment'], breakdown, 'isa')).toBe(false);
  });

  it('명시적 배열이 빈 배열이어도(신규 진단) 그대로 "미선택"으로 신뢰한다', () => {
    const breakdown = { installment: { monthly: 30 } };
    expect(isCategorySelected([], breakdown, 'installment')).toBe(false);
  });

  it('배열이 아니면(레거시, 필드 자체가 없음) 월 저축액이 양수인 항목만 선택된 것으로 본다', () => {
    const breakdown = { installment: { monthly: 30 }, isa: { monthly: 0 }, irp: { monthly: '' } };
    expect(isCategorySelected(undefined, breakdown, 'installment')).toBe(true);
    expect(isCategorySelected(undefined, breakdown, 'isa')).toBe(false);
    expect(isCategorySelected(undefined, breakdown, 'irp')).toBe(false);
    expect(isCategorySelected(null, breakdown, 'installment')).toBe(true);
  });
});

describe('selectedKeysFrom', () => {
  it('명시적 배열 기준으로 선택된 key 목록을 그대로 반환한다', () => {
    expect(selectedKeysFrom(['isa', 'irp'], {}, CATEGORY_KEYS)).toEqual(['isa', 'irp']);
  });

  it('레거시(배열 없음)에서는 월 저축액이 양수인 항목만 반환한다', () => {
    const breakdown = { installment: { monthly: 30 }, isa: { monthly: '' }, irp: { monthly: 0 } };
    expect(selectedKeysFrom(undefined, breakdown, CATEGORY_KEYS)).toEqual(['installment']);
  });

  it('아무 것도 선택되지 않은 신규 진단 기본값(빈 배열)은 빈 목록을 반환한다', () => {
    expect(selectedKeysFrom([], { installment: { monthly: 30 } }, CATEGORY_KEYS)).toEqual([]);
  });
});
