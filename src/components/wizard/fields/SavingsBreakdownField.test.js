import { describe, expect, it, vi } from 'vitest';
import { initialFormData } from '../../../state/initialFormData';
import { setIn } from '../../../state/pathUtils';
import { changeTotalInputMode } from './inputModeTransitions';
import {
  isCategorySelected,
  selectedKeysFrom,
  updateDirectLinkedAsset,
  updateLinkedLiquidAsset,
  updateLinkedPensionAsset,
} from './SavingsBreakdownField.jsx';

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
