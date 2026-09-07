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

describe('calcRetirementSimulation - retirement-pension asset conversion', () => {
  const retirementInput = ({ type, asset = 3000, severance = {}, withNewField = true }) => ({
    ...BASE,
    basic: { ...BASE.basic, birthYear: 1986, retirementAge: 65, assumedReturnRate: 10, hasSpouse: false },
    income: { severance: { type, ...severance } },
    assets: {
      ...BASE.assets,
      pensionAssets: asset,
      pensionAssetsBreakdown: withNewField ? { selfRetirementPension: asset } : {},
      savingsPlan: { monthly: 0, annual: 0 },
    },
  });

  it('keeps the identified balance in current assets but converts a future lump sum only at its receipt age', () => {
    const result = calcRetirementSimulation(retirementInput({
      type: 'lumpsum', severance: { lumpsum: 5000, lumpsumAge: 60 },
    }), 2026);
    expect(result.currentReadyAssets).toBe(3000);
    expect(result.currentAssetsAtRetirement).toBe(Math.round(5000 * (1.1 ** 5)));
  });

  it('includes a lump sum received exactly at retirement without pre-receipt investment growth', () => {
    const result = calcRetirementSimulation(retirementInput({
      type: 'lumpsum', severance: { lumpsum: 5000, lumpsumAge: 65 },
    }), 2026);
    expect(result.currentAssetsAtRetirement).toBe(5000);
    expect(result.readyAssetsAtRetirement).toBe(5000);
  });

  it('does not keep the same principal in future starting assets when it becomes monthly pension income', () => {
    const result = calcRetirementSimulation(retirementInput({
      type: 'pension', severance: { pensionMonthly: 80, pensionStartAge: 65, pensionMonths: 120 },
    }), 2026);
    expect(result.currentReadyAssets).toBe(3000);
    expect(result.currentAssetsAtRetirement).toBe(0);
    expect(result.readyAssetsAtRetirement).toBe(0);
  });

  it('keeps an identified currently held asset in the future base when no future severance benefit remains', () => {
    const result = calcRetirementSimulation(retirementInput({ type: 'none' }), 2026);
    expect(result.currentAssetsAtRetirement).toBe(Math.round(3000 * (1.1 ** 25)));
  });

  it('keeps legacy calculations unchanged when the new identification field is absent', () => {
    const result = calcRetirementSimulation(retirementInput({
      type: 'pension', withNewField: false,
      severance: { pensionMonthly: 80, pensionStartAge: 65, pensionMonths: 120 },
    }), 2026);
    expect(result.currentAssetsAtRetirement).toBe(Math.round(3000 * (1.1 ** 25)));
  });
});
