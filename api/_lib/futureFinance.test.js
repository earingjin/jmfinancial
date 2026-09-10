import { describe, expect, it } from 'vitest';
import { buildAggregates } from './aggregate.js';
import { calcRetirementSimulation } from './simulation.js';
import {
  buildFiveYearOutlookAges,
  buildFutureFinanceProjection,
  buildRetirementAssetProjection,
  calculatePensionIncomeAtTarget,
  calculateNonPensionIncomeAtTarget,
  calculateFutureValue,
  calculateFutureLivingExpense,
} from './futureFinance.js';

function makeInput(overrides = {}) {
  return {
    basic: { birthYear: 1976, lifeExpectancy: 83, hasSpouse: false },
    assets: {
      currentLivingCost: { monthly: 300 },
      liquidAssets: { total: 50000, breakdown: { deposit: 50000 } },
      financialAssets: {}, pensionAssetsBreakdown: {}, realEstateAssets: {}, debtStatus: {},
    },
    income: {
      nationalPension: { monthly: 150, months: 240 },
      personalPension: { type: 'installment', monthly: 50, startAge: 70, months: 240 },
      severance: { type: 'pension', pensionMonthly: 50, pensionStartAge: 60, pensionMonths: 240 },
    },
    spouse: {}, expense: {},
    ...overrides,
  };
}

function allNumbersAreFinite(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allNumbersAreFinite);
  if (value && typeof value === 'object') return Object.values(value).every(allNumbersAreFinite);
  return true;
}

