// 리포트 2페이지 "종합적 핵심이슈" 목록을 이미 계산된 값(지표들, 시뮬레이션)에서
// 문구만 도출한다. 새로운 판정 로직을 추가하지 않는다.
// 원래 클라이언트 번들에 있었으나(취약지표 판정 임계값 0.5 포함) 서버로 옮겨,
// 응답에는 완성된 문구 배열만 내려간다.

import { getAgeSavingsRateGuideline } from './peerBenchmarks.js';

function round1(v) {
  return Math.round(v * 10) / 10;
}

const STABLE_EXPENSE_STATUSES = new Set(['매우 우수', '우수', '양호']);
const STRONG_SAVINGS_STATUSES = new Set(['매우 우수', '우수']);

// 결과요약 현금흐름표용 피드백. 비율이나 구간을 다시 계산하지 않고, 이미 서버에서 판정한
// household/savingsRate 상태를 조합해 사용자용 문장만 만든다. 다만 표에 실제 표시되는
// 수입·지출·저축의 합계 불일치는 같은 aggregates 필드끼리 직접 확인해 가장 먼저 안내한다.
function buildFinancialCashFlowFeedbackCore({ indicators, aggregates }) {
  const household = indicators.find((indicator) => indicator.key === 'household');
  const savingsRate = indicators.find((indicator) => indicator.key === 'savingsRate');
  const householdUnavailable = !household || household.notCalculable;
  const savingsUnavailable = !savingsRate || savingsRate.notCalculable;

  if (householdUnavailable && savingsUnavailable) {
    return '현재 입력된 소득 정보만으로는 지출과 저축의 균형을 판단하기 어렵습니다. 소득 정보를 확인한 뒤 다시 진단해보세요.';
  }

  const displayedIncome = aggregates.householdMonthlyIncomeTotal;
  const displayedOutflow = aggregates.totalExpenseMonthlyExSavings + aggregates.monthlySavings;
  if (displayedOutflow > displayedIncome) {
    return '입력한 지출과 저축을 합하면 현재 월소득보다 많습니다. 일시적인 지출이나 기존 자산에서 충당하는 금액이 포함된 것은 아닌지 확인해보세요. 이런 상태가 지속되면 저축을 하고 있어도 전체 자산은 줄어들 수 있습니다.';
  }

  if (householdUnavailable) {
    return STRONG_SAVINGS_STATUSES.has(savingsRate.status)
      ? '현재 정보만으로는 소득에 비해 지출이 어느 정도인지 판단하기 어렵습니다. 저축은 꾸준히 이루어지고 있으므로, 지출 정보를 확인하면 현금흐름을 더 정확히 점검할 수 있습니다.'
      : '현재 정보만으로는 소득에 비해 지출이 어느 정도인지 판단하기 어렵습니다. 확인 가능한 저축 규모도 크지 않아, 지출 정보를 보완한 뒤 매달 저축할 금액을 함께 정해보는 것이 좋습니다.';
  }

  if (savingsUnavailable) {
    return STABLE_EXPENSE_STATUSES.has(household.status)
      ? '현재 소득에 비해 지출은 비교적 안정적으로 관리되고 있습니다. 저축 정보를 확인하면 매달 남는 돈이 자산으로 얼마나 이어지는지 더 정확히 판단할 수 있습니다.'
      : '현재 소득에서 생활비와 고정비가 차지하는 비중이 높은 편입니다. 저축 정보를 확인한 뒤 반복적으로 나가는 비용부터 함께 점검해보세요.';
  }

  const expenseStable = STABLE_EXPENSE_STATUSES.has(household.status);
  const savingsStrong = STRONG_SAVINGS_STATUSES.has(savingsRate.status);

  if (expenseStable && savingsStrong) {
    return '현재 소득 안에서 지출을 안정적으로 관리하고 있으며, 저축도 꾸준히 이루어지고 있습니다. 지금의 균형을 유지하면서 예상하지 못한 지출에 대비할 여유자금도 함께 확보해두는 것이 좋습니다.';
  }
  if (expenseStable) {
    return '현재 지출은 소득 범위 안에서 비교적 잘 관리되고 있습니다. 다만 저축으로 이어지는 금액은 다소 적어, 매달 남는 금액 중 일부를 꾸준한 저축으로 연결해보는 것이 좋습니다.';
  }
  if (savingsStrong) {
    return '지출과 저축이 모두 소득에서 큰 비중을 차지하고 있습니다. 일시적인 지출이나 추가 소득이 반영된 것은 아닌지 확인하고, 매달 반복 가능한 현금흐름인지 점검해보세요.';
  }
  return '현재 소득에서 생활비와 고정비가 차지하는 비중이 높은 편입니다. 저축을 늘리기 전에 반복적으로 나가는 비용 중 줄일 수 있는 항목이 있는지 먼저 살펴보세요.';
}

