// 리포트 2페이지 "종합적 핵심이슈" 목록을 이미 계산된 값(지표들, 시뮬레이션)에서
// 문구만 도출한다. 새로운 판정 로직을 추가하지 않는다.
// 원래 클라이언트 번들에 있었으나(취약지표 판정 임계값 0.5 포함) 서버로 옮겨,
// 응답에는 완성된 문구 배열만 내려간다.

function round1(v) {
  return Math.round(v * 10) / 10;
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

  const weakIndicators = indicators.filter((i) => !i.notCalculable && i.maxScore > 0 && i.score / i.maxScore < 0.5);
  if (weakIndicators.length > 0) {
    const names = weakIndicators.map((i) => i.label).join(' · ');
    issues.push(`FHS 종합결과 — 100점 만점 중 ${summary.totalScore}점(${summary.grade.letter}등급)으로, ${names} 지표가 개선이 필요한 구간입니다.`);
  } else {
    issues.push(`FHS 종합결과 — 100점 만점 중 ${summary.totalScore}점(${summary.grade.letter}등급)으로 전반적으로 안정적인 재무구조입니다.`);
  }

  return issues;
}
