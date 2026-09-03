// 노후소득보장률의 연차별 추이 계산 (계산로직 문서 4장 "물가연동 개선 로직").
// FHS 지표9 점수는 0년차(은퇴 시점) 값만 사용하며, 여기서 계산하는 연차별 추이는
// 은퇴자산 시뮬레이션 화면에서만 참고용으로 노출된다.

import { n } from './aggregate.js';
import { GENERAL_INFLATION_RATE, NATIONAL_PENSION_GROWTH_RATE } from './constants.js';
import { assessNationalPensionEligibility, nationalPensionMonthlyEligible } from './pensionEligibility.js';

const TREND_YEARS = [0, 5, 10, 15, 20, 25, 30];
const MAX_CROSSING_YEAR = 40;
const CROSSING_THRESHOLD = 100; // 기준(보장률 100%) 미만으로 처음 떨어지는 연차를 찾는다

// person: input.income 또는 input.spouse
function buildComponents(person) {
  const severance = person.severance || {};
  const nationalPension = person.nationalPension || {};
  const personalPension = person.personalPension || {};

  const components = [];

  // 퇴직연금 (일시금 수령은 월소득에 포함되지 않음). 물가연동 여부는 사용자가 선택하지 않으므로
  // 항상 물가연동형(일반 물가상승률)으로 가정한다.
  if (!('type' in severance) || severance.type === 'pension') {
    components.push({
      paymentPeriod: 'finite',
      monthlyAmount: n(severance.pensionMonthly),
      months: n(severance.pensionMonths),
      growthRate: GENERAL_INFLATION_RATE,
    });
  }

  // 국민연금: 수급개시 이후 종신 지급하므로 months를 종료기간으로 사용하지 않는다.
  // 2026 적용률 2.1%를 반복 적용하는 모델 가정이며, 영구 고정 정책률이라는 뜻은 아니다.
  const eligibility = assessNationalPensionEligibility({ pension: nationalPension });
  components.push({
    paymentPeriod: 'lifetime',
    // 새 필드가 없던 초안은 이 경로에서 가입기간과 무관하게 월액을 사용하던 기존 결과를 보존한다.
    monthlyAmount: nationalPensionMonthlyEligible(eligibility) || eligibility.legacyFallback
      ? n(nationalPension.monthly)
      : 0,
    growthRate: NATIONAL_PENSION_GROWTH_RATE,
    eligibilityStatus: eligibility.status,
  });

  // 개인연금 (일시금 수령은 월소득에 포함되지 않음). 물가연동 여부는 사용자가 선택하지 않으므로
  // 항상 물가연동형(일반 물가상승률)으로 가정한다.
  if (personalPension.type === 'installment' || !('type' in personalPension)) {
    components.push({
      paymentPeriod: 'finite',
      monthlyAmount: n(personalPension.monthly),
      months: n(personalPension.months),
      growthRate: GENERAL_INFLATION_RATE,
    });
  }

  return components;
}

function pensionIncomeAtYear(components, year) {
  return components.reduce((sum, c) => {
    if (c.monthlyAmount <= 0) return sum;
    if (c.paymentPeriod === 'finite' && c.months > 0 && year * 12 > c.months) return sum; // 수령기간 종료 (수령기간 이내 마지막 해까지는 지급)
    return sum + c.monthlyAmount * Math.pow(1 + c.growthRate, year);
  }, 0);
}

// 임의의 연차 목록에 대한 연금소득만 뽑아낸다(간편 요약 화면의 촘촘한 현금흐름 차트용).
// calcPensionAdequacyTrend와 동일한 연금 구성 로직을 재사용할 뿐, 기존 함수/트렌드 지점(TREND_YEARS)에는
// 영향을 주지 않는 별도 진입점이다.
export function pensionIncomeSeries(input, years) {
  const components = [
    ...buildComponents(input.income || {}),
    ...buildComponents(input.spouse || {}),
  ];
  return years.map((year) => ({ year, pensionIncome: Math.round(pensionIncomeAtYear(components, year)) }));
}

export function calcPensionAdequacyTrend(input) {
  const components = [
    ...buildComponents(input.income || {}),
    ...buildComponents(input.spouse || {}),
  ];
  const eligibilityStatus = {
    self: assessNationalPensionEligibility({ pension: input.income?.nationalPension || {} }).status,
    spouse: input.basic?.hasSpouse
      ? assessNationalPensionEligibility({ pension: input.spouse?.nationalPension || {} }).status
      : 'none',
  };
  const livingCostNow = n(input.expense?.retirementLivingCost);

  const ratioAtYear = (year) => {
    const income = pensionIncomeAtYear(components, year);
    const requiredCost = livingCostNow * Math.pow(1 + GENERAL_INFLATION_RATE, year);
    return requiredCost > 0 ? (income / requiredCost) * 100 : 100;
  };

  const trend = TREND_YEARS.map((year) => ({
    year,
    pensionIncome: Math.round(pensionIncomeAtYear(components, year)),
    requiredLivingCost: Math.round(livingCostNow * Math.pow(1 + GENERAL_INFLATION_RATE, year)),
    ratio: round1(ratioAtYear(year)),
  }));

  let crossingYear = null;
  for (let y = 0; y <= MAX_CROSSING_YEAR; y++) {
    if (ratioAtYear(y) < CROSSING_THRESHOLD) {
      crossingYear = y;
      break;
    }
  }

  return { threshold: CROSSING_THRESHOLD, trend, crossingYear, eligibilityStatus };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