export function buildFinancialCashFlowFeedback({ indicators, aggregates }) {
  const household = indicators.find((indicator) => indicator.key === 'household');
  const savingsRate = indicators.find((indicator) => indicator.key === 'savingsRate');
  const parts = [
    !household?.notCalculable && Number.isFinite(household?.rawValue)
      ? `지출 ${round1(household.rawValue)}%`
      : null,
    !savingsRate?.notCalculable && Number.isFinite(savingsRate?.rawValue)
      ? `저축 ${round1(savingsRate.rawValue)}%`
      : null,
  ].filter(Boolean);
  const feedback = buildFinancialCashFlowFeedbackCore({ indicators, aggregates });

  return parts.length > 0 ? `소득 중 ${parts.join(' · ')} — ${feedback}` : feedback;
}

// 결과요약 재무상태표용 피드백. 서버에서 이미 집계한 자산·부채·순자산을 그대로 해석하며
// 새로운 비율이나 등급 기준을 만들지 않는다.
function formatKoreanWon(value) {
  const amount = Math.round(Math.abs(value) * 10) / 10;
  if (amount < 10000) return `${amount.toLocaleString('ko-KR')}만원`;

  const eok = Math.floor(amount / 10000);
  const remainder = Math.round((amount - eok * 10000) * 10) / 10;
  return remainder > 0
    ? `${eok.toLocaleString('ko-KR')}억 ${remainder.toLocaleString('ko-KR')}만원`
    : `${eok.toLocaleString('ko-KR')}억원`;
}

export function buildExecutiveFinancialPositionFeedback({ aggregates, indicators = [] }) {
  const totalAssets = aggregates?.totalAssets;
  const totalDebt = aggregates?.totalDebt;
  const netWorth = aggregates?.netWorth;
  const debtBurden = indicators.find((indicator) => indicator.key === 'debtBurden');

  if (![totalAssets, totalDebt, netWorth].every(Number.isFinite)) {
    return '현재 입력 정보만으로는 자산과 부채의 관계를 판단하기 어렵습니다. 자산과 부채 정보를 확인한 뒤 다시 점검해보세요.';
  }
  if (totalAssets === 0 && totalDebt === 0) {
    return '현재 입력된 자산과 부채가 없어 재무상태를 판단하기 어렵습니다. 보유 자산과 갚아야 할 부채를 확인해 입력해보세요.';
  }
  if (netWorth < 0) {
    return `부채가 자산보다 ${formatKoreanWon(netWorth)} 많아, 보유 자산을 모두 사용해도 부채가 남는 구조입니다. 추가 자산 마련보다 금리가 높거나 부담이 큰 부채부터 상환 순서를 정해 줄이는 것이 좋습니다.`;
  }
  if (totalDebt === 0) {
    return `부채가 없어 ${formatKoreanWon(netWorth)}이 모두 내 자산으로 남아 있습니다. 이 자산을 비상자금, 가까운 시일에 쓸 돈, 장기적으로 불릴 돈으로 나누어 관리해보세요.`;
  }
  const debtRatioText = !debtBurden?.notCalculable && Number.isFinite(debtBurden?.rawValue)
    ? `전체 자산에서 부채가 차지하는 비중은 ${round1(debtBurden.rawValue)}%이며, `
    : '';
  return `${debtRatioText}부채를 제외하고 ${formatKoreanWon(netWorth)}이 내 자산으로 남습니다. 자산을 늘리는 것과 함께 대출 금리와 상환 부담을 점검해, 이자 부담이 큰 부채부터 줄이면 순자산을 더 빠르게 키울 수 있습니다.`;
}

