import { describe, it, expect } from 'vitest';
import { validateInput } from './validate.js';

function deepMerge(base, override) {
  if (Array.isArray(override)) return override;
  if (typeof override !== 'object' || override === null) return override;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base?.[key], override[key]);
  }
  return result;
}

const VALID = {
  basic: { birthYear: 1985, retirementAge: 65, lifeExpectancy: 90 },
  income: {},
  spouse: {},
  expense: { retirementLivingCost: 200 },
  assets: {
    currentIncome: { monthly: 500 },
    currentLivingCost: { monthly: 200 },
    debtStatus: { totalBalance: 500, monthlyRepayment: 20 },
    realEstateAssets: { total: 5000 },
    savingsPlan: { monthly: 200, annual: 2400, retirementMonthly: 100, retirementAnnual: 1200 },
  },
  scenarios: { realEstateConversion: { enabled: true, cashOutAmount: 1000 }, expenseReduction: { enabled: true, reductionRate: 30 } },
};

function makeInput(overrides = {}) {
  return deepMerge(VALID, overrides);
}

describe('validateInput - baseline', () => {
  it('accepts a fully valid input', () => {
    expect(validateInput(makeInput()).ok).toBe(true);
  });
});

describe('A-5 relational validation: real estate conversion cannot exceed holdings', () => {
  it('rejects cashOutAmount greater than realEstateAssets.total with an explicit message', () => {
    const result = validateInput(
      makeInput({ assets: { realEstateAssets: { total: 1000 } }, scenarios: { realEstateConversion: { enabled: true, cashOutAmount: 5000 } } })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/부동산.*초과/);
  });

  it('accepts cashOutAmount exactly equal to realEstateAssets.total', () => {
    const result = validateInput(
      makeInput({ assets: { realEstateAssets: { total: 1000 } }, scenarios: { realEstateConversion: { enabled: true, cashOutAmount: 1000 } } })
    );
    expect(result.ok).toBe(true);
  });

  it('is not checked when the scenario is disabled', () => {
    const result = validateInput(
      makeInput({ assets: { realEstateAssets: { total: 1000 } }, scenarios: { realEstateConversion: { enabled: false, cashOutAmount: 5000 } } })
    );
    expect(result.ok).toBe(true);
  });
});

describe('relational validation: retirement savings cannot exceed total savings', () => {
  it('rejects retirementMonthly > savingsPlan.monthly (existing rule, preserved)', () => {
    const result = validateInput(makeInput({ assets: { savingsPlan: { monthly: 100, retirementMonthly: 200 } } }));
    expect(result.ok).toBe(false);
  });

  it('rejects retirementAnnual > savingsPlan.annual (new rule)', () => {
    const result = validateInput(makeInput({ assets: { savingsPlan: { annual: 1000, retirementAnnual: 2000 } } }));
    expect(result.ok).toBe(false);
  });
});

describe('relational validation: expense reduction rate must be within 0-100', () => {
  it('rejects a reductionRate above 100', () => {
    const result = validateInput(makeInput({ scenarios: { expenseReduction: { enabled: true, reductionRate: 150 } } }));
    expect(result.ok).toBe(false);
  });

  it('rejects a negative reductionRate', () => {
    const result = validateInput(makeInput({ scenarios: { expenseReduction: { enabled: true, reductionRate: -10 } } }));
    expect(result.ok).toBe(false);
  });

  it('accepts a reductionRate of exactly 0 and exactly 100', () => {
    expect(validateInput(makeInput({ scenarios: { expenseReduction: { enabled: true, reductionRate: 0 } } })).ok).toBe(true);
    expect(validateInput(makeInput({ scenarios: { expenseReduction: { enabled: true, reductionRate: 100 } } })).ok).toBe(true);
  });
});

describe('relational validation: retirement end age must not precede retirement start age', () => {
  it('rejects lifeExpectancy < retirementAge', () => {
    const result = validateInput(makeInput({ basic: { retirementAge: 65, lifeExpectancy: 60 } }));
    expect(result.ok).toBe(false);
  });

  it('accepts lifeExpectancy === retirementAge', () => {
    const result = validateInput(makeInput({ basic: { retirementAge: 65, lifeExpectancy: 65 } }));
    expect(result.ok).toBe(true);
  });
});

describe('rejects NaN / Infinity / negative amounts across numeric fields', () => {
  it('rejects a negative amount', () => {
    expect(validateInput(makeInput({ assets: { currentIncome: { monthly: -10 } } })).ok).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(validateInput(makeInput({ assets: { currentIncome: { monthly: Infinity } } })).ok).toBe(false);
  });

  it('rejects NaN-producing garbage input', () => {
    expect(validateInput(makeInput({ assets: { currentIncome: { monthly: 'not-a-number' } } })).ok).toBe(false);
  });
});
