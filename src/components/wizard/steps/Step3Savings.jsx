import AutoAnnualField from '../fields/AutoAnnualField';
import CategoryBreakdownField from '../fields/CategoryBreakdownField';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

const SAVINGS_CATEGORIES = [
  { key: 'installment', label: '적금' },
  { key: 'isa', label: 'ISA' },
  { key: 'irp', label: 'IRP' },
  { key: 'subscription', label: '청약' },
  { key: 'stocks', label: '주식' },
  { key: 'parkingAccount', label: '파킹통장' },
];

export default function Step3Savings() {
  const { formData } = useFormData();
  const savingsMonthly = Number(getIn(formData, 'assets.savingsPlan.monthly')) || 0;
  const retirementSavingsMonthly = Number(getIn(formData, 'assets.savingsPlan.retirementMonthly')) || 0;
  const totalSavingsMonthly = savingsMonthly + retirementSavingsMonthly;

  return (
    <div className="step">
      <h2 className="step-title">3. 저축</h2>

      <section className="step-section">
        <h3>🌱 저축 · 노후준비</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          국민연금 · 개인연금 · 저축성보험(연금보험 등)처럼 노후를 위해 정기적으로 적립하는 금액을 포함해 입력해 주세요.
        </p>
        <CategoryBreakdownField
          basePath="assets.savingsPlan.breakdown"
          customPath="assets.savingsPlan.customItems"
          totalPath="assets.savingsPlan.monthly"
          annualPath="assets.savingsPlan.annual"
          modePath="assets.savingsPlan.inputMode"
          categories={SAVINGS_CATEGORIES}
          totalLabel="월 저축액 합계"
          annualLabel="연 저축액 합계"
          pillPrompt="해당하는 저축 종류를 눌러 금액을 입력해 주세요"
          customListLabel="기본 항목 외 추가 저축"
          customNameLabel="저축 이름"
          customNamePlaceholder="예: 저축보험"
          customAmountLabel="월 저축액"
          addItemLabel="저축 항목 추가"
        />
        <div className="field-grid" style={{ marginTop: 10 }}>
          <AutoAnnualField
            monthlyPath="assets.savingsPlan.retirementMonthly"
            annualPath="assets.savingsPlan.retirementAnnual"
            label="노후준비 월 저축액"
          />
        </div>

        <table className="grade-table compact" style={{ marginTop: 16 }}>
          <tbody>
            <tr><td>일반 저축</td><td className="num" style={{ textAlign: 'right' }}>{savingsMonthly}만원</td></tr>
            <tr><td>노후준비 저축</td><td className="num" style={{ textAlign: 'right' }}>{retirementSavingsMonthly}만원</td></tr>
            <tr className="total-row"><td>총 저축 합계(월)</td><td className="num" style={{ textAlign: 'right' }}>{totalSavingsMonthly}만원</td></tr>
            <tr className="total-row"><td>총 저축 합계(연)</td><td className="num" style={{ textAlign: 'right' }}>{totalSavingsMonthly * 12}만원</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