// 기존 은퇴 시뮬레이션과 연도별 자산 전망 결과를 사용해 2페이지 카드용 해석만 만든다.
// 부족액·준비율·소진 시점은 여기서 다시 계산하지 않는다.
export function buildExecutiveRetirementFeedback({ simulation, retirementAssetProjection }) {
  const shortfall = simulation?.shortfall;
  const preparationRate = simulation?.preparationRate;

  let cashFlow;
  if (!Number.isFinite(shortfall)) {
    cashFlow = '현재 입력 정보만으로는 은퇴생활비 준비 상태를 판단하기 어렵습니다. 은퇴 시점과 생활비 정보를 확인한 뒤 다시 점검해보세요.';
  } else if (shortfall > 0) {
    const rateText = Number.isFinite(preparationRate)
      ? `필요한 은퇴자금의 약 ${round1(preparationRate)}%를 준비할 수 있는 상태이며, `
      : '';
    cashFlow = `${rateText}현재 계획에서는 ${shortfall.toLocaleString('ko-KR')}만원이 부족할 것으로 예상됩니다. 지금의 저축을 유지할 수 있는지 확인하고, 부족분을 줄일 추가 저축 계획을 세워보세요.`;
  } else {
    cashFlow = '현재 계획대로라면 준비 가능한 자산으로 은퇴생활비를 충당할 수 있습니다. 다만 물가와 실제 지출은 달라질 수 있으므로 생활비와 저축 계획을 정기적으로 다시 확인해보세요.';
  }

  let assetGoal;
  if (!retirementAssetProjection || retirementAssetProjection.notCalculable) {
    assetGoal = '현재 입력 정보만으로는 은퇴 후 자산이 언제까지 유지되는지 판단하기 어렵습니다. 기대수명과 은퇴 후 소득·지출 정보를 확인한 뒤 다시 점검해보세요.';
  } else if (retirementAssetProjection.assetsRemainAtLifeExpectancy) {
    assetGoal = '예상 소득과 생활비, 목돈지출을 반영해도 기대수명까지 준비자산이 남을 전망입니다. 지금의 저축과 생활비 관리 흐름을 유지하되, 실제 지출 변화에 맞춰 정기적으로 점검하세요.';
  } else {
    assetGoal = `현재 계획대로라면 준비자산이 ${round1(retirementAssetProjection.depletionAge)}세 무렵 소진될 것으로 예상됩니다. 기대수명까지 이어질 수 있도록 노후 생활비, 목돈지출, 추가 저축 중 조정 가능한 항목을 먼저 살펴보세요.`;
  }

  return { cashFlow, assetGoal };
}

export function buildSavingsInvestmentFeedback({ indicators, age }) {
  const savingsRate = indicators.find((indicator) => indicator.key === 'savingsRate');
  if (!savingsRate || savingsRate.notCalculable || !Number.isFinite(savingsRate.rawValue)) {
    return '현재 입력된 소득 정보만으로는 소득에 비해 저축·투자가 어느 정도인지 판단하기 어렵습니다. 소득 정보를 확인한 뒤 다시 진단해보세요.';
  }

  const rate = round1(savingsRate.rawValue);
  const guideline = getAgeSavingsRateGuideline(age);
  const difference = guideline ? round1(rate - guideline.rate) : null;
  const ageComparison = !guideline
    ? ''
    : difference > 0
      ? ` 같은 연령대의 권장 수준(${guideline.rate}%)보다 ${difference}%p 높습니다.`
      : difference < 0
        ? ` 같은 연령대의 권장 수준(${guideline.rate}%)보다 ${Math.abs(difference)}%p 낮습니다.`
        : ` 같은 연령대의 권장 수준(${guideline.rate}%)과 같습니다.`;
  if (STRONG_SAVINGS_STATUSES.has(savingsRate.status)) {
    return `현재 소득의 ${rate}%를 저축·투자하고 있습니다.${ageComparison} 꾸준히 자산을 쌓아갈 수 있는 흐름이므로, 지금의 저축 습관을 유지해보세요.`;
  }
  if (savingsRate.status === '보통') {
    return `현재 소득의 ${rate}%를 저축·투자하고 있습니다.${ageComparison} 기본적인 저축은 이루어지고 있으며, 여유가 생길 때마다 정기 저축액을 조금씩 늘려보는 것이 좋습니다.`;
  }
  return `현재 소득의 ${rate}%를 저축·투자하고 있습니다.${ageComparison} 저축할 여유가 크지 않은 편이므로, 반복적으로 나가는 비용을 살펴보고 매달 일정 금액을 먼저 저축하는 방법을 검토해보세요.`;
}

