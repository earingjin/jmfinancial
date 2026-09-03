import { describe, it, expect } from 'vitest';
import { applyScenarios, calcScenarioComparison } from './scenarios.js';
import { buildAggregates } from './aggregate.js';

function deepMerge(base, override) {
  if (Array.isArray(override)) return override;
  if (typeof override !== 'object' || override === null) return override;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base?.[key], override[key]);
  }
  return result;
}

const BASE = {
  basic: { birthYear: 1985, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: 3 },
  income: {
    business: { monthly: 100 },
    severance: { type: 'lumpsum', lumpsum: 5000 },
    nationalPension: { monthly: 80, months: 240 },
    personalPension: { type: 'installment', monthly: 10, months: 120 },
    otherIncomes: [],
  },
  spouse: {},
  expense: { retirementLivingCost: 200, housingCost: 0, healthInsurance: { monthly: 5 }, medical: { annual: 0 }, otherExpenses: [], children: [] },
  assets: {
    currentIncome: { monthly: 500 },
    currentLivingCost: { monthly: 200 },
    liquidAssets: { total: 1200 },
    financialAssets: { stocks: 500, funds: 0, other: 0 },
    pensionAssets: 300,
    realEstateAssets: { total: 10000 },
    debtStatus: { totalBalance: 500, monthlyRepayment: 20 },
    insurance: { monthlyPremium: 45 },
    savingsPlan: { monthly: 200, annual: 2400, retirementMonthly: 150, retirementAnnual: 1800 },
  },
  scenarios: {
    reverseMortgage: { enabled: false, ageAtStart: '', housePrice: '' },
    realEstateConversion: { enabled: false, ageAtConversion: '', cashOutAmount: '' },
    expenseReduction: { enabled: false, reductionRate: '', targets: [] },
    additionalIncome: { enabled: false, monthlySalary: '', months: '' },
  },
};

function input(overrides = {}) {
  return deepMerge(BASE, overrides);
}

describe('A-4 reverse mortgage scenario - must not mix into severance/retirement pension', () => {
  it('applies to a user whose severance.type is "lumpsum" (the default) - the historical bug', () => {
    const scenarioInput = input({ scenarios: { reverseMortgage: { enabled: true, ageAtStart: 65, housePrice: 50000 } } });
    const before = buildAggregates(scenarioInput);
    const { adjusted } = applyScenarios(scenarioInput);
    const after = buildAggregates(adjusted);

    // The whole point of the scenario is that it must actually raise retirement income
    // even when the user's real severance is a lump-sum payout.
    expect(after.monthlyRetirementIncome).toBeGreaterThan(before.monthlyRetirementIncome);
  });

  it('does not mix into severancePensionMonthly - the user actual severance figure is untouched', () => {
    const scenarioInput = input({ scenarios: { reverseMortgage: { enabled: true, ageAtStart: 65, housePrice: 50000 } } });
    const before = buildAggregates(scenarioInput);
    const { adjusted } = applyScenarios(scenarioInput);
    const after = buildAggregates(adjusted);
    expect(after.severancePensionMonthly).toBe(before.severancePensionMonthly);
  });

  it('does not mutate the original input object (severance.type stays lumpsum)', () => {
    const scenarioInput = input({ scenarios: { reverseMortgage: { enabled: true, ageAtStart: 65, housePrice: 50000 } } });
    applyScenarios(scenarioInput);
    expect(scenarioInput.income.severance.type).toBe('lumpsum');
  });

  it('exposes the reverse mortgage income as its own distinct figure', () => {
    const scenarioInput = input({ scenarios: { reverseMortgage: { enabled: true, ageAtStart: 65, housePrice: 50000 } } });
    const { adjusted } = applyScenarios(scenarioInput);
    const after = buildAggregates(adjusted);
    expect(after.reverseMortgageMonthly).toBeGreaterThan(0);
  });

  it('feeds through to indicator9 in the before/after scenario comparison', () => {
    const scenarioInput = input({ scenarios: { reverseMortgage: { enabled: true, ageAtStart: 65, housePrice: 50000 } } });
    const comparison = calcScenarioComparison(scenarioInput);
    expect(comparison.after.indicator9.rawValue).toBeGreaterThan(comparison.before.indicator9.rawValue);
  });
});

describe('A-5 real estate conversion scenario - asset conservation', () => {
  it('preserves total assets when financial assets use simple-total mode', () => {
    const scenarioInput = input({
      assets: { financialAssets: { inputMode: 'simple', total: 1000, other: 9000 } },
      scenarios: { realEstateConversion: { enabled: true, ageAtConversion: 60, cashOutAmount: 3000 } },
    });
    const before = buildAggregates(scenarioInput);
    const { adjusted } = applyScenarios(scenarioInput);
    const after = buildAggregates(adjusted);

    expect(adjusted.assets.financialAssets.total).toBe(4000);
    expect(after.totalAssets).toBeCloseTo(before.totalAssets, 6);
  });

  it('preserves total assets when cashOutAmount is within the real estate holding', () => {
    const scenarioInput = input({ scenarios: { realEstateConversion: { enabled: true, ageAtConversion: 60, cashOutAmount: 3000 } } });
    const before = buildAggregates(scenarioInput);
    const { adjusted } = applyScenarios(scenarioInput);
    const after = buildAggregates(adjusted);
    expect(after.totalAssets).toBeCloseTo(before.totalAssets, 6);
    expect(before.realEstateTotal - after.realEstateTotal).toBeCloseTo(after.financialAssetsTotal - before.financialAssetsTotal, 6);
  });

  it('does not fabricate assets when cashOutAmount exceeds the real estate holding (defensive clamp)', () => {
    const scenarioInput = input({ scenarios: { realEstateConversion: { enabled: true, ageAtConversion: 60, cashOutAmount: 999999 } } });
    const before = buildAggregates(scenarioInput);
    const { adjusted } = applyScenarios(scenarioInput);
    const after = buildAggregates(adjusted);
    expect(after.totalAssets).toBeCloseTo(before.totalAssets, 6);
    expect(after.realEstateTotal).toBe(0);
  });
});

describe('A-6 additional income scenario - single canonical field only', () => {
  it('adds only to income.business.monthly, not to assets.currentIncome.monthly (avoids double counting)', () => {
    const scenarioInput = input({ scenarios: { additionalIncome: { enabled: true, monthlySalary: 100, months: 60 } } });
    const before = buildAggregates(scenarioInput);
    const { adjusted } = applyScenarios(scenarioInput);
    expect(adjusted.assets.currentIncome.monthly).toBe(before.salaryMonthly);
    expect(adjusted.income.business.monthly).toBe(before.businessMonthly + 100);
  });

  it('does not double-count the additional income in monthlyIncome', () => {
    const scenarioInput = input({ scenarios: { additionalIncome: { enabled: true, monthlySalary: 100, months: 60 } } });
    const before = buildAggregates(scenarioInput);
    const { adjusted } = applyScenarios(scenarioInput);
    const after = buildAggregates(adjusted);
    expect(after.monthlyIncome).toBeCloseTo(before.monthlyIncome + 100, 6);
  });
});
