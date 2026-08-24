// api/_lib/indicators.js의 판정 문구는 그대로 두고, 결과 화면의 상태 배지에만
// 사용자가 이해하기 쉬운 표시 문구를 적용한다. 점수와 ratioClass에는 관여하지 않는다.
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
    return `${prefix}${projection.depletionAge}세경 준비자산이 일시적으로 부족해지지만, 이후 소득 증가로 다시 쌓일 것으로 예상됩니다.`;
  }
  const diff = projection.lifeExpectancy - projection.depletionAge;
  return diff > 0
    ? `${prefix}기대수명보다 약 ${diff}년 먼저 준비자산이 소진될 것으로 예상됩니다.`
    : `${prefix}현재 계획 기준 자산이 기대수명 무렵 소진될 것으로 예상됩니다.`;
}
