import { describe, it, expect } from 'vitest';
import { calcIndicators } from './indicators.js';

function deepMerge(base, override) {
  if (Array.isArray(override)) return override;
  if (typeof override !== 'object' || override === null) return override;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base?.[key], override[key]);
  }
  return result;
}

// A fully healthy baseline input - every indicator should be calculable and
// land in a "good" band. Used as the starting point for total=100 regression
// tests and as a base to override for individual-indicator boundary tests.
const HEALTHY_BASE = {
  basic: { birthYear: 1985, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: 3 },
  income: {
    business: { monthly: 0 },
    severance: { type: 'lumpsum', lumpsum: 5000 },
    nationalPension: { monthly: 100, months: 240 },
    personalPension: { type: 'installment', monthly: 20, months: 120 },
    otherIncomes: [],
  },
  spouse: {},
  expense: {
    retirementLivingCost: 200,
    housingCost: 0,
    healthInsurance: { monthly: 5 },
    medical: { annual: 0 },
    otherExpenses: [],
    children: [],
  },
  assets: {
    currentIncome: { monthly: 500 },
    currentLivingCost: { monthly: 200 },
    liquidAssets: { total: 1200 },
    financialAssets: { stocks: 500, funds: 0, other: 0 },
    pensionAssets: 300,
    realEstateAssets: { total: 1000 },
    debtStatus: { totalBalance: 500, monthlyRepayment: 20 },
    insurance: { monthlyPremium: 45 },
    savingsPlan: { monthly: 200, annual: 2400, retirementMonthly: 150, retirementAnnual: 1800 },
  },
  scenarios: {},
};

function input(overrides = {}) {
  return deepMerge(HEALTHY_BASE, overrides);
}

function findIndicator(result, key) {
  return result.indicators.find((i) => i.key === key);
}

describe('total score integrity', () => {
  it('sums to exactly 100 for a healthy under-65 input', () => {
    const result = calcIndicators(input());
    expect(result.is65Plus).toBe(false);
    expect(result.notCalculable).toBe(false);
    expect(result.totalScore).toBe(
      result.indicators.reduce((sum, i) => sum + i.score, 0)
    );
    const maxSum = result.indicators.reduce((sum, i) => sum + i.maxScore, 0);
    expect(maxSum).toBe(100);
  });

  it('sums to exactly 100 for a healthy 65+ input (indicator7 absorbed into indicator9)', () => {
    const result = calcIndicators(input({ basic: { birthYear: new Date().getFullYear() - 66 } }));
    expect(result.is65Plus).toBe(true);
    const retirementSavings = findIndicator(result, 'retirementSavings');
    const retirementIncome = findIndicator(result, 'retirementIncome');
    expect(retirementSavings.maxScore).toBe(0);
    expect(retirementIncome.maxScore).toBe(30);
    const maxSum = result.indicators.reduce((sum, i) => sum + i.maxScore, 0);
    expect(maxSum).toBe(100);
  });
});

