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

describe('simple savings and asset totals', () => {
  it('uses active simple totals without mixing preserved detailed values', () => {
    const result = buildAggregates(input({
      assets: {
        liquidAssets: { inputMode: 'simple', total: 10, breakdown: { deposit: 999 } },
        financialAssets: { inputMode: 'simple', total: 20, stocks: 999, other: 999 },
        pensionAssets: 30,
        pensionAssetsBreakdown: { irp: 999 },
        realEstateAssets: { inputMode: 'simple', total: 40, mainProperty: 999 },
        otherAssets: { inputMode: 'simple', total: 50, items: [{ amount: 999 }] },
        savingsPlan: {
          inputMode: 'simple', monthly: 60, annual: 720,
          retirementSavingsInputVersion: 2,
          breakdown: { pensionSavings: { monthly: 999 } },
          additionalRetirementMonthly: 999,
        },
      },
    }));

    expect(result).toMatchObject({
      liquidAssets: 10,
      financialAssetsTotal: 20,
      pensionAssets: 30,
      realEstateTotal: 40,
      otherAssetsTotal: 50,
      totalAssets: 150,
      monthlySavings: 60,
      totalSavingsAnnual: 720,
      retirementSavingsAnnual: 0,
    });
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

// A2: "월예상 노후소득"(노후소득보장률의 분자)은 현재 나이가 아니라 사용자가 입력한 은퇴 예정
// 나이(basic.retirementAge / spouse.retirementAge) 시점의 예상 연금소득을 뜻한다. 퇴직연금·개인연금은
// 그 시점이 활성구간(시작 나이 포함, 종료 시점 제외) 안에 있을 때만 포함하고, 국민연금은 그 시점에
// 법정 수급개시연령(출생연도별)에 도달했는지를 추가로 확인한다. startAge/retirementAge/birthYear
// 정보가 없는 레거시 데이터는 이 시점을 판정할 수 없으므로 기존 동작(개월수·가입기간 자격만으로
// 판정)을 그대로 유지한다.
describe('연금 startAge/retirementAge 기준 활성구간 판정 (A2)', () => {
  describe('퇴직연금·개인연금', () => {
    const pensionInput = (retirementAge) => input({
      basic: { retirementAge },
      income: {
        severance: { type: 'pension', pensionMonthly: 100, pensionMonths: 240, pensionStartAge: 70 },
        personalPension: { type: 'installment', monthly: 100, months: 240, startAge: 70 },
      },
    });

    it('은퇴나이 < startAge -> 0', () => {
      const agg = buildAggregates(pensionInput(60));
      expect(agg.severancePensionMonthly).toBe(0);
      expect(agg.personalPensionMonthly).toBe(0);
    });

    it('은퇴나이 = startAge -> 포함', () => {
      const agg = buildAggregates(pensionInput(70));
      expect(agg.severancePensionMonthly).toBe(100);
      expect(agg.personalPensionMonthly).toBe(100);
    });

    it('startAge < 은퇴나이 < 종료나이(90) -> 포함', () => {
      const agg = buildAggregates(pensionInput(85));
      expect(agg.severancePensionMonthly).toBe(100);
      expect(agg.personalPensionMonthly).toBe(100);
    });

    it('은퇴나이 = 종료나이(90) -> 0 (종료 시점 제외)', () => {
      const agg = buildAggregates(pensionInput(90));
      expect(agg.severancePensionMonthly).toBe(0);
      expect(agg.personalPensionMonthly).toBe(0);
    });

    it('은퇴나이 > 종료나이 -> 0', () => {
      const agg = buildAggregates(pensionInput(95));
      expect(agg.severancePensionMonthly).toBe(0);
      expect(agg.personalPensionMonthly).toBe(0);
    });

    it('months가 12의 배수가 아니어도 종료 경계(startAge70+235/12=89.58세)를 정확히 처리한다', () => {
      const finiteInput = (retirementAge) => input({
        basic: { retirementAge },
        income: {
          severance: { type: 'pension', pensionMonthly: 100, pensionMonths: 235, pensionStartAge: 70 },
          personalPension: { type: 'installment', monthly: 100, months: 235, startAge: 70 },
        },
      });
      const before = buildAggregates(finiteInput(89));
      expect(before.severancePensionMonthly).toBe(100); // 89 < 89.58 -> 포함
      expect(before.personalPensionMonthly).toBe(100);

      const after = buildAggregates(finiteInput(90));
      expect(after.severancePensionMonthly).toBe(0); // 90 >= 89.58 -> 제외
      expect(after.personalPensionMonthly).toBe(0);
    });

    it('일시금 선택 시에는 startAge 활성구간과 무관하게 기존처럼 0이다', () => {
      const agg = buildAggregates(input({
        basic: { retirementAge: 75 }, // startAge(70) 이후라 연금방식이었다면 포함될 조건
        income: {
          severance: { type: 'lumpsum', lumpsum: 5000 },
          personalPension: { type: 'lumpsum', lumpsum: 3000 },
        },
      }));
      expect(agg.severancePensionMonthly).toBe(0);
      expect(agg.personalPensionMonthly).toBe(0);
    });

    it('startAge가 없는 레거시 입력은 기존 동작(개월수만으로 판정)을 그대로 유지한다', () => {
      const agg = buildAggregates(input({
        basic: { retirementAge: 60 }, // startAge(70)보다 이른 은퇴나이여도
        income: {
          severance: { type: 'pension', pensionMonthly: 100, pensionMonths: 240 }, // pensionStartAge 없음
          personalPension: { type: 'installment', monthly: 100, months: 240 }, // startAge 없음
        },
      }));
      expect(agg.severancePensionMonthly).toBe(100);
      expect(agg.personalPensionMonthly).toBe(100);
    });

    it('retirementAge가 없는 레거시 입력도 기존 동작을 그대로 유지한다', () => {
      const agg = buildAggregates(input({
        income: {
          severance: { type: 'pension', pensionMonthly: 100, pensionMonths: 240, pensionStartAge: 70 },
          personalPension: { type: 'installment', monthly: 100, months: 240, startAge: 70 },
        },
      })); // basic.retirementAge 없음
      expect(agg.severancePensionMonthly).toBe(100);
      expect(agg.personalPensionMonthly).toBe(100);
    });

    it('본인과 배우자의 은퇴나이가 다르면 각자 독립적으로 판정된다', () => {
      const agg = buildAggregates(input({
        basic: { hasSpouse: true, retirementAge: 60 }, // 본인: startAge(70) 전 -> 제외
        income: { personalPension: { type: 'installment', monthly: 100, months: 240, startAge: 70 } },
        spouse: {
          retirementAge: 72, // 배우자: startAge(70) 이후 -> 포함
          personalPension: { type: 'installment', monthly: 50, months: 240, startAge: 70 },
        },
      }));
      expect(agg.retirementIncomeByPerson.self.personalPensionMonthly).toBe(0);
      expect(agg.retirementIncomeByPerson.spouse.personalPensionMonthly).toBe(50);
      expect(agg.personalPensionMonthly).toBe(50); // 합계에도 배우자분만 반영
    });
  });

  describe('국민연금', () => {
    it('가입요건 충족 + 은퇴나이 < 법정 개시나이 -> 0', () => {
      // 출생연도 1975 -> '1969년 이후' 코호트 -> 법정 개시나이 65세
      const agg = buildAggregates(input({
        basic: { birthYear: 1975, retirementAge: 60 },
        income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 240, paymentMonths: 120 } },
      }));
      expect(agg.nationalPensionMonthly).toBe(0);
    });

    it('가입요건 충족 + 은퇴나이 = 법정 개시나이 -> 포함', () => {
      const agg = buildAggregates(input({
        basic: { birthYear: 1975, retirementAge: 65 },
        income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 240, paymentMonths: 120 } },
      }));
      expect(agg.nationalPensionMonthly).toBe(100);
    });

    it('가입요건 충족 + 은퇴나이 > 법정 개시나이 -> 포함', () => {
      const agg = buildAggregates(input({
        basic: { birthYear: 1975, retirementAge: 68 },
        income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 240, paymentMonths: 120 } },
      }));
      expect(agg.nationalPensionMonthly).toBe(100);
    });

    it('가입요건 미충족이면 은퇴나이와 무관하게 기존처럼 0이다', () => {
      const agg = buildAggregates(input({
        basic: { birthYear: 1975, retirementAge: 70 }, // 개시나이(65)보다 늦게 은퇴해도
        income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 240, paymentMonths: 60 } }, // 가입기간 미충족
      }));
      expect(agg.nationalPensionMonthly).toBe(0);
    });

    it('가입상태 unknown이면 기존 산출불가 흐름이 깨지지 않는다', () => {
      const agg = buildAggregates(input({
        basic: { birthYear: 1975, retirementAge: 70 },
        income: {
          nationalPension: {
            inputMode: 'direct', monthly: 100, months: 240, paymentMonths: 60, futureContributionPlan: 'continue',
          },
        },
      }));
      expect(agg.nationalPensionMonthly).toBe(0);
      expect(agg.nationalPensionEligibility.self).toBe('unknown');
    });

    it('birthYear가 없는 레거시 입력은 기존 동작(가입기간 자격만으로 판정)을 그대로 유지한다', () => {
      const agg = buildAggregates(input({
        basic: { retirementAge: 60 }, // birthYear 없음
        income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 240, paymentMonths: 120 } },
      }));
      expect(agg.nationalPensionMonthly).toBe(100);
    });

    it('본인과 배우자의 출생연도가 달라 법정 개시나이가 다르면 각자 독립적으로 판정된다', () => {
      const agg = buildAggregates(input({
        basic: { hasSpouse: true, birthYear: 1975, retirementAge: 62 }, // 본인 개시나이 65세 -> 아직
        income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 240, paymentMonths: 120 } },
        spouse: {
          birthYear: 1955, retirementAge: 62, // 배우자 코호트(1953~1956) 개시나이 61세 -> 이미 지남
          nationalPension: { inputMode: 'direct', monthly: 80, months: 240, paymentMonths: 120 },
        },
      }));
      expect(agg.retirementIncomeByPerson.self.nationalPensionMonthly).toBe(0);
      expect(agg.retirementIncomeByPerson.spouse.nationalPensionMonthly).toBe(80);
    });
  });

  describe('대표 시나리오(감사 예시): 은퇴 60세, 개인연금 startAge 70세, 240개월, 월 100만원', () => {
    const scenario = (retirementAge) => input({
      basic: { retirementAge },
      income: { personalPension: { type: 'installment', monthly: 100, months: 240, startAge: 70 } },
    });

    it('은퇴 60세 -> 개인연금 미포함(0)', () => {
      const agg = buildAggregates(scenario(60));
      expect(agg.personalPensionMonthly).toBe(0);
      expect(agg.monthlyRetirementIncome).toBe(0);
    });

    it('은퇴 70세(=startAge) -> 개인연금 100만원 정상 포함', () => {
      const agg = buildAggregates(scenario(70));
      expect(agg.personalPensionMonthly).toBe(100);
      expect(agg.monthlyRetirementIncome).toBe(100);
    });
  });
});
