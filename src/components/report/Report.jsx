import CoverPage from './pages/CoverPage';
import ExecutiveSummaryPage from './pages/ExecutiveSummaryPage';
import PART1FinancialStatusPage from './pages/PART1FinancialStatusPage';
import HouseholdDetailPage from './pages/HouseholdDetailPage';
import CashFlowOutlookPage from './pages/CashFlowOutlookPage';
import ShortfallFillPage from './pages/ShortfallFillPage';
import AssetManagementOptionsPage from './pages/AssetManagementOptionsPage';
import BackCoverPage from './pages/BackCoverPage';
import FutureFinanceReportPage from './pages/FutureFinanceReportPage';
import FiveYearOutlookReportPage from './pages/FiveYearOutlookReportPage';
import FinancialCompositionReportPage from './pages/FinancialCompositionReportPage';

const SHOW_RESPONSE_CONTENT = false;

export default function Report({ result, onRestart, onBack, clientName, scenariosInput }) {
  const {
    generatedAt, indicators, aggregates, simulation, scenarioComparison, peerComparison, familyAges,
    savingsBreakdown, debtBreakdown, otherLivingExpenseItems, otherLiquidAssetItems, webSummary,
  } = result;
  // AI가 작성할 리포트 피드백 문구를 담을 자리. 아직 생성 API와 연결되지 않아 항상 비어 있으며,
  // 값이 없으면 각 페이지가 자체적으로 "준비 중" placeholder를 보여준다(AIFeedbackBox 참고).
  const aiFeedback = result.aiFeedback || {};
  const hasComposition = !!webSummary?.donuts;
  const hasFutureFinance = (webSummary?.futureFinance?.targets?.length || 0) > 0;
  const hasFiveYearOutlook = (webSummary?.futureFinance?.fiveYearOutlook?.length || 0) > 0;
  const totalPages = 7 + Number(SHOW_RESPONSE_CONTENT) + Number(hasComposition) + Number(hasFutureFinance) + Number(hasFiveYearOutlook);

  let page = 1;
  const nextPage = () => ++page;
  const openPrintDialog = () => window.print();

  return (
    <div>
      <div className="report-actions no-print" aria-label="보고서 작업">
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← 뒤로가기
        </button>
        <button type="button" className="btn-primary" onClick={openPrintDialog}>
          PDF로 저장
        </button>
        <button type="button" className="btn-secondary" onClick={openPrintDialog}>
          인쇄
        </button>
        <button type="button" className="btn-secondary" onClick={onRestart}>
          다시 입력하기
        </button>
        <p className="report-actions-hint">
          PDF로 저장하려면 인쇄 창의 프린터에서 ‘PDF로 저장’을 선택하세요.
        </p>
      </div>

      <CoverPage generatedAt={generatedAt} clientName={clientName} />

      <ExecutiveSummaryPage
        simulation={simulation}
        aggregates={aggregates}
        familyAges={familyAges}
        retirementReadiness={webSummary?.retirementReadiness}
        feedback={aiFeedback.executiveSummary}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />

      <PART1FinancialStatusPage
        aggregates={aggregates}
        savingsBreakdown={savingsBreakdown}
        overviewDetail={webSummary?.overviewDetail}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />

      {hasComposition && <FinancialCompositionReportPage
        donuts={webSummary?.donuts}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />}

      <HouseholdDetailPage
        aggregates={aggregates}
        indicators={indicators}
        peerComparison={peerComparison}
        debtBreakdown={debtBreakdown}
        otherLivingExpenseItems={otherLivingExpenseItems}
        otherLiquidAssetItems={otherLiquidAssetItems}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />

      <CashFlowOutlookPage
        aggregates={aggregates}
        simulation={simulation}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />

      <ShortfallFillPage
        simulation={simulation}
        aggregates={aggregates}
        retirementReadiness={webSummary?.retirementReadiness}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />

      {hasFutureFinance && <FutureFinanceReportPage
        futureFinance={webSummary?.futureFinance}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />}

      {hasFiveYearOutlook && <FiveYearOutlookReportPage
        futureFinance={webSummary?.futureFinance}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />}

      {SHOW_RESPONSE_CONTENT && <AssetManagementOptionsPage
        scenariosInput={scenariosInput}
        scenarioComparison={scenarioComparison}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />}

      <BackCoverPage generatedAt={generatedAt} />
    </div>
  );
}
