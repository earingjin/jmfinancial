import PageFrame from './PageFrame';
import AIFeedbackBox from './AIFeedbackBox';
import { formatWon, round1 } from '../../../utils/format';

// 카드별 등급(우수/양호/보통/위험) 판정 기준은 아직 정의되어 있지 않아 자리표시자("-")로 남겨둔다.
// 실제 판정 로직이 마련되면 이 자리에 값을 채워 넣는다.
const RATING_PLACEHOLDER = '-';

export default function ExecutiveSummaryPage({ simulation, aggregates: agg, familyAges, feedback, pageNumber, totalPages }) {
  const retirementAge = simulation.currentAge + simulation.yearsToRetirement;
  const retirementEndAge = round1(retirementAge + simulation.retirementYears);
  const retirementStatus = simulation.shortfall > 0 ? '부족' : '적정';
  const fb = feedback || {};

  return (
    <PageFrame eyebrow="Executive Summary" title="핵심 이슈 & 종합 결과" pageNumber={pageNumber} totalPages={totalPages}>
      <p className="intro-text" style={{ marginBottom: 10 }}>
        본 보고서는 입력한 현재 재무 현황을 바탕으로 작성되었습니다. 안정적인 자산관리를 위해 현금흐름을
        쉽게 파악할 수 있도록 종합 정리하여 드립니다. 이를 참고하여 우리집의 투명한 자산계획과 관리를 이어나가시길 바랍니다.
      </p>

      <h3 className="num-section-title"><span className="num-badge">1</span>고객정보</h3>
      <table className="grade-table" style={{ marginBottom: 8 }}>
        <thead>
          <tr><th>구분</th><th>연령</th><th>은퇴(예정)연령</th><th>기대여명</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>본인</td>
            <td className="num">{familyAges.self.age ? `${familyAges.self.age}세` : '-'}</td>
            <td className="num">{retirementAge ? `${retirementAge}세` : '-'}</td>
            <td className="num">{retirementEndAge ? `${retirementEndAge}세` : '-'}</td>
          </tr>
          <tr>
            <td>배우자</td>
            <td className="num">{familyAges.spouse?.age != null ? `${familyAges.spouse.age}세` : '-'}</td>
            <td>-</td>
            <td>-</td>
          </tr>
          {/* 자녀를 입력하지 않았으면 빈 "자녀1/2/3" 행을 만들지 않는다 - 실제로 입력된 자녀 수만큼만 표시 */}
          {familyAges.children.map((child, i) => (
            <tr key={i}>
              <td>자녀{i + 1}</td>
              <td className="num">{child?.age != null ? `${child.age}세` : '-'}</td>
              <td>-</td>
              <td>-</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="num-section-title executive-results-title"><span className="num-badge">2</span>결과요약</h3>

      <div className="subsection-head" style={{ fontSize: 14, margin: '4px 0 6px' }}>PART1 재무</div>
      <div className="summary-card-grid" style={{ marginBottom: 6 }}>
        <div className="summary-card">
          <div className="summary-card-title-row">
            <span className="summary-card-title">재무상태요약</span>
            <span className="summary-card-rating">{RATING_PLACEHOLDER}</span>
          </div>
          <div className="summary-card-row"><span>자 산</span><span className="num">{formatWon(agg.totalAssets)}</span></div>
          <div className="summary-card-row"><span>부 채</span><span className="num">{formatWon(agg.totalDebt)}</span></div>
          <div className="summary-card-row total"><span>순자산</span><span className="num">{formatWon(agg.netWorth)}</span></div>
        </div>
        <div className="summary-card">
          <div className="summary-card-title-row">
            <span className="summary-card-title">현금흐름표</span>
            <span className="summary-card-rating">{RATING_PLACEHOLDER}</span>
          </div>
          <div className="summary-card-row"><span>수 입</span><span className="num">{formatWon(agg.householdMonthlyIncomeTotal)}</span></div>
          <div className="summary-card-row"><span>지 출</span><span className="num">{formatWon(agg.totalExpenseMonthlyExSavings)}</span></div>
          <div className="summary-card-row total"><span>순저축액</span><span className="num">{formatWon(agg.monthlySavings)}</span></div>
        </div>
      </div>
      <div className="executive-feedback" style={{ marginBottom: 8 }}>
        <AIFeedbackBox text={fb.financialStatus} />
      </div>

      <div className="subsection-head" style={{ fontSize: 14, margin: '4px 0 6px' }}>PART2 노후</div>
      <div className="summary-card-grid" style={{ marginBottom: 6 }}>
        <div className="summary-card">
          <div className="summary-card-title-row">
            <span className="summary-card-title">은퇴생활비 현금흐름점검</span>
            <span className="summary-card-rating">{RATING_PLACEHOLDER}</span>
          </div>
          <div className="summary-card-row"><span>노후기간</span><span className="num">{round1(simulation.retirementYears)}년</span></div>
          <div className="summary-card-row total"><span>적정상태</span><span className="num" style={{ color: simulation.shortfall > 0 ? 'var(--red)' : 'var(--teal)' }}>{retirementStatus}</span></div>
        </div>
        <div className="summary-card">
          <div className="summary-card-title-row">
            <span className="summary-card-title">은퇴재무목표 마련점검</span>
            <span className="summary-card-rating">{RATING_PLACEHOLDER}</span>
          </div>
          <div className="summary-card-row"><span>월평균 지출</span><span className="num">{formatWon(simulation.retirementLivingCostNow)}</span></div>
          <div className="summary-card-row total"><span>자산소진</span><span className="num">산출 불가</span></div>
        </div>
      </div>
      <div className="executive-feedback">
        <AIFeedbackBox text={fb.retirementCashFlow} />
      </div>
    </PageFrame>
  );
}
