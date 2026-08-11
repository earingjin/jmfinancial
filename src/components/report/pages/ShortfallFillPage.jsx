import PageFrame from './PageFrame';
import { formatWon, round1 } from '../../../utils/format';

export default function ShortfallFillPage({ simulation, aggregates: agg, pageNumber, totalPages }) {
  const byPerson = agg.retirementIncomeByPerson;
  const selfMonthlyIncome = byPerson.self.nationalPensionMonthly + byPerson.self.personalPensionMonthly;
  const spouseMonthlyIncome = byPerson.spouse.nationalPensionMonthly + byPerson.spouse.personalPensionMonthly;

  const goals = simulation.lifeGoals;
  const goalGap = goals.preparedAmount - goals.totalGoalAmount;

  return (
    <PageFrame eyebrow="Retirement Cash Flow" pageNumber={pageNumber} totalPages={totalPages}>
      <h3 className="num-section-title"><span className="num-badge">2</span>PART2_은퇴자산</h3>

      <div className="cashflow-info-heading-row" style={{ marginBottom: 16 }}>
        <h4 className="num-section-title" style={{ fontSize: 14, marginBottom: 0 }}><span className="num-badge">1</span>노후목표 생활비 대응을 위한 현금 유입 현황(가구)</h4>
        <div className="cashflow-info-box">
          <div className="cashflow-info-row"><span>향후 노후 생활 기간</span><span className="num">{round1(simulation.retirementYears)}년</span></div>
          <div className="cashflow-info-row"><span>월평균 지출비용</span><span className="num">{formatWon(simulation.retirementLivingCostNow)}</span></div>
        </div>
      </div>

      <h3 className="card-title" style={{ marginBottom: 8 }}>현재 총수입금액</h3>
      <table className="grade-table compact">
        <thead><tr><th>항목</th><th style={{ textAlign: 'right' }}>본인</th><th style={{ textAlign: 'right' }}>배우자</th></tr></thead>
        <tbody>
          <tr>
            <td>1. 퇴직 전 급여</td>
            <td className="num" colSpan={2} style={{ textAlign: 'right' }}>{formatWon(agg.salaryMonthly)} (가구 합산)</td>
          </tr>
          <tr>
            <td>2. 퇴직금(일시금)</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(byPerson.self.severanceLumpsum)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(byPerson.spouse.severanceLumpsum)}</td>
          </tr>
          <tr>
            <td>3. 국민연금(월)</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(byPerson.self.nationalPensionMonthly)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(byPerson.spouse.nationalPensionMonthly)}</td>
          </tr>
          <tr>
            <td>4. 개인연금(월)</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(byPerson.self.personalPensionMonthly)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(byPerson.spouse.personalPensionMonthly)}</td>
          </tr>
          <tr>
            <td>5. 현금성자산</td>
            <td className="num" colSpan={2} style={{ textAlign: 'right' }}>{formatWon(agg.liquidAssets)} (가구 합산)</td>
          </tr>
          <tr>
            <td>6. 기타수입(월)</td>
            <td className="num" colSpan={2} style={{ textAlign: 'right' }}>{formatWon(agg.otherIncomeMonthly)} (가구 합산)</td>
          </tr>
          <tr className="total-row">
            <td>순자산</td>
            <td className="num" colSpan={2} style={{ textAlign: 'right' }}>{formatWon(agg.netWorth)} (가구 합산)</td>
          </tr>
        </tbody>
      </table>
      <div className="fine-print" style={{ margin: '8px 0 16px' }}>
        국민연금 · 퇴직금(일시금) · 개인연금은 본인 · 배우자별로 입력된 값을 그대로 보여드립니다. 급여 · 현금성자산 ·
        기타수입 · 순자산은 가구 합산으로만 입력받아 본인 · 배우자로 나눠 표시하지 않습니다.
      </div>

      <div className="summary-card-grid" style={{ marginBottom: 20 }}>
        <div className="summary-card">
          <div className="summary-card-title">나의 총수입금액</div>
          <div className="summary-card-row"><span>월 수입 합계(국민연금+개인연금)</span><span className="num">{formatWon(selfMonthlyIncome)}</span></div>
          <div className="summary-card-row total"><span>퇴직금(일시금)</span><span className="num">{formatWon(byPerson.self.severanceLumpsum)}</span></div>
        </div>
        <div className="summary-card">
          <div className="summary-card-title">배우자의 총수입금액</div>
          <div className="summary-card-row"><span>월 수입 합계(국민연금+개인연금)</span><span className="num">{formatWon(spouseMonthlyIncome)}</span></div>
          <div className="summary-card-row total"><span>퇴직금(일시금)</span><span className="num">{formatWon(byPerson.spouse.severanceLumpsum)}</span></div>
        </div>
      </div>

      <h4 className="num-section-title" style={{ fontSize: 14 }}><span className="num-badge">2</span>생애재무목표</h4>
      <div className="cost-table-grid" style={{ marginTop: 10 }}>
        <table className="grade-table compact">
          <thead><tr><th>재무목표</th><th style={{ textAlign: 'right' }}>필요자금</th></tr></thead>
          <tbody>
            <tr><td>자녀결혼 지원</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(goals.byCategory.marriageSupport)}</td></tr>
            <tr><td>자녀교육비</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(goals.byCategory.education)}</td></tr>
            <tr><td>기타</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(goals.byCategory.other)}</td></tr>
            <tr className="total-row"><td>가구합계</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(goals.totalGoalAmount)}</td></tr>
          </tbody>
        </table>
        <table className="grade-table compact">
          <thead><tr><th>소계</th><th style={{ textAlign: 'right' }}>금액</th></tr></thead>
          <tbody>
            <tr><td>총 필요한 자금</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(goals.totalGoalAmount)}</td></tr>
            <tr><td>현재 준비된 자금</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(goals.preparedAmount)}</td></tr>
            <tr className="total-row">
              <td>계</td>
              <td className="num" style={{ textAlign: 'right' }}>
                {goalGap >= 0 ? `+${formatWon(goalGap)}` : `-${formatWon(-goalGap)}`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="fine-print" style={{ marginTop: 8 }}>
        &apos;자녀결혼 지원 · 자녀교육비 · 기타&apos;는 자녀별로 입력하신 생애 목돈 지출 항목의 합계이며, &apos;계&apos;가 양수이면 준비된
        자금이 필요자금보다 여유가 있고, 음수이면 그만큼 부족하다는 뜻입니다.
      </div>
    </PageFrame>
  );
}
