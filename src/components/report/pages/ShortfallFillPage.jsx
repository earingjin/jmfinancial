import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import { formatWon } from '../../../utils/format';

export default function ShortfallFillPage({ simulation, aggregates: agg, retirementReadiness, pageNumber, totalPages }) {
  const byPerson = agg.retirementIncomeByPerson;
  const selfMonthlyIncome = byPerson.self.nationalPensionMonthly + byPerson.self.severancePensionMonthly + byPerson.self.personalPensionMonthly;
  const spouseMonthlyIncome = byPerson.spouse.nationalPensionMonthly + byPerson.spouse.severancePensionMonthly + byPerson.spouse.personalPensionMonthly;

  const goals = simulation.lifeGoals;
  const goalGap = goals.preparedAmount - goals.totalGoalAmount;

  return (
    <PageFrame eyebrow="Retirement Cash Flow" pageNumber={pageNumber} totalPages={totalPages}>
      <div className="shortfall-report-content">
      <SectionBadge number="5" label="노후 현금유입 및 생애재무목표" />

      <h4 className="num-section-title" style={{ fontSize: 14 }}><span className="num-badge">5-1</span>노후목표 생활비 대응을 위한 현금 유입 현황(가구)</h4>

      <h3 className="card-title" style={{ marginBottom: 8 }}>현재 총수입금액</h3>
      <table className="grade-table compact">
        <thead><tr><th>항목</th><th>본인</th><th>배우자</th></tr></thead>
        <tbody>
          <tr>
            <td>1. 퇴직 전 급여</td>
            <td className="num" colSpan={2}>{formatWon(agg.salaryMonthly)} (가구 합산)</td>
          </tr>
          <tr>
            <td>2. 퇴직금(일시금)</td>
            <td className="num">{formatWon(byPerson.self.severanceLumpsum)}</td>
            <td className="num">{formatWon(byPerson.spouse.severanceLumpsum)}</td>
          </tr>
          <tr>
            <td>3. 국민연금(월)</td>
            <td className="num">{formatWon(byPerson.self.nationalPensionMonthly)}</td>
            <td className="num">{formatWon(byPerson.spouse.nationalPensionMonthly)}</td>
          </tr>
          <tr>
            <td>4. 퇴직연금(월)</td>
            <td className="num">{formatWon(byPerson.self.severancePensionMonthly)}</td>
            <td className="num">{formatWon(byPerson.spouse.severancePensionMonthly)}</td>
          </tr>
          <tr>
            <td>5. 개인연금(월)</td>
            <td className="num">{formatWon(byPerson.self.personalPensionMonthly)}</td>
            <td className="num">{formatWon(byPerson.spouse.personalPensionMonthly)}</td>
          </tr>
          <tr>
            <td>6. 현금성자산</td>
            <td className="num" colSpan={2}>{formatWon(agg.liquidAssets)} (가구 합산)</td>
          </tr>
          <tr>
            <td>7. 기타수입(월)</td>
            <td className="num" colSpan={2}>{formatWon(agg.otherIncomeMonthly)} (가구 합산)</td>
          </tr>
          <tr className="total-row">
            <td>순자산</td>
            <td className="num" colSpan={2}>{formatWon(agg.netWorth)} (가구 합산)</td>
          </tr>
        </tbody>
      </table>
      <div className="fine-print" style={{ margin: '8px 0 16px' }}>
        국민연금 · 퇴직금(일시금) · 개인연금은 본인 · 배우자별로 입력된 값을 그대로 보여드립니다. 급여 · 현금성자산 ·
        기타수입 · 순자산은 가구 합산으로만 입력받아 본인 · 배우자로 나눠 표시하지 않습니다.
      </div>

      {retirementReadiness && !retirementReadiness.notCalculable && (
        <>
          <div className="report-retirement-income-strip">
            <div><span>노후 월 필요생활비</span><strong>{formatWon(retirementReadiness.monthlyIncomeCompare.livingCostMonthly)}</strong></div>
            <div><span>가구 월 연금합계</span><strong>{formatWon(selfMonthlyIncome + spouseMonthlyIncome)}</strong></div>
            <div><span>월 부족액</span><strong className="is-shortfall">{formatWon(retirementReadiness.monthlyIncomeCompare.shortfallMonthly)}</strong></div>
            <div><span>연금소득 기준 충당률</span><strong>{retirementReadiness.retirementIncomeIndicator?.notCalculable ? '산출 불가' : `${retirementReadiness.retirementIncomeIndicator?.displayValue ?? retirementReadiness.retirementIncomeIndicator?.value}%`}</strong></div>
          </div>
          <p className="fine-print" style={{ margin: '6px 0 0' }}>
            연금소득 기준 충당률 = 월 예상 노후소득 ÷ 은퇴 후 월 필요생활비 × 100 (전체 자산이 아닌 연금소득만으로 생활비를 얼마나 충당하는지를 나타냅니다)
            {!retirementReadiness.retirementIncomeIndicator?.notCalculable && retirementReadiness.retirementIncomeIndicator?.value === 0
              && ` — ${retirementReadiness.retirementIncomeZeroReason || '월 수령 방식으로 입력된 노후 연금액이 없어 0%입니다.'}`}
          </p>
        </>
      )}

      {retirementReadiness?.incomeGap && !retirementReadiness.incomeGap.notCalculable && (
        <div className="report-income-gap-box">
          <strong>정년 이후 국민연금 수령 전 소득공백</strong>
          <span>{retirementReadiness.retirementAge}세 은퇴 → {retirementReadiness.incomeGap.nationalPensionStartAge}세 국민연금 개시</span>
          <span>공백기간 연 필요금액 {formatWon(retirementReadiness.incomeGap.annualGapCost)} × {retirementReadiness.incomeGap.gapYears}년 = 총 {formatWon(retirementReadiness.incomeGap.totalGapFundingNeeded)}</span>
        </div>
      )}

      <h4 className="num-section-title" style={{ fontSize: 14 }}><span className="num-badge">5-2</span>생애재무목표</h4>
      <div className="cost-table-grid" style={{ marginTop: 10 }}>
        <table className="grade-table compact">
          <thead><tr><th>재무목표</th><th>필요자금</th></tr></thead>
          <tbody>
            <tr><td>자녀결혼 지원</td><td className="num">{formatWon(goals.byCategory.marriageSupport)}</td></tr>
            <tr><td>자녀교육비</td><td className="num">{formatWon(goals.byCategory.education)}</td></tr>
            <tr><td>기타</td><td className="num">{formatWon(goals.byCategory.other)}</td></tr>
            <tr className="total-row"><td>가구합계</td><td className="num">{formatWon(goals.totalGoalAmount)}</td></tr>
          </tbody>
        </table>
        <table className="grade-table compact">
          <thead><tr><th>소계</th><th>금액</th></tr></thead>
          <tbody>
            <tr><td>총 필요한 자금</td><td className="num">{formatWon(goals.totalGoalAmount)}</td></tr>
            <tr><td>현재 준비된 자금</td><td className="num">{formatWon(goals.preparedAmount)}</td></tr>
            <tr className="total-row">
              <td>계</td>
              <td className="num">
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
      </div>
    </PageFrame>
  );
}
