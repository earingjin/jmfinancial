// "간편 은퇴진단결과" 요약 화면 전용 파생값. 기존 9개 지표 점수·은퇴자산 시뮬레이션(simulation.js)
// 로직에는 전혀 영향을 주지 않는 별도 계산이다 - 이미 계산된 결과값(aggregates, simulation)을
// 그대로 재사용해서 화면에 맞게 재구성하고, 새로 필요한 값(연금외 금융자산 월 환산, 2년 단위
// 현금흐름)만 추가로 계산한다.

import { GENERAL_INFLATION_RATE } from './constants.js';
import { pensionIncomeSeries } from './pensionProjection.js';

const CASH_FLOW_STEP_YEARS = 2;

// 연금외 금융자산(예금·적금·주식·펀드 등)을 은퇴 후 남은 기간 동안 균등하게 나눠 쓴다고 가정한
// 월 환산액이다. 실제 인출전략·운용수익률은 고려하지 않는 단순 근사치다.
function calcNonPensionFinancialMonthly(financialAssetsTotal, retirementYears) {
  const months = retirementYears * 12;
  return months > 0 ? financialAssetsTotal / months : 0;
}

function buildCashFlowByAge({ input, retirementAge, retirementYears, retirementLivingCostNow, nonPensionFinancialMonthly, pensionCalculable }) {
  const years = [];
  for (let y = 0; y <= retirementYears; y += CASH_FLOW_STEP_YEARS) years.push(y);
  if (years[years.length - 1] !== retirementYears) years.push(retirementYears);

  const pensionByYear = pensionIncomeSeries(input, years);

  return years.map((year) => {
    const requiredLivingCost = Math.round(retirementLivingCostNow * Math.pow(1 + GENERAL_INFLATION_RATE, year));
    const pensionIncome = pensionByYear.find((p) => p.year === year)?.pensionIncome;
    const calculable = pensionCalculable && pensionIncome != null;
    const preparedAmount = calculable ? Math.round(pensionIncome + nonPensionFinancialMonthly) : null;
    const shortfallAmount = calculable ? Math.max(0, requiredLivingCost - preparedAmount) : null;
    return { age: retirementAge + year, requiredLivingCost, preparedAmount, shortfallAmount, calculable };
  });
}

export function buildSimpleSummary({ input, aggregates, simulation }) {
  const retirementAge = simulation.currentAge + simulation.yearsToRetirement;
  const currentYear = new Date().getFullYear();
  const startYear = currentYear + simulation.yearsToRetirement;
  const endYear = startYear + simulation.retirementYears;

  const nonPensionFinancialMonthly = Math.round(
    calcNonPensionFinancialMonthly(aggregates.financialAssetsTotal + aggregates.liquidAssets, simulation.retirementYears)
  );

  const nationalPensionEligibility = aggregates.nationalPensionEligibility || {};
  const pensionCalculable = !Object.values(nationalPensionEligibility).includes('unknown');
  const pensionMonthly = pensionCalculable ? Math.round(aggregates.monthlyRetirementIncome) : null;
  const preparedMonthly = pensionCalculable ? pensionMonthly + nonPensionFinancialMonthly : null;
  const livingCostMonthly = simulation.retirementLivingCostNow;
  const shortfallMonthly = pensionCalculable ? Math.max(0, livingCostMonthly - preparedMonthly) : null;

  const cashFlowByAge = buildCashFlowByAge({
    input,
    retirementAge,
    retirementYears: simulation.retirementYears,
    retirementLivingCostNow: livingCostMonthly,
    nonPensionFinancialMonthly,
    pensionCalculable,
  });

  return {
    retirementAge,
    startYear,
    endYear,
    retirementYears: simulation.retirementYears,
    livingCostMonthly,
    preparedMonthly,
    shortfallMonthly,
    totalLivingCost: simulation.requiredAtRetirement,
    pensionBreakdown: {
      total: pensionMonthly,
      nationalPension: pensionCalculable ? Math.round(aggregates.nationalPensionMonthly) : null,
      nationalPensionEligibility,
      calculable: pensionCalculable,
      calculationReason: pensionCalculable ? null : '국민연금 향후 가입기간을 확정할 수 없음',
      severancePension: Math.round(aggregates.severancePensionMonthly),
      personalPension: Math.round(aggregates.personalPensionMonthly),
    },
    nonPensionFinancialMonthly,
    cashFlowByAge,
  };
}
