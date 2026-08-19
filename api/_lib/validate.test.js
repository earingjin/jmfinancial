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

describe('repeated input structure validation', () => {
  const arrayPaths = [
    ['income', 'regularIncomes'], ['income', 'otherIncomes'], ['expense', 'children'],
    ['expense', 'debts'], ['expense', 'otherExpenses'], ['expense', 'healthInsurance', 'items'],
    ['assets', 'liquidAssets', 'customItems'], ['assets', 'financialAssets', 'otherItems'],
    ['assets', 'pensionAssetsBreakdown', 'otherItems'], ['assets', 'realEstateAssets', 'otherItems'],
    ['assets', 'savingsPlan', 'customItems'], ['assets', 'debtStatus', 'customItems'],
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