describe('future finance projection', () => {
  it('does not turn unknown national-pension eligibility into a calculable zero', () => {
    const input = makeInput({
      basic: { birthYear: 1976, retirementAge: 65, lifeExpectancy: 83, hasSpouse: false },
      income: {
        nationalPension: { inputMode: 'direct', monthly: 150, months: 240, paymentMonths: 100, futureContributionPlan: 'continue' },
        personalPension: { type: 'none' }, severance: { type: 'none' },
      },
    });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.targets.length).toBeGreaterThan(0);
    expect(result.targets.every((target) => (
      target.calculable === false
      && target.pensionIncome === null
      && target.coverageRate === null
      && target.calculationReason.includes('국민연금 향후 가입기간을 확정할 수 없음')
    ))).toBe(true);
  });

  it('calculates the 60/70/80 outlook and purchasing-power equivalents', () => {
    const input = makeInput();
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.targets.map((item) => item.age)).toEqual([60, 70, 80]);
    expect(result.targets[0].livingExpense).toBe(403);
    expect(result.targets[0].pensionBreakdown.nationalPension).toBe(0);
    expect(result.targets[1].pensionIncome).toBe(266);
    expect(result.targets[2].pensionBreakdown.nationalPension).toBeGreaterThan(0);
    expect(result.purchasingPower.map((item) => item.requiredAmount)).toEqual([50000, 67196, 90306]);
  });

  it('adds a five-year outlook without changing the legacy targets', () => {
    const input = makeInput({ basic: { birthYear: 1979, retirementAge: 62, lifeExpectancy: 83, hasSpouse: false } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.targets.map((item) => item.age)).toEqual([60, 70, 80]);
    expect(result.fiveYearOutlook.map((item) => item.age)).toEqual([47, 50, 55, 60, 65, 70, 75, 80, 83]);
    expect(result.fiveYearOutlook[0].years).toBe(0);
    expect(result.retirementCashFlowOutlook.map((item) => item.age)).toEqual([62, 65, 70, 75, 80, 83]);
  });

  it('does not duplicate ages on five-year boundaries', () => {
    expect(buildFiveYearOutlookAges(50, 80)).toEqual([50, 55, 60, 65, 70, 75, 80]);
  });

  it('safely omits the outlook when life expectancy is missing or before the current age', () => {
    const missingInput = makeInput({ basic: { birthYear: 1979, hasSpouse: false } });
    const invalidInput = makeInput({ basic: { birthYear: 1979, lifeExpectancy: 46, hasSpouse: false } });
    const legacyInput = makeInput({ basic: { birthYear: 1979, lifeExpectancy: '', retirementEndAge: 80, hasSpouse: false } });
    expect(buildFutureFinanceProjection({ input: missingInput, aggregates: buildAggregates(missingInput), currentYear: 2026 }).fiveYearOutlook).toEqual([]);
    expect(buildFutureFinanceProjection({ input: invalidInput, aggregates: buildAggregates(invalidInput), currentYear: 2026 }).fiveYearOutlook).toEqual([]);
    expect(buildFutureFinanceProjection({ input: legacyInput, aggregates: buildAggregates(legacyInput), currentYear: 2026 }).fiveYearOutlook.at(-1).age).toBe(80);
  });

  it('reuses the existing pension boundaries and 3% living-expense assumption in the five-year outlook', () => {
    const input = makeInput({ basic: { birthYear: 1976, lifeExpectancy: 80, hasSpouse: false } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    const at60 = result.fiveYearOutlook.find((item) => item.age === 60);
    const at80 = result.fiveYearOutlook.find((item) => item.age === 80);
    expect(at60.livingExpense).toBe(Math.round(300 * (1.03 ** 10)));
    expect(at60.pensionBreakdown.retirementPension).toBe(50);
    expect(at80.pensionBreakdown.retirementPension).toBe(0);
  });

  it('includes salary, bonuses, business, other regular income, and pension for their existing periods', () => {
    const base = makeInput();
    const input = {
      ...base,
      basic: { birthYear: 1979, retirementAge: 60, lifeExpectancy: 70, hasSpouse: true },
      income: {
        ...base.income,
        salary: { monthly: 300, annualBonus: 120, months: 156 },
        business: { monthly: 50 },
        otherIncomes: [{ name: '임대소득', annual: 120, years: 8 }],
      },
      spouse: {
        birthYear: 1981,
        salary: { monthly: 100, annualBonus: 0, months: 36 },
        nationalPension: { monthly: 0, months: 0 },
        severance: { type: 'none' },
        personalPension: { type: 'none' },
      },
    };
    const aggregates = buildAggregates(input);
    const result = buildFutureFinanceProjection({ input, aggregates, currentYear: 2026 });
    const at47 = result.fiveYearOutlook.find((item) => item.age === 47);
    const at50 = result.fiveYearOutlook.find((item) => item.age === 50);
    const at55 = result.fiveYearOutlook.find((item) => item.age === 55);
    const at60 = result.fiveYearOutlook.find((item) => item.age === 60);

    expect(calculateNonPensionIncomeAtTarget({ input, aggregates, currentAge: 47, years: 0 })).toBe(470);
    expect(aggregates.otherIncomeMonthly).toBe(10);
    expect(at47.totalIncome).toBe(470);
    expect(at47.incomeLabel).toBe('월급·연금 등');
    expect(at50.nonPensionIncome).toBe(370);
    expect(at55.nonPensionIncome).toBe(360);
    expect(at60.nonPensionIncome).toBe(0);
    expect(at60.totalIncome).toBe(at60.pensionIncome);
    expect(at60.incomeLabel).toBe('연금소득');
    expect(at47.coverageRate).toBeCloseTo((470 / 300) * 100, 1);
  });

  it('uses the spouse retirement age when legacy spouse salary months are missing', () => {
    const input = makeInput({
      basic: { birthYear: 1979, retirementAge: 60, lifeExpectancy: 70, hasSpouse: true },
      spouse: {
        birthYear: 1981,
        retirementAge: 50,
        salary: { monthly: 100, annualBonus: 0, months: '' },
      },
    });
    const aggregates = buildAggregates(input);

    expect(calculateNonPensionIncomeAtTarget({ input, aggregates, currentAge: 47, currentYear: 2026, years: 4 })).toBe(100);
    expect(calculateNonPensionIncomeAtTarget({ input, aggregates, currentAge: 47, currentYear: 2026, years: 5 })).toBe(0);
  });

  it('keeps the legacy diagnosis based on age 80, not the final five-year point', () => {
    const baselineInput = makeInput({ basic: { birthYear: 1979, lifeExpectancy: 80, hasSpouse: false } });
    const input = makeInput({ basic: { birthYear: 1979, lifeExpectancy: 83, hasSpouse: false } });
    const baseline = buildFutureFinanceProjection({ input: baselineInput, aggregates: buildAggregates(baselineInput), currentYear: 2026 });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.diagnosis).toBe(baseline.diagnosis);
  });

  it('does not emit NaN or Infinity in the five-year outlook', () => {
    const input = makeInput({ basic: { birthYear: 1979, lifeExpectancy: 83, hasSpouse: false } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(allNumbersAreFinite(result.fiveYearOutlook)).toBe(true);
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

  it('uses start-inclusive and end-exclusive pension periods', () => {
    const input = makeInput();
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    const at60 = result.targets.find((item) => item.age === 60);
    const at70 = result.targets.find((item) => item.age === 70);
    const at80 = result.targets.find((item) => item.age === 80);
    expect(at60.pensionBreakdown.retirementPension).toBe(50);
    expect(at60.pensionBreakdown.personalPension).toBe(0);
    expect(at70.pensionBreakdown.personalPension).toBe(50);
    expect(at80.pensionBreakdown.retirementPension).toBe(0);
  });

  it('pays national pension from its start age through 10, 20, and 30 years later', () => {
    const input = makeInput({
      basic: { birthYear: 1986, retirementAge: 60, lifeExpectancy: 95, hasSpouse: false },
      income: {
        nationalPension: { monthly: 100, months: 240 },
        severance: { type: 'none' },
        personalPension: { type: 'none' },
      },
    });
    const atAge = (age) => calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: age - 40 });

    expect(atAge(64).nationalPension).toBe(0);
    [65, 75, 85, 95].forEach((age) => {
      const pension = atAge(age);
      expect(pension.nationalPension).toBeGreaterThan(0);
      expect(pension.components[0].inclusionStatus).toBe('included');
      expect(pension.components[0].endAge).toBeNull();
    });

    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.fiveYearOutlook.at(-1).age).toBe(95);
    expect(result.fiveYearOutlook.at(-1).pensionBreakdown.nationalPension).toBeGreaterThan(0);
    expect(result.retirementCashFlowOutlook.at(-1).pensionBreakdown.nationalPension).toBeGreaterThan(0);
  });

  it('applies national pension growth only after each person reaches the statutory start age', () => {
    const input = makeInput({
      basic: { birthYear: 1975, retirementAge: 60, lifeExpectancy: 85, hasSpouse: true },
      income: {
        nationalPension: { monthly: 130, months: 240 },
        severance: { type: 'none' },
        personalPension: { type: 'none' },
      },
      spouse: {
        birthYear: 1978,
        nationalPension: { monthly: 60, months: 240 },
        severance: { type: 'none' },
        personalPension: { type: 'none' },
      },
    });
    const selfAtAge = (age) => calculatePensionIncomeAtTarget({ input: { ...input, basic: { ...input.basic, hasSpouse: false } }, currentYear: 2026, years: age - 51 });
    const spouseOnlyInput = {
      ...input,
      basic: { ...input.basic, birthYear: 1978, hasSpouse: false },
      income: input.spouse,
    };
    const spouseAtAge = (age) => calculatePensionIncomeAtTarget({ input: spouseOnlyInput, currentYear: 2026, years: age - 48 });

    expect(selfAtAge(60).nationalPension).toBe(0);
    expect(selfAtAge(65).nationalPension).toBe(130);
    expect(selfAtAge(70).nationalPension).toBeCloseTo(130 * (1.021 ** 5), 10);
    expect(spouseAtAge(60).nationalPension).toBe(0);
    expect(spouseAtAge(65).nationalPension).toBe(60);
    expect(spouseAtAge(70).nationalPension).toBeCloseTo(60 * (1.021 ** 5), 10);

    const householdAtSelf70 = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 19 });
    const spouseComponent = householdAtSelf70.components.find((item) => item.key === 'spouse.nationalPension');
    expect(spouseComponent.currentAge + 19).toBe(67);
    expect(spouseComponent.amount).toBeCloseTo(60 * (1.021 ** 2), 10);
  });

  it.each([
    ['direct paymentMonths', { inputMode: 'direct', monthly: 100, months: 12, paymentMonths: 240 }],
    ['simulated contributionMonths', { inputMode: 'simulate', monthly: 100, months: 12, simulate: { contributionMonths: 240 } }],
  ])('uses %s only for eligibility, never as a national pension payment duration', (_label, nationalPension) => {
    const input = makeInput({
      basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 95, hasSpouse: false },
      income: { nationalPension, severance: { type: 'none' }, personalPension: { type: 'none' } },
    });
    const afterThirtyYears = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 55 });
    expect(afterThirtyYears.nationalPension).toBeGreaterThan(0);
    expect(afterThirtyYears.components[0].inclusionStatus).toBe('included');
  });

  it('marks the target incalculable when a positive monthly pension has unknown timing', () => {
    const input = makeInput({ income: { nationalPension: { monthly: 0, months: 0 }, personalPension: { type: 'installment', monthly: 50, startAge: '', months: 240 }, severance: { type: 'none' } } });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.targets[0].pensionIncome).toBeNull();
    expect(result.targets[0].coverageRate).toBeNull();
    expect(result.targets[0].calculable).toBe(false);
  });

  it('evaluates spouse national pension using the spouse cohort separately', () => {
    const input = makeInput({
      basic: { birthYear: 1976, hasSpouse: true },
      spouse: { birthYear: 1986, nationalPension: { monthly: 100, months: 240 }, severance: { type: 'none' }, personalPension: { type: 'none' } },
    });
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    const at70 = result.targets.find((item) => item.age === 70);
    const at80 = result.targets.find((item) => item.age === 80);
    const selfNational = at70.pensionBreakdown.components.find((item) => item.key === 'self.nationalPension');
    const spouseNational = at70.pensionBreakdown.components.find((item) => item.key === 'spouse.nationalPension');
    const spouseNationalAfterStart = at80.pensionBreakdown.components.find((item) => item.key === 'spouse.nationalPension');
    expect(selfNational.inclusionStatus).toBe('included');
    expect(spouseNational.inclusionStatus).toBe('beforeStart');
    expect(spouseNationalAfterStart.inclusionStatus).toBe('included');
  });
});

