import { describe, it, expect } from 'vitest';
import { calcIndicators } from './indicators.js';
import { getIndicatorMeta } from './indicatorMeta.js';

describe('연령별 바람직한 표시 기준', () => {
  it.each([
    [20, 50, 2, 50],
    [29, 50, 2, 50],
    [30, 70, 3, 30],
    [39, 70, 3, 30],
    [40, 80, 4, 20],
    [49, 80, 4, 20],
    [50, 90, 5, 10],
    [64, 90, 5, 10],
    [65, 95, 6, 5],
  ])('%i세의 가계수지·비상예비금·총저축성향 기준을 반환한다', (age, household, emergency, savingsRate) => {
    expect(getIndicatorMeta('household', age).bench).toEqual({ type: 'atMost', value: household });
    expect(getIndicatorMeta('emergency', age).bench).toEqual({ type: 'atLeast', value: emergency });
    expect(getIndicatorMeta('savingsRate', age).bench).toEqual({ type: 'atLeast', value: savingsRate });
  });

  it('연령 기준이 없는 총부채상환지표와 20세 미만은 기존 공통 기준을 유지한다', () => {
    expect(getIndicatorMeta('dsr', 35).bench).toEqual({ type: 'atMost', value: 30 });
    expect(getIndicatorMeta('household', 19).bench).toEqual({ type: 'atMost', value: 70 });
  });
});

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

