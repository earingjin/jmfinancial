// api/_lib/indicators.js의 판정 문구는 그대로 두고, 결과 화면의 상태 배지에만
// 사용자가 이해하기 쉬운 표시 문구를 적용한다. 점수와 ratioClass에는 관여하지 않는다.
import { formatNumber, formatPercent, formatWon } from '../../utils/format';

const PENSION_SOURCE_LABELS = {
  'self.nationalPension': '본인 국민연금',
  'spouse.nationalPension': '배우자 국민연금',
  'self.personalPension': '본인 개인연금',
  'spouse.personalPension': '배우자 개인연금',
  'self.retirementPension': '본인 퇴직연금',
  'spouse.retirementPension': '배우자 퇴직연금',
};

export function getIncludedPensionSources(components) {
  if (!Array.isArray(components)) return null;

  return components
    .filter((component) => component?.inclusionStatus === 'included')
    .map((component) => ({
      key: component.key,
      label: PENSION_SOURCE_LABELS[component.key],
      amount: component.amount,
    }))
    .filter((component) => component.label);
}

export function getPensionSourcePresentation(snapshot) {
  const sources = getIncludedPensionSources(snapshot?.pensionBreakdown?.components ?? snapshot?.components);
  if (sources == null) return { sources: null, summary: null };
  if (snapshot?.calculable !== true) return { sources, summary: null };
  if (sources.length === 0) {
    return {
      sources,
      summary: '해당 시점에 수령 중인 연금 없음',
    };
  }
  return {
    sources,
    summary: `${sources.map((source) => source.label).join(' · ')} 포함`,
  };
}

export const RETIREMENT_SIMPLE_COMPARISON_NOTE = '은퇴생활비 기준 필요자금과 예상 준비자산만 비교한 참고값입니다. 은퇴 후 연금소득과 지출을 반영한 최종 자산 유지 전망과는 다를 수 있습니다.';

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

const FHS_INDICATOR_INTERPRETATIONS = {
  household: {
    good: '지출 부담 낮음',
    caution: '지출 부담 점검',
    risk: '지출 부담 높음',
  },
  emergency: {
    good: '비상자금 충분',
    caution: '비상자금 점검',
    risk: '비상자금 부족',
  },
  dsr: {
    good: '상환 부담 낮음',
    caution: '상환 부담 점검',
    risk: '상환 부담 높음',
  },
};

// 서버의 ratioClass 판정을 지표별 사용자 문구로만 바꾼다.
// DSR 0은 good 판정 안에서 '없음/낮음' 표현만 구분하며 판정에는 사용하지 않는다.
export function getFinancialIndicatorInterpretation(indicator) {
  if (!indicator || indicator.notCalculable) return '산출 불가';
  if (indicator.key === 'dsr' && indicator.ratioClass === 'good' && Number(indicator.value) === 0) {
    return '상환 부담 없음';
  }
  return FHS_INDICATOR_INTERPRETATIONS[indicator.key]?.[indicator.ratioClass]
    || formatIndicatorStatusBadge(indicator)
    || '확인 필요';
}

const FHS_EXPLANATION_PHRASES = {
  household: {
    good: '지출 부담이 낮고',
    caution: '지출 부담을 점검할 필요가 있고',
    risk: '지출 부담이 높고',
  },
  emergency: {
    good: '비상자금이 충분하며',
    caution: '비상자금을 점검할 필요가 있으며',
    risk: '비상자금이 부족하며',
  },
  dsr: {
    good: '빚 상환 부담이 낮아',
    caution: '빚 상환 부담을 점검할 필요가 있어',
    risk: '빚 상환 부담이 높아',
  },
};

// 종합판정을 다시 계산하지 않고, 계산 가능한 대표지표의 기존 판정이 뜻하는 근거만 설명한다.
export function getFinancialHealthExplanation(reps, fallback) {
  const known = (reps || []).filter((indicator) => indicator && !indicator.notCalculable);
  const phrases = known
    .map((indicator) => {
      if (indicator.key === 'dsr' && indicator.ratioClass === 'good' && Number(indicator.value) === 0) {
        return '빚 상환 부담이 없어';
      }
      return FHS_EXPLANATION_PHRASES[indicator.key]?.[indicator.ratioClass];
    })
    .filter(Boolean);

  if (phrases.length === 0) return fallback;
  const prefix = known.length < 3 ? '확인 가능한 항목에서는 ' : '';
  const allGood = known.length === 3 && known.every((indicator) => indicator.ratioClass === 'good');
  return allGood
    ? `${phrases.join(', ')} 현재 재무구조가 안정적입니다.`
    : `${prefix}${phrases.join(', ')} 현재 재무상태 판정에 반영되었습니다.`;
}

