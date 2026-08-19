import { describe, it, expect } from 'vitest';
import { buildAggregates, buildFamilyAges } from './aggregate.js';

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
  assets: {
    currentIncome: { monthly: 500 },
    currentLivingCost: { monthly: 0 },
    debtStatus: { totalBalance: 0, monthlyRepayment: 0 },
    realEstateAssets: { total: 0 },
    savingsPlan: {
      monthly: 100,
      annual: 1200,
      retirementMonthly: 30,
      retirementAnnual: 360,
    },
  },
  expense: {},
  income: {},
};

function input(overrides = {}) {
  return deepMerge(BASE, overrides);
}

describe('savingsPlan.retirementIncludedInTotal - monthlySavings', () => {
  it('defaults to included (flag omitted): does not add retirementMonthly on top of monthly', () => {
    const agg = buildAggregates(input());
    expect(agg.monthlySavings).toBe(100);
  });

  it('included=true: does not add retirementMonthly on top of monthly', () => {
    const agg = buildAggregates(input({ assets: { savingsPlan: { retirementIncludedInTotal: true } } }));
    expect(agg.monthlySavings).toBe(100);
  });

  it('included=false: retirement savings is kept separate, so it is added on top of monthly', () => {
    const agg = buildAggregates(input({ assets: { savingsPlan: { retirementIncludedInTotal: false } } }));
    expect(agg.monthlySavings).toBe(130);
  });
});

describe('buildFamilyAges', () => {
  it('includes the spouse retirement age and life expectancy in report data', () => {
    const result = buildFamilyAges({
      basic: { birthYear: 1992 },
      spouse: { birthYear: 1990, retirementAge: 63, lifeExpectancy: 86.5 },
      expense: { children: [] },
    }, 2026);

    expect(result.spouse).toEqual({ age: 36, retirementAge: 63, lifeExpectancy: 86.5 });
  });
});

describe('retirementIncomeByPerson', () => {
  it('keeps retirement pension income separated for the report', () => {
    const result = buildAggregates(input({
      income: { severance: { type: 'pension', pensionMonthly: 40, pensionMonths: 120 } },
      spouse: { severance: { type: 'pension', pensionMonthly: 30, pensionMonths: 120 } },
    }));

    expect(result.retirementIncomeByPerson.self.severancePensionMonthly).toBe(40);
    expect(result.retirementIncomeByPerson.spouse.severancePensionMonthly).toBe(30);
  });
});

describe('savingsPlan.retirementIncludedInTotal - totalSavingsAnnual', () => {
  it('defaults to included (flag omitted): annual total is the general savings annual alone', () => {
    const agg = buildAggregates(input());
    expect(agg.totalSavingsAnnual).toBe(1200);
  });

  it('included=true: annual total is the general savings annual alone', () => {
    const agg = buildAggregates(input({ assets: { savingsPlan: { retirementIncludedInTotal: true } } }));
    expect(agg.totalSavingsAnnual).toBe(1200);
  });

  it('included=false: annual total adds the retirement annual amount', () => {
    const agg = buildAggregates(input({ assets: { savingsPlan: { retirementIncludedInTotal: false } } }));
    expect(agg.totalSavingsAnnual).toBe(1560);
  });

  it('included=false with no explicit annual fields: falls back to monthly*12 for both parts', () => {
    const agg = buildAggregates(
      input({
        assets: {
          savingsPlan: {
            monthly: 100,
            annual: '',
            retirementMonthly: 30,
            retirementAnnual: '',
            retirementIncludedInTotal: false,
          },
        },
      })
    );
    expect(agg.totalSavingsAnnual).toBe(1560);
  });
});

describe('savingsPlan.retirementIncludedInTotal - retirementSavingsAnnual (indicator numerator) is unaffected', () => {
  it('stays the same regardless of the included flag', () => {
    const includedAgg = buildAggregates(input({ assets: { savingsPlan: { retirementIncludedInTotal: true } } }));
    const separateAgg = buildAggregates(input({ assets: { savingsPlan: { retirementIncludedInTotal: false } } }));
    expect(includedAgg.retirementSavingsAnnual).toBe(360);
    expect(separateAgg.retirementSavingsAnnual).toBe(360);
  });
});

describe('financialAssets.bonds is included in financialAssetsTotal', () => {
  it('adds bonds alongside stocks/funds/other', () => {
    const agg = buildAggregates(
      input({ assets: { financialAssets: { stocks: 100, funds: 50, bonds: 30, other: 20 } } })
    );
    expect(agg.financialAssetsTotal).toBe(200);
  });

  it('counts a bonds-only entry (stocks/funds/other blank) without dropping it', () => {
    const agg = buildAggregates(input({ assets: { financialAssets: { bonds: 75 } } }));
    expect(agg.financialAssetsTotal).toBe(75);
  });
});

describe('otherAssets is included in totalAssets', () => {
  it('adds the canonical 기타 자산 total without treating it as a financial asset', () => {
    const agg = buildAggregates(input({ assets: { otherAssets: { total: 250 } } }));
    expect(agg.otherAssetsTotal).toBe(250);
    expect(agg.totalAssets).toBe(250);
    expect(agg.financialAssetsTotal).toBe(0);
  });
});

describe('savingsPlan.retirementIncludedInTotal - retirementIncludedInSavings is exposed for display purposes', () => {
  it('defaults to true when the flag is omitted', () => {
    const agg = buildAggregates(input());
    expect(agg.retirementIncludedInSavings).toBe(true);
  });

  it('is true when explicitly set to true', () => {
    const agg = buildAggregates(input({ assets: { savingsPlan: { retirementIncludedInTotal: true } } }));
    expect(agg.retirementIncludedInSavings).toBe(true);
  });

  it('is false when explicitly set to false', () => {
    const agg = buildAggregates(input({ assets: { savingsPlan: { retirementIncludedInTotal: false } } }));
    expect(agg.retirementIncludedInSavings).toBe(false);
  });
});
