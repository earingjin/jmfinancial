import { describe, expect, it } from 'vitest';
import { buildAggregates } from './aggregate.js';
import {
  buildFiveYearOutlookAges,
  buildFutureFinanceProjection,
  calculateNonPensionIncomeAtTarget,
  calculateFutureValue,
} from './futureFinance.js';

function makeInput(overrides = {}) {
  return {
    basic: { birthYear: 1976, lifeExpectancy: 83, hasSpouse: false },
    assets: {
      currentLivingCost: { monthly: 300 },
      liquidAssets: { total: 50000, breakdown: { deposit: 50000 } },
      financialAssets: {}, pensionAssetsBreakdown: {}, realEstateAssets: {}, debtStatus: {},
    },
    income: {
      nationalPension: { monthly: 150, months: 240 },
      personalPension: { type: 'installment', monthly: 50, startAge: 70, months: 240 },
      severance: { type: 'pension', pensionMonthly: 50, pensionStartAge: 60, pensionMonths: 240 },
    },
    spouse: {}, expense: {},
    ...overrides,
  };
}

function allNumbersAreFinite(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allNumbersAreFinite);
  if (value && typeof value === 'object') return Object.values(value).every(allNumbersAreFinite);
  return true;
}

describe('future finance projection', () => {
  it('calculates the 60/70/80 outlook and purchasing-power equivalents', () => {
    const input = makeInput();
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.targets.map((item) => item.age)).toEqual([60, 70, 80]);
    expect(result.targets[0].livingExpense).toBe(403);
    expect(result.targets[0].pensionBreakdown.nationalPension).toBe(0);
    expect(result.targets[1].pensionIncome).toBe(327);
    expect(result.purchasingPower.map((item) => item.requiredAmount)).toEqual([50000, 67196, 90306]);
  });

  it('adds a five-year outlook without changing the legacy targets', () => {
    const input = makeInput({ basic: { birthYear: 1979, retirementAge: 62, lifeExpectancy: 83, hasSpouse: false } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.targets.map((item) => item.age)).toEqual([60, 70, 80]);
    expect(result.fiveYearOutlook.map((item) => item.age)).toEqual([47, 50, 55, 60, 65, 70, 75, 80, 83]);
    expect(result.fiveYearOutlook[0].years).toBe(0);
    expect(result.retirementCashFlowOutlook.map((item) => item.age)).toEqual([62, 65, 70, 75, 80, 83]);
  });

  it('does not duplicate ages on five-year boundaries', () => {
    expect(buildFiveYearOutlookAges(50, 80)).toEqual([50, 55, 60, 65, 70, 75, 80]);
  });

  it('safely omits the outlook when life expectancy is missing or before the current age', () => {
    const missingInput = makeInput({ basic: { birthYear: 1979, hasSpouse: false } });
    const invalidInput = makeInput({ basic: { birthYear: 1979, lifeExpectancy: 46, hasSpouse: false } });
    const legacyInput = makeInput({ basic: { birthYear: 1979, lifeExpectancy: '', retirementEndAge: 80, hasSpouse: false } });
    expect(buildFutureFinanceProjection({ input: missingInput, aggregates: buildAggregates(missingInput), currentYear: 2026 }).fiveYearOutlook).toEqual([]);
    expect(buildFutureFinanceProjection({ input: invalidInput, aggregates: buildAggregates(invalidInput), currentYear: 2026 }).fiveYearOutlook).toEqual([]);
    expect(buildFutureFinanceProjection({ input: legacyInput, aggregates: buildAggregates(legacyInput), currentYear: 2026 }).fiveYearOutlook.at(-1).age).toBe(80);
  });

  it('reuses the existing pension boundaries and 3% living-expense assumption in the five-year outlook', () => {
    const input = makeInput({ basic: { birthYear: 1976, lifeExpectancy: 80, hasSpouse: false } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    const at60 = result.fiveYearOutlook.find((item) => item.age === 60);
    const at80 = result.fiveYearOutlook.find((item) => item.age === 80);
    expect(at60.livingExpense).toBe(Math.round(300 * (1.03 ** 10)));
    expect(at60.pensionBreakdown.retirementPension).toBe(50);
    expect(at80.pensionBreakdown.retirementPension).toBe(0);
  });

  it('includes salary, bonuses, business, other regular income, and pension for their existing periods', () => {
    const base = makeInput();
    const input = {
      ...base,
      basic: { birthYear: 1979, retirementAge: 60, lifeExpectancy: 70, hasSpouse: true },
      income: {
        ...base.income,
        salary: { monthly: 300, annualBonus: 120, months: 156 },
        business: { monthly: 50 },
        otherIncomes: [{ name: '임대소득', annual: 120, years: 8 }],
      },
      spouse: {
        birthYear: 1981,
        salary: { monthly: 100, annualBonus: 0, months: 36 },
        nationalPension: { monthly: 0, months: 0 },
        severance: { type: 'none' },
        personalPension: { type: 'none' },
      },
    };
    const aggregates = buildAggregates(input);
    const result = buildFutureFinanceProjection({ input, aggregates, currentYear: 2026 });
    const at47 = result.fiveYearOutlook.find((item) => item.age === 47);
    const at50 = result.fiveYearOutlook.find((item) => item.age === 50);
    const at55 = result.fiveYearOutlook.find((item) => item.age === 55);
    const at60 = result.fiveYearOutlook.find((item) => item.age === 60);

    expect(calculateNonPensionIncomeAtTarget({ input, aggregates, currentAge: 47, years: 0 })).toBe(470);
    expect(at47.totalIncome).toBe(470);
    expect(at47.incomeLabel).toBe('월급·연금 등');
    expect(at50.nonPensionIncome).toBe(370);
    expect(at55.nonPensionIncome).toBe(360);
    expect(at60.nonPensionIncome).toBe(0);
    expect(at60.totalIncome).toBe(at60.pensionIncome);
    expect(at60.incomeLabel).toBe('연금소득');
    expect(at47.coverageRate).toBeCloseTo((470 / 300) * 100, 1);
  });

  it('uses the spouse retirement age when legacy spouse salary months are missing', () => {
    const input = makeInput({
      basic: { birthYear: 1979, retirementAge: 60, lifeExpectancy: 70, hasSpouse: true },
      spouse: {
        birthYear: 1981,
        retirementAge: 50,
        salary: { monthly: 100, annualBonus: 0, months: '' },
      },
    });
    const aggregates = buildAggregates(input);

    expect(calculateNonPensionIncomeAtTarget({ input, aggregates, currentAge: 47, currentYear: 2026, years: 4 })).toBe(100);
    expect(calculateNonPensionIncomeAtTarget({ input, aggregates, currentAge: 47, currentYear: 2026, years: 5 })).toBe(0);
  });

  it('keeps the legacy diagnosis based on age 80, not the final five-year point', () => {
    const baselineInput = makeInput({ basic: { birthYear: 1979, lifeExpectancy: 80, hasSpouse: false } });
    const input = makeInput({ basic: { birthYear: 1979, lifeExpectancy: 83, hasSpouse: false } });
    const baseline = buildFutureFinanceProjection({ input: baselineInput, aggregates: buildAggregates(baselineInput), currentYear: 2026 });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.diagnosis).toBe(baseline.diagnosis);
  });

  it('does not emit NaN or Infinity in the five-year outlook', () => {
    const input = makeInput({ basic: { birthYear: 1979, lifeExpectancy: 83, hasSpouse: false } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(allNumbersAreFinite(result.fiveYearOutlook)).toBe(true);
  });

  it('keeps real zero pension values calculable', () => {
    const input = makeInput({ income: { nationalPension: { monthly: 0, months: 240 }, personalPension: { type: 'installment', monthly: 0, months: 240 }, severance: { type: 'pension', pensionMonthly: 0, pensionMonths: 240 } } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.missing.pension).toBe(false);
    expect(result.targets[0].coverageRate).toBe(0);
  });

  it('does not turn missing living expenses or assets into zero', () => {
    const input = makeInput({ assets: { currentLivingCost: { monthly: '' }, liquidAssets: { breakdown: {} }, financialAssets: {}, pensionAssetsBreakdown: {}, realEstateAssets: {}, debtStatus: {} } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.targets[0].livingExpense).toBeNull();
    expect(result.targets[0].coverageRate).toBeNull();
    expect(result.purchasingPower).toBeNull();
  });

  it('excludes target ages already passed', () => {
    const input = makeInput({ basic: { birthYear: 1961 } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.targets.map((item) => item.age)).toEqual([70, 80]);
  });

  it('uses start-inclusive and end-exclusive pension periods', () => {
    const input = makeInput();
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    const at60 = result.targets.find((item) => item.age === 60);
    const at70 = result.targets.find((item) => item.age === 70);
    const at80 = result.targets.find((item) => item.age === 80);
    expect(at60.pensionBreakdown.retirementPension).toBe(50);
    expect(at60.pensionBreakdown.personalPension).toBe(0);
    expect(at70.pensionBreakdown.personalPension).toBe(50);
    expect(at80.pensionBreakdown.retirementPension).toBe(0);
  });

  it('marks the target incalculable when a positive monthly pension has unknown timing', () => {
    const input = makeInput({ income: { nationalPension: { monthly: 0, months: 0 }, personalPension: { type: 'installment', monthly: 50, startAge: '', months: 240 }, severance: { type: 'none' } } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.targets[0].pensionIncome).toBeNull();
    expect(result.targets[0].coverageRate).toBeNull();
    expect(result.targets[0].calculable).toBe(false);
  });

  it('evaluates spouse national pension using the spouse cohort separately', () => {
    const input = makeInput({
      basic: { birthYear: 1976, hasSpouse: true },
      spouse: { birthYear: 1986, nationalPension: { monthly: 100, months: 240 }, severance: { type: 'none' }, personalPension: { type: 'none' } },
    });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    const at70 = result.targets.find((item) => item.age === 70);
    const spouseNational = at70.pensionBreakdown.components.find((item) => item.key === 'spouse.nationalPension');
    expect(spouseNational.inclusionStatus).toBe('beforeStart');
  });
});

describe('calculateFutureValue finite result guard', () => {
  it('throws an explicit calculation error instead of returning null on overflow', () => {
    expect(() => calculateFutureValue(Number.MAX_VALUE, 1, 2)).toThrow(/CALCULATION_NON_FINITE/);
  });
});
