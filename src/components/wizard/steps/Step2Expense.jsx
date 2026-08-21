import { useState, useEffect } from 'react';
import NumberField from '../fields/NumberField';
import RepeatableList from '../fields/RepeatableList';
import ExpenseBreakdownField from '../fields/ExpenseBreakdownField';
import TotalAmountBox from '../fields/TotalAmountBox';
import PresenceField from '../fields/PresenceField';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatWon } from '../../../utils/format';
import FormattedNumberInput from '../fields/FormattedNumberInput';

// 국민연금연구원 조사 2024년 기준 적정 노후생활비(단위: 만원, 외부 공식 자료 - 계산에는 쓰이지 않는 참고용 표).
// 원 자료는 천원 단위이며, 이 앱의 금액 단위(만원)에 맞춰 표시만 변환했다(예: 3,328천원 → 332.8만원).
const RETIREMENT_COST_GUIDE_ROWS = [
  { age: '50대 미만', couple: '332.8', single: '208.4' },
  { age: '50대', couple: '306.8', single: '198.3' },
  { age: '60대', couple: '288.8', single: '183.8' },
  { age: '70대', couple: '251.3', single: '161.7' },
  { age: '80대 이상', couple: '226.8', single: '144.0' },
];

function RetirementCostGuideModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>적정 노후 생활비 기준 보기</h4>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <p style={{ fontWeight: 700, margin: '0 0 8px' }}>적정 노후 생활비는 도시가구 기준입니다.</p>
        <p className="field-helper" style={{ textAlign: 'right', marginBottom: 6 }}>(단위: 만원)</p>
        <table className="grade-table compact">
          <thead>
            <tr>
              <th colSpan={2}>구분</th>
              <th colSpan={2}>필요적정노후생활비</th>
            </tr>
            <tr>
              <th colSpan={2} />
              <th>부부기준</th>
              <th>개인기준</th>
            </tr>
          </thead>
          <tbody>
            {RETIREMENT_COST_GUIDE_ROWS.map((row, i) => (
              <tr key={row.age}>
                {i === 0 && <td rowSpan={RETIREMENT_COST_GUIDE_ROWS.length}>연령대</td>}
                <td>{row.age}</td>
                <td className="num" style={{ textAlign: 'right' }}>{row.couple}</td>
                <td className="num" style={{ textAlign: 'right' }}>{row.single}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="field-helper" style={{ marginTop: 10 }}>
          [ 필요적정 노후생활비 세부항목 ] 주거비, 의료비, 식비, 여가비, 세금 및 공과금
        </p>
      </div>
    </div>
  );
}

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
  const [showCostGuide, setShowCostGuide] = useState(false);
  const { formData, setField } = useFormData();
  const monthlyLivingCost = Number(getIn(formData, 'assets.currentLivingCost.monthly')) || 0;
  const insurancePremium = Number(getIn(formData, 'assets.insurance.monthlyPremium')) || 0;
  const hasInsurance = getIn(formData, 'assets.insurance.hasInsurance') !== false;

  const setHasInsurance = (value) => {
    setField('assets.insurance.hasInsurance', value);
    if (!value) {
      setField('assets.insurance.monthlyPremium', 0);
      setField('assets.insurance.coverageAmount', 0);
    }
  };

  // "월 국민건강보험료" 단일 입력칸을 "+ 기타 추가" 반복 목록으로 바꾸고, 합계를 그대로
  // expense.healthInsurance.monthly에 반영한다 - 고정지출 집계 로직(aggregate.js)은 그대로 이 값을 쓴다.
  const healthInsuranceItems = getIn(formData, 'expense.healthInsurance.items') || [];
  const healthInsurance = healthInsuranceItems.reduce((s, item) => s + (Number(item.monthly) || 0), 0);

  useEffect(() => {
    setField('expense.healthInsurance.monthly', healthInsurance);
  }, [healthInsurance, setField]);

  const totalMonthlyExpense = monthlyLivingCost + insurancePremium + healthInsurance;

  // "노후 생활비 지출 총액" = 노후 월 평균 생활비 × 노후 생활 개월수(기대수명-은퇴연령). "1. 수입"의
  // "예상 노후 생활" 기간과 동일한 기준(basic.retirementAge~basic.lifeExpectancy)을 재사용한다.
  const retirementAge = getIn(formData, 'basic.retirementAge');
  const lifeExpectancy = getIn(formData, 'basic.lifeExpectancy');
  const retirementLivingCost = Number(getIn(formData, 'expense.retirementLivingCost')) || 0;
  const isFilledAge = (v) => v !== '' && v != null && Number.isFinite(Number(v));
  const retirementLivingMonths =
    isFilledAge(retirementAge) && isFilledAge(lifeExpectancy)
      ? Math.max(0, Number(lifeExpectancy) - Number(retirementAge)) * 12
      : null;
  const retirementLivingCostTotal =
    retirementLivingMonths != null ? retirementLivingCost * retirementLivingMonths : null;

  return (
    <div className="step">
      <h2 className="step-title">2. 지출</h2>

      <section className="step-section">
        <h3><span className="step-icon">🧾</span> 현재 생활비 상세</h3>
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
        <h3><span className="step-icon">🏖️</span> 노후 생활비</h3>
        <p className="field-helper" style={{ marginBottom: 4 }}>
          국민연금연구원 조사 2024년 기준 적정 노후 생활비 자료입니다.
          <br />
          아래 기준표의 적정 생활비를 참고하실 수 있습니다.
        </p>
        <button type="button" className="text-link-button" onClick={() => setShowCostGuide(true)}>
          적정 노후 생활비 기준 보기 ›
        </button>
        <div className="field-grid" style={{ marginTop: 14 }}>
          <NumberField
            path="expense.retirementLivingCost"
            label="노후 월 평균 생활비 *"
            unit="만원"
            helper="필수 입력 항목입니다. 은퇴 이후 필요한 생활비 가정치로, 현재 생활비와는 별개로 은퇴자산 시뮬레이션에 사용됩니다"
          />
        </div>
        {retirementLivingCostTotal != null ? (
          <>
            <TotalAmountBox
              label="노후 생활비 지출 총액"
              amount={retirementLivingCostTotal}
              valueLabel="지출 총액은"
            />
            <span className="field-helper">
              은퇴(예정) 연령부터 기대수명까지 약 {Math.round((retirementLivingMonths / 12) * 10) / 10}년간의 누적 지출액입니다
            </span>
          </>
        ) : (
          <span className="field-helper" style={{ marginTop: 8, display: 'block' }}>
            "1. 수입"에서 은퇴(예정) 연령과 기대수명을 입력하면 은퇴 후 기대수명까지의 노후 생활비 지출 총액이 계산됩니다.
          </span>
        )}
        {showCostGuide && <RetirementCostGuideModal onClose={() => setShowCostGuide(false)} />}
      </section>

      <section className="step-section">
        <h3><span className="step-icon">🛡️</span> 보장성 보험</h3>
        <PresenceField label="보장성 보험 여부" present={hasInsurance} onChange={setHasInsurance} presentLabel="보험 있음" absentLabel="보험 없음" />
        {hasInsurance ? <div className="field-grid">
          <NumberField path="assets.insurance.monthlyPremium" label="보장성보험 월 보험료" unit="만원" helper="실손보험 등" />
          <NumberField path="assets.insurance.coverageAmount" label="주요 보장금액" unit="만원" />
        </div> : <p className="field-helper">보장성 보험 없음으로 선택했습니다. 보험료와 보장금액은 0원으로 반영됩니다.</p>}
        <RepeatableList
          path="expense.healthInsurance.items"
          label="기타 보험료(국민건강보험료 등)"
          addLabel="기타 추가"
          emptyItem={{ name: '', monthly: '' }}
          renderItem={(item, _i, update) => (
            <div className="field-grid three-col">
              <label className="field">
                <span className="field-label">항목 이름</span>
                <input type="text" placeholder="예: 국민건강보험료" value={item.name} onChange={(e) => update('name', e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">월 보험료</span>
                <div className="field-input-row">
                  <FormattedNumberInput value={item.monthly} onChange={(e) => update('monthly', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
            </div>
          )}
        />
      </section>

      <section className="step-section">
        <h3><span className="step-icon">🎓</span> 자녀 학자금 · 결혼지원 · 기타 (목돈 지출)</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          향후 목돈 지출 예정인 항목을 입력해주세요.
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
                  <FormattedNumberInput value={item.educationCost} onChange={(e) => update('educationCost', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
              <label className="field">
                <span className="field-label">결혼지원비</span>
                <div className="field-input-row">
                  <FormattedNumberInput value={item.marriageSupport} onChange={(e) => update('marriageSupport', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
              <label className="field">
                <span className="field-label">기타</span>
                <div className="field-input-row">
                  <FormattedNumberInput value={item.otherCost} onChange={(e) => update('otherCost', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
            </div>
          )}
        />
      </section>

      <section className="step-section">
        <h3><span className="step-icon">💸</span> 기타 지출</h3>
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
                  <FormattedNumberInput value={item.annual} onChange={(e) => update('annual', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
              <label className="field">
                <span className="field-label">지출 기간</span>
                <div className="field-input-row">
                  <FormattedNumberInput value={item.years} onChange={(e) => update('years', Number(e.target.value))} />
                  <span className="field-unit">년</span>
                </div>
              </label>
            </div>
          )}
        />
      </section>

      <section className="step-section">
        <h3><span className="step-icon">🧮</span> 총 지출 합계</h3>
        <table className="grade-table compact">
          <thead>
            <tr><th>항목</th><th style={{ textAlign: 'right' }}>월 금액</th></tr>
          </thead>
          <tbody>
            <tr className="total-row"><td>현재 총 지출 합계(월)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(totalMonthlyExpense)}</td></tr>
            <tr className="total-row"><td>현재 총 지출 합계(연)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(totalMonthlyExpense * 12)}</td></tr>
            <tr><td>현재 생활비</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(monthlyLivingCost)}</td></tr>
            <tr><td>보장성보험료</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(insurancePremium)}</td></tr>
            <tr><td>기타 보험료(건강보험료 등)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(healthInsurance)}</td></tr>
          </tbody>
        </table>
        <span className="field-helper">
          노후 생활비, 자녀 목돈 지출, 기타 지출은 발생 시점·주기가 달라 위 합계에 포함되지 않습니다.
        </span>
      </section>
    </div>
  );
}
