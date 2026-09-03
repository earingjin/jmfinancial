import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import { formatWon } from '../../../utils/format';

export default function PART1FinancialStatusPage({ aggregates: agg, savingsBreakdown, overviewDetail, savingsInvestmentFeedback, pageNumber, totalPages }) {
  const savingsRows = savingsBreakdown || [];
  const hasSavingsBreakdown = savingsRows.length > 0;
  // 국민연금 가입기간 판정이 'unknown'(향후 납부 계속 여부 미확정)이면 agg.monthlyRetirementIncome은
  // 해당 인물의 국민연금을 0원으로 포함한 값이다 - "미수령 확정"이 아니므로 그대로 보여주지 않는다.
  const nationalPensionUnknown = agg.nationalPensionEligibility?.self === 'unknown'
    || agg.nationalPensionEligibility?.spouse === 'unknown';

  return (
    <PageFrame eyebrow="Household Cash Flow" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="1" label="재무현황 세부내역" />
      <p className="intro-text report-compact-intro">현재 가구의 월 소득원과 저축·투자 항목을 구분해 보여드립니다.</p>

      <div className="report-income-savings-layout">
      <section className="report-detail-panel">
      <h3 className="card-title">① 수입 현황 <small>(월평균, 만원)</small></h3>
      <table className="grade-table compact">
        <thead><tr><th>항목</th><th>금액</th></tr></thead>
        <tbody>
          {overviewDetail?.income?.salaryItems?.length ? overviewDetail.income.salaryItems.map((item) => (
            <tr key={item.key}><td>{item.label}</td><td className="num">{formatWon(item.value)}</td></tr>
          )) : <tr><td>급여</td><td className="num">{formatWon(agg.salaryMonthly)}</td></tr>}
          <tr><td>사업소득</td><td className="num">{formatWon(agg.businessMonthly)}</td></tr>
          <tr>
            <td>국민연금 · 퇴직연금 · 개인연금</td>
            <td className="num">
              {nationalPensionUnknown ? (
                <>확인 필요<span style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}> (국민연금 향후 가입 여부 미확정)</span></>
              ) : (
                <>
                  {formatWon(agg.monthlyRetirementIncome)}
                  {agg.monthlyRetirementIncome === 0 && <span style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}> (미수령)</span>}
                </>
              )}
            </td>
          </tr>
          <tr><td>기타(임대소득 · 배당금 등)</td><td className="num">{formatWon(agg.otherIncomeMonthly)}</td></tr>
          <tr className="total-row">
            <td>가구 합계(월평균)</td>
            <td className="num">
              {formatWon(agg.householdMonthlyIncomeTotal)}
              {nationalPensionUnknown && <span style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}> (국민연금 미확정분 제외)</span>}
            </td>
          </tr>
          <tr>
            <td>가구 합계(연평균)</td>
            <td className="num">
              {formatWon(agg.householdMonthlyIncomeTotal * 12)}
              {nationalPensionUnknown && <span style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}> (국민연금 미확정분 제외)</span>}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="indicator-feedback" style={{ marginBottom: 8 }}>
        귀하의 월평균 수입은 {formatWon(agg.monthlyIncome)}이고, 연간 수입은 {formatWon(agg.annualIncome)}입니다.
        이 금액은 소득에 비해 지출과 저축이 어느 정도인지 확인하는 기준으로 사용됩니다.
      </div>
      </section>

      <section className="report-detail-panel">
      <h3 className="card-title">② 저축 / 투자 현황 <small>(월평균, 만원)</small></h3>
      <table className="grade-table compact">
        <thead><tr><th>항목</th><th>금액</th></tr></thead>
        <tbody>
          {hasSavingsBreakdown ? (
            savingsRows.map((item) => (
              <tr key={item.key}><td>{item.label}</td><td className="num">{formatWon(item.value)}</td></tr>
            ))
          ) : (
            <tr><td>저축 · 투자액</td><td className="num">{formatWon(agg.monthlySavings)}</td></tr>
          )}
          {hasSavingsBreakdown && (
            <tr className="total-row"><td>저축 · 투자액 합계(월평균)</td><td className="num">{formatWon(agg.monthlySavings)}</td></tr>
          )}
          <tr>
            <td>
              (노후목적) 연 저축액
              <span style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}>
                {agg.retirementIncludedInSavings
                  ? ' (월 환산액이 위 저축·투자액 합계(월평균)에 포함됨)'
                  : ' (월 환산액이 위 저축·투자액 합계(월평균)와 별도로 합산됨)'}
              </span>
            </td>
            <td className="num">{formatWon(agg.retirementSavingsAnnual)}</td>
          </tr>
        </tbody>
      </table>
      <div className="indicator-feedback" style={{ marginBottom: 8 }}>
        저축 · 투자액 {formatWon(agg.monthlySavings)}은 생활비처럼 소비되는 돈이 아니라 자산을 늘리는 금액으로 봅니다.
        따라서 월 지출에는 포함하지 않고, 소득 중 얼마를 저축하고 있는지 확인할 때 사용합니다.
      </div>
      </section>
      </div>

      <section className="report-savings-rate-feedback">
        <strong>수입 대비 저축·투자 비율</strong>
        <p>{savingsInvestmentFeedback || '소득과 저축 정보를 다시 확인하면 저축·투자 비율에 대한 안내를 확인할 수 있습니다.'}</p>
      </section>

      <section className="report-key-note" aria-label="사용자 메모 영역">
        <div className="report-key-note-heading">
          <strong>KEY NOTE</strong>
          <span>수입과 저축 현황을 확인하며 기억할 내용이나 실천 계획을 기록해 보세요.</span>
        </div>
        <div className="report-key-note-space" aria-hidden="true" />
      </section>
    </PageFrame>
  );
}