// docs/future-finance-spec.md:49,76 - "월 수령액 불명"은 산출 불가로 처리해야 하며, null/빈 문자열/
// 누락 필드를 0으로 정규화해 완전한 합계에 써서는 안 된다. 이 describe는 그 규칙을 검증한다.
describe('blank monthly pension amount is unknown, not a silent zero (docs/future-finance-spec.md:49,76)', () => {
  const nationalPensionEligibleBlank = (monthly) => ({
    basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 95, hasSpouse: false },
    income: {
      nationalPension: { inputMode: 'direct', monthly, paymentMonths: 120 },
      severance: { type: 'none' },
      personalPension: { type: 'none' },
    },
  });
  const severancePensionBlank = (pensionMonthly) => ({
    basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 95, hasSpouse: false },
    income: {
      nationalPension: { inputMode: 'none' },
      severance: { type: 'pension', pensionMonthly, pensionStartAge: 65, pensionMonths: 240 },
      personalPension: { type: 'none' },
    },
  });
  const personalPensionBlank = (monthly) => ({
    basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 95, hasSpouse: false },
    income: {
      nationalPension: { inputMode: 'none' },
      severance: { type: 'none' },
      personalPension: { type: 'installment', monthly, startAge: 65, months: 240 },
    },
  });

  const cases = [
    ['income.nationalPension.monthly (eligible)', nationalPensionEligibleBlank, 'self.nationalPension'],
    ['income.severance.pensionMonthly (type=pension)', severancePensionBlank, 'self.retirementPension'],
    ['income.personalPension.monthly (type=installment)', personalPensionBlank, 'self.personalPension'],
  ];

  it.each(cases)('%s: blank string is unknown, not zero', (_label, buildOverrides, componentKey) => {
    const input = makeInput(buildOverrides(''));
    const result = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 30 });
    const component = result.components.find((c) => c.key === componentKey);
    expect(component.inclusionStatus).toBe('unknown');
    expect(component.amount).toBeNull();
    expect(result.calculable).toBe(false);
  });

  it.each(cases)('%s: whitespace-only is unknown, not zero', (_label, buildOverrides, componentKey) => {
    const input = makeInput(buildOverrides('   '));
    const result = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 30 });
    const component = result.components.find((c) => c.key === componentKey);
    expect(component.inclusionStatus).toBe('unknown');
    expect(component.amount).toBeNull();
  });

  it.each(cases)('%s: null is unknown, not zero', (_label, buildOverrides, componentKey) => {
    const input = makeInput(buildOverrides(null));
    const result = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 30 });
    const component = result.components.find((c) => c.key === componentKey);
    expect(component.inclusionStatus).toBe('unknown');
    expect(component.amount).toBeNull();
  });

  it.each(cases)('%s: undefined is unknown, not zero', (_label, buildOverrides, componentKey) => {
    const input = makeInput(buildOverrides(undefined));
    const result = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 30 });
    const component = result.components.find((c) => c.key === componentKey);
    expect(component.inclusionStatus).toBe('unknown');
    expect(component.amount).toBeNull();
  });

  it.each(cases)('%s: an explicit 0 is a real zero, not unknown', (_label, buildOverrides, componentKey) => {
    const input = makeInput(buildOverrides(0));
    const result = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 30 });
    const component = result.components.find((c) => c.key === componentKey);
    expect(component.inclusionStatus).toBe('zero');
    expect(component.amount).toBe(0);
    expect(result.calculable).toBe(true);
  });

  it.each(cases)('%s: a normal positive amount keeps the existing included calculation', (_label, buildOverrides, componentKey) => {
    const input = makeInput(buildOverrides(100));
    const result = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 30 });
    const component = result.components.find((c) => c.key === componentKey);
    expect(component.inclusionStatus).toBe('included');
    expect(component.amount).toBeGreaterThan(0);
    expect(result.calculable).toBe(true);
  });

  it('사례 A (실제 문의 재현): 국민연금 가입기간은 충족했지만 월액이 빈칸이면 60/70/80세 지표 전체가 산출 불가가 된다', () => {
    const input = makeInput(nationalPensionEligibleBlank(''));
    const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
    expect(result.targets.length).toBeGreaterThan(0);
    expect(result.targets.every((target) => (
      target.calculable === false && target.pensionIncome === null && target.coverageRate === null
    ))).toBe(true);
  });
});

