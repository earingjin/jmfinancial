// 대응방안 시나리오(주택연금 전환 / 부동산 자금 전환 / 지출 줄이기 / 추가 수입원) 적용 로직.
// 입력을 조정한 뒤 지표9(노후소득보장률)와 은퇴자산 시뮬레이션을 재계산해 "적용 전 vs 적용 후"를 비교한다.
//
// NOTE - 주택연금 월지급액 추정치는 실제 한국주택금융공사 산정 공식(가입연령, 종신/확정기간,
// 금리 변동형 여부 등 복합 변수)을 그대로 반영한 것이 아닌 단순화된 근사치입니다.
// 정확한 금액은 반드시 한국주택금융공사 예상연금 조회를 통해 재확인해야 합니다.

import { n } from './aggregate.js';
import { calcIndicators } from './indicators.js';
import { calcRetirementSimulation } from './simulation.js';

// 가입 나이대별 월지급률(주택가격 대비, 단순 근사치) - 나이가 많을수록 월지급률이 높아짐
const REVERSE_MORTGAGE_RATE_TABLE = [
  { minAge: 80, monthlyRateOfHousePrice: 0.0055 },
  { minAge: 75, monthlyRateOfHousePrice: 0.0045 },
  { minAge: 70, monthlyRateOfHousePrice: 0.0038 },
  { minAge: 65, monthlyRateOfHousePrice: 0.0032 },
  { minAge: 60, monthlyRateOfHousePrice: 0.0027 },
  { minAge: 0, monthlyRateOfHousePrice: 0.0022 },
];

function estimateReverseMortgageMonthly(housePrice, age) {
  const band = REVERSE_MORTGAGE_RATE_TABLE.find((b) => age >= b.minAge) || REVERSE_MORTGAGE_RATE_TABLE[REVERSE_MORTGAGE_RATE_TABLE.length - 1];
  return Math.round(housePrice * band.monthlyRateOfHousePrice);
}

export function applyScenarios(input) {
  const scenarios = input.scenarios || {};
  const adjusted = structuredClone(input);
  const notes = [];

  // ① 주택연금 전환 - 사용자가 실제로 선택한 퇴직금 수령방식(income.severance)은 절대 건드리지
  // 않는다. 주택연금 소득은 완전히 별도 네임스페이스(scenarioAdjustments)에 두어, 실제 퇴직연금과
  // 혼합되거나(퇴직연금 breakdown에 섞임) severance.type이 'lumpsum'인 사용자(기본값)에게 조용히
  // 무시되는 일이 없도록 한다(aggregate.js가 이 값을 무조건 별도로 더한다).
  if (scenarios.reverseMortgage?.enabled) {
    const housePrice = n(scenarios.reverseMortgage.housePrice);
    const age = n(scenarios.reverseMortgage.ageAtStart);
    const monthlyPension = estimateReverseMortgageMonthly(housePrice, age);
    adjusted.scenarioAdjustments = { ...(adjusted.scenarioAdjustments || {}), reverseMortgageMonthly: monthlyPension };
    notes.push({ scenario: 'reverseMortgage', monthlyIncomeAdded: monthlyPension });
  }

  // ② 부동산 자금 전환 - cashOutAmount가 보유 부동산자산을 초과하는 요청은 원칙적으로
  // validate.js가 서버 응답 단계에서 명시적 오류로 거부한다(사용자에게 입력 오류를 숨기지 않음).
  // 여기서의 Math.min은 그 검증을 우회해 이 함수가 단독 호출되는 경우에도 존재하지 않는 자산이
  // 생성되지 않도록 하는 방어적 안전장치일 뿐이다 - 감소분과 증가분은 항상 동일해야 한다.
  if (scenarios.realEstateConversion?.enabled) {
    const requestedCashOut = n(scenarios.realEstateConversion.cashOutAmount);
    const availableRealEstate = n(adjusted.assets.realEstateAssets.total);
    const cashOut = Math.min(Math.max(0, requestedCashOut), availableRealEstate);
    adjusted.assets.realEstateAssets.total = availableRealEstate - cashOut;
    adjusted.assets.financialAssets.other = n(adjusted.assets.financialAssets.other) + cashOut;
    notes.push({ scenario: 'realEstateConversion', assetsShifted: cashOut, requestedCashOut });
  }

  // ③ 지출 줄이기
  if (scenarios.expenseReduction?.enabled) {
    const rate = n(scenarios.expenseReduction.reductionRate) / 100;
    const targets = scenarios.expenseReduction.targets || [];
    if (targets.includes('living')) {
      adjusted.assets.currentLivingCost.monthly = n(adjusted.assets.currentLivingCost.monthly) * (1 - rate);
    }
    if (targets.includes('medical')) {
      adjusted.expense.medical.annual = n(adjusted.expense.medical.annual) * (1 - rate);
    }
    if (targets.includes('other')) {
      adjusted.expense.otherExpenses = (adjusted.expense.otherExpenses || []).map((item) => ({
        ...item,
        annual: n(item.annual) * (1 - rate),
      }));
    }
    // 부채상환액 · 교육비 · 건강보험료는 절감 대상에서 항상 제외 (요구사항)
    notes.push({ scenario: 'expenseReduction', reductionRate: n(scenarios.expenseReduction.reductionRate), targets });
  }

  // ④ 추가 수입원 모색 - canonical 소득 경로는 income.business.monthly 한 곳뿐이다
  // (assets.currentIncome.monthly는 Step1Income.jsx가 급여 합계로만 자동 파생하는 필드이므로
  // 여기서 함께 더하면 aggregate.js의 monthlyIncome = salaryMonthly + businessMonthly 합산에서
  // 동일 금액이 중복 반영된다). 새로운 저축률·소득 지속기간 가정은 추가하지 않는다.
  // 알려진 제한사항: calcScenarioComparison은 indicator9·simulation만 비교하므로, monthlyIncome에만
  // 영향을 주는 이 시나리오의 효과는 현재 시나리오 비교 화면에 나타나지 않는다.
  if (scenarios.additionalIncome?.enabled) {
    const monthlySalary = n(scenarios.additionalIncome.monthlySalary);
    adjusted.income.business.monthly = n(adjusted.income.business.monthly) + monthlySalary;
    notes.push({ scenario: 'additionalIncome', monthlyIncomeAdded: monthlySalary });
  }

  return { adjusted, notes };
}

export function calcScenarioComparison(input) {
  const beforeIndicators = calcIndicators(input);
  const before = {
    indicator9: beforeIndicators.indicators.find((i) => i.key === 'retirementIncome'),
    aggregates: beforeIndicators.aggregates,
    simulation: calcRetirementSimulation(input),
  };

  const anyEnabled = Object.values(input.scenarios || {}).some((s) => s?.enabled);
  if (!anyEnabled) {
    return { applied: false, before, after: before, notes: [] };
  }

  const { adjusted, notes } = applyScenarios(input);
  const afterIndicators = calcIndicators(adjusted);
  const after = {
    indicator9: afterIndicators.indicators.find((i) => i.key === 'retirementIncome'),
    aggregates: afterIndicators.aggregates,
    simulation: calcRetirementSimulation(adjusted),
  };

  return { applied: true, before, after, notes };
}
