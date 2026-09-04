// api/_lib/indicators.js의 판정 문구는 그대로 두고, 결과 화면의 상태 배지에만
// 사용자가 이해하기 쉬운 표시 문구를 적용한다. 점수와 ratioClass에는 관여하지 않는다.
import { formatNumber, formatPercent, formatWon } from '../../utils/format';

const FHS_STATUS_BADGE_LABELS = {
  '매우 우수': '안정적',
  '우수': '양호',
  '양호': '양호',
  '보통': '점검 필요',
  '주의': '개선 필요',
  '위험': '우선 개선',
};

export function formatIndicatorStatusBadge(indicator) {
  return FHS_STATUS_BADGE_LABELS[indicator.status] || indicator.status;
}

export function formatPensionIncomeAtRetirement(amount, status, schedules = []) {
  if (status === 'notCalculable') return '산출 불가';
  if (status === 'beforeStart') {
    const scheduleText = schedules
      .filter((schedule) => Number.isFinite(schedule?.startAge) && Number.isFinite(schedule?.monthly))
      .map((schedule) => `${formatNumber(schedule.startAge)}세부터 월 ${formatWon(schedule.monthly)}`)
      .join(' · ');
    return scheduleText ? `수령 전 · ${scheduleText}` : '수령 전';
  }
  if (status === 'lumpSum') return '일시금 수령 예정';
  return formatWon(amount);
}

export function formatRetirementLivingCostBasis({ livingCostMonthly, retirementLivingCostAtRetirement, inflationRate }) {
  if (!Number.isFinite(retirementLivingCostAtRetirement) || !Number.isFinite(inflationRate)) {
    return '현재 입력한 노후 월 필요생활비를 기준으로 비교합니다.';
  }
  return `현재 입력한 월 필요생활비 ${formatWon(livingCostMonthly)}을 기준으로, 은퇴까지 연 ${formatPercent(inflationRate)} 물가상승률을 반영하면 은퇴 시점에는 월 ${formatWon(retirementLivingCostAtRetirement)}이 필요하다고 계산했습니다.`;
}

// 서버가 계산한 ratioClass만 사용해 결과 화면의 안내 문구를 선택한다.
export function getFinancialHealthStatus(reps) {
  const known = (reps || []).filter((r) => r && !r.notCalculable);
  if (known.length === 0) {
    return {
      icon: '🤔',
      title: '현재 재무상태를 확인하려면 정보가 조금 더 필요합니다.',
      detail: '가계수지·비상예비금·부채상환 정보를 입력하면 확인할 수 있습니다.',
    };
  }
  const riskCount = known.filter((r) => r.ratioClass === 'risk').length;
  const cautionCount = known.filter((r) => r.ratioClass === 'caution').length;
  if (riskCount === 0 && cautionCount === 0) {
    return {
      icon: '😊',
      title: '현재 재무상태가 전반적으로 안정적입니다.',
      detail: '수입과 지출의 균형, 비상자금과 부채 수준이 비교적 안정적으로 관리되고 있습니다.',
    };
  }
  if (riskCount >= 2) {
    return {
      icon: '😥',
      title: '현재 재무구조에서 우선 점검할 부분이 있습니다.',
      detail: '지출·비상자금·부채 중 취약한 항목부터 순서대로 점검할 필요가 있습니다.',
    };
  }
  return {
    icon: '🙂',
    title: '현재 재무상태는 대체로 안정적이지만 일부 점검이 필요합니다.',
    detail: '지출·비상자금·부채 중 보완이 필요한 항목을 확인해 보세요.',
  };
}

// 서버가 계산한 자산 소진 결과를 사용자 안내 문장으로만 변환한다.
export function formatAssetProjectionOutlook(projection) {
  const prefix = projection.lumpSumExpenseIncluded ? '예상 목돈지출을 포함하면 ' : '';
  if (projection.assetsRemainAtLifeExpectancy) {
    return `${prefix}${projection.lumpSumExpenseIncluded ? '기대수명까지 준비자산이 남을 것으로 예상됩니다.' : '현재 계획을 유지하면 기대수명까지 준비자산이 남을 것으로 예상됩니다.'}`;
  }
  if (projection.recoveredAfterDepletion) {
    return `${prefix}${formatNumber(projection.depletionAge)}세경 준비자산이 일시적으로 부족해지지만, 이후 소득 증가로 다시 쌓일 것으로 예상됩니다.`;
  }
  const diff = projection.lifeExpectancy - projection.depletionAge;
  return diff > 0
    ? `${prefix}기대수명보다 약 ${formatNumber(diff)}년 먼저 준비자산이 소진될 것으로 예상됩니다.`
    : `${prefix}현재 계획 기준 자산이 기대수명 무렵 소진될 것으로 예상됩니다.`;
}

export function formatAssetProjectionReason(projection) {
  const points = projection?.points || [];
  if (points.length === 0) return '';

  const startingAssets = points[0].startingBalance;
  const endingAssets = points[points.length - 1].endingBalance;
  const explanation = projection.explanation;
  if (explanation) {
    const changeText = explanation.assetChange < 0
      ? `${formatWon(Math.abs(explanation.assetChange))}(${formatPercent(Math.abs(explanation.assetChangeRate))}) 감소`
      : explanation.assetChange > 0
        ? `${formatWon(explanation.assetChange)}(${formatPercent(explanation.assetChangeRate)}) 증가`
        : '비슷한 수준으로 유지';
    const flowGap = explanation.totalOutflow - explanation.totalInflow;
    const flowReason = flowGap > 0
      ? `생활비와 목돈지출이 들어오는 소득과 운용수익보다 ${formatWon(flowGap)} 많아, 부족한 금액을 준비자산에서 꺼내 쓰기 때문입니다.`
      : flowGap < 0
        ? `들어오는 소득과 운용수익이 생활비와 목돈지출보다 ${formatWon(Math.abs(flowGap))} 많아, 남는 금액이 자산에 더해지기 때문입니다.`
        : '들어오는 소득·운용수익과 생활비·목돈지출의 규모가 비슷하기 때문입니다.';

    return `은퇴 시작자산 ${formatWon(startingAssets)}은 기대수명 시점에 ${formatWon(explanation.endingAssets)}으로 ${changeText}할 것으로 예상됩니다. 은퇴기간 동안 소득 ${formatWon(explanation.totalIncome)}과 운용수익 ${formatWon(explanation.totalInvestmentReturn)}이 들어오고, 생활비 ${formatWon(explanation.totalLivingExpense)}${explanation.totalLumpSumExpense > 0 ? `와 목돈지출 ${formatWon(explanation.totalLumpSumExpense)}` : ''}이 나갑니다. ${flowReason} 연 수익률 ${formatPercent(projection.assumedReturnRate)}와 물가상승률 ${formatPercent(projection.inflationRate)}를 반영한 결과입니다.`;
  }

  if (endingAssets < startingAssets) {
    return '은퇴 후 들어오는 소득과 자산 운용수익만으로 생활비와 목돈지출을 모두 충당하지 못해, 부족한 금액을 준비자산에서 꺼내 쓰기 때문에 그래프가 점차 내려갑니다.';
  }
  if (endingAssets > startingAssets) {
    return '은퇴 후 들어오는 소득과 자산 운용수익이 생활비와 목돈지출보다 많아, 남는 금액이 자산에 더해지기 때문에 그래프가 올라갑니다.';
  }
  return '은퇴 후 들어오는 소득과 자산 운용수익이 생활비와 목돈지출에 사용되면서, 준비자산이 현재와 비슷한 수준으로 유지되는 모습입니다.';
}
