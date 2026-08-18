import { describe, expect, it } from 'vitest';
import { buildAggregates } from './aggregate.js';
import { buildFutureFinanceProjection, calculateFutureValue } from './futureFinance.js';

function makeInput(overrides = {}) {
  return {
    basic: { birthYear: 1976, hasSpouse: false },
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
