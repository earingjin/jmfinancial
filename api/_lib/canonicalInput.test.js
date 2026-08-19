import { describe, expect, it } from 'vitest';
import { buildCanonicalInput } from './canonicalInput.js';

const input = () => ({
  basic: { hasSpouse: true },
  income: { salary: { monthly: 300, annualBonus: 120 }, business: {}, regularIncomes: [{ type: 'business', annual: 1200 }, { type: 'other', annual: 240 }] },
  spouse: { salary: { monthly: 100, annualBonus: 0 } },
  expense: { healthInsurance: { monthly: 9999, items: [{ monthly: 10 }] } },
  assets: {
    currentIncome: { monthly: 5000, annual: 60000 },
    currentLivingCost: { inputMode: 'detailed', monthly: 9999, annual: 9999, breakdown: { rent: 100, other: 9999, otherItems: [{ amount: 20 }] } },
    liquidAssets: { total: 9999, breakdown: { deposit: 100 }, customItems: [{ amount: 20 }] },
    financialAssets: { other: 9999, otherItems: [{ amount: 30 }] },
    pensionAssets: 9999, pensionAssetsBreakdown: { variableAnnuity: 10, pensionSavingsAccount: 20, irp: 30, other: 9999, otherItems: [{ amount: 40 }] },
    realEstateAssets: { total: 9999, mainProperty: 1000, otherItems: [{ amount: 200 }] },
    otherAssets: { total: 9999, items: [{ amount: 50 }, { amount: 25 }] },
    debtStatus: { inputMode: 'detailed', totalBalance: 9999, monthlyRepayment: 9999, breakdown: { mortgage: { repaymentType: 'interestOnly', principal: 500, monthlyInterest: 5 } }, customItems: [] },
    savingsPlan: { monthly: 9999, annual: 9999, retirementMonthly: 50, retirementAnnual: 9999, breakdown: { installment: { monthly: 100 } }, customItems: [{ monthly: 20 }] },
  },
});

describe('buildCanonicalInput', () => {
  it('recomputes browser-derived totals from detail inputs', () => {
    const result = buildCanonicalInput(input());
    expect(result.assets.currentIncome.monthly).toBe(410);
    expect(result.income.business.monthly).toBe(100);
    expect(result.assets.currentLivingCost.monthly).toBe(120);
    expect(result.expense.healthInsurance.monthly).toBe(10);
    expect(result.assets.liquidAssets.total).toBe(120);
    expect(result.assets.financialAssets.other).toBe(30);
    expect(result.assets.pensionAssets).toBe(100);
    expect(result.assets.realEstateAssets.total).toBe(1200);
    expect(result.assets.otherAssets.total).toBe(75);
    expect(result.assets.debtStatus.totalBalance).toBe(500);
    expect(result.assets.debtStatus.monthlyRepayment).toBe(5);
    expect(result.assets.savingsPlan.monthly).toBe(120);
    expect(result.assets.savingsPlan.annual).toBe(1440);
    expect(result.assets.savingsPlan.retirementAnnual).toBe(600);
  });

  it('preserves direct debt totals in simple mode', () => {
    const source = input();
    source.assets.debtStatus.inputMode = 'simple';
    expect(buildCanonicalInput(source).assets.debtStatus.totalBalance).toBe(9999);
  });

  it('preserves direct living-cost totals in simple mode', () => {
    const source = input();
    source.assets.currentLivingCost.inputMode = 'simple';
    expect(buildCanonicalInput(source).assets.currentLivingCost).toMatchObject({ monthly: 9999, annual: 9999 });
  });
});
