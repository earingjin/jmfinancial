// 노후소득보장률의 연차별 추이 계산 (계산로직 문서 4장 "물가연동 개선 로직").
// FHS 지표9 점수는 0년차(은퇴 시점) 값만 사용하며, 여기서 계산하는 연차별 추이는
// 은퇴자산 시뮬레이션 화면에서만 참고용으로 노출된다.

import { n } from './aggregate.js';
import { GENERAL_INFLATION_RATE, NATIONAL_PENSION_GROWTH_RATE } from './constants.js';

const TREND_YEARS = [0, 5, 10, 15, 20, 25, 30];
const MAX_CROSSING_YEAR = 40;
const CROSSING_THRESHOLD = 100; // 기준(보장률 100%) 미만으로 처음 떨어지는 연차를 찾는다

// person: input.income 또는 input.spouse
function buildComponents(person) {
  const severance = person.severance || {};
  const nationalPension = person.nationalPension || {};
  const personalPension = person.personalPension || {};

  const components = [];

  // 퇴직연금 (일시금 수령은 월소득에 포함되지 않음)
  if (!('type' in severance) || severance.type === 'pension') {
    components.push({
      monthlyAmount: n(severance.pensionMonthly),
      months: n(severance.pensionMonths),
      growthRate: severance.inflationLinked === false ? 0 : GENERAL_INFLATION_RATE,
    });
  }

  // 국민연금 (물가와 무관하게 매년 2.1% 고정 증가)
  components.push({
    monthlyAmount: n(nationalPension.monthly),
    months: n(nationalPension.months),
    growthRate: NATIONAL_PENSION_GROWTH_RATE,
  });

  // 개인연금 (일시금 수령은 월소득에 포함되지 않음)
  if (personalPension.type === 'installment' || !('type' in personalPension)) {
    components.push({
      monthlyAmount: n(personalPension.monthly),
      months: n(personalPension.months),
      growthRate: personalPension.inflationLinked === false ? 0 : GENERAL_INFLATION_RATE,
    });
  }

  return components;
}

function pensionIncomeAtYear(components, year) {
  return components.reduce((sum, c) => {
    if (c.monthlyAmount <= 0) return sum;
    if (c.months > 0 && year * 12 > c.months) return sum; // 수령기간 종료 (수령기간 이내 마지막 해까지는 지급)
    return sum + c.monthlyAmount * Math.pow(1 + c.growthRate, year);
  }, 0);
}

// 임의의 연차 목록에 대한 연금소득만 뽑아낸다(간편 요약 화면의 촘촘한 현금흐름 차트용).
// calcPensionAdequacyTrend와 동일한 연금 구성 로직을 재사용할 뿐, 기존 함수/트렌드 지점(TREND_YEARS)에는
// 영향을 주지 않는 별도 진입점이다.
export function pensionIncomeSeries(input, years) {
  const components = [...buildComponents(input.income || {}), ...buildComponents(input.spouse || {})];
  return years.map((year) => ({ year, pensionIncome: Math.round(pensionIncomeAtYear(components, year)) }));
}

export function calcPensionAdequacyTrend(input) {
  const components = [...buildComponents(input.income || {}), ...buildComponents(input.spouse || {})];
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

  return { threshold: CROSSING_THRESHOLD, trend, crossingYear };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
