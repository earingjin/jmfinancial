import DebtBreakdownField from '../fields/DebtBreakdownField';
import PresenceField from '../fields/PresenceField';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

const DEBT_CATEGORIES = [
  { key: 'mortgage', label: '주담대' },
  { key: 'depositLoan', label: '보증금대출' },
  { key: 'businessLoan', label: '사업자대출' },
  { key: 'buildingLoan', label: '빌딩대출' },
  { key: 'carLoan', label: '차량대출' },
  { key: 'studentLoan', label: '학자금대출' },
  { key: 'otherLoan', label: '기타대출' },
];

export default function Step5Debt() {
  const { formData, setField } = useFormData();
  const hasDebt = getIn(formData, 'assets.debtStatus.hasDebt') !== false;
  const setHasDebt = (value) => {
    setField('assets.debtStatus.hasDebt', value);
    if (!value) {
      setField('assets.debtStatus.totalBalance', 0);
      setField('assets.debtStatus.monthlyRepayment', 0);
      setField('assets.debtStatus.customItems', []);
      DEBT_CATEGORIES.forEach(({ key }) => setField(`assets.debtStatus.breakdown.${key}`, {}));
    }
  };

  return (
    <div className="step">
      <h2 className="step-title">5. 부채</h2>

      <section className="step-section">
        <h3><span className="step-icon">💳</span> 부채 상태</h3>
        <PresenceField label="부채 여부" present={hasDebt} onChange={setHasDebt} presentLabel="부채 있음" absentLabel="부채 없음" />
        {hasDebt ? <DebtBreakdownField
          basePath="assets.debtStatus.breakdown"
          customPath="assets.debtStatus.customItems"
          balanceTotalPath="assets.debtStatus.totalBalance"
          repaymentTotalPath="assets.debtStatus.monthlyRepayment"
          modePath="assets.debtStatus.inputMode"
          categories={DEBT_CATEGORIES}
        /> : <p className="field-helper">부채 없음으로 선택했습니다. 부채잔액과 월 상환액은 0원으로 반영됩니다.</p>}
      </section>
    </div>
  );
}