// 현금흐름·은퇴자산 그래프용 피드백. 소득 대비 지출·저축 비율은 indicators의 기존
// household/savingsRate 결과를 재사용하고, 그래프에 이미 표시되는 현재·노후 생활비의 차이만 해석한다.
export function buildCashFlowOutlookFeedback({ indicators, aggregates, simulation }) {
  const household = indicators.find((indicator) => indicator.key === 'household');
  const savingsRate = indicators.find((indicator) => indicator.key === 'savingsRate');
  const income = aggregates.monthlyIncome;
  const expense = aggregates.totalExpenseMonthlyExSavings;
  const savings = aggregates.monthlySavings;
  const retirementExpense = simulation.retirementLivingCostNow;

  if (!(income > 0) || household?.notCalculable || savingsRate?.notCalculable) {
    return '현재 입력된 소득 정보만으로는 생활비와 저축의 균형을 판단하기 어렵습니다. 소득 정보를 확인하면 노후 생활비 목표와 비교한 안내를 확인할 수 있습니다.';
  }

  const excess = expense + savings - income;
  if (excess > 0) {
    return `현재 생활비와 저축을 합하면 월소득보다 ${round1(excess).toLocaleString('ko-KR')}만원 많습니다. 일시적인 지출이나 다른 소득이 포함된 것은 아닌지 먼저 확인해야 노후 준비 가능 금액을 정확히 판단할 수 있습니다.`;
  }

  const savingsPercent = round1(savingsRate.rawValue);
  const remaining = round1(Math.max(0, income - expense - savings));
  const retirementGap = round1(retirementExpense - expense);
  const retirementGapPercent = expense > 0 ? round1((Math.abs(retirementGap) / expense) * 100) : null;
  const currentFlow = remaining > 0
    ? `현재는 월소득의 ${savingsPercent}%를 저축·투자하고, 생활비와 저축을 제외하면 매월 약 ${remaining.toLocaleString('ko-KR')}만원이 남습니다.`
    : `현재는 월소득의 ${savingsPercent}%를 저축·투자하고 있어 생활비와 저축이 월소득 대부분을 차지합니다.`;

  if (retirementGap > 0) {
    const gapText = retirementGapPercent == null
      ? `${retirementGap.toLocaleString('ko-KR')}만원`
      : `${retirementGap.toLocaleString('ko-KR')}만원(${retirementGapPercent}%)`;
    return `${currentFlow} 노후 생활비 목표는 현재보다 ${gapText} 높으므로, 지금의 저축을 유지하면서 여유금액 일부를 노후 준비로 꾸준히 연결하는 것이 좋습니다.`;
  }
  if (retirementGap < 0) {
    const gapText = Math.abs(retirementGap).toLocaleString('ko-KR');
    return `${currentFlow} 노후 생활비 목표는 현재보다 월 ${gapText}만원 낮지만, 물가상승이나 의료비처럼 예상 밖의 지출에 대비할 여유자금도 함께 준비해두는 것이 좋습니다.`;
  }
  return `${currentFlow} 노후 생활비 목표가 현재 생활비와 같은 수준이므로, 지금의 생활비 관리와 저축 습관을 은퇴 전까지 꾸준히 유지하는 것이 중요합니다.`;
}

