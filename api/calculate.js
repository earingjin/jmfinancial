import { calcIndicators } from './_lib/indicators.js';
import { calcRetirementSimulation } from './_lib/simulation.js';
import { buildPeerComparison } from './_lib/peerComparison.js';
import { validateInput } from './_lib/validate.js';
import { buildFamilyAges, getCurrentAge } from './_lib/aggregate.js';
import { buildFinancialHealthInterpretation, enrichIndicators, enrichSimulation } from './_lib/reportEnrichment.js';
import { buildCashFlowOutlookFeedback, buildExecutiveFinancialPositionFeedback, buildExecutiveRetirementFeedback, buildFinancialCashFlowFeedback, buildPeerComparisonFeedback, buildSavingsInvestmentFeedback } from './_lib/executiveSummary.js';
import { buildSimpleSummary } from './_lib/simpleSummary.js';
import { buildSavingsBreakdown, buildDebtBreakdown, buildLivingExpenseItems, buildOtherLivingExpenseItems, buildOtherLiquidAssetItems } from './_lib/reportBreakdowns.js';
import { buildWebSummary, allBlankLeaf } from './_lib/summaryOverview.js';
import { obfuscate } from '../src/utils/obfuscate.js';
import { requireUser } from './_lib/auth.js';
import { assertFiniteCalculationResult } from './_lib/finite.js';
import { buildCanonicalInput } from './_lib/canonicalInput.js';

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

  // 브라우저 자동 합계는 신뢰하지 않는다. 구조·숫자 검증을 통과한 세부 입력으로 서버에서 재계산한다.
  input = buildCanonicalInput(input);

  try {
    const { indicators, notCalculable, missingInputs, weakest, strongest, aggregates, currentAge } = calcIndicators(input);
    const simulation = calcRetirementSimulation(input);
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

    const liquidAssetLeafPaths = input.assets?.liquidAssets?.inputMode === 'simple'
      ? ['assets.liquidAssets.total']
      : [
          'assets.liquidAssets.breakdown.deposit', 'assets.liquidAssets.breakdown.savings',
          'assets.liquidAssets.breakdown.cma', 'assets.liquidAssets.breakdown.subscription',
          'assets.liquidAssets.breakdown.emergencyFund',
        ];
    const financialAssetLeafPaths = input.assets?.financialAssets?.inputMode === 'simple'
      ? ['assets.financialAssets.total']
      : ['assets.financialAssets.stocks', 'assets.financialAssets.funds', 'assets.financialAssets.bonds'];
    const pensionAssetLeafPaths = input.assets?.pensionAssetsInputMode === 'simple'
      ? ['assets.pensionAssets']
      : [
          'assets.pensionAssetsBreakdown.variableAnnuity', 'assets.pensionAssetsBreakdown.pensionSavingsAccount',
          'assets.pensionAssetsBreakdown.irp',
        ];
    const realEstateAssetLeafPaths = input.assets?.realEstateAssets?.inputMode === 'simple'
      ? ['assets.realEstateAssets.total']
      : ['assets.realEstateAssets.mainProperty'];
    const otherAssetLeafPaths = input.assets?.otherAssets?.inputMode === 'simple'
      ? ['assets.otherAssets.total']
      : [];
    const activeAssetArrayPaths = [
      ...(input.assets?.liquidAssets?.inputMode === 'simple' ? [] : ['assets.liquidAssets.customItems']),
      ...(input.assets?.financialAssets?.inputMode === 'simple' ? [] : ['assets.financialAssets.otherItems']),
      ...(input.assets?.pensionAssetsInputMode === 'simple' ? [] : ['assets.pensionAssetsBreakdown.otherItems']),
      ...(input.assets?.realEstateAssets?.inputMode === 'simple' ? [] : ['assets.realEstateAssets.otherItems']),
      ...(input.assets?.otherAssets?.inputMode === 'simple' ? [] : ['assets.otherAssets.items']),
      'assets.debtStatus.customItems',
    ];

    const netWorthMissing = allBlankLeaf(
      input,
      [
        ...liquidAssetLeafPaths, ...financialAssetLeafPaths, ...pensionAssetLeafPaths,
        ...realEstateAssetLeafPaths, ...otherAssetLeafPaths,
        ...debtBreakdownLeafPaths,
      ],
      activeAssetArrayPaths
    );
    const annualIncomeMissing = allBlankLeaf(input, [
      'income.salary.monthly', 'income.salary.annualBonus', 'income.business.monthly',
      'spouse.salary.monthly', 'spouse.salary.annualBonus',
    ], ['income.regularIncomes']);
    const financialAssetsMissing = allBlankLeaf(
      input,
      [
        ...financialAssetLeafPaths,
        ...liquidAssetLeafPaths,
      ],
      [
        ...(input.assets?.financialAssets?.inputMode === 'simple' ? [] : ['assets.financialAssets.otherItems']),
        ...(input.assets?.liquidAssets?.inputMode === 'simple' ? [] : ['assets.liquidAssets.customItems']),
      ]
    );

    const peerComparison = buildPeerComparison({
      age: getCurrentAge(input),
      totalAssets: aggregates.totalAssets,
      totalDebt: aggregates.totalDebt,
      annualIncome: aggregates.annualIncome,
      financialAssetsTotal: aggregates.financialAssetsTotal + aggregates.liquidAssets,
      netWorthMissing,
      annualIncomeMissing,
      financialAssetsMissing,
    });

    // 리포트 렌더링에 필요한 게이지 위치·참고 범위 비교 문구·생활수준 구간 같은
    // "표시용 파생값"을 서버에서 미리 계산해 붙인다. 클라이언트는 이 값을 그대로 그리기만
    // 하면 되므로, 게이지 임계값·등급 커트라인 같은 기준 데이터가 클라이언트에 존재하지 않는다.
    const retirementLivingCost = simulation.retirementLivingCostNow;
    const enriched = enrichIndicators({ indicators, weakest, strongest, aggregates, retirementLivingCost, age: currentAge });
    const financialHealthInterpretation = buildFinancialHealthInterpretation(enriched.indicators);
    const enrichedSimulation = enrichSimulation(simulation, retirementLivingCost);
    const financialStatusFeedback = buildFinancialCashFlowFeedback({
      indicators: enriched.indicators,
      aggregates,
    });
    const financialPositionFeedback = buildExecutiveFinancialPositionFeedback({
      aggregates,
      indicators: enriched.indicators,
    });
    const savingsInvestmentFeedback = buildSavingsInvestmentFeedback({
      indicators: enriched.indicators,
      age: getCurrentAge(input),
    });
    const cashFlowOutlookFeedback = buildCashFlowOutlookFeedback({
      indicators: enriched.indicators,
      aggregates,
      simulation,
    });
    const peerComparisonFeedback = buildPeerComparisonFeedback({ peerComparison });
    const simpleSummary = buildSimpleSummary({ input, aggregates, simulation });
    const savingsBreakdown = buildSavingsBreakdown(input);
    const debtBreakdown = buildDebtBreakdown(input);
    // "현재 생활비 상세"의 기타지출, "현금성 자산"의 기타 항목 - 값은 이미 각 합계
    // (monthlyLivingCost/liquidAssets.total)에 포함되어 있으므로 여기서 다시 더하지 않는다.
    // 요약/리포트 화면에 항목명을 보여주기 위한 표시용 목록일 뿐이다(reportBreakdowns.js 참고).
    const otherLivingExpenseItems = buildOtherLivingExpenseItems(input);
    const livingExpenseItems = buildLivingExpenseItems(input);
    const otherLiquidAssetItems = buildOtherLiquidAssetItems(input);
    // 다운로드 전 웹 요약 화면(SimpleSummaryReport.jsx) 전용 파생값. 기존 필드(indicators/aggregates/
    // simulation/...)는 전혀 바뀌지 않으므로 PDF 리포트 렌더링에는 영향이 없다(하위호환 유지).
    const webSummary = buildWebSummary({
      input, aggregates, simulation: enrichedSimulation, indicators: enriched.indicators,
      savingsBreakdown, debtBreakdown, livingExpenseItems, otherLiquidAssetItems,
    });
    const executiveRetirementFeedback = buildExecutiveRetirementFeedback({
      simulation: enrichedSimulation,
      retirementAssetProjection: webSummary?.futureFinance?.retirementAssetProjection,
    });

    // 화면(요약/리포트)이 실제로 참조하지 않는 필드는 클라이언트 응답에 내려보내지 않는다.
    // 위 계산(enrichIndicators 등) 자체는 그대로 두고, 여기서 필요한 키만 뽑아낸다.
    // gauge/benchmark/recommendedLabel/guideline은 재무건강 8개 지표 심화 리포트(FhsDetailReport.jsx)가
    // 게이지·참고 범위 대비 설명에 그대로 사용한다. composition(지표별 구성 파이차트)은 어느
    // 화면도 아직 쓰지 않아 계속 제외한다.
    const clientIndicators = enriched.indicators.map(
      ({ composition: _composition, ...rest }) => rest
    );

    // 응답을 평문 JSON으로 그대로 내려보내지 않고 스크램블한다. F12 → Network 탭에서
    // 열어봤을 때 계산 기준표(임계값·공식·판정 사유 등)가 곧바로 읽히지 않도록 하기 위함이다.
    // 클라이언트(src/App.jsx)가 동일한 유틸로 즉시 복호화하므로 화면·계산 결과는 그대로다.
    const calculationResult = {
      generatedAt: new Date().toISOString(),
      summary: {
        notCalculable,
        missingInputs,
      },
      indicators: clientIndicators,
      financialHealthInterpretation,
      aggregates,
      simulation: enrichedSimulation,
      peerComparison,
      familyAges: buildFamilyAges(input),
      aiFeedback: {
        executiveSummary: {
          financialPosition: financialPositionFeedback,
          financialStatus: financialStatusFeedback,
          retirement: executiveRetirementFeedback,
        },
        financialStatus: {
          savingsInvestment: savingsInvestmentFeedback,
        },
        cashFlowOutlook: cashFlowOutlookFeedback,
        peerComparison: peerComparisonFeedback,
      },
      simpleSummary,
      savingsBreakdown,
      debtBreakdown,
      otherLivingExpenseItems,
      otherLiquidAssetItems,
      webSummary,
    };
    assertFiniteCalculationResult(calculationResult);
    const payload = obfuscate(calculationResult);

    res.status(200).json({ payload });
  } catch (err) {
    // 민감한 입력이나 전체 결과는 기록하지 않고 비민감 오류 코드만 남긴다.
    // eslint-disable-next-line no-console
    console.error('calculate error code:', err?.code || 'CALCULATION_FAILED');
    res.status(500).json({ error: '계산 중 오류가 발생했습니다.' });
  }
}