describe('A-2 / N/A handling - denominator 0 must never score best or worst silently', () => {
  it('household ratio: income=0 -> N/A, not a perfect score', () => {
    const result = calcIndicators(input({ assets: { currentIncome: { monthly: 0 } } }));
    const ind = findIndicator(result, 'household');
    expect(ind.notCalculable).toBe(true);
    expect(ind.score).toBeNull();
    expect(ind.rawValue).toBeNull();
    expect(ind.displayValue).toBeNull();
    expect(ind.reason).toMatch(/소득/);
  });

  it('household ratio: income=0 AND expense=0 must still be N/A, not 0%', () => {
    const result = calcIndicators(
      input({ assets: { currentIncome: { monthly: 0 }, currentLivingCost: { monthly: 0 } } })
    );
    expect(findIndicator(result, 'household').notCalculable).toBe(true);
  });

  it('DSR: income=0 -> N/A', () => {
    const result = calcIndicators(input({ assets: { currentIncome: { monthly: 0 } } }));
    expect(findIndicator(result, 'dsr').notCalculable).toBe(true);
  });

  it('insurance: income=0 -> N/A (even though premium > 0)', () => {
    const result = calcIndicators(input({ assets: { currentIncome: { monthly: 0 } } }));
    expect(findIndicator(result, 'insurance').notCalculable).toBe(true);
  });

  it('insurance: premium=0 with positive income -> NOT N/A, scores 0% normally', () => {
    const result = calcIndicators(input({ assets: { insurance: { monthlyPremium: 0 } } }));
    const ind = findIndicator(result, 'insurance');
    expect(ind.notCalculable).toBe(false);
    expect(ind.rawValue).toBe(0);
    expect(ind.score).toBe(0);
  });

  it('savingsRate: income=0 -> N/A', () => {
    const result = calcIndicators(input({ assets: { currentIncome: { monthly: 0 } } }));
    expect(findIndicator(result, 'savingsRate').notCalculable).toBe(true);
  });

  it('debtBurden: totalAssets=0 -> N/A (not a perfect score)', () => {
    const result = calcIndicators(
      input({
        assets: {
          liquidAssets: { total: 0 },
          financialAssets: { stocks: 0, funds: 0, other: 0 },
          pensionAssets: 0,
          realEstateAssets: { total: 0 },
        },
      })
    );
    const ind = findIndicator(result, 'debtBurden');
    expect(ind.notCalculable).toBe(true);
    expect(ind.score).toBeNull();
  });

  it('financialAssetRatio: totalAssets=0 -> N/A', () => {
    const result = calcIndicators(
      input({
        assets: {
          liquidAssets: { total: 0 },
          financialAssets: { stocks: 0, funds: 0, other: 0 },
          pensionAssets: 0,
          realEstateAssets: { total: 0 },
        },
      })
    );
    expect(findIndicator(result, 'financialAssetRatio').notCalculable).toBe(true);
  });

  it('retirementSavings (under 65): totalSavingsAnnual=0 -> N/A', () => {
    const result = calcIndicators(input({ assets: { savingsPlan: { monthly: 0, annual: 0, retirementMonthly: 0, retirementAnnual: 0 } } }));
    expect(findIndicator(result, 'retirementSavings').notCalculable).toBe(true);
  });

  it('emergency: monthly expense=0 -> N/A (not 0x, not best, regardless of liquid assets)', () => {
    const zeroExpenseInput = input({
      assets: { currentLivingCost: { monthly: 0 } },
      expense: { housingCost: 0, healthInsurance: { monthly: 0 }, medical: { annual: 0 } },
    });
    zeroExpenseInput.assets.insurance = { monthlyPremium: 0 };
    zeroExpenseInput.assets.debtStatus = { totalBalance: 500, monthlyRepayment: 0 };
    const result = calcIndicators(zeroExpenseInput);
    const ind = findIndicator(result, 'emergency');
    expect(ind.notCalculable).toBe(true);
    expect(ind.score).toBeNull();
  });

  it('retirementIncome: retirementLivingCost=0 -> N/A', () => {
    const result = calcIndicators(input({ expense: { retirementLivingCost: 0 } }));
    expect(findIndicator(result, 'retirementIncome').notCalculable).toBe(true);
  });

  it('a single N/A indicator makes the composite totalScore/grade null, not partially summed', () => {
    const result = calcIndicators(input({ assets: { currentIncome: { monthly: 0 } } }));
    expect(result.notCalculable).toBe(true);
    expect(result.totalScore).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.missingInputs.length).toBeGreaterThan(0);
  });

  it('N/A indicators are excluded from weakest/strongest ranking', () => {
    const result = calcIndicators(input({ assets: { currentIncome: { monthly: 0 } } }));
    expect(result.weakest?.notCalculable).not.toBe(true);
    expect(result.strongest?.notCalculable).not.toBe(true);
  });
});

