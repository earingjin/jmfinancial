// 국민연금 수급개시연령 공식 참고표 (출생연도별 법정 고정값 - 계산치가 아닌 정부 공식 자료).
// 원래 RetirementSimulationPage.jsx(리포트 17페이지)에만 있던 표를 서버로 옮겨, 웹 요약 화면의
// 소득공백기간 계산에서도 동일한 값을 재사용한다(같은 기준을 두 곳에 중복 구현하지 않음).
// 값 자체는 변경하지 않았으므로 17페이지 PDF 표시 내용은 그대로다.
export const NATIONAL_PENSION_COHORTS = [
  { range: '1957~1960년', from: 1957, to: 1960, retireAge: 60, pensionAge: 62, gapYears: 2 },
  { range: '1961~1964년', from: 1961, to: 1964, retireAge: 60, pensionAge: 63, gapYears: 3 },
  { range: '1965~1968년', from: 1965, to: 1968, retireAge: 60, pensionAge: 64, gapYears: 4 },
  { range: '1969년 이후', from: 1969, to: Infinity, retireAge: 60, pensionAge: 65, gapYears: 5 },
];

export function findNationalPensionCohort(birthYear) {
  if (!Number.isFinite(birthYear)) return null;
  return NATIONAL_PENSION_COHORTS.find((c) => birthYear >= c.from && birthYear <= c.to) || null;
}

// 출생연도로 알 수 없는 경우(범위 밖·비수치) 임의로 나이를 추정하지 않고 null(산출 불가)을 반환한다.
export function getNationalPensionStartAge(birthYear) {
  const cohort = findNationalPensionCohort(birthYear);
  return cohort ? cohort.pensionAge : null;
}