// 서버가 계산한 은퇴 후 자산 소진 결과를 최종 사용자 판정 문구로만 변환한다.
// shortfall·preparationRate를 재해석하거나 새로운 계산값을 만들지 않는다.
export function getRetirementSustainabilityStatus(projection, unavailableReason) {
  if (!projection || projection.notCalculable) {
    return {
      key: 'unknown',
      icon: '🤔',
      label: '확인 필요',
      displayValue: '산출 불가',
      titleLines: ['은퇴 후 자산 유지 전망을 확인하려면', '정보가 조금 더 필요합니다.'],
      detailLines: [projection?.reason || unavailableReason || '은퇴 시점과 기대수명, 은퇴 후 소득·지출 정보를 확인해 주세요.'],
    };
  }

  if (projection.recoveredAfterDepletion && Number.isFinite(projection.depletionAge)) {
    return {
      key: 'recovered',
      icon: '🙂',
      label: '변동 확인',
      displayValue: `${formatNumber(projection.depletionAge)}세 일시 소진 후 회복`,
      titleLines: [`현재 계획에서는 약 ${formatNumber(projection.depletionAge)}세에 준비자산이`, '일시적으로 소진된 뒤 다시 회복될 것으로 예상됩니다.'],
      detailLines: ['은퇴 후 소득이 늘어나는 시점에 자산이 다시 쌓이는 흐름을 함께 반영한 결과입니다.'],
    };
  }

  if (projection.assetsRemainAtLifeExpectancy === true) {
    return {
      key: 'stable',
      icon: '😊',
      label: '유지 예상',
      displayValue: '기대수명까지 유지',
      titleLines: ['현재 계획을 유지하면 기대수명까지', '준비자산이 유지될 것으로 예상됩니다.'],
      detailLines: ['은퇴 후 연금소득과 예정된 목돈지출을 함께 반영한 결과입니다.'],
    };
  }

  if (Number.isFinite(projection.depletionAge)) {
    return {
      key: 'depleted',
      icon: '😥',
      label: '보완 필요',
      displayValue: `${formatNumber(projection.depletionAge)}세 소진 예상`,
      titleLines: [`현재 계획을 유지하면 약 ${formatNumber(projection.depletionAge)}세에`, '준비자산이 소진될 것으로 예상됩니다.'],
      detailLines: ['은퇴 후 연금소득과 예정된 목돈지출을 함께 반영한 결과입니다.'],
    };
  }

  return {
    key: 'unknown',
    icon: '🤔',
    label: '확인 필요',
    displayValue: '산출 불가',
    titleLines: ['은퇴 후 자산 유지 전망을', '현재 결과에서 확인하기 어렵습니다.'],
    detailLines: [unavailableReason || '은퇴 관련 입력 정보를 확인한 뒤 다시 점검해 주세요.'],
  };
}

export function getRetirementStatusPresentation(status) {
  const summary = (status?.titleLines || []).join(' ');
  const ageMatch = summary.match(/약\s+\d+(?:\.\d+)?세/);
  if (!ageMatch) return { headline: status?.displayValue || '산출 불가', summary };

  return {
    headline: ageMatch[0],
    summary: summary.replace(/약\s+\d+(?:\.\d+)?세에?\s*/, ''),
  };
}

export function getMonthlyCoveragePresentation(snapshot, livingCostAtRetirement) {
  const pensionIncome = snapshot?.pensionIncomeMonthly ?? snapshot?.pensionIncome;
  const calculable = snapshot?.calculable === true
    && Number.isFinite(livingCostAtRetirement)
    && Number.isFinite(pensionIncome);

  if (!calculable) {
    return {
      calculable: false,
      result: '확인 필요',
      reason: snapshot?.reason || snapshot?.calculationReason || '월 생활비 충당 정보를 산출할 수 없습니다.',
      pensionSources: getPensionSourcePresentation(snapshot),
    };
  }

  if (livingCostAtRetirement > pensionIncome) {
    return { calculable: true, result: `월 ${formatWon(livingCostAtRetirement - pensionIncome)} 부족`, livingCost: livingCostAtRetirement, pensionIncome, pensionSources: getPensionSourcePresentation(snapshot) };
  }
  if (pensionIncome > livingCostAtRetirement) {
    return { calculable: true, result: `월 ${formatWon(pensionIncome - livingCostAtRetirement)} 여유`, livingCost: livingCostAtRetirement, pensionIncome, pensionSources: getPensionSourcePresentation(snapshot) };
  }
  return { calculable: true, result: '월 생활비 충당 가능', livingCost: livingCostAtRetirement, pensionIncome, pensionSources: getPensionSourcePresentation(snapshot) };
}

