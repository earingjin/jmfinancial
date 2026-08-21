// 계산로직 문서(1_계산로직.html) 기준 공통 가정치.
// 실측 데이터 갱신 시 이 파일만 수정하면 지표·시뮬레이션 전반에 반영된다.

// 사용자 승인(2026-08-20)에 따라 일반 물가상승률(CPI)을 3%로 통일한다. 이전에는
// GENERAL_INFLATION_RATE(4.1%)와 FUTURE_FINANCE_ASSUMPTIONS.inflationRate(3%)가
// 서로 달라 계산 전반에서 서로 다른 물가상승률이 쓰였다.
export const GENERAL_INFLATION_RATE = 0.03; // 일반 물가상승률(CPI), 연
// 장기적으로 영구 고정된 법정 증가율이 아니다. 2026년 지급액에 반영된 2025년도
// 전국소비자물가변동률을 미래 투영에 반복 적용하는 모델 가정이다.
export const NATIONAL_PENSION_GROWTH_RATE = 0.021;
export const NATIONAL_PENSION_GROWTH_ASSUMPTION = Object.freeze({
  rate: NATIONAL_PENSION_GROWTH_RATE,
  kind: 'modelAssumption',
  basis: '2025년도 전국소비자물가변동률을 2026년 지급액에 반영한 조정률',
  effectiveYear: 2026,
  referenceDate: '2026-01-12',
});

// 간편요약 미래재무 계산의 가정. GENERAL_INFLATION_RATE와 동일한 물가상승률을 그대로 참조한다.
export const FUTURE_FINANCE_ASSUMPTIONS = Object.freeze({
  inflationRate: GENERAL_INFLATION_RATE,
  nationalPensionGrowthRate: NATIONAL_PENSION_GROWTH_RATE,
  nationalPensionGrowthBasis: NATIONAL_PENSION_GROWTH_ASSUMPTION,
  privatePensionGrowthRate: 0,
  retirementPensionGrowthRate: 0,
});
