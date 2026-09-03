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

  it('exposes each person\'s national-pension eligibility status alongside the monthly amount (self and spouse independently)', () => {
    const result = buildAggregates(input({
      basic: { hasSpouse: true },
      income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 240, paymentMonths: 60, futureContributionPlan: 'continue' } },
      spouse: { nationalPension: { inputMode: 'direct', monthly: 80, months: 240, paymentMonths: 130 } },
    }));

    expect(result.retirementIncomeByPerson.self.nationalPensionEligibilityStatus).toBe('unknown');
    expect(result.retirementIncomeByPerson.self.nationalPensionMonthly).toBe(0);
    expect(result.retirementIncomeByPerson.spouse.nationalPensionEligibilityStatus).toBe('eligible');
    expect(result.retirementIncomeByPerson.spouse.nationalPensionMonthly).toBe(80);
  });

  it('marks spouse eligibility as "none" when there is no spouse, without throwing', () => {
    const result = buildAggregates(input({ basic: { hasSpouse: false } }));
    expect(result.retirementIncomeByPerson.spouse.nationalPensionEligibilityStatus).toBe('none');
  });

  describe('severanceLumpsum ignores stale lumpsum values left over from switching type', () => {
    it('keeps showing the lumpsum amount when type is "lumpsum" (existing behavior unchanged)', () => {
      const result = buildAggregates(input({ income: { severance: { type: 'lumpsum', lumpsum: 5000 } } }));
      expect(result.retirementIncomeByPerson.self.severanceLumpsum).toBe(5000);
    });

    it('reports 0 when type is "none" even though a stale lumpsum value remains in the form data', () => {
      const result = buildAggregates(input({ income: { severance: { type: 'none', lumpsum: 5000 } } }));
      expect(result.retirementIncomeByPerson.self.severanceLumpsum).toBe(0);
    });

    it('reports 0 when type is "pension" even though a stale lumpsum value remains in the form data', () => {
      const result = buildAggregates(input({
        income: { severance: { type: 'pension', lumpsum: 5000, pensionMonthly: 40, pensionMonths: 120 } },
      }));
      expect(result.retirementIncomeByPerson.self.severanceLumpsum).toBe(0);
      // the switch to type='pension' must not be affected by this fix
      expect(result.retirementIncomeByPerson.self.severancePensionMonthly).toBe(40);
    });

    it('applies the same rule to the spouse independently of self', () => {
      const result = buildAggregates(input({
        income: { severance: { type: 'lumpsum', lumpsum: 5000 } },
        spouse: { severance: { type: 'none', lumpsum: 3000 } },
      }));
      expect(result.retirementIncomeByPerson.self.severanceLumpsum).toBe(5000);
      expect(result.retirementIncomeByPerson.spouse.severanceLumpsum).toBe(0);
    });

    it('preserves old saved results that predate the type field entirely (no "type" key at all)', () => {
      const legacyInput = input({ income: { severance: { lumpsum: 5000 } } });
      delete legacyInput.income.severance.type;
      const result = buildAggregates(legacyInput);
      expect(result.retirementIncomeByPerson.self.severanceLumpsum).toBe(5000);
    });
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

// retirementSavingsInputVersion: 2 - 연금저축·IRP는 breakdown 저축 총액에 이미 포함되어 자동
// 인식되고, additionalRetirementMonthly/Annual만 사용자가 별도로 추가하는 "노후저축 v2" 계산.
// v1(레거시 retirementMonthly/retirementIncludedInTotal) 계산식은 절대 건드리지 않는다.
describe('retirementSavingsInputVersion 2 - auto-detected pensionSavings/irp + additional retirement savings', () => {
  const v2Overrides = (extra = {}) => ({
    assets: {
      savingsPlan: {
        retirementSavingsInputVersion: 2,
        breakdown: { pensionSavings: { monthly: 20 }, irp: { monthly: 30 } },
        additionalRetirementMonthly: 0,
        additionalRetirementAnnual: 0,
        ...extra,
      },
    },
  });

  it('Case 1: breakdown 총저축 100(연금저축 20 + IRP 30 포함), 추가 노후저축 0 → 총저축 100 / 노후저축 50', () => {
    const agg = buildAggregates(input(v2Overrides()));
    expect(agg.monthlySavings).toBe(100);
    expect(agg.retirementSavingsAnnual).toBe(600); // (20+30)*12
    expect(agg.totalSavingsAnnual).toBe(1200);
  });

  it('Case 2: 추가 노후저축 10이 총저축·노후저축에 각각 한 번만 더해진다 → 총저축 110 / 노후저축 60', () => {
    const agg = buildAggregates(input(v2Overrides({ additionalRetirementMonthly: 10, additionalRetirementAnnual: 120 })));
    expect(agg.monthlySavings).toBe(110);
    expect(agg.retirementSavingsAnnual).toBe(720); // 600 + 120
    expect(agg.totalSavingsAnnual).toBe(1320); // 1200 + 120
  });

  it('Case 3: 연금저축·IRP 없이 추가 노후저축 30만 있으면 총저축에 30이 한 번만 더해진다', () => {
    const agg = buildAggregates(
      input({
        assets: {
          savingsPlan: {
            monthly: 0,
            annual: 0,
            retirementSavingsInputVersion: 2,
            breakdown: { pensionSavings: { monthly: 0 }, irp: { monthly: 0 } },
            additionalRetirementMonthly: 30,
            additionalRetirementAnnual: 360,
          },
        },
      })
    );
    expect(agg.monthlySavings).toBe(30);
    expect(agg.retirementSavingsAnnual).toBe(360);
  });

  it('Case 4: 연금저축·IRP만 있고 추가 노후저축 입력이 없어도 정상 계산된다', () => {
    const agg = buildAggregates(input(v2Overrides()));
    expect(agg.retirementSavingsAnnual).toBe(600);
    expect(agg.totalSavingsAnnual).toBe(1200);
  });

  it('v2에서는 노후저축 전액이 이미 총저축 합계 안에 있으므로 retirementIncludedInSavings가 true다', () => {
    const agg = buildAggregates(input(v2Overrides({ additionalRetirementMonthly: 10, additionalRetirementAnnual: 120 })));
    expect(agg.retirementIncludedInSavings).toBe(true);
  });
});

describe('retirementSavingsInputVersion 1(레거시, 버전 필드 없음) - pensionSavings/irp breakdown을 자동 합산하지 않는다', () => {
  it('Case 6: 연금저축 20 + IRP 30이 있어도 레거시 retirementMonthly=50만 노후저축 분자로 쓴다(100으로 계산되지 않음)', () => {
    const agg = buildAggregates(
      input({
        assets: {
          savingsPlan: {
            breakdown: { pensionSavings: { monthly: 20 }, irp: { monthly: 30 } },
            retirementMonthly: 50,
            retirementAnnual: 600,
            retirementIncludedInTotal: false,
          },
        },
      })
    );
    expect(agg.retirementSavingsAnnual).toBe(600); // (20+30+50)*12=1200 이 아니라 retirementAnnual 필드값 그대로
    expect(agg.monthlySavings).toBe(150); // generalSavingsMonthly(100) + retirementMonthly(50) - breakdown 자동합산 없음
  });

  it('Case 5: 버전 필드가 아예 없는 기존 저장 결과는 현재(v1) 계산과 완전히 동일하다', () => {
    const withVersion = buildAggregates(input({ assets: { savingsPlan: { retirementSavingsInputVersion: undefined } } }));
    const withoutVersion = buildAggregates(input());
    expect(withVersion).toEqual(withoutVersion);
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
