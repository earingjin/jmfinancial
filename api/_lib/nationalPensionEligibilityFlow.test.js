import { describe, expect, it } from 'vitest';
import { buildAggregates, calcRetirementIncomeByPerson } from './aggregate.js';
import { calculatePensionIncomeAtTarget } from './futureFinance.js';
import { pensionIncomeSeries } from './pensionProjection.js';

function inputFor(selfPension, spousePension) {
  return {
    basic: { birthYear: 1986, retirementAge: 65, hasSpouse: Boolean(spousePension) },
    income: {
      business: {}, otherIncomes: [],
      nationalPension: { monthly: 100, months: 240, ...selfPension },
      severance: { type: 'none' }, personalPension: { type: 'none' },
    },
    spouse: {
      birthYear: 1986, retirementAge: 65,
      nationalPension: spousePension ? { monthly: 70, months: 240, ...spousePension } : { inputMode: 'none', monthly: 0, months: 0 },
      severance: { type: 'none' }, personalPension: { type: 'none' },
    },
    expense: { healthInsurance: {}, otherExpenses: [], retirementLivingCost: 200 },
    assets: {
      currentIncome: {}, currentLivingCost: {}, insurance: {}, debtStatus: {}, savingsPlan: {},
      financialAssets: {}, liquidAssets: {}, realEstateAssets: {}, otherAssets: {},
    },
  };
}

describe('national pension eligibility is consistent across calculation paths', () => {
  it('lumpSumPossible은 aggregate·futureFinance·pensionProjection에서 모두 월소득 0이다', () => {
    const input = inputFor({ inputMode: 'direct', paymentMonths: 60, futureContributionPlan: 'stop' });
    expect(buildAggregates(input).nationalPensionMonthly).toBe(0);
    expect(calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 40 }).nationalPension).toBe(0);
    expect(pensionIncomeSeries(input, [0, 10], 2026).every((point) => point.pensionIncome === 0)).toBe(true);
  });

  it('continue 신규 입력은 세 경로에서 unknown이고 futureFinance는 산출 불가다', () => {
    const input = inputFor({ inputMode: 'direct', paymentMonths: 60, futureContributionPlan: 'continue' });
    const aggregates = buildAggregates(input);
    const future = calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 40 });
    expect(aggregates).toMatchObject({ nationalPensionMonthly: 0, nationalPensionEligibility: { self: 'unknown' } });
    expect(future).toMatchObject({ nationalPension: null, total: null, calculable: false });
    expect(future.reason).toContain('국민연금 향후 가입기간을 확정할 수 없음');
    expect(future.components.find((component) => component.key === 'self.nationalPension')).toMatchObject({
      eligibilityStatus: 'unknown', inclusionStatus: 'unknown', amount: null,
    });
    expect(pensionIncomeSeries(input, [0], 2026)[0]).toMatchObject({
      pensionIncome: null, calculable: false, eligibilityStatus: 'unknown',
    });
  });

  it('사용자가 입력한 실제+추가 납부 개월이 120개월이면 세 경로에서 국민연금을 포함한다', () => {
    const input = inputFor({
      inputMode: 'direct', paymentMonths: 60, futureContributionPlan: 'continue',
      expectedAdditionalContributionMonths: 60,
    });
    expect(buildAggregates(input).nationalPensionMonthly).toBe(100);
    expect(calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 40 }).nationalPension).toBeGreaterThan(0);
    expect(pensionIncomeSeries(input, [0])[0]).toMatchObject({ pensionIncome: 100, calculable: true });
  });

  it('본인과 배우자를 독립 판정한다', () => {
    const spouseEligible = inputFor(
      { inputMode: 'direct', paymentMonths: 60, futureContributionPlan: 'stop' },
      { inputMode: 'direct', paymentMonths: 120 },
    );
    expect(calcRetirementIncomeByPerson(spouseEligible)).toMatchObject({
      self: { nationalPensionMonthly: 0 }, spouse: { nationalPensionMonthly: 70 },
    });

    const selfEligible = inputFor(
      { inputMode: 'direct', paymentMonths: 120 },
      { inputMode: 'direct', paymentMonths: 60, futureContributionPlan: 'unknown' },
    );
    expect(calcRetirementIncomeByPerson(selfEligible)).toMatchObject({
      self: { nationalPensionMonthly: 100 }, spouse: { nationalPensionMonthly: 0 },
    });
  });

  it('inputMode none은 기존처럼 완전히 제외한다', () => {
    const input = inputFor({ inputMode: 'none', paymentMonths: 240, monthly: 999 });
    expect(buildAggregates(input).nationalPensionMonthly).toBe(0);
    expect(calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 40 }).nationalPension).toBe(0);
    expect(pensionIncomeSeries(input, [0], 2026)[0].pensionIncome).toBe(0);
    expect(buildAggregates(input).nationalPensionEligibility.self).toBe('none');
  });

  it('새 필드가 없는 120개월 이상 및 가입기간 없는 과거 데이터 결과를 유지한다', () => {
    expect(buildAggregates(inputFor({ inputMode: 'direct', paymentMonths: 120 })).nationalPensionMonthly).toBe(100);
    expect(buildAggregates(inputFor({ inputMode: 'direct', paymentMonths: 121 })).nationalPensionMonthly).toBe(100);
    expect(buildAggregates(inputFor({ inputMode: 'direct', paymentMonths: '', paymentYears: '' })).nationalPensionMonthly).toBe(100);
  });

  it.each([
    [{ inputMode: 'direct', paymentMonths: 80 }, 'paymentMonths'],
    [{ inputMode: 'direct', paymentMonths: '', paymentYears: 8 }, 'paymentYears'],
    [{ inputMode: 'simulate', simulate: { contributionMonths: '', years: 8 } }, 'simulate.years'],
  ])('새 필드가 없는 레거시 %s 입력의 경로별 기존 결과를 유지한다', (pension) => {
    const input = inputFor(pension);
    expect(buildAggregates(input).nationalPensionMonthly).toBe(0);
    expect(calculatePensionIncomeAtTarget({ input, currentYear: 2026, years: 40 })).toMatchObject({
      nationalPension: 0, calculable: true,
    });
    // pensionProjection은 기존에 가입기간 게이트가 없었으므로 레거시 초안의 월액을 그대로 보존한다.
    expect(pensionIncomeSeries(input, [0], 2026)[0].pensionIncome).toBe(100);
  });
});
