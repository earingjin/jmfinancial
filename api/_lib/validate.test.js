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
  basic: { birthYear: 1985, retirementAge: 65, lifeExpectancy: 90, serviceYears: 20 },
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

describe('liquid asset subscription validation', () => {
  it.each([0, 100])('accepts a valid subscription amount (%s)', (subscription) => {
    const result = validateInput(makeInput({
      assets: { liquidAssets: { breakdown: { subscription } } },
    }));
    expect(result.ok).toBe(true);
  });

  it.each([-1, 'abc', '1e3', '0x10', NaN, Infinity])('rejects an invalid subscription amount (%s)', (subscription) => {
    const result = validateInput(makeInput({
      assets: { liquidAssets: { breakdown: { subscription } } },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('assets.liquidAssets.breakdown.subscription');
  });
});

// A11: simple 모드 그림자 필드(총액입력 모드에서 세부입력 값을 보관해 두는 필드)도 다른
// simple 그림자 필드(예: assets.savingsPlan.simpleMonthly)와 동일하게 AMOUNT_FIELDS로
// 검증되어야 한다. 실제 계산에는 쓰이지 않지만(모드 전환 시 원본으로 다시 복사될 뿐) 원본
// 데이터에 음수 등 비정상 값이 영구 저장되는 것을 막는 방어선이다.
describe('A11: simple 모드 그림자 금액 필드 검증(assets.currentLivingCost / assets.debtStatus)', () => {
  const SHADOW_AMOUNT_FIELDS = [
    'assets.currentLivingCost.simpleMonthly',
    'assets.currentLivingCost.simpleAnnual',
    'assets.debtStatus.simpleTotalBalance',
    'assets.debtStatus.simpleMonthlyRepayment',
  ];

  it.each(SHADOW_AMOUNT_FIELDS)('필드가 없으면(레거시 데이터) 그대로 통과한다: %s', (path) => {
    // makeInput()의 VALID 베이스에는 이 그림자 필드들이 전혀 없다 - 기존 검증 결과가 그대로
    // 유지되는지(새 필드 추가로 레거시/기존 데이터가 깨지지 않는지) 확인한다.
    expect(validateInput(makeInput()).ok).toBe(true);
    void path;
  });

  it.each(SHADOW_AMOUNT_FIELDS)('%s: 0과 양수를 허용한다', (path) => {
    [0, 100].forEach((value) => {
      const overrides = path.split('.').reduceRight((acc, key) => ({ [key]: acc }), value);
      const result = validateInput(makeInput(overrides));
      expect(result.ok).toBe(true);
    });
  });

  it.each(SHADOW_AMOUNT_FIELDS)('%s: 음수·NaN·Infinity·비정상 숫자 표현을 거부한다', (path) => {
    [-1, 'abc', '1e3', '0x10', NaN, Infinity].forEach((value) => {
      const overrides = path.split('.').reduceRight((acc, key) => ({ [key]: acc }), value);
      const result = validateInput(makeInput(overrides));
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toContain(path);
    });
  });
});

describe('required spouse retirement fields', () => {
  const spouseInput = {
    basic: { hasSpouse: true },
    spouse: { birthYear: 1990, retirementAge: 63, lifeExpectancy: 86.5 },
  };

  it('accepts spouse retirement age and life expectancy', () => {
    expect(validateInput(makeInput(spouseInput)).ok).toBe(true);
  });

  it.each(['retirementAge', 'lifeExpectancy'])('requires spouse.%s when a spouse is included', (key) => {
    const result = validateInput(makeInput({
      ...spouseInput,
      spouse: { ...spouseInput.spouse, [key]: '' },
    }));
    expect(result.ok).toBe(false);
  });

  it('rejects spouse life expectancy before spouse retirement age', () => {
    const result = validateInput(makeInput({
      ...spouseInput,
      spouse: { ...spouseInput.spouse, retirementAge: 70, lifeExpectancy: 69 },
    }));
    expect(result.errors).toContain('배우자 기대여명은 배우자 은퇴(예정) 연령보다 작을 수 없습니다.');
  });
});

describe('required field: expense.retirementLivingCost', () => {
  it('rejects when blank ("")', () => {
    const result = validateInput(makeInput({ expense: { retirementLivingCost: '' } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/노후.*생활비/);
  });

  it('rejects when missing (undefined)', () => {
    const result = validateInput(makeInput({ expense: { retirementLivingCost: undefined } }));
    expect(result.ok).toBe(false);
  });

  it('accepts an explicit 0 (user asserts no retirement living cost assumption)', () => {
    const result = validateInput(makeInput({ expense: { retirementLivingCost: 0 } }));
    expect(result.ok).toBe(true);
  });

  it('accepts a normal positive value', () => {
    const result = validateInput(makeInput({ expense: { retirementLivingCost: 150 } }));
    expect(result.ok).toBe(true);
  });
});

describe('required fields: basic information', () => {
  it.each(['birthYear', 'retirementAge', 'lifeExpectancy', 'serviceYears'])('rejects blank basic.%s', (key) => {
    const result = validateInput(makeInput({ basic: { [key]: '' } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/필수 입력/);
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

  it('applies the cap when retirementIncludedInTotal is omitted (defaults to included=true)', () => {
    const result = validateInput(
      makeInput({ assets: { savingsPlan: { monthly: 100, retirementMonthly: 100.01, retirementIncludedInTotal: undefined } } })
    );
    expect(result.ok).toBe(false);
  });

  it('applies the cap when retirementIncludedInTotal is explicitly true, at the T+0.01 boundary', () => {
    const result = validateInput(
      makeInput({ assets: { savingsPlan: { monthly: 100, retirementMonthly: 100.01, retirementIncludedInTotal: true } } })
    );
    expect(result.ok).toBe(false);
  });

  it('accepts retirementMonthly exactly equal to savingsPlan.monthly (T boundary) when included', () => {
    const result = validateInput(
      makeInput({ assets: { savingsPlan: { monthly: 100, retirementMonthly: 100, retirementIncludedInTotal: true } } })
    );
    expect(result.ok).toBe(true);
  });

  it('accepts retirementMonthly just under savingsPlan.monthly (T-0.01 boundary) when included', () => {
    const result = validateInput(
      makeInput({ assets: { savingsPlan: { monthly: 100, retirementMonthly: 99.99, retirementIncludedInTotal: true } } })
    );
    expect(result.ok).toBe(true);
  });

  it('does NOT apply the cap when retirementIncludedInTotal is false (retirement savings kept separate)', () => {
    const result = validateInput(
      makeInput({ assets: { savingsPlan: { monthly: 100, retirementMonthly: 200, retirementIncludedInTotal: false } } })
    );
    expect(result.ok).toBe(true);
  });

  it('does NOT apply the annual cap when retirementIncludedInTotal is false', () => {
    const result = validateInput(
      makeInput({ assets: { savingsPlan: { annual: 1000, retirementAnnual: 2000, retirementIncludedInTotal: false } } })
    );
    expect(result.ok).toBe(true);
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

// retirementSavingsInputVersion: 2의 "추가 노후준비 저축" 필드도 다른 금액 입력과 동일하게
// 음수·NaN·Infinity를 거부해야 한다(CLAUDE.md 금액 입력 공통 규칙).
describe('additionalRetirementMonthly/Annual amount validation (retirementSavingsInputVersion: 2)', () => {
  it('rejects a negative additionalRetirementMonthly', () => {
    const result = validateInput(makeInput({ assets: { savingsPlan: { additionalRetirementMonthly: -10 } } }));
    expect(result.ok).toBe(false);
  });

  it('rejects Infinity for additionalRetirementAnnual', () => {
    const result = validateInput(makeInput({ assets: { savingsPlan: { additionalRetirementAnnual: Infinity } } }));
    expect(result.ok).toBe(false);
  });

  it('rejects NaN-producing garbage for additionalRetirementMonthly', () => {
    const result = validateInput(makeInput({ assets: { savingsPlan: { additionalRetirementMonthly: 'garbage' } } }));
    expect(result.ok).toBe(false);
  });

  it('accepts a valid additionalRetirementMonthly/Annual pair', () => {
    const result = validateInput(makeInput({ assets: { savingsPlan: { additionalRetirementMonthly: 10, additionalRetirementAnnual: 120 } } }));
    expect(result.ok).toBe(true);
  });
});

// Case C(코드리뷰 후속): v2는 retirementMonthly/retirementAnnual/retirementIncludedInTotal을 계산에
// 전혀 쓰지 않으므로, v1→v2 전환 전에 남아있던 레거시 값(예: retirementMonthly > savingsMonthly)이
// 있어도 v1 전용 관계 검증 때문에 API 요청 자체가 거부되면 안 된다. 숫자 타입/NaN/Infinity 같은
// 전체 입력 안전성 검증(AMOUNT_FIELDS)은 버전과 무관하게 그대로 유지되어야 한다.
describe('retirementSavingsInputVersion: 2 - 레거시 관계 검증 제외', () => {
  it('레거시 retirementMonthly(200) > savingsMonthly(100) 값이 남아 있어도 v2는 거부되지 않는다', () => {
    const result = validateInput(makeInput({
      assets: {
        savingsPlan: {
          monthly: 100,
          retirementMonthly: 200,
          retirementIncludedInTotal: true,
          retirementSavingsInputVersion: 2,
        },
      },
    }));
    expect(result.ok).toBe(true);
  });

  it('레거시 retirementAnnual(5000) > savingsAnnual(1200) 값이 남아 있어도 v2는 거부되지 않는다', () => {
    const result = validateInput(makeInput({
      assets: {
        savingsPlan: {
          annual: 1200,
          retirementAnnual: 5000,
          retirementIncludedInTotal: true,
          retirementSavingsInputVersion: 2,
        },
      },
    }));
    expect(result.ok).toBe(true);
  });

  it('회귀 확인: 동일한 값이라도 v1(버전 필드 없음)이면 여전히 거부된다', () => {
    const result = validateInput(makeInput({
      assets: { savingsPlan: { monthly: 100, retirementMonthly: 200, retirementIncludedInTotal: true } },
    }));
    expect(result.ok).toBe(false);
  });

  it('v2에서도 additionalRetirementMonthly 자체의 음수/NaN/Infinity 검증은 그대로 유지된다', () => {
    const result = validateInput(makeInput({
      assets: { savingsPlan: { retirementSavingsInputVersion: 2, additionalRetirementMonthly: -5 } },
    }));
    expect(result.ok).toBe(false);
  });
});

describe('national pension future contribution plan validation', () => {
  it('requires expected additional months when continued contribution is selected', () => {
    const result = validateInput(makeInput({
      income: { nationalPension: { futureContributionPlan: 'continue', expectedAdditionalContributionMonths: '' } },
    }));
    expect(result.errors).toContain('income.nationalPension.expectedAdditionalContributionMonths 값이 필요합니다.');
  });

  it('accepts an explicit zero for expected additional months', () => {
    const result = validateInput(makeInput({
      income: { nationalPension: { futureContributionPlan: 'continue', expectedAdditionalContributionMonths: 0 } },
    }));
    expect(result.errors).not.toContain('income.nationalPension.expectedAdditionalContributionMonths 값이 필요합니다.');
  });
  it('allows an actual contribution period below 120 months with a supported plan', () => {
    const result = validateInput(makeInput({
      income: { nationalPension: { inputMode: 'direct', paymentMonths: 60, futureContributionPlan: 'stop' } },
    }));
    expect(result.ok).toBe(true);
  });

  it('rejects an unsupported future contribution plan', () => {
    const result = validateInput(makeInput({
      income: { nationalPension: { futureContributionPlan: 'maybe' } },
    }));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('income.nationalPension.futureContributionPlan 값이 유효하지 않습니다.');
  });
});

describe('compound return rates must be greater than -100%', () => {
  it.each([-100, -100.01])('rejects basic.assumedReturnRate=%s', (assumedReturnRate) => {
    const result = validateInput(makeInput({ basic: { assumedReturnRate } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/assumedReturnRate.*-100보다 커야/);
  });

  it('accepts -99.99% because no stricter policy floor is approved', () => {
    expect(validateInput(makeInput({ basic: { assumedReturnRate: -99.99 } })).ok).toBe(true);
  });

  it.each([NaN, Infinity])('rejects a non-finite assumed return rate (%s)', (assumedReturnRate) => {
    expect(validateInput(makeInput({ basic: { assumedReturnRate } })).ok).toBe(false);
  });

  it.each([-100, -100.01])('applies the same boundary to savings item interestRate=%s', (interestRate) => {
    const result = validateInput(makeInput({
      assets: { savingsPlan: { breakdown: { installment: { monthly: 1, remainingMonths: 12, interestRate } } } },
    }));
    expect(result.ok).toBe(false);
  });
});

describe('age cap: basic.retirementAge (kind "age", max 120)', () => {
  it('rejects retirementAge at T+0.01 boundary (121)', () => {
    const result = validateInput(makeInput({ basic: { retirementAge: 121, lifeExpectancy: 121 } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/retirementAge.*120/);
  });

  it('accepts retirementAge at the T boundary (120)', () => {
    const result = validateInput(makeInput({ basic: { retirementAge: 120, lifeExpectancy: 120 } }));
    expect(result.ok).toBe(true);
  });

  it('accepts retirementAge at the T-0.01 boundary (119, nearest valid integer)', () => {
    const result = validateInput(makeInput({ basic: { retirementAge: 119, lifeExpectancy: 119 } }));
    expect(result.ok).toBe(true);
  });

  it('rejects a negative retirementAge (regression check on the pre-existing min:0 rule)', () => {
    const result = validateInput(makeInput({ basic: { retirementAge: -1 } }));
    expect(result.ok).toBe(false);
  });
});

describe('array length cap: income.regularIncomes (MAX_ARRAY_LENGTH = 50)', () => {
  const item = { annual: 100, years: 1 };

  it('rejects 51 items (T+1 boundary)', () => {
    const result = validateInput(makeInput({ income: { regularIncomes: Array.from({ length: 51 }, () => ({ ...item })) } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/regularIncomes.*50/);
  });

  it('accepts exactly 50 items (T boundary)', () => {
    const result = validateInput(makeInput({ income: { regularIncomes: Array.from({ length: 50 }, () => ({ ...item })) } }));
    expect(result.ok).toBe(true);
  });
});

// "현재 생활비 상세"의 "기타지출"이 단일 금액에서 종류별(name+amount) 반복 목록으로
// 바뀌면서 새로 생긴 배열 경로. 다른 otherItems 배열과 동일하게 amount는 음수·NaN·
// Infinity를 거부해야 한다(financialAssets.otherItems 등과 동일한 검증 규칙).
describe('array field: assets.currentLivingCost.breakdown.otherItems (amount kind)', () => {
  it('accepts a normal positive amount', () => {
    const result = validateInput(
      makeInput({ assets: { currentLivingCost: { breakdown: { otherItems: [{ name: '반려동물', amount: 10 }] } } } })
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a negative amount (T-0.01 below the 0 floor)', () => {
    const result = validateInput(
      makeInput({ assets: { currentLivingCost: { breakdown: { otherItems: [{ name: '반려동물', amount: -0.01 }] } } } })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/otherItems\.0\.amount.*0 이상/);
  });

  it('accepts exactly 0 (T boundary)', () => {
    const result = validateInput(
      makeInput({ assets: { currentLivingCost: { breakdown: { otherItems: [{ name: '반려동물', amount: 0 }] } } } })
    );
    expect(result.ok).toBe(true);
  });

  it('rejects NaN amount', () => {
    const result = validateInput(
      makeInput({ assets: { currentLivingCost: { breakdown: { otherItems: [{ name: '반려동물', amount: NaN }] } } } })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/otherItems\.0\.amount.*유효한 숫자/);
  });

  it('rejects Infinity amount', () => {
    const result = validateInput(
      makeInput({ assets: { currentLivingCost: { breakdown: { otherItems: [{ name: '반려동물', amount: Infinity }] } } } })
    );
    expect(result.ok).toBe(false);
  });

  it('rejects 51 items (T+1 boundary, MAX_ARRAY_LENGTH = 50)', () => {
    const result = validateInput(
      makeInput({
        assets: { currentLivingCost: { breakdown: { otherItems: Array.from({ length: 51 }, () => ({ name: '항목', amount: 1 })) } } },
      })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/otherItems.*50/);
  });

  it('accepts exactly 50 items (T boundary)', () => {
    const result = validateInput(
      makeInput({
        assets: { currentLivingCost: { breakdown: { otherItems: Array.from({ length: 50 }, () => ({ name: '항목', amount: 1 })) } } },
      })
    );
    expect(result.ok).toBe(true);
  });
});

describe('age cap: basic.retirementEndAge (legacy fallback alias, same kind as lifeExpectancy)', () => {
  it('rejects retirementEndAge above 120', () => {
    const result = validateInput(makeInput({ basic: { retirementEndAge: 121 } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/retirementEndAge.*120/);
  });

  it('accepts retirementEndAge at the boundary (120)', () => {
    const result = validateInput(makeInput({ basic: { retirementEndAge: 120 } }));
    expect(result.ok).toBe(true);
  });

  it('accepts a decimal retirementEndAge (84.6), same as lifeExpectancy', () => {
    const result = validateInput(makeInput({ basic: { retirementEndAge: 84.6 } }));
    expect(result.ok).toBe(true);
  });

  it('rejects an oversized retirementEndAge even when lifeExpectancy is blank (regression: this was the bypass path)', () => {
    const result = validateInput(makeInput({ basic: { lifeExpectancy: '', retirementEndAge: 1000000 } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/retirementEndAge.*120/);
  });
});

describe('birth-year range validation: expense.children[].birthYear (same rule as basic.birthYear, 1900~current year)', () => {
  const childItem = { educationCost: 0, marriageSupport: 0, otherCost: 0 };

  it('rejects a non-numeric value (NaN)', () => {
    const result = validateInput(makeInput({ expense: { children: [{ ...childItem, birthYear: 'abc' }] } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/expense\.children\.0\.birthYear/);
  });

  it('rejects 1899 (T-1 boundary)', () => {
    const result = validateInput(makeInput({ expense: { children: [{ ...childItem, birthYear: 1899 }] } }));
    expect(result.ok).toBe(false);
  });

  it('accepts 1900 (T boundary)', () => {
    const result = validateInput(makeInput({ expense: { children: [{ ...childItem, birthYear: 1900 }] } }));
    expect(result.ok).toBe(true);
  });

  it('rejects 9999 (far above current year)', () => {
    const result = validateInput(makeInput({ expense: { children: [{ ...childItem, birthYear: 9999 }] } }));
    expect(result.ok).toBe(false);
  });

  it('accepts a blank birthYear (not yet entered, same convention as other fields)', () => {
    const result = validateInput(makeInput({ expense: { children: [{ ...childItem, birthYear: '' }] } }));
    expect(result.ok).toBe(true);
  });

  it('includes the item index in the error message when the second of two children is invalid', () => {
    const result = validateInput(
      makeInput({ expense: { children: [{ ...childItem, birthYear: 2000 }, { ...childItem, birthYear: 9999 }] } })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/expense\.children\.1\.birthYear/);
    expect(result.errors.join(' ')).not.toMatch(/expense\.children\.0\.birthYear/);
  });
});

describe('expense.retirementLumpSumExpenses[] - post-retirement lump-sum expenses', () => {
  // makeInput()의 basic 기본값: retirementAge 65, lifeExpectancy 90.
  const item = (overrides = {}) => ({ name: '자녀 결혼지원', expectedAge: 72, amount: 3000, ...overrides });

  it('accepts a fully valid item', () => {
    const result = validateInput(makeInput({ expense: { retirementLumpSumExpenses: [item()] } }));
    expect(result.ok).toBe(true);
  });

  it('accepts an empty list (no lump-sum expenses entered)', () => {
    expect(validateInput(makeInput({ expense: { retirementLumpSumExpenses: [] } })).ok).toBe(true);
  });

  it('accepts multiple items, including two at the same age', () => {
    const result = validateInput(makeInput({
      expense: { retirementLumpSumExpenses: [item({ expectedAge: 72 }), item({ name: '차량 교체', expectedAge: 72, amount: 2000 })] },
    }));
    expect(result.ok).toBe(true);
  });

  it('accepts an amount of exactly 0', () => {
    expect(validateInput(makeInput({ expense: { retirementLumpSumExpenses: [item({ amount: 0 })] } })).ok).toBe(true);
  });

  it('rejects a negative amount', () => {
    const result = validateInput(makeInput({ expense: { retirementLumpSumExpenses: [item({ amount: -1 })] } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/expense\.retirementLumpSumExpenses\.0\.amount/);
  });

  it('rejects a non-numeric amount', () => {
    const result = validateInput(makeInput({ expense: { retirementLumpSumExpenses: [item({ amount: 'abc' })] } }));
    expect(result.ok).toBe(false);
  });

  it('rejects an expected age before the retirement age (retirementAge=65)', () => {
    const result = validateInput(makeInput({ expense: { retirementLumpSumExpenses: [item({ expectedAge: 64 })] } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/은퇴\(예정\) 연령/);
  });

  it('accepts an expected age exactly at the retirement age (T boundary)', () => {
    expect(validateInput(makeInput({ expense: { retirementLumpSumExpenses: [item({ expectedAge: 65 })] } })).ok).toBe(true);
  });

  it('rejects an expected age after life expectancy (lifeExpectancy=90)', () => {
    const result = validateInput(makeInput({ expense: { retirementLumpSumExpenses: [item({ expectedAge: 91 })] } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/기대수명/);
  });

  it('accepts an expected age exactly at life expectancy (T boundary)', () => {
    expect(validateInput(makeInput({ expense: { retirementLumpSumExpenses: [item({ expectedAge: 90 })] } })).ok).toBe(true);
  });

  it('rejects a whitespace-only name', () => {
    const result = validateInput(makeInput({ expense: { retirementLumpSumExpenses: [item({ name: '   ' })] } }));
    expect(result.ok).toBe(false);
  });

  it('rejects a name over 40 characters', () => {
    const result = validateInput(makeInput({ expense: { retirementLumpSumExpenses: [item({ name: 'a'.repeat(41) })] } }));
    expect(result.ok).toBe(false);
  });

  it('requires a name once amount or expectedAge is filled in', () => {
    const result = validateInput(makeInput({ expense: { retirementLumpSumExpenses: [{ name: '', expectedAge: 72, amount: 3000 }] } }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/expense\.retirementLumpSumExpenses\.0\.name/);
  });

  it('leaves a fully blank placeholder row valid (not yet filled in, same convention as other repeatable lists)', () => {
    const result = validateInput(makeInput({ expense: { retirementLumpSumExpenses: [{ name: '', expectedAge: '', amount: '' }] } }));
    expect(result.ok).toBe(true);
  });

  it('re-validates against a changed life expectancy (an item that was in range can become out of range)', () => {
    const result = validateInput(makeInput({
      basic: { lifeExpectancy: 80 },
      expense: { retirementLumpSumExpenses: [item({ expectedAge: 85 })] },
    }));
    expect(result.ok).toBe(false);
  });
});

describe('repeated input structure validation', () => {
  const arrayPaths = [
    ['income', 'regularIncomes'], ['income', 'otherIncomes'], ['expense', 'children'],
    ['expense', 'debts'], ['expense', 'otherExpenses'], ['expense', 'healthInsurance', 'items'],
    ['assets', 'liquidAssets', 'customItems'], ['assets', 'financialAssets', 'otherItems'],
    ['assets', 'pensionAssetsBreakdown', 'otherItems'], ['assets', 'realEstateAssets', 'otherItems'],
    ['assets', 'savingsPlan', 'customItems'], ['assets', 'debtStatus', 'customItems'],
    ['expense', 'retirementLumpSumExpenses'],
  ];

  const withPath = (path, value) => path.reduceRight((nested, key) => ({ [key]: nested }), value);

  it.each(arrayPaths)('rejects a non-array value at %s.%s', (...path) => {
    expect(validateInput(makeInput(withPath(path, {}))).ok).toBe(false);
  });

  it.each([null, [], 'item', 1])('rejects a non-plain-object array item: %j', (item) => {
    expect(validateInput(makeInput({ income: { otherIncomes: [item] } })).ok).toBe(false);
  });

  it('keeps omitted and empty arrays valid', () => {
    expect(validateInput(makeInput({ income: { otherIncomes: undefined } })).ok).toBe(true);
    expect(validateInput(makeInput({ income: { otherIncomes: [] } })).ok).toBe(true);
  });

  it('validates the checkbox target array without requiring object items', () => {
    expect(validateInput(makeInput({ scenarios: { expenseReduction: { targets: ['living', 'medical'] } } })).ok).toBe(true);
    expect(validateInput(makeInput({ scenarios: { expenseReduction: { targets: {} } } })).ok).toBe(false);
    expect(validateInput(makeInput({ scenarios: { expenseReduction: { targets: ['unknown'] } } })).ok).toBe(false);
  });
});

describe('strict numeric input types and strings', () => {
  it.each([true, false, [], {}, '   '])('rejects non-numeric amount input: %j', (monthly) => {
    expect(validateInput(makeInput({ assets: { currentIncome: { monthly } } })).ok).toBe(false);
  });

  it.each(['0', '123', '-99.99', '12.5', '.5'])('accepts an explicit decimal numeric string: %s', (assumedReturnRate) => {
    expect(validateInput(makeInput({ basic: { assumedReturnRate } })).ok).toBe(true);
  });

  it.each([' 1', '1 ', '1e3', '0x10', '+', '.', 'Infinity', '-Infinity'])('rejects an unsupported numeric string: %s', (assumedReturnRate) => {
    expect(validateInput(makeInput({ basic: { assumedReturnRate } })).ok).toBe(false);
  });

  it.each([true, [], {}, '   '])('rejects invalid birthYear types: %j', (birthYear) => {
    expect(validateInput(makeInput({ basic: { birthYear } })).ok).toBe(false);
  });
});

describe('repeated item names', () => {
  it.each(['임대수입', 'IRP(개인형)', 'S&P500', 'CMA-RP', '주택/상가'])('accepts a normal financial item name: %s', (name) => {
    expect(validateInput(makeInput({ income: { otherIncomes: [{ name, annual: 1, years: 1 }] } })).ok).toBe(true);
  });

  it.each(['!!!', '@@@'])('rejects a punctuation-only item name: %s', (name) => {
    expect(validateInput(makeInput({ income: { otherIncomes: [{ name, annual: 1, years: 1 }] } })).ok).toBe(false);
  });

  it('treats a whitespace-only optional item name as blank', () => {
    expect(validateInput(makeInput({ income: { otherIncomes: [{ name: '   ', annual: '', years: '' }] } })).ok).toBe(true);
  });
});

describe('monthly pension start age requirements', () => {
  it.each([
    { income: { severance: { type: 'pension', pensionStartAge: '' } } },
    { income: { personalPension: { type: 'installment', startAge: '' } } },
  ])('rejects a missing self pension start age', (override) => {
    expect(validateInput(makeInput(override)).ok).toBe(false);
  });

  it('accepts explicit start ages for monthly pensions', () => {
    const result = validateInput(makeInput({
      income: {
        severance: { type: 'pension', pensionStartAge: 60 },
        personalPension: { type: 'installment', startAge: 65 },
      },
    }));
    expect(result.ok).toBe(true);
  });
});