describe('financial-health indicator integrity', () => {
  it('preserves the established eight household-finance indicator formulas, raw results, and score allocations', () => {
    const result = calcIndicators(input());
    const expected = {
      household: { rawValue: 54, score: 14, maxScore: 15 },
      emergency: { rawValue: 1200 / 270, score: 6, maxScore: 10 },
      dsr: { rawValue: 4, score: 15, maxScore: 15 },
      debtBurden: { rawValue: 500 / 3000 * 100, score: 9, maxScore: 10 },
      insurance: { rawValue: 9, score: 10, maxScore: 10 },
      savingsRate: { rawValue: 40, score: 5, maxScore: 5 },
      retirementSavings: { rawValue: 75, score: 13, maxScore: 15 },
      financialAssetRatio: { rawValue: 1700 / 3000 * 100, score: 5, maxScore: 5 },
    };

    Object.entries(expected).forEach(([key, expectedIndicator]) => {
      const indicator = findIndicator(result, key);
      expect(indicator.rawValue).toBeCloseTo(expectedIndicator.rawValue, 8);
      expect(indicator.score).toBe(expectedIndicator.score);
      expect(indicator.maxScore).toBe(expectedIndicator.maxScore);
    });
    expect(findIndicator(result, 'retirementSavings').formula).toBe('노후대비저축액 ÷ 총저축액 × 100');
  });

  // breakdown: 화면(FhsDetailReport)에서 비율의 근거가 된 실제 금액을 보여주기 위한 표시용
  // 데이터. 판정(rawValue/score)에 이미 쓰인 agg 값을 그대로 재사용할 뿐 새 계산이 아니므로,
  // 위 테스트가 검증한 것과 같은 HEALTHY_BASE 입력에서 각 지표의 분자·분모 금액이 정확히
  // 일치하는지만 확인한다(연간원리금상환액=월상환액×12=20×12=240, 금융자산=투자자산+
  // 현금성자산=500+1200=1700 등, 판정식에 쓰인 것과 동일한 원본 표현식).
  it('8개 지표 모두 breakdown.numerator/denominator가 판정에 쓰인 agg 값과 정확히 일치한다', () => {
    const result = calcIndicators(input());
    const expectedBreakdowns = {
      household: { numerator: { label: '총지출(저축 제외)', amount: 270 }, denominator: { label: '총소득', amount: 500 } },
      emergency: { numerator: { label: '유동성자산', amount: 1200 }, denominator: { label: '월지출(저축 제외)', amount: 270 } },
      dsr: { numerator: { label: '연간원리금상환액', amount: 240 }, denominator: { label: '연소득', amount: 6000 } },
      debtBurden: { numerator: { label: '총부채', amount: 500 }, denominator: { label: '총자산', amount: 3000 } },
      insurance: { numerator: { label: '보장성보험료(월)', amount: 45 }, denominator: { label: '월소득', amount: 500 } },
      savingsRate: { numerator: { label: '총저축액(연)', amount: 2400 }, denominator: { label: '총소득(연)', amount: 6000 } },
      retirementSavings: { numerator: { label: '노후대비저축액(연)', amount: 1800 }, denominator: { label: '총저축액(연)', amount: 2400 } },
      financialAssetRatio: { numerator: { label: '금융자산(투자+현금성)', amount: 1700 }, denominator: { label: '총자산', amount: 3000 } },
    };

    Object.entries(expectedBreakdowns).forEach(([key, expected]) => {
      expect(findIndicator(result, key).breakdown).toEqual(expected);
    });
  });

  it('분모가 0이라 notCalculable인 지표는 breakdown이 null이다', () => {
    const result = calcIndicators(input({ assets: { currentIncome: { monthly: 0 } } }));
    const household = findIndicator(result, 'household');
    expect(household.notCalculable).toBe(true);
    expect(household.breakdown).toBeNull();
  });

  it('65세 이상(notApplicable)인 노후대비저축지표는 breakdown이 null이다', () => {
    const result = calcIndicators(input({ basic: { birthYear: new Date().getFullYear() - 66 } }));
    const retirementSavings = findIndicator(result, 'retirementSavings');
    expect(retirementSavings.notApplicable).toBe(true);
    expect(retirementSavings.breakdown).toBeNull();
  });

  it('노후소득보장률(retirementIncome, FHS 8개 지표 밖)에는 breakdown 필드를 추가하지 않는다', () => {
    const result = calcIndicators(input());
    const retirementIncome = findIndicator(result, 'retirementIncome');
    expect(retirementIncome).not.toHaveProperty('breakdown');
  });

  // retirementSavingsInputVersion: 2 - 연금저축·IRP 자동합산 + 추가 노후저축 입력의 노후대비저축지표
  // 공식(retirementSavingsAnnual ÷ totalSavingsAnnual × 100)은 변경하지 않는다. 지표에 들어가기 전
  // 집계값만 버전에 맞게 만들어지는지 확인한다.
  it('Case 1(v2): 연금저축 20 + IRP 30 자동합산, 추가 노후저축 없음 → 50%', () => {
    const result = calcIndicators(input({
      assets: {
        savingsPlan: {
          monthly: 100,
          annual: 1200,
          retirementSavingsInputVersion: 2,
          breakdown: { pensionSavings: { monthly: 20 }, irp: { monthly: 30 } },
        },
      },
    }));
    expect(findIndicator(result, 'retirementSavings').rawValue).toBeCloseTo(50, 8);
  });

  it('Case 2(v2): 연금저축 20 + IRP 30 + 추가 노후저축 10 → 약 54.5%', () => {
    const result = calcIndicators(input({
      assets: {
        savingsPlan: {
          monthly: 100,
          annual: 1200,
          retirementSavingsInputVersion: 2,
          breakdown: { pensionSavings: { monthly: 20 }, irp: { monthly: 30 } },
          additionalRetirementMonthly: 10,
          additionalRetirementAnnual: 120,
        },
      },
    }));
    expect(findIndicator(result, 'retirementSavings').rawValue).toBeCloseTo(720 / 1320 * 100, 8);
    expect(findIndicator(result, 'retirementSavings').displayValue).toBeCloseTo(54.5, 8);
  });

  it('Case 5/6(v1 회귀): 버전 필드가 없으면 연금저축·IRP breakdown을 무시하고 레거시 retirementMonthly만 분자로 쓴다', () => {
    const result = calcIndicators(input({
      assets: {
        savingsPlan: {
          monthly: 200,
          annual: 2400,
          breakdown: { pensionSavings: { monthly: 20 }, irp: { monthly: 30 } },
          retirementMonthly: 50,
          retirementAnnual: 600,
        },
      },
    }));
    // (20+30+50)*12 ÷ 2400 이 아니라, 기존 그대로 retirementAnnual(600) ÷ totalSavingsAnnual(2400)
    expect(findIndicator(result, 'retirementSavings').rawValue).toBeCloseTo(600 / 2400 * 100, 8);
  });

  it('does not expose a composite total or S~F grade for an under-65 input', () => {
    const result = calcIndicators(input());
    expect(result.is65Plus).toBe(false);
    expect(result.notCalculable).toBe(false);
    expect(result).not.toHaveProperty('totalScore');
    expect(result).not.toHaveProperty('grade');
  });

  it('keeps retirement savings not applicable at 65+ without transferring its allocation', () => {
    const result = calcIndicators(input({ basic: { birthYear: new Date().getFullYear() - 66 } }));
    expect(result.is65Plus).toBe(true);
    const retirementSavings = findIndicator(result, 'retirementSavings');
    const retirementIncome = findIndicator(result, 'retirementIncome');
    expect(retirementSavings.maxScore).toBe(0);
    expect(retirementSavings.notApplicable).toBe(true);
    expect(retirementIncome.maxScore).toBe(15);
    expect(retirementIncome.score).toBeLessThanOrEqual(15);
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

  it('uses retirement savings as part of an already-included total without double counting', () => {
    const result = calcIndicators(input({
      assets: {
        savingsPlan: {
          monthly: 100,
          annual: 1200,
          retirementMonthly: 30,
          retirementAnnual: 360,
          retirementIncludedInTotal: true,
        },
      },
    }));

    expect(result.aggregates.totalSavingsAnnual).toBe(1200);
    expect(findIndicator(result, 'retirementSavings').rawValue).toBe(30);
  });

  it('adds separately managed retirement savings to the total before calculating the ratio', () => {
    const result = calcIndicators(input({
      assets: {
        savingsPlan: {
          monthly: 100,
          annual: 1200,
          retirementMonthly: 30,
          retirementAnnual: 360,
          retirementIncludedInTotal: false,
        },
      },
    }));

    expect(result.aggregates.totalSavingsAnnual).toBe(1560);
    expect(findIndicator(result, 'retirementSavings').rawValue).toBeCloseTo(23.0769, 4);
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

  it('retirementIncome: 국민연금 가입기간 판정이 unknown이면 0원 집계를 확정 비율로 보여주지 않고 N/A 처리한다', () => {
    // 다른 입력은 모두 정상(HEALTHY_BASE)이라 unknown이 아니었다면 계산 가능한 비율이 나온다 -
    // agg.monthlyRetirementIncome이 국민연금을 0원으로 포함한 "확정 안 된" 값이라는 걸 확인한다.
    const result = calcIndicators(input({
      income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 240, paymentMonths: 60, futureContributionPlan: 'continue' } },
    }));
    const retirementIncome = findIndicator(result, 'retirementIncome');
    expect(retirementIncome.notCalculable).toBe(true);
    expect(retirementIncome.reason).toContain('국민연금');
  });

  it('retirementIncome: 배우자 국민연금이 unknown이어도 N/A 처리한다', () => {
    const result = calcIndicators(input({
      basic: { hasSpouse: true },
      spouse: { nationalPension: { inputMode: 'direct', monthly: 50, months: 240, paymentMonths: 60, futureContributionPlan: 'unknown' } },
    }));
    expect(findIndicator(result, 'retirementIncome').notCalculable).toBe(true);
  });

  it('reports missing inputs for the eight-indicator assessment without exposing a composite score', () => {
    const result = calcIndicators(input({ assets: { currentIncome: { monthly: 0 } } }));
    expect(result.notCalculable).toBe(true);
    expect(result).not.toHaveProperty('totalScore');
    expect(result).not.toHaveProperty('grade');
    expect(result.missingInputs.length).toBeGreaterThan(0);
  });

  it('keeps retirement-income N/A separate from the eight-indicator assessment', () => {
    const result = calcIndicators(input({ expense: { retirementLivingCost: 0 } }));
    expect(findIndicator(result, 'retirementIncome').notCalculable).toBe(true);
    expect(result.notCalculable).toBe(false);
    expect(result.missingInputs).not.toContain(findIndicator(result, 'retirementIncome').reason);
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

  it('retirementIncome keeps its standalone max 15 for 65+', () => {
    const result = calcIndicators(
      retirementIncomeCase(120)
        ? deepMerge(retirementIncomeCase(120), { basic: { birthYear: new Date().getFullYear() - 66 } })
        : {}
    );
    const ind = findIndicator(result, 'retirementIncome');
    expect(ind.maxScore).toBe(15);
    expect(ind.score).toBe(15);
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