export function getNationalPensionCoverageFallback(snapshot) {
  if (!snapshot) return '최신 기준으로 다시 진단하면 확인할 수 있습니다';
  const reason = snapshot.reason || snapshot.calculationReason;
  if (reason === '국민연금 향후 가입기간을 확정할 수 없음') return '국민연금 가입기간 확인 필요';
  if (reason === '국민연금 수령 시점을 확인할 수 없습니다.') return '국민연금 수령 시점 확인 필요';
  if (reason === '연금 정보를 확인할 수 없습니다.') return '연금정보 확인 필요';
  if (reason?.startsWith('월 연금액을 확인할 수 없음:')) return '연금 수령액 확인 필요';
  if (reason?.startsWith('연금 개시·종료 정보 부족:')) return '연금 수령 조건 확인 필요';
  return '연금정보 확인 필요';
}

// 서버가 계산한 시점별 결과를 두 요약 화면에서 동일하게 읽기 위한 표시 전용 view-model.
export function getRetirementSummaryPresentation(retirementReadiness = {}, futureFinance = {}) {
  const retirementStatus = getRetirementSustainabilityStatus(futureFinance.retirementAssetProjection, retirementReadiness.reason);
  const retirementPensionSnapshot = futureFinance.retirementCashFlowOutlook
    ?.find((item) => item.age === retirementReadiness.retirementAge);
  const livingCost = retirementReadiness.retirementLivingCostAtRetirement;
  const nationalPensionStartSnapshot = futureFinance.nationalPensionStartSnapshot;

  return {
    retirementStatus,
    retirementStatusPresentation: getRetirementStatusPresentation(retirementStatus),
    retirementMonthlyCoverage: getMonthlyCoveragePresentation(retirementPensionSnapshot, livingCost),
    nationalPensionMonthlyCoverage: getMonthlyCoveragePresentation(nationalPensionStartSnapshot, livingCost),
    nationalPensionCoverageFallbackMessage: getNationalPensionCoverageFallback(nationalPensionStartSnapshot),
    nationalPensionStartSnapshot,
    retirementCashFlowDiagnosis: futureFinance.retirementCashFlowDiagnosis || null,
  };
}

export function getCashFlowPointPresentation(point) {
  if (!point?.calculable || point.status === 'unavailable') {
    return { available: false, result: '산출 불가', tone: 'unavailable', reason: point?.reason || '현금흐름 정보를 산출할 수 없습니다.' };
  }
  if (point.status === 'surplus') {
    return { available: true, result: `월 ${formatWon(Math.abs(point.balance))} 여유`, tone: 'surplus' };
  }
  if (point.status === 'shortfall') {
    return { available: true, result: `월 ${formatWon(Math.abs(point.balance))} 부족`, tone: 'shortfall' };
  }
  return { available: true, result: '월소득과 생활비 균형', tone: 'balanced' };
}

export function getNationalPensionCashFlowStatusPresentation(point) {
  const cashFlow = getCashFlowPointPresentation(point);
  const meaning = point?.meaning || '국민연금 수령 후';
  const byTone = {
    surplus: {
      icon: '😊',
      headline: `${meaning} ${cashFlow.result}가 예상됩니다.`,
      description: '월소득으로 생활비를 충당하고 남는 수준입니다.',
    },
    shortfall: {
      icon: '😟',
      headline: `${meaning} ${cashFlow.result}이 예상됩니다.`,
      description: '월소득이 생활비보다 적은 수준입니다.',
    },
    balanced: {
      icon: '😐',
      headline: `${meaning} 월소득과 생활비가 같습니다.`,
      description: '월소득과 생활비가 같은 수준입니다.',
    },
    unavailable: {
      icon: '❔',
      headline: `${meaning} 월 현금흐름을 산출할 수 없습니다.`,
      description: null,
    },
  };
  return { ...cashFlow, ...byTone[cashFlow.tone] };
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

// simulation.js와 futureFinance.js의 기존 경계(수령 나이 <= 은퇴 나이)를 화면 표시에도 그대로
// 사용한다. 금액을 합산하거나 준비자산을 다시 계산하지 않고, 저장된 원본 입력의 일시금 항목을
// 어느 결과 구간에 표시할지만 구분한다.
export function getSeveranceLumpSumDisplayItems(input, retirementAge) {
  const receiptBoundary = Number(retirementAge);
  if (!Number.isFinite(receiptBoundary)) return [];
  const owners = [
    { label: '본인', severance: input?.income?.severance },
    ...(input?.basic?.hasSpouse === true ? [{ label: '배우자', severance: input?.spouse?.severance }] : []),
  ];
  return owners.flatMap(({ label, severance }) => {
    const amount = Number(severance?.lumpsum);
    const age = Number(severance?.lumpsumAge);
    if (severance?.type !== 'lumpsum' || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(age)) return [];
    return [{ label, amount, age, includedAtRetirement: age <= receiptBoundary }];
  });
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
