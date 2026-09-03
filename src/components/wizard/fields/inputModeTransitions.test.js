import { describe, expect, it, vi } from 'vitest';
import { initialFormData } from '../../../state/initialFormData';
import { mergeDraft } from '../../../state/draftStorage';
import { setIn } from '../../../state/pathUtils';
import { buildCanonicalInput } from '../../../../api/_lib/canonicalInput';
import { buildAggregates } from '../../../../api/_lib/aggregate';
import { buildDebtBreakdown, buildLivingExpenseItems } from '../../../../api/_lib/reportBreakdowns';
import { changeDebtInputMode, changeLivingInputMode } from './inputModeTransitions';

const livingCategories = ['rent', 'maintenance', 'utilities', 'fuel', 'carInsurance', 'clothing', 'fourInsurances', 'food', 'communication', 'medical', 'subscription', 'other'].map((key) => ({ key }));
const debtCategories = ['mortgage', 'depositLoan', 'businessLoan', 'buildingLoan', 'carLoan', 'studentLoan', 'otherLoan'].map((key) => ({ key }));

function stateHarness(source) {
  let formData = source;
  return { get: () => formData, setField: (path, value) => { formData = setIn(formData, path, value); } };
}

function livingChange(harness, nextMode, confirmChange = vi.fn(() => true)) {
  return changeLivingInputMode({
    formData: harness.get(), setField: harness.setField, nextMode,
    basePath: 'assets.currentLivingCost.breakdown', totalPath: 'assets.currentLivingCost.monthly',
    annualPath: 'assets.currentLivingCost.annual', modePath: 'assets.currentLivingCost.inputMode',
    simpleTotalPath: 'assets.currentLivingCost.simpleMonthly', simpleAnnualPath: 'assets.currentLivingCost.simpleAnnual',
    simpleStoredPath: 'assets.currentLivingCost.simpleInputStored', categories: livingCategories, confirmChange,
  });
}

function debtChange(harness, nextMode, confirmChange = vi.fn(() => true)) {
  return changeDebtInputMode({
    formData: harness.get(), setField: harness.setField, nextMode,
    basePath: 'assets.debtStatus.breakdown', customPath: 'assets.debtStatus.customItems',
    balanceTotalPath: 'assets.debtStatus.totalBalance', repaymentTotalPath: 'assets.debtStatus.monthlyRepayment',
    modePath: 'assets.debtStatus.inputMode', simpleBalancePath: 'assets.debtStatus.simpleTotalBalance',
    simpleRepaymentPath: 'assets.debtStatus.simpleMonthlyRepayment', simpleStoredPath: 'assets.debtStatus.simpleInputStored',
    categories: debtCategories, confirmChange,
  });
}

describe('living-cost input mode transitions', () => {
  it('간편 300 → 빈 상세 전환을 안내하고 취소 시 모든 상태를 유지한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.currentLivingCost, { monthly: 300, annual: 3600, inputMode: 'simple' });
    const harness = stateHarness(formData);
    const confirmChange = vi.fn(() => false);
    expect(livingChange(harness, 'detailed', confirmChange)).toBe(false);
    expect(confirmChange.mock.calls[0][0]).toContain('300만원에서 0만원');
    expect(harness.get().assets.currentLivingCost).toMatchObject({ monthly: 300, annual: 3600, inputMode: 'simple' });
  });

  it('적용 후 상세 0만 계산하고 간편 복귀 시 300을 복원한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.currentLivingCost, { monthly: 300, annual: 3600, inputMode: 'simple' });
    const harness = stateHarness(formData);
    livingChange(harness, 'detailed');
    expect(harness.get().assets.currentLivingCost).toMatchObject({ monthly: 0, annual: 0, inputMode: 'detailed', simpleMonthly: 300 });
    expect(buildCanonicalInput(harness.get()).assets.currentLivingCost.monthly).toBe(0);
    livingChange(harness, 'simple');
    expect(harness.get().assets.currentLivingCost).toMatchObject({ monthly: 300, annual: 3600, inputMode: 'simple' });
  });

  it('반복 전환해도 양쪽 값을 복원하고 보고서에는 현재 모드만 남긴다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.currentLivingCost, { monthly: 100, annual: 1200, inputMode: 'simple', simpleMonthly: 100, simpleAnnual: 1200, simpleInputStored: true });
    formData.assets.currentLivingCost.breakdown.food = 300;
    const harness = stateHarness(formData);
    livingChange(harness, 'detailed');
    expect(buildLivingExpenseItems(buildCanonicalInput(harness.get()))).toEqual([{ key: 'living-food', label: '식비', value: 300 }]);
    livingChange(harness, 'simple'); livingChange(harness, 'detailed'); livingChange(harness, 'simple');
    const canonical = buildCanonicalInput(harness.get());
    expect(canonical.assets.currentLivingCost.monthly).toBe(100);
    expect(buildLivingExpenseItems(canonical)).toEqual([{ key: 'living-simple', label: '간편 입력 생활비', value: 100 }]);
  });

  it('간편 입력의 미입력 값과 명시적 0을 각각 그대로 보존한다', () => {
    for (const simpleValue of ['', 0]) {
      const formData = structuredClone(initialFormData);
      Object.assign(formData.assets.currentLivingCost, { inputMode: 'detailed', monthly: 0, simpleMonthly: simpleValue, simpleAnnual: simpleValue, simpleInputStored: true });
      const harness = stateHarness(formData);
      livingChange(harness, 'simple');
      expect(harness.get().assets.currentLivingCost.monthly).toBe(simpleValue);
      expect(harness.get().assets.currentLivingCost.annual).toBe(simpleValue);
    }
  });
});

