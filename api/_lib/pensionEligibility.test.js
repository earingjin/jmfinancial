import { describe, it, expect } from 'vitest';
import { assessNationalPensionEligibility, calculateNationalPensionMonthlyEstimate, findNationalPensionCohort, getNationalPensionStartAge, nationalPensionMonthlyEligible, NATIONAL_PENSION_COHORTS } from './pensionEligibility.js';

describe('pensionEligibility - shared official cohort table', () => {
  it('exposes all birth-year cohorts used by the form and report', () => {
    expect(NATIONAL_PENSION_COHORTS).toEqual([
      { range: '1953~1956년', from: 1953, to: 1956, retireAge: 60, pensionAge: 61, gapYears: 1 },
      { range: '1957~1960년', from: 1957, to: 1960, retireAge: 60, pensionAge: 62, gapYears: 2 },
      { range: '1961~1964년', from: 1961, to: 1964, retireAge: 60, pensionAge: 63, gapYears: 3 },
      { range: '1965~1968년', from: 1965, to: 1968, retireAge: 60, pensionAge: 64, gapYears: 4 },
      { range: '1969년 이후', from: 1969, to: Infinity, retireAge: 60, pensionAge: 65, gapYears: 5 },
    ]);
  });

  it.each([
    [1953, 61], [1956, 61],
    [1957, 62], [1960, 62],
    [1961, 63], [1964, 63],
    [1965, 64], [1968, 64],
    [1969, 65], [2000, 65],
  ])('birthYear %s -> national pension start age %s', (birthYear, expected) => {
    expect(getNationalPensionStartAge(birthYear)).toBe(expected);
  });

  it('returns null for a birth year outside every known cohort (no invented assumption)', () => {
    expect(findNationalPensionCohort(1950)).toBeNull();
    expect(getNationalPensionStartAge(1950)).toBeNull();
  });

  it('returns null for non-finite / blank input instead of guessing', () => {
    expect(getNationalPensionStartAge(NaN)).toBeNull();
    expect(getNationalPensionStartAge(undefined)).toBeNull();
  });
});

describe('national pension contribution eligibility', () => {
  const assess = (contributionMonths, futureContributionPlan) => assessNationalPensionEligibility({
    pension: { inputMode: 'direct', paymentMonths: contributionMonths, futureContributionPlan },
  });

  it.each([120, 121])('%s개월은 기존처럼 eligible이다', (months) => {
    const result = assess(months, 'stop');
    expect(result.status).toBe('eligible');
    expect(nationalPensionMonthlyEligible(result)).toBe(true);
  });

  it('119개월은 계속 납부 예정이어도 미래 가입기간을 추정하지 않는다', () => {
    expect(assess(119, 'continue').status).toBe('unknown');
  });

  it('납부 중단은 lumpSumPossible이다', () => {
    expect(assess(60, 'stop')).toMatchObject({ status: 'lumpSumPossible', benefitType: 'possibleRefundLumpSum' });
  });

  it('계속 납부 예정은 미래 가입기간을 확정할 수 없어 unknown이다', () => {
    expect(assess(100, 'continue')).toMatchObject({ status: 'unknown', benefitType: 'unknown' });
  });

  it('직접 입력한 실제·추가 납부기간 합계가 120개월이면 eligible이다', () => {
    const result = assessNationalPensionEligibility({
      pension: {
        inputMode: 'direct', paymentMonths: 100, futureContributionPlan: 'continue',
        expectedAdditionalContributionMonths: 20,
      },
    });
    expect(result).toMatchObject({
      status: 'eligible', effectiveContributionMonths: 120, eligibilityBasis: 'actualAndPlanned',
    });
    expect(calculateNationalPensionMonthlyEstimate(300, result.effectiveContributionMonths)).toBe(45);
  });

  it('직접 입력한 실제·추가 납부기간 합계가 119개월이면 unknown이다', () => {
    const result = assessNationalPensionEligibility({
      pension: {
        inputMode: 'direct', paymentMonths: 100, futureContributionPlan: 'continue',
        expectedAdditionalContributionMonths: 19,
      },
    });
    expect(result).toMatchObject({ status: 'unknown', effectiveContributionMonths: 119 });
  });

  it('잘 모르겠음은 unknown이고 월 연금에 포함하지 않는다', () => {
    const result = assess(100, 'unknown');
    expect(result.status).toBe('unknown');
    expect(nationalPensionMonthlyEligible(result)).toBe(false);
  });

  it('inputMode none은 반환일시금 가능 상태와 구분한다', () => {
    expect(assessNationalPensionEligibility({ pension: { inputMode: 'none' } })).toMatchObject({
      status: 'none', benefitType: 'none',
    });
  });

  it('새 필드는 존재하지만 아직 선택하지 않은 경우 unknown이다', () => {
    expect(assess(100, '').status).toBe('unknown');
  });

  it('새 필드가 없는 120개월 미만 데이터는 기존 0원 정책을 유지한다', () => {
    const result = assessNationalPensionEligibility({ pension: { inputMode: 'direct', paymentMonths: 80 } });
    expect(result).toMatchObject({ status: 'lumpSumPossible', legacyFallback: true });
  });

  it('새 필드와 가입기간이 모두 없는 과거 데이터는 기존 포함 정책을 유지한다', () => {
    const result = assessNationalPensionEligibility({ pension: { inputMode: 'direct' } });
    expect(result).toMatchObject({ status: 'eligible', legacyFallback: true });
  });

  it('simulate 기존 공식은 같은 가입개월에 같은 결과를 낸다', () => {
    expect(calculateNationalPensionMonthlyEstimate(300, 120)).toBe(45);
    expect(calculateNationalPensionMonthlyEstimate(300, 121)).toBe(45);
    expect(calculateNationalPensionMonthlyEstimate(300, 180)).toBe(68);
  });
});
