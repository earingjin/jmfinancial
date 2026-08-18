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
