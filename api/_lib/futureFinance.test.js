import { describe, expect, it } from 'vitest';
import { buildAggregates } from './aggregate.js';
import { buildFutureFinanceProjection } from './futureFinance.js';

function makeInput(overrides = {}) {
  return {
    basic: { birthYear: 1976 },
    assets: {
      currentLivingCost: { monthly: 300 },
      liquidAssets: { total: 50000, breakdown: { deposit: 50000 } },
      financialAssets: {}, pensionAssetsBreakdown: {}, realEstateAssets: {}, debtStatus: {},
    },
    income: {
      nationalPension: { monthly: 150, months: 240 },
      personalPension: { type: 'installment', monthly: 50, months: 240 },
      severance: { type: 'pension', pensionMonthly: 50, pensionMonths: 240 },
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
});
