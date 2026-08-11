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
import { buildWebSummary, allBlankLeaf } from './_lib/summaryOverview.js';
import { obfuscate } from '../src/utils/obfuscate.js';
import { requireUser } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
    return;
  }

  const auth = await requireUser(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const MAX_BODY_SIZE = 200_000; // 약 200KB - 정상적인 입력 폼 데이터 대비 충분히 여유 있는 상한

  let input;
  try {
    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (bodyStr.length > MAX_BODY_SIZE) {
      res.status(413).json({ error: '요청 데이터가 너무 큽니다.' });
      return;
    }
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
    // netWorth/annualIncome/financialAssetsTotal은 미입력 시 n()이 0으로 채우므로, 아래 경로가
    // 전부 비어 있으면(=사용자가 해당 항목 자체를 입력하지 않았으면) "실제 0원"이 아니라 미입력임을
    // peerComparison.js에 별도로 알려준다(aggregate.js의 각 합산식과 정확히 대응하는 경로만 검사).
    // 아래 "미입력 판정"용 leaf 경로는 화면에 실제 입력칸으로 존재하는 필드만 모은 것이다.
    // assets.liquidAssets.total / assets.debtStatus.totalBalance 같은 "합계" 필드는 해당 스텝
    // 화면을 열기만 해도 0으로 자동 채워지므로(각 스텝의 합계 계산 useEffect) 판정 기준에서 제외한다.
    const DEBT_CATEGORIES = ['mortgage', 'depositLoan', 'businessLoan', 'buildingLoan', 'carLoan', 'studentLoan', 'otherLoan'];
    const debtBreakdownLeafPaths = DEBT_CATEGORIES.flatMap((cat) => [
      `assets.debtStatus.breakdown.${cat}.principal`,
      `assets.debtStatus.breakdown.${cat}.monthlyInterest`,
      `assets.debtStatus.breakdown.${cat}.monthlyRepayment`,
      `assets.debtStatus.breakdown.${cat}.months`,
    ]);

    const netWorthMissing = allBlankLeaf(
      input,
      [
        'assets.liquidAssets.breakdown.deposit', 'assets.liquidAssets.breakdown.savings',
        'assets.liquidAssets.breakdown.cma', 'assets.liquidAssets.breakdown.emergencyFund',
        'assets.financialAssets.stocks', 'assets.financialAssets.funds', 'assets.financialAssets.bonds',
        'assets.pensionAssetsBreakdown.variableAnnuity', 'assets.pensionAssetsBreakdown.pensionSavingsAccount', 'assets.pensionAssetsBreakdown.irp',
        'assets.realEstateAssets.mainProperty',
        ...debtBreakdownLeafPaths,
      ],
      [
        'assets.liquidAssets.customItems', 'assets.financialAssets.otherItems',
        'assets.pensionAssetsBreakdown.otherItems', 'assets.realEstateAssets.otherItems',
        'assets.debtStatus.customItems',
      ]
    );
    const annualIncomeMissing = allBlankLeaf(input, [
      'income.salary.monthly', 'income.salary.annualBonus', 'income.business.monthly',
      'spouse.salary.monthly', 'spouse.salary.annualBonus',
    ], ['income.regularIncomes']);
    const financialAssetsMissing = allBlankLeaf(
      input,
      [
        'assets.financialAssets.stocks', 'assets.financialAssets.funds', 'assets.financialAssets.bonds',
        'assets.liquidAssets.breakdown.deposit', 'assets.liquidAssets.breakdown.savings',
        'assets.liquidAssets.breakdown.cma', 'assets.liquidAssets.breakdown.emergencyFund',
      ],
      ['assets.financialAssets.otherItems', 'assets.liquidAssets.customItems']
    );

    const peerComparison = buildPeerComparison({
      age: getCurrentAge(input),
      totalAssets: aggregates.totalAssets,
      totalDebt: aggregates.totalDebt,
      annualIncome: aggregates.annualIncome,
      financialAssetsTotal: aggregates.financialAssetsTotal + aggregates.liquidAssets,
      retirementScore: totalScore,
      netWorthMissing,
      annualIncomeMissing,
      financialAssetsMissing,
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