describe('debt input mode transitions', () => {
  it('간편 부채를 보존하면서 상세 원금·월 상환액으로 전환하고 복원한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.debtStatus, { totalBalance: 5000, monthlyRepayment: 50, inputMode: 'simple' });
    const harness = stateHarness(formData);
    debtChange(harness, 'detailed');
    expect(buildAggregates(buildCanonicalInput(harness.get()))).toMatchObject({ totalDebt: 0, monthlyDebtRepayment: 0 });
    expect(harness.get().assets.debtStatus.simpleTotalBalance).toBe(5000);
    debtChange(harness, 'simple');
    expect(buildAggregates(buildCanonicalInput(harness.get()))).toMatchObject({ totalDebt: 5000, monthlyDebtRepayment: 50 });
  });

  it('상세 5000과 간편 1000을 분리하고 간편 보고서에서 상세 대출을 숨긴다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.debtStatus, { totalBalance: 5000, monthlyRepayment: 40, inputMode: 'detailed', simpleTotalBalance: 1000, simpleMonthlyRepayment: 10, simpleInputStored: true });
    formData.assets.debtStatus.breakdown.mortgage = { repaymentType: 'interestOnly', principal: 5000, monthlyInterest: 40 };
    const harness = stateHarness(formData);
    debtChange(harness, 'simple');
    const canonical = buildCanonicalInput(harness.get());
    expect(buildAggregates(canonical)).toMatchObject({ totalDebt: 1000, monthlyDebtRepayment: 10 });
    expect(buildDebtBreakdown(canonical)).toEqual([{ key: 'total', label: '간편 입력 부채', value: 1000 }]);
    expect(harness.get().assets.debtStatus.breakdown.mortgage.principal).toBe(5000);
  });

  it('새 보존 필드가 없는 기존 상세 초안은 첫 간편 전환에 상세 합계를 사용한다', () => {
    const oldDraft = structuredClone(initialFormData);
    delete oldDraft.assets.debtStatus.simpleTotalBalance; delete oldDraft.assets.debtStatus.simpleMonthlyRepayment; delete oldDraft.assets.debtStatus.simpleInputStored;
    oldDraft.assets.debtStatus.inputMode = 'detailed';
    oldDraft.assets.debtStatus.customItems = [{ name: '기존 대출', repaymentType: 'equalPrincipal', principal: 5000, monthlyRepayment: 50 }];
    const harness = stateHarness(mergeDraft(initialFormData, oldDraft));
    debtChange(harness, 'simple');
    expect(harness.get().assets.debtStatus).toMatchObject({ inputMode: 'simple', totalBalance: 5000, monthlyRepayment: 50, simpleTotalBalance: 5000, simpleMonthlyRepayment: 50, simpleInputStored: true });
  });

  it('금액 차이가 없으면 확인창 없이 전환하고 임시저장 직렬화 후 양쪽 값을 유지한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.debtStatus, { totalBalance: 1000, monthlyRepayment: 10, inputMode: 'simple' });
    formData.assets.debtStatus.breakdown.mortgage = { repaymentType: 'interestOnly', principal: 1000, monthlyInterest: 10 };
    const harness = stateHarness(formData);
    const confirmChange = vi.fn(() => true);
    debtChange(harness, 'detailed', confirmChange);
    expect(confirmChange).not.toHaveBeenCalled();

    const restored = JSON.parse(JSON.stringify(harness.get()));
    expect(restored.assets.debtStatus).toMatchObject({
      inputMode: 'detailed', totalBalance: 1000, monthlyRepayment: 10,
      simpleTotalBalance: 1000, simpleMonthlyRepayment: 10, simpleInputStored: true,
    });
    expect(restored.assets.debtStatus.breakdown.mortgage.principal).toBe(1000);
  });
});
