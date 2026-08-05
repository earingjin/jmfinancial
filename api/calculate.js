import { calcIndicators } from './_lib/indicators.js';
import { calcRetirementSimulation } from './_lib/simulation.js';
import { calcScenarioComparison } from './_lib/scenarios.js';
import { buildPeerComparison } from './_lib/peerComparison.js';
import { validateInput } from './_lib/validate.js';
import { buildFamilyAges, getCurrentAge } from './_lib/aggregate.js';
import { enrichIndicators, enrichSimulation } from './_lib/reportEnrichment.js';
import { buildComprehensiveIssues } from './_lib/executiveSummary.js';
import { buildSimpleSummary } from './_lib/simpleSummary.js';
import { buildSavingsBreakdown, buildDebtBreakdown } from './_lib/reportBreakdowns.js';
import { buildWebSummary } from './_lib/summaryOverview.js';
import { obfuscate } from '../src/utils/obfuscate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
    return;
  }

  let input;
  try {
    input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: '요청 본문이 올바른 JSON 형식이 아닙니다.' });
    return;
  }

  const validation = validateInput(input);
  if (!validation.ok) {
    res.status(400).json({ error: '입력값을 다시 확인해 주세요.', details: validation.errors });
    return;
  }

  try {
    const { indicators, totalScore, grade, notCalculable, missingInputs, weakest, strongest, aggregates, is65Plus } = calcIndicators(input);
    const simulation = calcRetirementSimulation(input);
    const scenarioComparison = calcScenarioComparison(input);
    // totalScore가 null(종합점수 산출 불가)이면 buildMetric이 Number.isFinite(null)=false로 감지해
    // "비교 데이터 부족" 상태를 그대로 반환한다(0점처럼 잘못 계산되지 않음 - peerComparison.js 참고).
    const peerComparison = buildPeerComparison({
      age: getCurrentAge(input),
      totalAssets: aggregates.totalAssets,
      totalDebt: aggregates.totalDebt,
      annualIncome: aggregates.annualIncome,
      financialAssetsTotal: aggregates.financialAssetsTotal + aggregates.liquidAssets,
      retirementScore: totalScore,
    });

    // 리포트 렌더링에 필요한 게이지 위치·권장기준 비교 문구·등급 배지·생활수준 구간 같은
    // "표시용 파생값"을 서버에서 미리 계산해 붙인다. 클라이언트는 이 값을 그대로 그리기만
    // 하면 되므로, 게이지 임계값·등급 커트라인 같은 기준 데이터가 클라이언트에 존재하지 않는다.
    const retirementLivingCost = simulation.retirementLivingCostNow;
    const enriched = enrichIndicators({ indicators, totalScore, weakest, strongest, aggregates, retirementLivingCost });
    const enrichedSimulation = enrichSimulation(simulation, retirementLivingCost);
    const comprehensiveIssues = buildComprehensiveIssues({
      indicators: enriched.indicators,
      simulation: enrichedSimulation,
      summary: { totalScore, grade, notCalculable, missingInputs },
    });
    const simpleSummary = buildSimpleSummary({ input, aggregates, simulation });
    const savingsBreakdown = buildSavingsBreakdown(input);
    const debtBreakdown = buildDebtBreakdown(input);
    // 다운로드 전 웹 요약 화면(SimpleSummaryReport.jsx) 전용 파생값. 기존 필드(indicators/aggregates/
    // simulation/...)는 전혀 바뀌지 않으므로 PDF 리포트 렌더링에는 영향이 없다(하위호환 유지).
    const webSummary = buildWebSummary({ input, aggregates, simulation: enrichedSimulation, indicators: enriched.indicators, savingsBreakdown, debtBreakdown });

    // 응답을 평문 JSON으로 그대로 내려보내지 않고 스크램블한다. F12 → Network 탭에서
    // 열어봤을 때 계산 기준표(임계값·공식·판정 사유 등)가 곧바로 읽히지 않도록 하기 위함이다.
    // 클라이언트(src/App.jsx)가 동일한 유틸로 즉시 복호화하므로 화면·계산 결과는 그대로다.
    const payload = obfuscate({
      generatedAt: new Date().toISOString(),
      summary: {
        totalScore,
        grade,
        notCalculable,
        missingInputs,
        weakest: enriched.weakest,
        strongest: enriched.strongest,
        is65Plus,
        gradeBands: enriched.gradeBands,
        referenceScore: enriched.referenceScore,
        nextGrade: enriched.nextGrade,
        pointsToNextGrade: enriched.pointsToNextGrade,
        belowRecommendedCount: enriched.belowRecommendedCount,
      },
      indicators: enriched.indicators,
      aggregates,
      simulation: enrichedSimulation,
      scenarioComparison,
      peerComparison,
      familyAges: buildFamilyAges(input),
      comprehensiveIssues,
      simpleSummary,
      savingsBreakdown,
      debtBreakdown,
      webSummary,
    });

    res.status(200).json({ payload });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('calculate error:', err);
    res.status(500).json({ error: '계산 중 오류가 발생했습니다.' });
  }
}
