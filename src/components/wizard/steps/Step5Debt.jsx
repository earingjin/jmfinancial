import DebtBreakdownField from '../fields/DebtBreakdownField';

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
  return (
    <div className="step">
      <h2 className="step-title">5. 부채</h2>

      <section className="step-section">
        <h3><span className="step-icon">💳</span> 부채 상태</h3>
        <DebtBreakdownField
          basePath="assets.debtStatus.breakdown"
          customPath="assets.debtStatus.customItems"
          balanceTotalPath="assets.debtStatus.totalBalance"
          repaymentTotalPath="assets.debtStatus.monthlyRepayment"
          modePath="assets.debtStatus.inputMode"
          categories={DEBT_CATEGORIES}
        />
      </section>
    </div>
  );
}