describe('A-1 boundary continuity (T-0.01 / T / T+0.01) - cutoffs unchanged, gaps removed', () => {
  // household ratio = expense / income * 100, income fixed at 10000 so expense == ratio*100.
  // Every other contributor to totalExpenseMonthlyExSavings must be zeroed so it doesn't leak in.
  const householdCase = (ratio) =>
    input({
      assets: {
        currentIncome: { monthly: 10000 },
        currentLivingCost: { monthly: ratio * 100 },
        insurance: { monthlyPremium: 0 },
        debtStatus: { totalBalance: 0, monthlyRepayment: 0 },
      },
      expense: { housingCost: 0, healthInsurance: { monthly: 0 }, medical: { annual: 0 }, otherExpenses: [] },
    });

  it.each([
    [49.99, 15], [50, 15], [50.01, 14],
    [59.99, 14], [60, 14], [60.01, 11],
    [69.99, 11], [70, 11], [70.01, 8],
    [79.99, 8], [80, 8], [80.01, 4],
    [89.99, 4], [90, 4], [90.01, 0],
  ])('household ratio %s%% -> score %s', (ratio, expectedScore) => {
    const result = calcIndicators(householdCase(ratio));
    const ind = findIndicator(result, 'household');
    expect(ind.notCalculable).toBe(false);
    expect(ind.score).toBe(expectedScore);
  });

  // DSR = debtRepayment*12/annualIncome*100, annualIncome fixed at 120000 (monthly 10000)
  // so debtRepayment*12/120000*100 == ratio requires debtRepayment == ratio*100.
  const dsrCase = (ratio) =>
    input({ assets: { currentIncome: { monthly: 10000 }, debtStatus: { totalBalance: 0, monthlyRepayment: ratio * 100 } } });

  it.each([
    [9.99, 15], [10, 15], [10.01, 14],
    [19.99, 14], [20, 14], [20.01, 11],
    [29.99, 11], [30, 11], [30.01, 8],
    [39.99, 8], [40, 8], [40.01, 4],
    [49.99, 4], [50, 4], [50.01, 0],
  ])('DSR %s%% -> score %s', (ratio, expectedScore) => {
    const result = calcIndicators(dsrCase(ratio));
    const ind = findIndicator(result, 'dsr');
    expect(ind.notCalculable).toBe(false);
    expect(ind.score).toBe(expectedScore);
  });

  // debtBurden = totalDebt/totalAssets*100, totalAssets fixed at 10000 (liquid only) so totalDebt == ratio*100
  const debtBurdenCase = (ratio) =>
    input({
      assets: {
        liquidAssets: { total: 10000 },
        financialAssets: { stocks: 0, funds: 0, other: 0 },
        pensionAssets: 0,
        realEstateAssets: { total: 0 },
        debtStatus: { totalBalance: ratio * 100, monthlyRepayment: 20 },
      },
    });

  it.each([
    [9.99, 10], [10, 10], [10.01, 9],
    [19.99, 9], [20, 9], [20.01, 7],
    [29.99, 7], [30, 7], [30.01, 5],
    [39.99, 5], [40, 5], [40.01, 3],
    [49.99, 3], [50, 3], [50.01, 0],
  ])('debtBurden %s%% -> score %s', (ratio, expectedScore) => {
    const result = calcIndicators(debtBurdenCase(ratio));
    const ind = findIndicator(result, 'debtBurden');
    expect(ind.notCalculable).toBe(false);
    expect(ind.score).toBe(expectedScore);
  });

  // savingsRate = savingsAnnual/annualIncome*100, annualIncome fixed at 120000 so savingsAnnual == ratio*1200
  const savingsRateCase = (ratio) =>
    input({
      assets: { currentIncome: { monthly: 10000 }, savingsPlan: { monthly: 0, annual: ratio * 1200, retirementMonthly: 0, retirementAnnual: 0 } },
    });

  it.each([
    [9.99, 0], [10, 1], [10.01, 1],
    [19.99, 1], [20, 3], [20.01, 3],
    [29.99, 3], [30, 4], [30.01, 4],
    [39.99, 4], [40, 5], [40.01, 5],
  ])('savingsRate %s%% -> score %s', (ratio, expectedScore) => {
    const result = calcIndicators(savingsRateCase(ratio));
    const ind = findIndicator(result, 'savingsRate');
    expect(ind.notCalculable).toBe(false);
    expect(ind.score).toBe(expectedScore);
  });

  // financialAssetRatio = (financial+liquid)/totalAssets*100, totalAssets fixed at 10000
  const financialAssetRatioCase = (ratio) => {
    const financial = ratio * 100;
    return input({
      assets: {
        liquidAssets: { total: 0 },
        financialAssets: { stocks: financial, funds: 0, other: 0 },
        pensionAssets: 0,
        realEstateAssets: { total: 10000 - financial },
      },
    });
  };

  it.each([
    [9.99, 0], [10, 2], [10.01, 2],
    [19.99, 2], [20, 3], [20.01, 3],
    [29.99, 3], [30, 4], [30.01, 4],
    [39.99, 4], [40, 5], [40.01, 5],
  ])('financialAssetRatio %s%% -> score %s', (ratio, expectedScore) => {
    const result = calcIndicators(financialAssetRatioCase(ratio));
    const ind = findIndicator(result, 'financialAssetRatio');
    expect(ind.notCalculable).toBe(false);
    expect(ind.score).toBe(expectedScore);
  });

  // retirementSavings = retirementSavingsAnnual/totalSavingsAnnual*100, totalSavingsAnnual fixed at 10000
  const retirementSavingsCase = (ratio) =>
    input({
      basic: { birthYear: 1985 },
      assets: { savingsPlan: { monthly: 0, annual: 10000, retirementMonthly: 0, retirementAnnual: ratio * 100 } },
    });

  it.each([
    [29.99, 0], [30, 3], [30.01, 3],
    [39.99, 3], [40, 6], [40.01, 6],
    [49.99, 6], [50, 9], [50.01, 9],
    [59.99, 9], [60, 11], [60.01, 11],
    [69.99, 11], [70, 13], [70.01, 13],
    [79.99, 13], [80, 15], [80.01, 15],
  ])('retirementSavings %s%% -> score %s', (ratio, expectedScore) => {
    const result = calcIndicators(retirementSavingsCase(ratio));
    const ind = findIndicator(result, 'retirementSavings');
    expect(ind.notCalculable).toBe(false);
    expect(ind.score).toBe(expectedScore);
  });

  // retirementIncome = monthlyRetirementIncome/retirementLivingCost*100, livingCost fixed at 100.
  // Base severance/personalPension income must be zeroed so only nationalPension drives the ratio.
  const retirementIncomeCase = (ratio) =>
    input({
      expense: { retirementLivingCost: 100 },
      income: {
        nationalPension: { monthly: ratio, months: 240 },
        severance: { type: 'lumpsum', lumpsum: 0 },
        personalPension: { type: 'installment', monthly: 0, months: 0 },
      },
    });

  it.each([
    [39.99, 0], [40, 3], [40.01, 3],
    [59.99, 3], [60, 6], [60.01, 6],
    [79.99, 6], [80, 9], [80.01, 9],
    [99.99, 9], [100, 12], [100.01, 12],
    [119.99, 12], [120, 15], [120.01, 15],
  ])('retirementIncome %s%% -> score %s (under 65, max 15)', (ratio, expectedScore) => {
    const result = calcIndicators(retirementIncomeCase(ratio));
    const ind = findIndicator(result, 'retirementIncome');
    expect(ind.notCalculable).toBe(false);
    expect(ind.maxScore).toBe(15);
    expect(ind.score).toBe(expectedScore);
  });

  it('retirementIncome doubles to max 30 for 65+', () => {
    const result = calcIndicators(
      retirementIncomeCase(120)
        ? deepMerge(retirementIncomeCase(120), { basic: { birthYear: new Date().getFullYear() - 66 } })
        : {}
    );
    const ind = findIndicator(result, 'retirementIncome');
    expect(ind.maxScore).toBe(30);
    expect(ind.score).toBe(30);
  });

  // emergency (multiple) = liquidAssets / monthlyExpense, monthlyExpense fixed at 100.
  // Every other contributor to totalExpenseMonthlyExSavings must be zeroed so it doesn't leak in.
  const emergencyCase = (multiple) =>
    input({
      assets: {
        currentLivingCost: { monthly: 100 },
        liquidAssets: { total: multiple * 100 },
        insurance: { monthlyPremium: 0 },
        debtStatus: { totalBalance: 0, monthlyRepayment: 0 },
      },
      expense: { housingCost: 0, healthInsurance: { monthly: 0 }, medical: { annual: 0 }, otherExpenses: [] },
    });

  it.each([
    [1.99, 0], [2, 2], [2.01, 2],
    [2.99, 2], [3, 4], [3.01, 4],
    [3.99, 4], [4, 6], [4.01, 6],
    [4.99, 6], [5, 8], [5.01, 8],
    [5.99, 8], [6, 10], [6.01, 10],
  ])('emergency multiple %sx -> score %s', (multiple, expectedScore) => {
    const result = calcIndicators(emergencyCase(multiple));
    const ind = findIndicator(result, 'emergency');
    expect(ind.notCalculable).toBe(false);
    expect(ind.score).toBe(expectedScore);
  });
});