// legacyFallback(futureContributionPlan 키 자체가 없는 과거 데이터)은 "가입기간 자격판정"의
// 하위호환일 뿐이다. 월 예상연금액(monthly) 자체가 비어 있는지는 별개의 문제이므로, 자격판정이
// legacyFallback으로 통과했다는 이유만으로 monthly 공란을 0원으로 확정해서는 안 된다.
describe('legacy national pension (no futureContributionPlan key): eligibility fallback is separate from a blank monthly amount', () => {
  const legacyNationalPension = (monthly) => ({
    basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 95, hasSpouse: false },
    income: {
      // inputMode/paymentMonths/futureContributionPlan 키 자체가 없는 과거 스키마 형태.
      nationalPension: { monthly },
      severance: { type: 'none' },
      personalPension: { type: 'none' },
    },
  });

  it('legacy + monthly 양수 → 기존처럼 정상 계산(포함)된다', () => {
    const input = makeInput(legacyNationalPension(150));
    const result = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 30 });
    const component = result.components.find((c) => c.key === 'self.nationalPension');
    expect(component.eligibilityStatus).toBe('eligible');
    expect(component.inclusionStatus).toBe('included');
    expect(component.amount).toBeGreaterThan(0);
    expect(result.calculable).toBe(true);
  });

  it.each([
    ['blank string', ''],
    ['whitespace-only', '   '],
    ['null', null],
    ['undefined', undefined],
  ])('legacy + monthly가 %s이면 unknown(amount:null)이지 zero가 아니다', (_label, monthly) => {
    const input = makeInput(legacyNationalPension(monthly));
    const result = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 30 });
    const component = result.components.find((c) => c.key === 'self.nationalPension');
    expect(component.eligibilityStatus).toBe('eligible');
    expect(component.inclusionStatus).toBe('unknown');
    expect(component.amount).toBeNull();
    expect(result.calculable).toBe(false);
  });

  it('legacy + 명시적 0은 실제 0원(zero)으로 유지된다', () => {
    const input = makeInput(legacyNationalPension(0));
    const result = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 30 });
    const component = result.components.find((c) => c.key === 'self.nationalPension');
    expect(component.inclusionStatus).toBe('zero');
    expect(component.amount).toBe(0);
    expect(result.calculable).toBe(true);
  });
});

describe('calculateFutureValue finite result guard', () => {
  it('throws an explicit calculation error instead of returning null on overflow', () => {
    expect(() => calculateFutureValue(Number.MAX_VALUE, 1, 2)).toThrow(/CALCULATION_NON_FINITE/);
  });
});

