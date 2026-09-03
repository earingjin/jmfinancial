import AutoAnnualField from '../fields/AutoAnnualField';
import SavingsBreakdownField from '../fields/SavingsBreakdownField';
import PresenceField from '../fields/PresenceField';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatWon } from '../../../utils/format';

// assetLink: "현재까지 누적된 금액"이 "4. 자산" 파트의 어느 값과 연동되는지(사용자 승인된 매핑).
// 변액연금·연금저축·IRP는 "4. 자산 > 연금자산"의 각각 전용 항목(pensionAssetsBreakdown)에 바로 연동된다
// (연금자산은 변액연금·연금저축계좌·IRP개인퇴직계좌·기타 4개 버튼으로 나뉘어 있고, "기타"만 자산 파트에서
// 직접 입력하며 저축 파트와는 연동하지 않는다).
const SAVINGS_CATEGORIES = [
  { key: 'installment', label: '적금', assetLink: { type: 'liquidBreakdown', field: 'savings' }, assetLinkLabel: '현금성 자산 > 적금' },
  { key: 'isa', label: 'ISA', assetLink: { type: 'liquidCustomItem', name: 'ISA' }, assetLinkLabel: '현금성 자산의 "ISA" 추가 항목' },
  { key: 'variableAnnuity', label: '변액연금', assetLink: { type: 'pensionBreakdown', field: 'variableAnnuity' }, assetLinkLabel: '연금자산 > 변액연금' },
  { key: 'pensionSavings', label: '연금저축', assetLink: { type: 'pensionBreakdown', field: 'pensionSavingsAccount' }, assetLinkLabel: '연금자산 > 연금저축계좌' },
  { key: 'irp', label: 'IRP', assetLink: { type: 'pensionBreakdown', field: 'irp' }, assetLinkLabel: '연금자산 > IRP개인퇴직계좌' },
  { key: 'subscription', label: '청약', assetLink: { type: 'liquidBreakdown', field: 'subscription' }, assetLinkLabel: '현금성 자산 > 청약' },
  { key: 'stocks', label: '주식', assetLink: { type: 'direct', path: 'assets.financialAssets.stocks' }, assetLinkLabel: '금융자산 > 주식' },
  { key: 'parkingAccount', label: '파킹통장', assetLink: { type: 'liquidCustomItem', name: '파킹통장' }, assetLinkLabel: '현금성 자산의 "파킹통장" 추가 항목' },
];

// 테스트에서 실제 상태 변경 경계를 검증하기 위해 함께 내보낸다.
// oxlint-disable-next-line react/only-export-components
export function updateSavingsPresence(formData, setField, value) {
  setField('assets.savingsPlan.hasSavings', value);
  if (value) return;

  const emptyItem = { monthly: '', remainingMonths: '', interestRate: '' };
  SAVINGS_CATEGORIES.forEach(({ key }) => {
    setField(`assets.savingsPlan.breakdown.${key}`, { ...emptyItem });
  });
  const customItems = (getIn(formData, 'assets.savingsPlan.customItems') || []).map((item) => ({
    ...item,
    monthly: '',
    remainingMonths: '',
    interestRate: '',
  }));
  setField('assets.savingsPlan.customItems', customItems);
  setField('assets.savingsPlan.monthly', 0);
  setField('assets.savingsPlan.annual', 0);
  setField('assets.savingsPlan.retirementMonthly', 0);
  setField('assets.savingsPlan.retirementAnnual', 0);
  setField('assets.savingsPlan.additionalRetirementMonthly', 0);
  setField('assets.savingsPlan.additionalRetirementAnnual', 0);
}

