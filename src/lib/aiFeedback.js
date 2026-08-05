// AI가 리포트 특정 섹션에 들어갈 피드백 문구를 생성하기 위한 연결 지점.
// 아직 실제 생성 API와 연결되지 않았다 - 연결 시 이 함수 내부만 채우면 되도록 시그니처만 먼저 정의해 둔다.

export const AI_FEEDBACK_SECTIONS = {
  executiveSummary: 'executiveSummary',
  peerComparison: 'peerComparison',
  fhsOverview: 'fhsOverview',
  indicatorSummary: 'indicatorSummary',
  indicator: 'indicator', // 지표별 fb-box, context.indicatorKey로 구분
  lifeCycle: 'lifeCycle',
  retirementSimulationBars: 'retirementSimulationBars',
  retirementSimulationPension: 'retirementSimulationPension',
};

// section: AI_FEEDBACK_SECTIONS 값 중 하나, context: 해당 섹션 렌더링에 쓰인 result 데이터 일부
// eslint-disable-next-line no-unused-vars
export async function generateAIFeedback(section, context) {
  // TODO: 실제 AI 생성 API 연결 필요 (예: /api/ai-feedback 라우트 추가 후 fetch)
  return null;
}
