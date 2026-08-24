import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import AIFeedbackBox from './AIFeedbackBox';
import { formatWon, formatPercent } from '../../../utils/format';

const SCENARIO_LABELS = {
  reverseMortgage: '① 주택연금 전환',
  realEstateConversion: '② 부동산 자금 전환',
  expenseReduction: '③ 지출 줄이기',
  additionalIncome: '④ 추가 수입원 모색',
};

export default function ConclusionPage({ summary, simulation, scenarioComparison, indicators, goalFeedback, feedback, showResponseContent = true, pageNumber, totalPages }) {
  const { totalScore, grade, notCalculable } = summary;
  const { shortfall, readyAssetsAtRetirement } = simulation;
  const { totalGoalAmount, preparedAmount } = simulation.lifeGoals;
  const { applied, before, after, notes } = scenarioComparison;

  const household = indicators.find((i) => i.key === 'household');
  const savingsRate = indicators.find((i) => i.key === 'savingsRate');
  const financialAssetRatio = indicators.find((i) => i.key === 'financialAssetRatio');
  const retirementIncome = indicators.find((i) => i.key === 'retirementIncome');
  const incomeGap = retirementIncome && !retirementIncome.notCalculable
    ? Math.max(0, Math.round((100 - retirementIncome.value) * 10) / 10)
    : null;

  return (
    <PageFrame eyebrow="Conclusion" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="3" label={showResponseContent ? '종합의견 및 대응' : '종합의견'} />
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
        {notCalculable
          ? `일부 지표를 산출할 수 없어 종합 재무건전성 점수를 계산할 수 없습니다.${showResponseContent ? ' 아래 방안은 산출 가능한 지표를 기준으로 참고해 주세요.' : ''}`
          : <>귀하는 현재 재무건전성(FHS {totalScore}점, {grade.letter}등급) 측면에서 {grade.label} 수준입니다.{showResponseContent && ' 아래 방안을 검토해보시길 권해드립니다.'}</>}
      </p>

      <table className="grade-table">
        <thead><tr><th>재무목표</th><th>필요자금</th><th>준비 가능 자산</th>{showResponseContent && <th>대응 방안</th>}</tr></thead>
        <tbody>
          <tr>
            <td>노후생활비 부족분</td>
            <td className="num">{formatWon(shortfall)}</td>
            <td className="num">{formatWon(readyAssetsAtRetirement)}</td>
            {showResponseContent && <td>IRP · 연금저축 추가납입</td>}
          </tr>
          <tr>
            <td>생애지출(자녀 교육 · 결혼자금)</td>
            <td className="num">{formatWon(totalGoalAmount)}</td>
            <td className="num">{formatWon(preparedAmount)}</td>
            {showResponseContent && <td>별도 목적자금 계획 필요</td>}
          </tr>
        </tbody>
      </table>
      <div className="fine-print" style={{ marginTop: 8 }}>
        본 보고서는 입력하신 정보를 기준으로 산출되었으며, 물가상승률 · 수익률 · 세금 등 실제 변수에 따라 결과가 달라질 수 있습니다.
        본 진단은 성실성과 객관성을 원칙으로 작성되었으며, 정기적인 재점검을 통해 목표 달성을 지원해드립니다.
      </div>
      <div style={{ marginTop: 12 }}>
        <AIFeedbackBox text={goalFeedback} />
      </div>

      {showResponseContent && <>
      <h3 className="card-title" style={{ margin: '24px 0 10px' }}>대응 옵션</h3>
      <table className="grade-table">
        <thead><tr><th>대응 옵션</th><th>내용</th><th>고려사항</th></tr></thead>
        <tbody>
          <tr>
            <td>저축 확대</td>
            <td>현재 저축성향 {savingsRate && !savingsRate.notCalculable ? formatPercent(savingsRate.value) : '-'} → 상향 검토</td>
            <td>가계수지지표 {household && !household.notCalculable ? formatPercent(household.value) : '-'}로, 저축 여력 확인 필요</td>
          </tr>
          <tr>
            <td>자산 유동화</td>
            <td>주택연금 전환 또는 부동산 자금 일부 전환</td>
            <td>
              금융자산 비중 {financialAssetRatio && !financialAssetRatio.notCalculable ? formatPercent(financialAssetRatio.value) : '-'}
              {financialAssetRatio && !financialAssetRatio.notCalculable ? `(${financialAssetRatio.status})` : ''} — 자산구조 개선에 참고
            </td>
          </tr>
          <tr>
            <td>투자 조정</td>
            <td>연금자산 · 금융자산 포트폴리오 재배분</td>
            <td>정액형 연금 비중 축소, 물가연동형 상품 검토</td>
          </tr>
          <tr>
            <td>소득 연장</td>
            <td>은퇴 시점 이후 추가 근로소득 모색</td>
            <td>
              {incomeGap != null
                ? `노후소득보장률 공백(${incomeGap}%p)을 메우는 데 가장 직접적`
                : '노후소득 공백을 메우는 데 가장 직접적'}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="fine-print" style={{ marginBottom: 8 }}>
        유의사항: 특정 비율 추천은 지양하며, 위 옵션은 비교 참고용입니다. 본 진단은 입력하신 정보를 기준으로 자동
        산출되며, 실제 재무상담 시에는 전문가와 상의해 정확한 개별 데이터를 확인하시기 바랍니다.
      </div>
      </>}

      {showResponseContent && applied && (
        <>
          <h3 className="card-title" style={{ margin: '24px 0 10px' }}>대응방안 적용 전 / 후 비교</h3>
          <table className="grade-table">
            <thead><tr><th>항목</th><th>적용 전</th><th>적용 후</th></tr></thead>
            <tbody>
              <tr>
                <td>노후소득보장률</td>
                <td className="num">{before.indicator9.notCalculable ? '산출 불가' : formatPercent(before.indicator9.value)}</td>
                <td className="num">{after.indicator9.notCalculable ? '산출 불가' : formatPercent(after.indicator9.value)}</td>
              </tr>
              <tr>
                <td>은퇴자산 준비율</td>
                <td className="num">{formatPercent(before.simulation.preparationRate)}</td>
                <td className="num">{formatPercent(after.simulation.preparationRate)}</td>
              </tr>
              <tr>
                <td>은퇴자산 부족금액</td>
                <td className="num">{formatWon(before.simulation.shortfall)}</td>
                <td className="num">{formatWon(after.simulation.shortfall)}</td>
              </tr>
            </tbody>
          </table>
          {notes.map((note) => (
            <div key={note.scenario} className="fine-print" style={{ marginTop: 8 }}>
              {SCENARIO_LABELS[note.scenario]} 적용됨
              {note.monthlyIncomeAdded != null && ` — 월 ${formatWon(note.monthlyIncomeAdded)} 수입 반영`}
              {note.assetsShifted != null && ` — ${formatWon(note.assetsShifted)} 자산 전환`}
              {note.reductionRate != null && ` — ${note.reductionRate}% 절감 (${note.targets.join(', ')})`}
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <AIFeedbackBox text={feedback} />
      </div>
    </PageFrame>
  );
}
