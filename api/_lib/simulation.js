// 은퇴자산 시뮬레이션 로직. 가정치(물가상승률 등)와 계산 공식은 서버에만 존재한다.
// NOTE: 실제 상용 서비스로 갈 때는 회사의 검증된 액추어리얼(계리) 모델로 교체를 권장합니다.
// 아래는 "은퇴시점 필요자금 = 은퇴 후 생활비의 현재가치를 은퇴시점 기준으로 환산한 합"이라는
// 표준적인 은퇴설계 방법론을 단순화해 구현한 1차 버전입니다.

import { n, getCurrentAge, buildAggregates } from './aggregate.js';
import { GENERAL_INFLATION_RATE } from './constants.js';
import { calcPensionAdequacyTrend } from './pensionProjection.js';

const BASE_INFLATION = GENERAL_INFLATION_RATE; // 일반 물가상승률(CPI), 연 4.1%

export function calcRetirementSimulation(input, currentYear = new Date().getFullYear()) {
  const basic = input.basic || {};
  const expense = input.expense || {};

  const currentAge = getCurrentAge(input, currentYear);
  const retirementAge = n(basic.retirementAge);
  // 기대수명을 노후 생활비 필요기간의 종료 연령으로 사용한다.
  // retirementEndAge는 기존에 저장된 입력 데이터와의 호환을 위한 보조값이다.
  const retirementEndAge = n(basic.lifeExpectancy || basic.retirementEndAge);
  // 명시적으로 0%를 입력한 경우도 존중한다(falsy 0 때문에 3% 기본값으로 덮어쓰지 않음) -
  // 입력 자체가 없을 때만(빈 값/undefined/null) 3% 기본값을 사용한다.
  const hasReturnRate = basic.assumedReturnRate !== '' && basic.assumedReturnRate !== null && basic.assumedReturnRate !== undefined;
  const returnRate = hasReturnRate ? n(basic.assumedReturnRate) / 100 : 0.03;

  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const retirementYears = Math.max(0, retirementEndAge - retirementAge);

  const monthlyLivingCostNow = n(expense.retirementLivingCost);
  const futureMonthlyLivingCost = monthlyLivingCostNow * Math.pow(1 + BASE_INFLATION, yearsToRetirement);

  // 은퇴 후 필요자금(은퇴시점 가치): 실질수익률(투자수익률 - 물가상승률) = 0%로 가정한다.
  // 즉 은퇴 후 매년 생활비가 물가만큼 늘어나고, 그 미래가치를 같은 비율로 할인하면 서로 상쇄되어
  // 은퇴시점 기준 실질가치는 매년 동일하게 유지된다. 따라서 연금현가 공식
  // [1-(1+r)^(-n)]÷r 의 r→0 극한값(=n)을 그대로 적용해 "연간 생활비 × 은퇴기간"으로 단순화된다.
  const requiredAtRetirement = futureMonthlyLivingCost * 12 * retirementYears;

  // 준비 가능 자산 = (현금성자산 + 금융자산 + 연금자산)이 은퇴시점까지 불어난 금액 + 은퇴 전까지
  // 추가 저축의 미래가치. financialAssetsTotal/liquidAssets/pensionAssets는 aggregate.js의
  // buildAggregates()와 동일한 정의를 재사용해, 지표 계산과 은퇴 시뮬레이션이 서로 다른 "금융자산"
  // 정의를 갖는 일이 없도록 한다(중복 계산식을 두지 않음).
  const agg = buildAggregates(input);
  const { financialAssetsTotal, liquidAssets, pensionAssets } = agg;
  const currentReadyAssets = financialAssetsTotal + liquidAssets + pensionAssets;

  const fvCurrentAssets = currentReadyAssets * Math.pow(1 + returnRate, yearsToRetirement);

  // aggregate.js와 동일한 포함 규칙을 사용한다. 노후저축이 총저축에 포함되지 않는다고
  // 명시한 경우(retirementIncludedInTotal === false)에는 별도 노후저축도 합산한다.
  const annualSavings = agg.totalSavingsAnnual;
  let fvFutureSavings = 0;
  for (let y = 1; y <= yearsToRetirement; y++) {
    fvFutureSavings += annualSavings * Math.pow(1 + returnRate, yearsToRetirement - y);
  }

  const readyAssetsAtRetirement = fvCurrentAssets + fvFutureSavings;
  const shortfall = Math.max(0, requiredAtRetirement - readyAssetsAtRetirement);
  const preparationRate = requiredAtRetirement > 0 ? (readyAssetsAtRetirement / requiredAtRetirement) * 100 : 100;

  // 물가상승률 시나리오별 미래 필요생활비 (10/20/30년 후, 고정 참고표)
  const inflationScenarios = [0.03, GENERAL_INFLATION_RATE, 0.05].map((rate) => ({
    rate: round1(rate * 100),
    after10: Math.round(monthlyLivingCostNow * Math.pow(1 + rate, 10)),
    after20: Math.round(monthlyLivingCostNow * Math.pow(1 + rate, 20)),
    after30: Math.round(monthlyLivingCostNow * Math.pow(1 + rate, 30)),
  }));

  // 자녀 생애 목돈 지출(학자금+결혼지원비+기타) 준비 상태 - 단순화된 1차 모델
  const children = expense.children || [];
  // 항목별 합계(리포트 "생애재무목표" 표 전용) - totalGoalAmount와 동일한 원본 필드를 항목별로만
  // 나눠 보여줄 뿐, 새로운 금액이나 판정 기준을 추가하지 않는다.
  const goalsByCategory = children.reduce(
    (sum, c) => ({
      marriageSupport: sum.marriageSupport + n(c.marriageSupport),
      education: sum.education + n(c.educationCost),
      other: sum.other + n(c.otherCost),
    }),
    { marriageSupport: 0, education: 0, other: 0 },
  );
  const totalGoalAmount = children.reduce(
    (sum, c) => sum + n(c.educationCost) + n(c.marriageSupport) + n(c.otherCost),
    0
  );
  const availableForGoals = financialAssetsTotal + liquidAssets; // 단순화: 현금성자산·금융자산을 우선 재원으로 가정
  const goalPreparedAmount = Math.min(availableForGoals, totalGoalAmount);
  const goalPreparationRate = totalGoalAmount > 0 ? (goalPreparedAmount / totalGoalAmount) * 100 : 100;

  // 노후소득보장률의 연차별 추이(물가연동 vs 정액형 연금 반영). FHS 지표9 점수 자체에는 영향을 주지 않고,
  // 은퇴자산 시뮬레이션 화면에서만 "시간이 지날수록 보장률이 낮아질 수 있다"는 것을 보여주는 참고 정보다.
  const pensionAdequacyTrend = calcPensionAdequacyTrend(input);

  // "물가상승률에 따라 달라지는 목표 도달 나이" - 은퇴시점 준비자산을 은퇴 후에도 인출 없이
  // 계속 investRate로 굴린다고 가정하는(실제 인출 모델과는 다른) 참고용 가상 시나리오.
  // 물가상승률이 높을수록 필요자금(목표)이 커지므로 같은 자산으로도 목표 도달이 늦어짐을 보여준다.
  const GOAL_REACH_HORIZON_YEARS = 30;
  const goalReachTargets = [0.03, GENERAL_INFLATION_RATE, 0.05].map((rate) => {
    const futureLivingCostAtRate = monthlyLivingCostNow * Math.pow(1 + rate, yearsToRetirement);
    return { rate: round1(rate * 100), requiredAmount: Math.round(futureLivingCostAtRate * 12 * retirementYears) };
  });
  const maxGoalTarget = Math.max(...goalReachTargets.map((t) => t.requiredAmount), 0);

  const goalReachCurve = [];
  for (let y = 0; y <= GOAL_REACH_HORIZON_YEARS; y++) {
    const value = readyAssetsAtRetirement * Math.pow(1 + returnRate, y);
    goalReachCurve.push({ age: retirementAge + y, value: Math.round(value) });
    if (maxGoalTarget > 0 && value >= maxGoalTarget) break;
  }

  const goalReachAnalysis = {
    targets: goalReachTargets,
    curve: goalReachCurve,
    crossingAges: goalReachTargets.map((t) => {
      const hit = goalReachCurve.find((p) => p.value >= t.requiredAmount);
      return { ...t, age: hit ? hit.age : null };
    }),
  };

  return {
    currentAge,
    yearsToRetirement,
    retirementYears,
    retirementLivingCostNow: monthlyLivingCostNow,
    retirementLivingCostAtRetirement: round1(futureMonthlyLivingCost),
    inflationRate: round1(BASE_INFLATION * 100),
    assumedReturnRate: round1(returnRate * 100),
    currentReadyAssets: Math.round(currentReadyAssets),
    currentAssetsAtRetirement: Math.round(fvCurrentAssets),
    annualSavings: Math.round(annualSavings),
    futureSavingsAtRetirement: Math.round(fvFutureSavings),
    requiredAtRetirement: Math.round(requiredAtRetirement),
    readyAssetsAtRetirement: Math.round(readyAssetsAtRetirement),
    shortfall: Math.round(shortfall),
    preparationRate: round1(preparationRate),
    inflationScenarios,
    pensionAdequacyTrend,
    goalReachAnalysis,
    lifeGoals: {
      totalGoalAmount: Math.round(totalGoalAmount),
      preparedAmount: Math.round(goalPreparedAmount),
      preparationRate: round1(goalPreparationRate),
      byCategory: {
        marriageSupport: Math.round(goalsByCategory.marriageSupport),
        education: Math.round(goalsByCategory.education),
        other: Math.round(goalsByCategory.other),
      },
    },
  };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