describe('buildRetirementAssetProjection', () => {
  // 40세(1986년생), 65세 은퇴, 90세 기대수명이 기본값 - simulation.test.js와 동일한 관례를 쓴다.
  function projectionInput(overrides = {}) {
    return {
      basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: 0, hasSpouse: false },
      // 국민연금이 테스트 목적이 아닌 경우 "없음"임을 명시한다 - 국민연금 섹션이 통째로 빠진 채로는
      // legacyFallback(과거 데이터 자격판정 하위호환)에 우연히 걸려 의도와 무관한 국민연금 판정이
      // 섞여 들어갈 수 있다.
      income: { nationalPension: { inputMode: 'none' } },
      spouse: {},
      expense: { retirementLivingCost: 200 },
      assets: {},
      ...overrides,
    };
  }

  function project(overrides = {}, currentYear = 2026) {
    const input = projectionInput(overrides);
    const aggregates = buildAggregates(input);
    const simulation = calcRetirementSimulation(input, currentYear);
    return buildRetirementAssetProjection({ input, aggregates, simulation, currentYear });
  }

  it('1) keeps assets through life expectancy when starting assets are large relative to living cost', () => {
    const result = project({ assets: { liquidAssets: { total: 1000000 } } });
    expect(result.notCalculable).toBe(false);
    expect(result.depletionAge).toBeNull();
    expect(result.assetsRemainAtLifeExpectancy).toBe(true);
    expect(result.points[0].age).toBe(65);
    expect(result.points.at(-1).age).toBe(90);
    expect(result.points.length).toBe(26); // 65..90 inclusive
    expect(result.points.every((p) => p.endingBalance >= 0)).toBe(true);
  });

  it('2) reports a depletion age before life expectancy when starting assets are insufficient', () => {
    const result = project({ assets: { liquidAssets: { total: 1000 } } });
    expect(result.notCalculable).toBe(false);
    expect(result.depletionAge).not.toBeNull();
    expect(result.depletionAge).toBeGreaterThanOrEqual(65);
    expect(result.depletionAge).toBeLessThan(90);
    expect(result.assetsRemainAtLifeExpectancy).toBe(false);
    expect(result.points.find((p) => p.age === result.depletionAge).unfundedExpense).toBeGreaterThan(0);
  });

  it('2a) depletionAge always points at the exact age whose endingBalance is 0 (chart/text alignment contract)', () => {
    // 그래프가 텍스트의 depletionAge와 다른 나이에 0원을 그리는 회귀를 막는다 - depletionAge는
    // points[].age 중 endingBalance가 0인 "그 나이" 자체를 가리켜야 한다(연도 밀림 금지).
    const result = project({ assets: { liquidAssets: { total: 1000 } } });
    const depletionPoint = result.points.find((p) => p.age === result.depletionAge);
    expect(depletionPoint).toBeDefined();
    expect(depletionPoint.endingBalance).toBe(0);
    expect(depletionPoint.unfundedExpense).toBeGreaterThan(0);
    // depletionAge 이전 나이는 아직 0으로 클램프되지 않았어야 한다(진짜 "최초" 소진 시점인지 확인).
    const before = result.points.find((p) => p.age === result.depletionAge - 1);
    if (before) expect(before.endingBalance).toBeGreaterThan(0);
  });

  it('2b) reports recoveredAfterDepletion when income later exceeds expenses and rebuilds the balance', () => {
    // retirementAge를 60으로 낮춰 국민연금 개시(65세)까지 소득 공백기간을 만든다. 이 공백기간
    // 동안 적은 시작자산(500)이 먼저 소진되고, 65세부터 국민연금(월 300, 물가상승률보다 낮은
    // 국민연금 증가율에도 생활비를 웃돌 만큼 큰 금액)이 들어오면서 다시 잔액이 쌓이는지 확인한다.
    const result = project({
      basic: { birthYear: 1986, retirementAge: 60, lifeExpectancy: 90, assumedReturnRate: 0, hasSpouse: false },
      assets: { liquidAssets: { total: 500 } },
      income: { nationalPension: { monthly: 500, months: 300 } },
    });
    expect(result.depletionAge).not.toBeNull();
    expect(result.depletionAge).toBeLessThan(65);
    expect(result.recoveredAfterDepletion).toBe(true);
    expect(result.points.some((p) => p.age > result.depletionAge && p.endingBalance > 0)).toBe(true);
  });

  it('2c) reports recoveredAfterDepletion as false when the balance never comes back', () => {
    const result = project({ assets: { liquidAssets: { total: 10 } } });
    expect(result.depletionAge).not.toBeNull();
    expect(result.recoveredAfterDepletion).toBe(false);
  });

  it('3) can deplete in the very first retirement year', () => {
    const result = project({ assets: { liquidAssets: { total: 10 } } });
    expect(result.depletionAge).toBe(65);
    expect(result.points[0].unfundedExpense).toBeGreaterThan(0);
    expect(result.points[0].endingBalance).toBe(0);
  });

  it('4) grows the balance over time when pension income exceeds living expenses', () => {
    const result = project({
      assets: { liquidAssets: { total: 0 } },
      income: { nationalPension: { monthly: 1000, months: 600 } },
    });
    expect(result.depletionAge).toBeNull();
    expect(result.points[0].endingBalance).toBeGreaterThan(0);
    expect(result.points.at(-1).endingBalance).toBeGreaterThan(result.points[0].endingBalance);
  });

  it('5) treats a zero starting balance with exactly breakeven income and expense as not depleted', () => {
    // 개인연금(privatePensionGrowthRate=0, 물가상승 없이 명목액 고정)을 은퇴 시점의 물가반영
    // 생활비와 정확히 같은 금액으로 맞춰, "자산 0원인데 그 해 소득이 생활비를 정확히 충당하는"
    // 손익분기 케이스를 만든다. 기대수명=은퇴나이(단일 연도)로 두어 이후 연도의 물가·연금
    // 증가율 차이로 인한 괴리를 배제한다.
    const yearsToRetirement = 65 - 40; // birthYear 1986, currentYear 2026
    const monthlyExpenseAtRetirement = calculateFutureLivingExpense(200, yearsToRetirement);
    const result = project({
      basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 65, assumedReturnRate: 0, hasSpouse: false },
      income: {
        nationalPension: { inputMode: 'none' },
        personalPension: { type: 'installment', monthly: monthlyExpenseAtRetirement, startAge: 65, months: 12 },
      },
      assets: { liquidAssets: { total: 0 } },
    });
    expect(result.points.length).toBe(1);
    expect(result.points[0].unfundedExpense).toBe(0);
    expect(result.points[0].endingBalance).toBe(0);
    expect(result.depletionAge).toBeNull();
    expect(result.assetsRemainAtLifeExpectancy).toBe(true);
  });

  it('6) reflects national pension eligibility before and after its start age', () => {
    // birthYear 1986 -> 국민연금 개시 65세. retirementAge 60으로 낮춰 60~70세 구간에서
    // 개시 전/후 전환을 관찰한다.
    const result = project({
      basic: { birthYear: 1986, retirementAge: 60, lifeExpectancy: 70, assumedReturnRate: 0, hasSpouse: false },
      income: { nationalPension: { monthly: 100, months: 300 } },
      assets: { liquidAssets: { total: 1000000 } },
    });
    const before = result.points.find((p) => p.age === 64);
    const after = result.points.find((p) => p.age === 65);
    expect(before.income).toBe(0);
    expect(after.income).toBeGreaterThan(0);
  });

  it('7) stops personal pension income once its receiving period ends', () => {
    const result = project({
      income: {
        nationalPension: { inputMode: 'none' },
        personalPension: { type: 'installment', monthly: 100, startAge: 65, months: 60 }, // 65~69세, 70세부터 종료
      },
      assets: { liquidAssets: { total: 1000000 } },
    });
    const during = result.points.find((p) => p.age === 69);
    const after = result.points.find((p) => p.age === 70);
    expect(during.income).toBeGreaterThan(0);
    expect(after.income).toBe(0);
  });

  it('8) stops retirement (severance) pension income once its receiving period ends', () => {
    const result = project({
      income: {
        nationalPension: { inputMode: 'none' },
        severance: { type: 'pension', pensionMonthly: 100, pensionStartAge: 65, pensionMonths: 60 },
      },
      assets: { liquidAssets: { total: 1000000 } },
    });
    const during = result.points.find((p) => p.age === 69);
    const after = result.points.find((p) => p.age === 70);
    expect(during.income).toBeGreaterThan(0);
    expect(after.income).toBe(0);
  });

  it('8a) legacy/bypass data with an active monthly pension but a blank amount is not calculable (previously silently zero)', () => {
    // 신규 입력은 wizardRequiredFields.js/validate.js가 이 상태를 제출 단계에서 막지만, 과거 저장
    // 데이터나 validation 우회 데이터가 여기까지 들어오는 경우를 대비한 계산 계층 방어다.
    const result = project({
      income: {
        nationalPension: { inputMode: 'none' },
        severance: { type: 'pension', pensionMonthly: '', pensionStartAge: 65, pensionMonths: 60 },
      },
      assets: { liquidAssets: { total: 1000000 } },
    });
    expect(result.notCalculable).toBe(true);
  });

  it('converts an identified retirement-pension balance into monthly income without retaining the same principal', () => {
    const result = project({
      basic: { birthYear: 1961, retirementAge: 65, lifeExpectancy: 67, assumedReturnRate: 0, hasSpouse: false },
      income: {
        nationalPension: { inputMode: 'none' },
        severance: { type: 'pension', pensionMonthly: 80, pensionStartAge: 65, pensionMonths: 24 },
      },
      expense: { retirementLivingCost: 0 },
      assets: { pensionAssets: 3000, pensionAssetsBreakdown: { selfRetirementPension: 3000 } },
    });
    expect(result.startingAssets).toBe(0);
    expect(result.points[0]).toMatchObject({ income: 960, retirementLumpSumIncome: 0, endingBalance: 960 });
    expect(result.points[1].income).toBe(960);
    expect(result.points[2].income).toBe(0);
  });

  it('adds a retirement lump sum once at its retirement-age receipt point', () => {
    const result = project({
      basic: { birthYear: 1961, retirementAge: 65, lifeExpectancy: 67, assumedReturnRate: 0, hasSpouse: false },
      income: { nationalPension: { inputMode: 'none' }, severance: { type: 'lumpsum', lumpsum: 5000, lumpsumAge: 66 } },
      expense: { retirementLivingCost: 0 },
      assets: { pensionAssets: 3000, pensionAssetsBreakdown: { selfRetirementPension: 3000 } },
    });
    expect(result.startingAssets).toBe(0);
    expect(result.points.map((point) => point.retirementLumpSumIncome)).toEqual([0, 5000, 0]);
    expect(result.points[1].endingBalance).toBe(5000);
    expect(result.explanation.totalRetirementLumpSumIncome).toBe(5000);
  });

  it('does not add again a lump sum already included at the retirement boundary', () => {
    const result = project({
      basic: { birthYear: 1961, retirementAge: 65, lifeExpectancy: 66, assumedReturnRate: 0, hasSpouse: false },
      income: { nationalPension: { inputMode: 'none' }, severance: { type: 'lumpsum', lumpsum: 5000, lumpsumAge: 65 } },
      expense: { retirementLivingCost: 0 },
      assets: { pensionAssets: 3000, pensionAssetsBreakdown: { selfRetirementPension: 3000 } },
    });
    expect(result.startingAssets).toBe(5000);
    expect(result.points[0].retirementLumpSumIncome).toBe(0);
    expect(result.points[0].endingBalance).toBe(5000);
  });

  it('9) applies a 0% return rate as no investment growth', () => {
    const result = project({ basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: 0, hasSpouse: false }, assets: { liquidAssets: { total: 100000 } } });
    expect(result.points[0].investmentReturn).toBe(0);
  });

  it('10) applies a positive return rate to the starting balance for that year, before that year\'s cash flow', () => {
    // retirementAge = currentAge(65)로 두어 은퇴 전 축적 기간(0년)이 없게 만든다 - 그래야
    // readyAssetsAtRetirement가 입력한 liquidAssets.total과 정확히 같아 계산이 단순해진다.
    const result = project({
      basic: { birthYear: 1961, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: 5, hasSpouse: false },
      income: { nationalPension: { monthly: 500, months: 300 } },
      assets: { liquidAssets: { total: 100000 } },
    });
    expect(result.points[0].investmentReturn).toBe(Math.round(100000 * 0.05));
  });

  it('11) allows a negative assumed return rate (declining balance faster than expenses alone)', () => {
    const result = project({
      basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: -2, hasSpouse: false },
      assets: { liquidAssets: { total: 100000 } },
    });
    expect(result.points[0].investmentReturn).toBeLessThan(0);
    expect(Number.isFinite(result.points[0].investmentReturn)).toBe(true);
  });

  it('12) handles a user who has already passed their entered retirement age (starts the projection at their current age)', () => {
    const result = project({
      basic: { birthYear: 1958, retirementAge: 60, lifeExpectancy: 90, assumedReturnRate: 0, hasSpouse: false },
      assets: { liquidAssets: { total: 100000 } },
    }); // currentAge(2026) = 68, already past retirementAge 60
    expect(result.notCalculable).toBe(false);
    expect(result.points[0].age).toBe(68);
  });

  it('13) handles retirementAge equal to current age', () => {
    const result = project({
      basic: { birthYear: 1961, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: 0, hasSpouse: false },
      assets: { liquidAssets: { total: 100000 } },
    }); // currentAge(2026) = 65 = retirementAge
    expect(result.points[0].age).toBe(65);
  });

  it('14) handles life expectancy equal to retirement age (a single-year projection)', () => {
    const result = project({ basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 65, assumedReturnRate: 0, hasSpouse: false } });
    expect(result.points.length).toBe(1);
    expect(result.points[0].age).toBe(65);
  });

  it('15) computes normally for a user already 65 or older', () => {
    const result = project({
      basic: { birthYear: 1955, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: 0, hasSpouse: false },
      assets: { liquidAssets: { total: 100000 } },
    }); // currentAge(2026) = 71
    expect(result.notCalculable).toBe(false);
    expect(result.points[0].age).toBe(71);
  });

  it('16) reports no lump-sum expense included when none is entered', () => {
    const result = project();
    expect(result.lumpSumExpenseIncluded).toBe(false);
    expect(result.points.every((p) => p.lumpSumExpense === 0)).toBe(true);
  });

  it('18) does not fabricate a lump-sum expense timing when only a total amount is entered (no age)', () => {
    const result = project({ expense: { retirementLivingCost: 200, children: [{ educationCost: 3000, marriageSupport: 5000, otherCost: 0 }] } });
    expect(result.lumpSumExpenseIncluded).toBe(false);
    expect(result.points.every((p) => p.lumpSumExpense === 0)).toBe(true);
  });

  it('20a) is not calculable when retirementAge is missing', () => {
    const result = project({ basic: { birthYear: 1986, retirementAge: '', lifeExpectancy: 90, hasSpouse: false } });
    expect(result.notCalculable).toBe(true);
    expect(result.points).toEqual([]);
  });

  it('20b) is not calculable when retirementLivingCost is missing', () => {
    const result = project({ expense: { retirementLivingCost: '' } });
    expect(result.notCalculable).toBe(true);
  });

  it('20c) is not calculable when birthYear is missing', () => {
    const result = project({ basic: { birthYear: '', retirementAge: 65, lifeExpectancy: 90, hasSpouse: false } });
    expect(result.notCalculable).toBe(true);
  });

  it('20d) is not calculable when life expectancy is missing (degenerate retirement period)', () => {
    const result = project({ basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: '', hasSpouse: false } });
    expect(result.notCalculable).toBe(true);
  });

  it('20e) is not calculable when a positive pension amount has no known start age (unknown timing, not treated as zero)', () => {
    const result = project({
      income: {
        nationalPension: { inputMode: 'none' },
        personalPension: { type: 'installment', monthly: 50, startAge: '', months: 240 },
      },
    });
    expect(result.notCalculable).toBe(true);
    expect(result.reason).toMatch(/연금/);
  });

  describe('20f) unknown national-pension eligibility is assumed zero here (relaxed on purpose, unlike the 60/70/80 coverage-rate indicator)', () => {
    it('still computes the full projection instead of returning notCalculable', () => {
      const result = project({
        income: {
          nationalPension: { inputMode: 'direct', monthly: 100, months: 300, paymentMonths: 60, futureContributionPlan: 'continue' },
          personalPension: { type: 'installment', monthly: 80, startAge: 65, months: 300 },
        },
        assets: { liquidAssets: { total: 1000000 } },
      });
      expect(result.notCalculable).toBe(false);
      expect(result.points.length).toBe(26); // 65..90세, 국민연금 unknown이어도 그대로 다 계산됨
      // 국민연금은 unknown이라 0원 취급되지만, 개인연금은 그대로 계산에 반영되어야 한다.
      expect(result.points[0].income).toBeGreaterThan(0);
    });

    it('flags nationalPensionUnknownAssumedZero and carries an explanatory note', () => {
      const result = project({
        income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 300, paymentMonths: 60, futureContributionPlan: 'unknown' } },
      });
      expect(result.nationalPensionUnknownAssumedZero).toBe(true);
      expect(result.nationalPensionUnknownNote).toMatch(/국민연금/);
    });

    it('does not flag nationalPensionUnknownAssumedZero when eligibility is resolved (stop -> lumpSumPossible, already zero for a known reason)', () => {
      const result = project({
        income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 300, paymentMonths: 60, futureContributionPlan: 'stop' } },
      });
      expect(result.notCalculable).toBe(false);
      expect(result.nationalPensionUnknownAssumedZero).toBe(false);
      expect(result.nationalPensionUnknownNote).toBeNull();
    });

    it('leaves the 60/70/80 coverage-rate indicator (buildFutureFinanceProjection) strictly not-calculable for the same input', () => {
      // 이번 완화는 buildRetirementAssetProjection 전용이다 - calculatePensionIncomeAtTarget의
      // 기본 호출부(60/70/80세 지표)는 여전히 unknown을 산출 불가로 처리해야 한다.
      const input = makeInput({
        basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 90, hasSpouse: false },
        income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 300, paymentMonths: 60, futureContributionPlan: 'continue' } },
      });
      const result = buildFutureFinanceProjection({ input, aggregates: buildAggregates(input), currentYear: 2026 });
      expect(result.targets.every((target) => target.calculable === false)).toBe(true);
    });

    it('still blocks the whole projection when a different component is genuinely unknown (e.g. spouse birth year missing)', () => {
      const result = project({
        basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 90, hasSpouse: true },
        income: { nationalPension: { inputMode: 'direct', monthly: 100, months: 300, paymentMonths: 60, futureContributionPlan: 'unknown' } },
        spouse: { severance: { type: 'pension', pensionMonthly: 50, pensionStartAge: 65, pensionMonths: 120 } },
      });
      // spouse.birthYear가 없어 spouse의 퇴직연금 개시 시점을 알 수 없다 - 이 경우는 여전히
      // 산출 불가로 남아야 한다(국민연금 unknown 완화와는 별개의 문제).
      expect(result.notCalculable).toBe(true);
    });
  });

  it('does not emit NaN or Infinity across the whole projection', () => {
    const result = project({
      basic: { birthYear: 1986, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: 5, hasSpouse: false },
      income: { nationalPension: { monthly: 150, months: 300 }, personalPension: { type: 'installment', monthly: 50, startAge: 70, months: 120 } },
      assets: { liquidAssets: { total: 30000 } },
    });
    const flat = result.points.flatMap((p) => Object.values(p));
    expect(flat.every((v) => typeof v !== 'number' || Number.isFinite(v))).toBe(true);
  });

  describe('retirement lump-sum expenses (expense.retirementLumpSumExpenses)', () => {
    const bigAssets = { liquidAssets: { total: 1000000 } };

    it('10) reduces the ending balance at the expense age compared to no lump sum', () => {
      const withoutLumpSum = project({ assets: bigAssets });
      const withLumpSum = project({
        assets: bigAssets,
        expense: { retirementLivingCost: 200, retirementLumpSumExpenses: [{ name: '차량 교체', expectedAge: 72, amount: 100000 }] },
      });
      const before = withoutLumpSum.points.find((p) => p.age === 72).endingBalance;
      const after = withLumpSum.points.find((p) => p.age === 72).endingBalance;
      expect(after).toBeLessThan(before);
      expect(before - after).toBeCloseTo(100000, -2);
    });

    it('11) can introduce (or move earlier) a depletionAge that would not otherwise happen', () => {
      // 300,000은 목돈지출 없이는 기대수명까지 넉넉히 버티는 시작자산이다(예: 1)번 케이스와 동일한
      // 성격). 70세에 큰 목돈지출을 더하면 그 자체로 depletionAge가 새로 생겨야 한다.
      const withoutLumpSum = project({ assets: { liquidAssets: { total: 300000 } } });
      const withLumpSum = project({
        assets: { liquidAssets: { total: 300000 } },
        expense: { retirementLivingCost: 200, retirementLumpSumExpenses: [{ name: '주택 수리', expectedAge: 70, amount: 250000 }] },
      });
      expect(withoutLumpSum.assetsRemainAtLifeExpectancy).toBe(true);
      expect(withLumpSum.depletionAge).not.toBeNull();
      expect(withLumpSum.depletionAge).toBeLessThan(90);
    });

    it('12) can bring the balance to exactly 0 right at the expense age (never shown negative)', () => {
      const result = project({
        assets: bigAssets,
        expense: { retirementLivingCost: 200, retirementLumpSumExpenses: [{ name: '전액 소진', expectedAge: 72, amount: 10000000 }] },
      });
      const point = result.points.find((p) => p.age === 72);
      expect(point.endingBalance).toBe(0);
      expect(point.unfundedExpense).toBeGreaterThan(0);
    });

    it('13) records unfundedExpense when the lump sum cannot be fully covered', () => {
      const result = project({
        assets: { liquidAssets: { total: 1000 } },
        expense: { retirementLivingCost: 200, retirementLumpSumExpenses: [{ name: '차량 교체', expectedAge: 65, amount: 100000 }] },
      });
      const point = result.points.find((p) => p.age === 65);
      expect(point.endingBalance).toBe(0);
      expect(point.unfundedExpense).toBeGreaterThan(0);
      expect(result.depletionAge).toBe(65);
    });

    it('14) still recovers after a lump-sum-caused depletion once pension income exceeds expenses', () => {
      const result = project({
        basic: { birthYear: 1986, retirementAge: 60, lifeExpectancy: 90, assumedReturnRate: 0, hasSpouse: false },
        assets: { liquidAssets: { total: 1000 } },
        income: { nationalPension: { monthly: 500, months: 300 } },
        expense: { retirementLivingCost: 200, retirementLumpSumExpenses: [{ name: '목돈지출', expectedAge: 60, amount: 50000 }] },
      });
      expect(result.depletionAge).toBe(60);
      expect(result.recoveredAfterDepletion).toBe(true);
    });

    it('15) sums multiple lump-sum items at the same age and keeps each as a separate event', () => {
      const result = project({
        assets: bigAssets,
        expense: {
          retirementLivingCost: 200,
          retirementLumpSumExpenses: [
            { name: '자녀 결혼지원', expectedAge: 72, amount: 3000 },
            { name: '차량 교체', expectedAge: 72, amount: 2000 },
          ],
        },
      });
      const point = result.points.find((p) => p.age === 72);
      expect(point.lumpSumExpense).toBe(5000);
      expect(point.lumpSumEvents).toEqual([
        { name: '자녀 결혼지원', amount: 3000 },
        { name: '차량 교체', amount: 2000 },
      ]);
      expect(result.lumpSumExpenseIncluded).toBe(true);
    });

    it('ignores a lump-sum item whose expected age falls before retirement (defensive, mirrors validate.js)', () => {
      const result = project({
        assets: bigAssets,
        expense: { retirementLivingCost: 200, retirementLumpSumExpenses: [{ name: '은퇴 전 지출', expectedAge: 60, amount: 3000 }] },
      });
      expect(result.points.every((p) => p.lumpSumExpense === 0)).toBe(true);
      expect(result.lumpSumExpenseIncluded).toBe(false);
    });

    it('ignores a lump-sum item whose expected age falls after life expectancy (defensive, mirrors validate.js)', () => {
      const result = project({
        assets: bigAssets,
        expense: { retirementLivingCost: 200, retirementLumpSumExpenses: [{ name: '기대수명 이후', expectedAge: 95, amount: 3000 }] },
      });
      expect(result.points.every((p) => p.lumpSumExpense === 0)).toBe(true);
      expect(result.lumpSumExpenseIncluded).toBe(false);
    });

    it('16) leaves the projection numerically identical to before when retirementLumpSumExpenses is empty (regression)', () => {
      const withEmptyArray = project({ assets: bigAssets, expense: { retirementLivingCost: 200, retirementLumpSumExpenses: [] } });
      const withoutField = project({ assets: bigAssets });
      const strip = (r) => ({
        ...r,
        points: r.points.map(({ lumpSumEvents: _lumpSumEvents, ...rest }) => rest),
      });
      expect(strip(withEmptyArray)).toEqual(strip(withoutField));
      expect(withEmptyArray.points.every((p) => p.lumpSumExpense === 0 && p.lumpSumEvents.length === 0)).toBe(true);
      expect(withEmptyArray.lumpSumExpenseIncluded).toBe(false);
    });
  });
});
