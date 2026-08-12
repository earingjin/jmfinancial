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
