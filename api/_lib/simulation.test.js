import { describe, expect, it } from 'vitest';
import { calcRetirementSimulation } from './simulation.js';

const BASE = {
  basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: 0 },
  income: {},
  spouse: {},
  expense: { retirementLivingCost: 0 },
  assets: {
    savingsPlan: {
      monthly: 100,
      annual: 1200,
      retirementMonthly: 50,
      retirementAnnual: 600,
      retirementIncludedInTotal: false,
    },
  },
};

describe('calcRetirementSimulation - annual savings inclusion', () => {
  it('adds separately managed retirement savings using aggregate.js rules', () => {
    const result = calcRetirementSimulation(BASE, 2026);
    expect(result.annualSavings).toBe(1800);
  });

  it('does not double count retirement savings when it is already included in total savings', () => {
    const result = calcRetirementSimulation({
      ...BASE,
      assets: { savingsPlan: { ...BASE.assets.savingsPlan, retirementIncludedInTotal: true } },
    }, 2026);
    expect(result.annualSavings).toBe(1200);
  });
});

describe('calcRetirementSimulation - inflation rate', () => {
  it('reports and applies the 3% general inflation rate (approved 2026-08-20)', () => {
    const result = calcRetirementSimulation({
      ...BASE,
      expense: { retirementLivingCost: 300 },
    }, 2026);
    // 1986년생, 2026년 기준 40세 -> 65세 은퇴까지 25년.
    expect(result.inflationRate).toBe(3);
    const expected = Math.round(300 * Math.pow(1.03, 25) * 10) / 10;
    expect(result.retirementLivingCostAtRetirement).toBe(expected);
  });
});
