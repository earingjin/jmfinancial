import CoverPage from './pages/CoverPage';
import ExecutiveSummaryPage from './pages/ExecutiveSummaryPage';
import PART1FinancialStatusPage from './pages/PART1FinancialStatusPage';
import HouseholdDetailPage from './pages/HouseholdDetailPage';
import CashFlowOutlookPage from './pages/CashFlowOutlookPage';
import ShortfallFillPage from './pages/ShortfallFillPage';
import ConclusionPage from './pages/ConclusionPage';
import AssetManagementOptionsPage from './pages/AssetManagementOptionsPage';
import BackCoverPage from './pages/BackCoverPage';

const TOTAL_PAGES = 9;

export default function Report({ result, onRestart, onBack, clientName, scenariosInput }) {
  const {
    generatedAt, summary, indicators, aggregates, simulation, scenarioComparison, peerComparison, familyAges,
    savingsBreakdown, debtBreakdown, otherLivingExpenseItems, otherLiquidAssetItems,
  } = result;
  // AI가 작성할 리포트 피드백 문구를 담을 자리. 아직 생성 API와 연결되지 않아 항상 비어 있으며,
  // 값이 없으면 각 페이지가 자체적으로 "준비 중" placeholder를 보여준다(AIFeedbackBox 참고).
  const aiFeedback = result.aiFeedback || {};

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
        feedback={aiFeedback.executiveSummary}
        pageNumber={nextPage()}
        totalPages={TOTAL_PAGES}
      />

      <PART1FinancialStatusPage
        aggregates={aggregates}
        savingsBreakdown={savingsBreakdown}
        pageNumber={nextPage()}
        totalPages={TOTAL_PAGES}
      />

      <HouseholdDetailPage
        aggregates={aggregates}
        indicators={indicators}
        peerComparison={peerComparison}
        debtBreakdown={debtBreakdown}
        otherLivingExpenseItems={otherLivingExpenseItems}
        otherLiquidAssetItems={otherLiquidAssetItems}
        pageNumber={nextPage()}
        totalPages={TOTAL_PAGES}
      />

      <CashFlowOutlookPage
        aggregates={aggregates}
        simulation={simulation}
        pageNumber={nextPage()}
        totalPages={TOTAL_PAGES}
      />

      <ShortfallFillPage
        simulation={simulation}
        aggregates={aggregates}
        pageNumber={nextPage()}
        totalPages={TOTAL_PAGES}
      />

      <ConclusionPage
        summary={summary}
        simulation={simulation}
        scenarioComparison={scenarioComparison}
        indicators={indicators}
        goalFeedback={aiFeedback.financialGoals}
        feedback={aiFeedback.conclusion}
        pageNumber={nextPage()}
        totalPages={TOTAL_PAGES}
      />

      <AssetManagementOptionsPage
        scenariosInput={scenariosInput}
        scenarioComparison={scenarioComparison}
        pageNumber={nextPage()}
        totalPages={TOTAL_PAGES}
      />

      <BackCoverPage generatedAt={generatedAt} />
    </div>
  );
}