export default function Step3Savings() {
  const { formData, setField } = useFormData();
  const savingsMonthly = Number(getIn(formData, 'assets.savingsPlan.monthly')) || 0;
  const retirementSavingsMonthly = Number(getIn(formData, 'assets.savingsPlan.retirementMonthly')) || 0;
  // true: 사용자가 포함 버튼을 직접 선택한 경우 총 저축 합계에 중복으로 더하지 않는다.
  // false(새 진단 기본값): 버튼을 미리 선택하지 않고 별개 금액으로 더한다
  // (aggregate.js의 monthlySavings·totalSavingsAnnual 계산과 동일한 전제를 공유한다).
  const retirementIncluded = getIn(formData, 'assets.savingsPlan.retirementIncludedInTotal') !== false;
  const hasSavings = getIn(formData, 'assets.savingsPlan.hasSavings') !== false;
  const totalSavingsMonthly = retirementIncluded ? savingsMonthly : savingsMonthly + retirementSavingsMonthly;

  // v2(신규): 연금저축·IRP는 위 SavingsBreakdownField에서 이미 노후저축으로 자동 인식되므로,
  // 여기서는 "추가 노후준비 저축"만 별도로 입력받는다(aggregate.js의 v2 계산과 동일한 전제).
  // v1(레거시, 버전 필드 없음): 기존 "노후준비 월 저축액" + 포함 여부 체크박스를 그대로 보여준다.
  const isRetirementSavingsV2 = getIn(formData, 'assets.savingsPlan.retirementSavingsInputVersion') === 2;
  const pensionSavingsMonthly = Number(getIn(formData, 'assets.savingsPlan.breakdown.pensionSavings.monthly')) || 0;
  const irpMonthly = Number(getIn(formData, 'assets.savingsPlan.breakdown.irp.monthly')) || 0;
  const additionalRetirementMonthly = Number(getIn(formData, 'assets.savingsPlan.additionalRetirementMonthly')) || 0;
  const totalRetirementSavingsMonthly = pensionSavingsMonthly + irpMonthly + additionalRetirementMonthly;
  const totalSavingsMonthlyV2 = savingsMonthly + additionalRetirementMonthly;

  const setHasSavings = (value) => {
    updateSavingsPresence(formData, setField, value);
  };

  return (
    <div className="step">
      <h2 className="step-title">3. 저축</h2>

      <section className="step-section">
        <h3><span className="step-icon">🌱</span> 저축 · 노후준비</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          국민연금 · 개인연금 · 저축성보험(연금보험 등)처럼 노후를 위해 정기적으로 적립하는 금액을 포함해 입력해 주세요.
        </p>
        <PresenceField label="저축 여부" present={hasSavings} onChange={setHasSavings} presentLabel="저축 있음" absentLabel="저축 없음" />
        {hasSavings ? <>
        <SavingsBreakdownField
          basePath="assets.savingsPlan.breakdown"
          customPath="assets.savingsPlan.customItems"
          totalPath="assets.savingsPlan.monthly"
          annualPath="assets.savingsPlan.annual"
          categories={SAVINGS_CATEGORIES}
        />
        {isRetirementSavingsV2 ? (
          <>
            <p className="field-helper" style={{ marginTop: 10 }}>
              입력한 연금저축과 IRP는 노후준비 저축으로 자동 포함됩니다.
            </p>
            <div className="field-grid" style={{ marginTop: 10 }}>
              <AutoAnnualField
                monthlyPath="assets.savingsPlan.additionalRetirementMonthly"
                annualPath="assets.savingsPlan.additionalRetirementAnnual"
                label="추가 노후준비 저축"
                helper="연금저축·IRP 외에 노후 목적으로 따로 저축하고 있는 금액이 있다면 입력해 주세요."
                helperClassName="field-helper--prominent"
              />
            </div>

            <table className="grade-table compact" style={{ marginTop: 16 }}>
              <tbody>
                <tr className="total-row"><td>총 저축 합계(월)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(totalSavingsMonthlyV2)}</td></tr>
                <tr className="total-row"><td>총 저축 합계(연)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(totalSavingsMonthlyV2 * 12)}</td></tr>
                <tr><td>연금저축(월)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(pensionSavingsMonthly)}</td></tr>
                <tr><td>IRP(월)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(irpMonthly)}</td></tr>
                <tr><td>추가 노후준비 저축(월)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(additionalRetirementMonthly)}</td></tr>
                <tr className="total-row"><td>노후준비 저축 합계(월)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(totalRetirementSavingsMonthly)}</td></tr>
              </tbody>
            </table>
          </>
        ) : (
          <>
            <div className="field-grid" style={{ marginTop: 10 }}>
              <AutoAnnualField
                monthlyPath="assets.savingsPlan.retirementMonthly"
                annualPath="assets.savingsPlan.retirementAnnual"
                label="노후준비 월 저축액"
              />
            </div>
            <label
              className={`checkbox-pill is-navy ${retirementIncluded ? 'is-active' : ''}`}
              style={{ marginTop: 8, width: 'fit-content' }}
            >
              <input
                type="checkbox"
                checked={retirementIncluded}
                onChange={(e) => setField('assets.savingsPlan.retirementIncludedInTotal', e.target.checked)}
              />
              위 노후준비 저축액은 일반 저축액에 이미 포함되어 있어요
            </label>
            <span className="field-helper" style={{ display: 'block', marginTop: 6 }}>
              {retirementIncluded
                ? '입력한 노후준비 저축액은 지표 계산에 사용하며, 이미 일반 저축에 포함된 금액이므로 총 저축 합계에 다시 더하지 않습니다.'
                : '일반 저축과 겹치지 않는 별도 금액으로 보고, 총 저축 합계에 두 금액을 더합니다.'}
            </span>

            <table className="grade-table compact" style={{ marginTop: 16 }}>
              <tbody>
                <tr className="total-row"><td>총 저축 합계(월)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(totalSavingsMonthly)}</td></tr>
                <tr className="total-row"><td>총 저축 합계(연)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(totalSavingsMonthly * 12)}</td></tr>
                <tr><td>일반 저축</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(savingsMonthly)}</td></tr>
                <tr><td>노후준비 저축{retirementIncluded ? ' (일반 저축에 포함됨)' : ''}</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(retirementSavingsMonthly)}</td></tr>
              </tbody>
            </table>
          </>
        )}
        </> : <p className="field-helper">현재 납입하는 저축액은 0원으로 반영됩니다. 기존 보유자산은 유지됩니다.</p>}
      </section>
    </div>
  );
}