describe('A-1 / insurance continuous mid-band cutoffs (exact 16-value table)', () => {
  // insurance ratio = premium/income*100, income fixed at 10000 so premium == ratio*100
  const insuranceCase = (ratio) =>
    input({ assets: { currentIncome: { monthly: 10000 }, insurance: { monthlyPremium: ratio * 100 } } });

  it.each([
    [0, 0], [2.99, 0],
    [3, 5], [4.99, 5],
    [5, 8], [7.99, 8],
    [8, 10], [9.99, 10], [10, 10],
    [10.01, 8], [12.99, 8], [13, 8],
    [13.01, 5], [15.99, 5], [16, 5],
    [16.01, 0],
  ])('insurance ratio %s%% -> score %s', (ratio, expectedScore) => {
    const result = calcIndicators(insuranceCase(ratio));
    const ind = findIndicator(result, 'insurance');
    expect(ind.notCalculable).toBe(false);
    expect(ind.score).toBe(expectedScore);
  });
});

describe('rawValue vs displayValue precision', () => {
  it('rawValue keeps full precision; displayValue is rounded to 1 decimal; score uses rawValue', () => {
    // income=3, expense=1 -> ratio = 33.333...%, which rounds to 33.3 for display
    const result = calcIndicators(
      input({
        assets: {
          currentIncome: { monthly: 3 },
          currentLivingCost: { monthly: 1 },
          insurance: { monthlyPremium: 0 },
          debtStatus: { totalBalance: 0, monthlyRepayment: 0 },
        },
        expense: { housingCost: 0, healthInsurance: { monthly: 0 }, medical: { annual: 0 }, otherExpenses: [] },
      })
    );
    const ind = findIndicator(result, 'household');
    expect(ind.rawValue).toBeCloseTo(33.3333, 3);
    expect(ind.displayValue).toBe(33.3);
    expect(ind.score).toBe(15); // <=50, unaffected either way, but proves rawValue is not pre-rounded garbage
  });
});
