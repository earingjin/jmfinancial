// 국민연금 출생연도별 법정 수급개시연령.
export const NATIONAL_PENSION_COHORTS = [
  { range: '1953~1956년', from: 1953, to: 1956, retireAge: 60, pensionAge: 61, gapYears: 1 },
  { range: '1957~1960년', from: 1957, to: 1960, retireAge: 60, pensionAge: 62, gapYears: 2 },
  { range: '1961~1964년', from: 1961, to: 1964, retireAge: 60, pensionAge: 63, gapYears: 3 },
  { range: '1965~1968년', from: 1965, to: 1968, retireAge: 60, pensionAge: 64, gapYears: 4 },
  { range: '1969년 이후', from: 1969, to: Infinity, retireAge: 60, pensionAge: 65, gapYears: 5 },
];

export function findNationalPensionCohort(birthYear) {
  if (!Number.isFinite(birthYear)) return null;
  return NATIONAL_PENSION_COHORTS.find((cohort) => birthYear >= cohort.from && birthYear <= cohort.to) || null;
}

export function getNationalPensionStartAge(birthYear) {
  return findNationalPensionCohort(birthYear)?.pensionAge ?? null;
}

export const NATIONAL_PENSION_MIN_MONTHS = 120;

const present = (value) => value !== '' && value !== null && value !== undefined;
const n = (value) => Number(value) || 0;

export function getNationalPensionContributionMonths(pension = {}) {
  const mode = pension.inputMode || 'direct';
  const months = mode === 'simulate' ? pension.simulate?.contributionMonths : pension.paymentMonths;
  const years = mode === 'simulate' ? pension.simulate?.years : pension.paymentYears;
  if (present(months)) return n(months);
  if (present(years)) return n(years) * 12;
  return null;
}

export function assessNationalPensionEligibility({ pension = {} }) {
  const contributionMonths = getNationalPensionContributionMonths(pension);
  const hasFutureContributionPlan = Object.prototype.hasOwnProperty.call(pension, 'futureContributionPlan');
  if (pension.inputMode === 'none') {
    return { status: 'none', benefitType: 'none', contributionMonths };
  }
  // 가입기간 필드가 전혀 없는 과거 데이터는 기존처럼 입력된 월 예상연금을 포함한다.
  if (contributionMonths === null) {
    if (hasFutureContributionPlan) {
      return { status: 'unknown', benefitType: 'unknown', contributionMonths: null };
    }
    return { status: 'eligible', benefitType: 'oldAgePension', contributionMonths: null, legacyFallback: true };
  }
  if (contributionMonths >= NATIONAL_PENSION_MIN_MONTHS) {
    return { status: 'eligible', benefitType: 'oldAgePension', contributionMonths };
  }

  const plan = pension.futureContributionPlan;
  if (hasFutureContributionPlan && plan === 'continue') {
    const expectedAdditionalMonths = pension.expectedAdditionalContributionMonths;
    if (!present(expectedAdditionalMonths)) {
      return { status: 'unknown', benefitType: 'unknown', contributionMonths };
    }
    const effectiveContributionMonths = contributionMonths + Math.max(0, n(expectedAdditionalMonths));
    if (effectiveContributionMonths >= NATIONAL_PENSION_MIN_MONTHS) {
      return {
        status: 'eligible', benefitType: 'oldAgePension', contributionMonths,
        expectedAdditionalMonths: Math.max(0, n(expectedAdditionalMonths)),
        effectiveContributionMonths,
        eligibilityBasis: 'actualAndPlanned',
      };
    }
    return {
      status: 'unknown', benefitType: 'unknown', contributionMonths,
      expectedAdditionalMonths: Math.max(0, n(expectedAdditionalMonths)),
      effectiveContributionMonths,
    };
  }
  if (hasFutureContributionPlan && plan !== 'stop') {
    return { status: 'unknown', benefitType: 'unknown', contributionMonths };
  }
  return {
    status: 'lumpSumPossible', benefitType: 'possibleRefundLumpSum', contributionMonths,
    legacyFallback: !hasFutureContributionPlan,
  };
}

export const nationalPensionMonthlyEligible = (eligibility) => eligibility?.status === 'eligible';

export function calculateNationalPensionMonthlyEstimate(averageMonthlyIncome, contributionMonths) {
  if (!present(averageMonthlyIncome) || !present(contributionMonths)) return null;
  return Math.round(n(averageMonthlyIncome) * (n(contributionMonths) / 12) * 0.015);
}
