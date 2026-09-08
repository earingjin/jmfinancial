import OnePageSummaryReportPage from './pages/OnePageSummaryReportPage';

export default function SummaryReport({ result, onBack, onHome, clientName }) {
  const openPrintDialog = () => window.print();

  return (
    <div className="one-page-summary-report">
      <div className="report-actions no-print" aria-label="요약 리포트 작업">
        <button type="button" className="btn-secondary" onClick={onBack}>← 결과 화면으로</button>
        <button type="button" className="btn-primary" onClick={openPrintDialog}>PDF로 저장</button>
        <button type="button" className="btn-secondary" onClick={onHome}>홈 화면으로 가기</button>
        <p className="report-actions-hint">PDF로 저장하려면 인쇄 창의 프린터에서 ‘PDF로 저장’을 선택하세요.</p>
      </div>

      <OnePageSummaryReportPage result={result} clientName={clientName} />
    </div>
  );
}
