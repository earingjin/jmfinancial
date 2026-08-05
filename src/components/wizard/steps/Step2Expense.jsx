import NumberField from '../fields/NumberField';
import RepeatableList from '../fields/RepeatableList';
import ExpenseBreakdownField from '../fields/ExpenseBreakdownField';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

const CURRENT_LIVING_COST_CATEGORIES = [
  { key: 'rent', label: '월세' },
  { key: 'maintenance', label: '관리비' },
  { key: 'utilities', label: '공과금' },
  { key: 'fuel', label: '유류비' },
  { key: 'carInsurance', label: '차 보험료' },
  { key: 'clothing', label: '의류비' },
  { key: 'fourInsurances', label: '4대보험' },
  { key: 'food', label: '식비' },
  { key: 'communication', label: '통신비' },
  { key: 'medical', label: '의료비' },
  { key: 'subscription', label: '각종 구독료' },
  { key: 'other', label: '기타지출' },
];

export default function Step2Expense() {
  const { formData } = useFormData();
  const monthlyLivingCost = Number(getIn(formData, 'assets.currentLivingCost.monthly')) || 0;
  const insurancePremium = Number(getIn(formData, 'assets.insurance.monthlyPremium')) || 0;
  const healthInsurance = Number(getIn(formData, 'expense.healthInsurance.monthly')) || 0;
  const totalMonthlyExpense = monthlyLivingCost + insurancePremium + healthInsurance;

  const children = getIn(formData, 'expense.children') || [];
  const childrenLumpSum = children.reduce(
    (s, c) => s + (Number(c.educationCost) || 0) + (Number(c.marriageSupport) || 0) + (Number(c.otherCost) || 0),
    0
  );
  const otherExpenses = getIn(formData, 'expense.otherExpenses') || [];
  const otherExpensesAnnual = otherExpenses.reduce((s, item) => s + (Number(item.annual) || 0), 0);

  return (
    <div className="step">
      <h2 className="step-title">2. 지출</h2>

      <section className="step-section">
        <h3>🧾 현재 생활비 상세</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          대출 원리금상환액(차량대출 포함)은 여기가 아닌 "5. 부채" 단계에서 입력해 주세요. 두 곳에 중복으로 입력하면 총지출이 실제보다 크게 계산됩니다.
        </p>
        <ExpenseBreakdownField
          basePath="assets.currentLivingCost.breakdown"
          totalPath="assets.currentLivingCost.monthly"
          annualPath="assets.currentLivingCost.annual"
          modePath="assets.currentLivingCost.inputMode"
          categories={CURRENT_LIVING_COST_CATEGORIES}
          totalLabel="현재 기준 월 생활비 합계"
          annualLabel="현재 기준 연 생활비 합계"
        />
      </section>

      <section className="step-section">
        <h3>🏖️ 노후 생활비</h3>
        <div className="field-grid">
          <NumberField
            path="expense.retirementLivingCost"
            label="노후 월 평균 생활비"
            unit="만원"
            helper="은퇴 이후 필요한 생활비 가정치로, 현재 생활비와는 별개로 은퇴자산 시뮬레이션에 사용됩니다"
          />
        </div>
      </section>

      <section className="step-section">
        <h3>🛡️ 보장성 보험</h3>
        <div className="field-grid">
          <NumberField path="assets.insurance.monthlyPremium" label="보장성보험 월 보험료" unit="만원" helper="실손보험 등" />
          <NumberField path="assets.insurance.coverageAmount" label="주요 보장금액" unit="만원" />
          <NumberField path="expense.healthInsurance.monthly" label="월 국민건강보험료" unit="만원" />
        </div>
      </section>

      <section className="step-section">
        <h3>🎓 자녀 학자금 · 결혼지원 · 기타 (목돈 지출)</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          한 번에 목돈으로 나가는 총액 기준으로 입력해 주세요.
        </p>
        <RepeatableList
          path="expense.children"
          label="자녀별 학자금 · 결혼지원비 · 기타 목돈 지출 계획"
          addLabel="자녀 추가"
          maxItems={3}
          emptyItem={{ educationCost: '', marriageSupport: '', otherCost: '' }}
          renderItem={(item, _i, update) => (
            <div className="field-grid three-col">
              <label className="field">
                <span className="field-label">학자금</span>
                <div className="field-input-row">
                  <input type="number" value={item.educationCost} onChange={(e) => update('educationCost', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
              <label className="field">
                <span className="field-label">결혼지원비</span>
                <div className="field-input-row">
                  <input type="number" value={item.marriageSupport} onChange={(e) => update('marriageSupport', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
              <label className="field">
                <span className="field-label">기타</span>
                <div className="field-input-row">
                  <input type="number" value={item.otherCost} onChange={(e) => update('otherCost', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
            </div>
          )}
        />
      </section>

      <section className="step-section">
        <h3>💸 기타 지출</h3>
        <RepeatableList
          path="expense.otherExpenses"
          label="경조사비 등 추가로 예상되는 지출"
          addLabel="지출 항목 추가"
          emptyItem={{ name: '', annual: '', years: '' }}
          renderItem={(item, _i, update) => (
            <div className="field-grid three-col">
              <label className="field">
                <span className="field-label">지출 항목 이름</span>
                <input type="text" placeholder="예: 경조사비" value={item.name} onChange={(e) => update('name', e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">연간 지출 금액</span>
                <div className="field-input-row">
                  <input type="number" value={item.annual} onChange={(e) => update('annual', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
              <label className="field">
                <span className="field-label">지출 기간</span>
                <div className="field-input-row">
                  <input type="number" value={item.years} onChange={(e) => update('years', Number(e.target.value))} />
                  <span className="field-unit">년</span>
                </div>
              </label>
            </div>
          )}
        />
      </section>

      <section className="step-section">
        <h3>🧮 총 지출 합계</h3>
        <table className="grade-table compact">
          <thead>
            <tr><th>항목</th><th style={{ textAlign: 'right' }}>월 금액</th></tr>
          </thead>
          <tbody>
            <tr><td>현재 생활비</td><td className="num" style={{ textAlign: 'right' }}>{monthlyLivingCost}만원</td></tr>
            <tr><td>보장성보험료</td><td className="num" style={{ textAlign: 'right' }}>{insurancePremium}만원</td></tr>
            <tr><td>국민건강보험료</td><td className="num" style={{ textAlign: 'right' }}>{healthInsurance}만원</td></tr>
            <tr className="total-row"><td>현재 총 지출 합계(월)</td><td className="num" style={{ textAlign: 'right' }}>{totalMonthlyExpense}만원</td></tr>
            <tr className="total-row"><td>현재 총 지출 합계(연)</td><td className="num" style={{ textAlign: 'right' }}>{totalMonthlyExpense * 12}만원</td></tr>
          </tbody>
        </table>
        <span className="field-helper">
          노후 생활비, 자녀 목돈 지출, 기타 지출은 발생 시점·주기가 달라 위 합계에 포함되지 않고 아래에 참고용으로 표시됩니다.
        </span>
        <div className="field-grid" style={{ marginTop: 10 }}>
          <label className="field">
            <span className="field-label">자녀 학자금 등 목돈 지출 합계(참고용)</span>
            <div className="field-input-row">
              <input type="number" value={childrenLumpSum} readOnly />
              <span className="field-unit">만원</span>
            </div>
          </label>
          <label className="field">
            <span className="field-label">기타 지출 합계(연, 참고용)</span>
            <div className="field-input-row">
              <input type="number" value={otherExpensesAnnual} readOnly />
              <span className="field-unit">만원</span>
            </div>
          </label>
        </div>
      </section>
    </div>
  );
}
