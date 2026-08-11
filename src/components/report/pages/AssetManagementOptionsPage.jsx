import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import { formatWon } from '../../../utils/format';

// 대응 옵션(ConclusionPage)을 구체적인 실행 방안 카드로 풀어보여주는 레이아웃.
//
// 카드별로 두 가지 "빈 값"을 구분해서 보여준다 (사용자 승인된 요구사항):
//   1) "7. 대응방안"에서 해당 옵션 자체를 켜지 않은 경우 → 계산이 안 된 게 아니라 "적용하지 않음"임을
//      명확한 안내 문구로 보여준다("-"만 덩그러니 있으면 계산 오류로 오해할 수 있다).
//   2) 옵션은 켰지만 특정 세부 금액(예: 주택연금 총 수령금액)은 아직 계산 로직이 없는 경우 →
//      그 항목에 한해 "계산 준비 중" 문구로 표시해 "미적용"과 구분한다.
// 새 금액 산정 공식은 만들지 않는다 - scenarios.js가 이미 계산한 값(notes)과 사용자가 직접 입력한
// 값(scenariosInput), 이미 계산된 전/후 집계(scenarioComparison.before/after)만 그대로 사용한다.

const NOT_APPLIED = '이 방법을 적용하지 않으셨습니다';
const CALC_PENDING = '계산 준비 중';

function findNote(scenarioComparison, scenarioKey) {
  return (scenarioComparison?.notes || []).find((n) => n.scenario === scenarioKey) || null;
}

function OptionCard({ title, desc, enabled, children, list }) {
  return (
    <div className="option-card">
      <div className="option-card-title">{title}</div>
      <div className="option-card-desc">{desc}</div>
      {enabled ? (
        children
      ) : (
        <div className="option-card-row option-card-row--notice">
          <span className="option-card-not-applied">{NOT_APPLIED}</span>
        </div>
      )}
      {list}
    </div>
  );
}

export default function AssetManagementOptionsPage({ scenariosInput, scenarioComparison, pageNumber, totalPages }) {
  const scenarios = scenariosInput || {};

  const reverseMortgageEnabled = !!scenarios.reverseMortgage?.enabled;
  const reverseMortgageNote = findNote(scenarioComparison, 'reverseMortgage');

  const realEstateEnabled = !!scenarios.realEstateConversion?.enabled;
  const realEstateNote = findNote(scenarioComparison, 'realEstateConversion');
  const cashOutAge = scenarios.realEstateConversion?.ageAtConversion;

  const expenseReductionEnabled = !!scenarios.expenseReduction?.enabled;
  const livingCostBefore = scenarioComparison?.before?.aggregates?.totalExpenseMonthlyExSavings;
  const livingCostAfter = scenarioComparison?.after?.aggregates?.totalExpenseMonthlyExSavings;

  const additionalIncomeEnabled = !!scenarios.additionalIncome?.enabled;
  const targetMonthlySalary = scenarios.additionalIncome?.monthlySalary;
  const incomeMonths = scenarios.additionalIncome?.months;

  return (
    <PageFrame eyebrow="Conclusion" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="8" label="자산관리" />

      <div className="option-card-grid">
        <OptionCard
          title="주택연금 전환"
          desc="보유한 주택을 주택연금으로 전환하여 노후자금을 보충하는 방안"
          enabled={reverseMortgageEnabled}
        >
          <div className="option-card-row">
            <span>주택연금 월 수령금액</span>
            <span className="num">{reverseMortgageNote ? formatWon(reverseMortgageNote.monthlyIncomeAdded) : CALC_PENDING}</span>
          </div>
          <div className="option-card-row">
            <span>총 수령금액</span>
            <span className="num">{CALC_PENDING}</span>
          </div>
        </OptionCard>

        <OptionCard
          title="부동산 자금전환"
          desc="주택 · 부동산 규모 혹은 전세금 규모를 조정해 현금으로 전환하는 방안"
          enabled={realEstateEnabled}
          list={
            <ul className="option-card-list">
              <li>보유 주택을 매매하여 작은 평수로 이동</li>
              <li>보유 주택을 전/월세로 축소하여 현금화</li>
              <li>실거주택을 제외한 여유 주택 · 농지 매각</li>
            </ul>
          }
        >
          <div className="option-card-row">
            <span>부동산 현금화 금액</span>
            <span className="num">{realEstateNote ? formatWon(realEstateNote.assetsShifted) : CALC_PENDING}</span>
          </div>
          <div className="option-card-row">
            <span>현금 전환 시 나이</span>
            <span className="num">{cashOutAge ? `${cashOutAge}세` : CALC_PENDING}</span>
          </div>
        </OptionCard>

        <OptionCard
          title="지출 줄이기"
          desc="노후 생활비 · 자녀 교육 등 지출 패턴을 조정하는 방안"
          enabled={expenseReductionEnabled}
        >
          <div className="option-card-row">
            <span>지출 감소 전 생활비</span>
            <span className="num">{Number.isFinite(livingCostBefore) ? formatWon(livingCostBefore) : CALC_PENDING}</span>
          </div>
          <div className="option-card-row">
            <span>지출 감소 후 생활비</span>
            <span className="num">{Number.isFinite(livingCostAfter) ? formatWon(livingCostAfter) : CALC_PENDING}</span>
          </div>
        </OptionCard>

        <OptionCard
          title="재취업 수입원"
          desc="은퇴 이후 추가 근로소득을 모색하는 방안"
          enabled={additionalIncomeEnabled}
        >
          <div className="option-card-row">
            <span>목표 월급여</span>
            <span className="num">{targetMonthlySalary ? formatWon(targetMonthlySalary) : CALC_PENDING}</span>
          </div>
          <div className="option-card-row">
            <span>급여 수령기간</span>
            <span className="num">{incomeMonths ? `${incomeMonths}개월` : CALC_PENDING}</span>
          </div>
        </OptionCard>
      </div>

      <div className="fine-print" style={{ marginTop: 12 }}>
        "적용하지 않으셨습니다"로 표시된 방안은 "7. 대응방안" 단계에서 켜지 않은 옵션입니다. "계산 준비 중"으로
        표시된 항목은 옵션은 켰지만 아직 세부 계산 기능이 연동되지 않은 값입니다. 실제 재무상담 시에는 전문가와
        상의해 개별 데이터를 기준으로 산출하시기 바랍니다.
      </div>
    </PageFrame>
  );
}
