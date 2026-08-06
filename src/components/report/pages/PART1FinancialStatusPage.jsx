import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import FinanceBarChart from './FinanceBarChart';
import { formatWon } from '../../../utils/format';

export default function PART1FinancialStatusPage({ aggregates: agg, savingsBreakdown, pageNumber, totalPages }) {
  const assetBars = [
    { label: '자산', value: agg.totalAssets, color: 'var(--navy-700)' },
    { label: '부채', value: agg.totalDebt, color: 'var(--red)' },
    { label: '순자산', value: agg.netWorth, color: 'var(--teal)' },
  ];
  const cashFlowBars = [
    { label: '수입', value: agg.householdMonthlyIncomeTotal, color: 'var(--navy-700)' },
    { label: '지출', value: agg.totalExpenseMonthlyExSavings, color: 'var(--red)' },
    { label: '순저축액', value: agg.monthlySavings, color: 'var(--teal)' },
  ];

  const savingsRows = savingsBreakdown || [];
  const hasSavingsBreakdown = savingsRows.length > 0;
  const SAVINGS_CHART_COLORS = ['var(--navy-700)', 'var(--teal)', 'var(--gold)', 'var(--navy-600)', 'var(--amber)', 'var(--navy-800)', 'var(--teal-soft)', 'var(--red)'];
  const savingsBars = savingsRows.map((item, i) => ({
    label: item.label,
    value: item.value,
    color: SAVINGS_CHART_COLORS[i % SAVINGS_CHART_COLORS.length],
  }));

  return (
    <PageFrame eyebrow="Household Cash Flow" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="2" label="PART1_재무현황" />

      <h3 className="card-title" style={{ marginBottom: 10 }}>■ 요약 재무현황</h3>
      <div className="finance-summary-grid">
        <div>
          <table className="grade-table compact">
            <thead><tr><th colSpan={2}>[ 재무상태표 ]</th></tr></thead>
            <tbody>
              <tr><td>자 산</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.totalAssets)}</td></tr>
              <tr><td>부 채</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.totalDebt)}</td></tr>
              <tr className="total-row"><td>순 자 산</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.netWorth)}</td></tr>
            </tbody>
          </table>
          <FinanceBarChart bars={assetBars} tickStep={50000} />
        </div>
        <div>
          <table className="grade-table compact">
            <thead><tr><th colSpan={2}>[ 현금흐름표 ]</th></tr></thead>
            <tbody>
              <tr><td>수 입</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.householdMonthlyIncomeTotal)}</td></tr>
              <tr><td>지 출</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.totalExpenseMonthlyExSavings)}</td></tr>
              <tr className="total-row"><td>순저축액</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.monthlySavings)}</td></tr>
            </tbody>
          </table>
          <FinanceBarChart bars={cashFlowBars} tickStep={500} zeroLabel="-" />
        </div>
      </div>
      <div className="fine-print" style={{ margin: '10px 0 4px' }}>(단위: 만원, 월평균 기준)</div>

      <h3 className="card-title" style={{ margin: '18px 0 6px' }}>① 수입 현황 (월평균, 만원)</h3>
      <table className="grade-table compact">
        <thead><tr><th>항목</th><th style={{ textAlign: 'right' }}>금액</th></tr></thead>
        <tbody>
          <tr><td>급여</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.salaryMonthly)}</td></tr>
          <tr><td>사업소득</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.businessMonthly)}</td></tr>
          <tr>
            <td>국민연금 · 퇴직연금 · 개인연금</td>
            <td className="num" style={{ textAlign: 'right' }}>
              {formatWon(agg.monthlyRetirementIncome)}
              {agg.monthlyRetirementIncome === 0 && <span style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}> (미수령)</span>}
            </td>
          </tr>
          <tr><td>기타(임대소득 · 배당금 등)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.otherIncomeMonthly)}</td></tr>
          <tr className="total-row"><td>가구 합계(월평균)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.householdMonthlyIncomeTotal)}</td></tr>
          <tr><td>가구 합계(연평균)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.householdMonthlyIncomeTotal * 12)}</td></tr>
        </tbody>
      </table>
      <div className="indicator-feedback" style={{ marginBottom: 8 }}>
        귀하의 월평균 수입은 {formatWon(agg.monthlyIncome)}이고, 연간 수입은 {formatWon(agg.annualIncome)}입니다.
        이 금액은 가계수지지표 · 총저축성향지표 산출의 기준(총소득)으로 활용됩니다.
      </div>

      <h3 className="card-title" style={{ margin: '18px 0 6px' }}>② 저축 / 투자 현황 (월평균, 만원)</h3>
      <table className="grade-table compact">
        <thead><tr><th>항목</th><th style={{ textAlign: 'right' }}>금액</th></tr></thead>
        <tbody>
          {hasSavingsBreakdown ? (
            savingsRows.map((item) => (
              <tr key={item.key}><td>{item.label}</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(item.value)}</td></tr>
            ))
          ) : (
            <tr><td>저축 · 투자액</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.monthlySavings)}</td></tr>
          )}
          {hasSavingsBreakdown && (
            <tr className="total-row"><td>저축 · 투자액 합계(월평균)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.monthlySavings)}</td></tr>
          )}
          <tr>
            <td>
              (노후목적) 연 저축액
              <span style={{ color: 'var(--ink-soft)', fontSize: 10.5 }}>
                {agg.retirementIncludedInSavings ? ' (위 합계에 포함된 금액)' : ' (위 합계에 별도로 합산된 금액)'}
              </span>
            </td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.retirementSavingsAnnual)}</td>
          </tr>
        </tbody>
      </table>
      {hasSavingsBreakdown && <FinanceBarChart bars={savingsBars} zeroLabel="-" />}
      <div className="fine-print" style={{ marginBottom: 8 }}>
        저축 · 투자액 {formatWon(agg.monthlySavings)}은 소멸성 지출이 아닌 자산증가로 분류되어, 가계수지지표 계산 시 총지출에서 제외되고 총저축성향지표 계산에 활용됩니다.
      </div>
    </PageFrame>
  );
}
