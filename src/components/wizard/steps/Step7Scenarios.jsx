import NumberField from '../fields/NumberField';
import ToggleField from '../fields/ToggleField';
import CheckboxGroupField from '../fields/CheckboxGroupField';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

export default function Step7Scenarios() {
  const { formData } = useFormData();
  const reverseMortgageOn = getIn(formData, 'scenarios.reverseMortgage.enabled');
  const realEstateConversionOn = getIn(formData, 'scenarios.realEstateConversion.enabled');
  const expenseReductionOn = getIn(formData, 'scenarios.expenseReduction.enabled');
  const additionalIncomeOn = getIn(formData, 'scenarios.additionalIncome.enabled');

  return (
    <div className="step">
      <h2 className="step-title">7. 대응방안 시뮬레이션</h2>
      <p className="step-desc">
        아래는 확정 입력이 아닌 "만약 이렇게 한다면?"을 검토하는 시나리오입니다. 필요한 항목만 켜서 비교해보세요.
      </p>

      <section className="step-section scenario-card">
        <ToggleField
          path="scenarios.reverseMortgage.enabled"
          label="🏠 ① 주택연금 전환"
          description="보유 주택을 담보로 평생 매월 연금을 받는 방법"
        />
        {reverseMortgageOn && (
          <div className="field-grid" style={{ marginTop: 14 }}>
            <NumberField path="scenarios.reverseMortgage.ageAtStart" label="가입 시 나이" unit="세" max={120} />
            <NumberField path="scenarios.reverseMortgage.housePrice" label="주택 가격" unit="만원" />
          </div>
        )}
      </section>

      <section className="step-section scenario-card">
        <ToggleField
          path="scenarios.realEstateConversion.enabled"
          label="🏢 ② 부동산 자금 전환"
          description="부동산자산 일부를 현금화해 생활자금으로 전환"
        />
        {realEstateConversionOn && (
          <div className="field-grid" style={{ marginTop: 14 }}>
            <NumberField path="scenarios.realEstateConversion.ageAtConversion" label="전환 시 나이" unit="세" max={120} />
            <NumberField path="scenarios.realEstateConversion.cashOutAmount" label="현금화 조정 금액" unit="만원" />
          </div>
        )}
      </section>

      <section className="step-section scenario-card">
        <ToggleField
          path="scenarios.expenseReduction.enabled"
          label="✂️ ③ 지출 줄이기"
          description="선택한 지출 항목을 일정 비율 절감"
        />
        {expenseReductionOn && (
          <div style={{ marginTop: 14 }}>
            <div className="field-grid">
              <NumberField path="scenarios.expenseReduction.reductionRate" label="절감 비율" unit="%" max={100} />
            </div>
            <CheckboxGroupField
              path="scenarios.expenseReduction.targets"
              label="절감 비율 적용 대상"
              options={[
                { value: 'living', label: '생활비' },
                { value: 'medical', label: '의료비' },
                { value: 'other', label: '기타 지출' },
              ]}
            />
            <p className="field-helper">부채 · 교육비 · 건강보험료는 절감 대상에서 자동 제외됩니다.</p>
          </div>
        )}
      </section>

      <section className="step-section scenario-card">
        <ToggleField
          path="scenarios.additionalIncome.enabled"
          label="💡 ④ 추가 수입원 모색"
          description="검토 중인 추가 소득 계획 (확정된 수입이 아님)"
        />
        {additionalIncomeOn && (
          <div className="field-grid" style={{ marginTop: 14 }}>
            <NumberField path="scenarios.additionalIncome.monthlySalary" label="예상 월급여" unit="만원" />
            <NumberField path="scenarios.additionalIncome.months" label="수령 기간" unit="개월" />
          </div>
        )}
      </section>
    </div>
  );
}