export function buildPeerComparisonFeedback({ peerComparison }) {
  const metrics = [
    { label: '순자산', metric: peerComparison?.netWorth },
    { label: '연소득', metric: peerComparison?.householdIncome },
    { label: '금융자산', metric: peerComparison?.financialAssets },
  ];
  const available = metrics.filter(({ metric }) => metric?.value != null && metric?.average != null);
  if (available.length === 0) {
    return '현재 입력된 정보만으로는 또래 가구와 자산·소득을 비교하기 어렵습니다. 자산과 소득 정보를 확인한 뒤 다시 진단해보세요.';
  }

  const position = (metric) => {
    if (metric.percentileLabel?.includes('높음')) return '또래 평균보다 높은 편';
    if (metric.percentileLabel?.includes('낮음')) return '또래 평균보다 낮은 편';
    return '또래 평균과 비슷한 편';
  };
  const summary = available.map(({ label, metric }) => `${label}은 ${position(metric)}`).join(', ');
  const netWorthLow = peerComparison.netWorth?.percentileLabel?.includes('낮음');
  const financialAssetsLow = peerComparison.financialAssets?.percentileLabel?.includes('낮음');

  if (financialAssetsLow) {
    return `${summary}입니다. 금융자산이 상대적으로 적다면 갑자기 돈이 필요할 때를 대비해 예금·투자금처럼 활용하기 쉬운 자산을 꾸준히 늘려보세요.`;
  }
  if (netWorthLow) {
    return `${summary}입니다. 또래와의 차이를 줄이려면 부채 상환과 정기적인 저축을 함께 관리해 순자산을 차근차근 늘려가는 것이 좋습니다.`;
  }
  return `${summary}입니다. 현재의 자산관리 흐름을 유지하면서 예상하지 못한 지출에 대비할 여유자금도 함께 확보해두는 것이 좋습니다.`;
}

export function buildComprehensiveIssues({ indicators, simulation, summary }) {
  const issues = [];

  const retirementIncome = indicators.find((i) => i.key === 'retirementIncome');
  if (retirementIncome?.notCalculable) {
    issues.push(`노후 생활비 현금흐름 — ${retirementIncome.reason}`);
  } else if (retirementIncome) {
    const gap = round1(100 - retirementIncome.value);
    issues.push(
      gap > 0
        ? `노후 생활비 현금흐름 — 은퇴(${simulation.currentAge + simulation.yearsToRetirement}세) 시점 기준 노후소득이 필요생활비 대비 ${retirementIncome.value}%에 그쳐 월 소득공백 대비가 필요합니다.`
        : `노후 생활비 현금흐름 — 은퇴 시점 노후소득이 필요생활비의 ${retirementIncome.value}%로 충분히 확보되어 있습니다.`
    );
  }

  const { totalGoalAmount, preparationRate } = simulation.lifeGoals;
  if (totalGoalAmount > 0) {
    issues.push(
      preparationRate >= 100
        ? '재무목표 부족액 — 자녀 교육비·결혼자금 등 생애 목돈 지출은 준비자산으로 충분히 충당 가능합니다.'
        : `재무목표 부족액 — 은퇴시점까지 준비 가능한 자산은 필요생활비의 ${round1(simulation.preparationRate)}% 수준으로, 약 ${simulation.shortfall.toLocaleString('ko-KR')}만원의 추가 준비가 필요합니다.`
    );
  } else if (simulation.shortfall > 0) {
    issues.push(`재무목표 부족액 — 은퇴시점 준비자산이 필요자금 대비 약 ${simulation.shortfall.toLocaleString('ko-KR')}만원 부족합니다.`);
  }

  if (summary.notCalculable) {
    const missing = (summary.missingInputs || []).join(' / ');
    issues.push(`FHS 종합결과 — 일부 지표를 산출할 수 없어 종합점수·등급을 계산할 수 없습니다. 부족한 입력: ${missing}`);
    return issues;
  }

  const weakIndicators = indicators.filter(
    (i) => i.key !== 'retirementIncome' && !i.notCalculable && !i.notApplicable && i.maxScore > 0 && i.score / i.maxScore < 0.5
  );
  if (weakIndicators.length > 0) {
    const names = weakIndicators.map((i) => i.label).join(' · ');
    issues.push(`재무건강지표 종합결과 — ${names} 지표를 우선 점검할 필요가 있습니다.`);
  } else {
    issues.push('재무건강지표 종합결과 — 산출 가능한 8개 지표를 함께 보면 전반적으로 안정적인 재무구조입니다.');
  }

  return issues;
}
