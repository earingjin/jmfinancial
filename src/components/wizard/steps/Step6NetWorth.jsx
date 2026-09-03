import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatWon } from '../../../utils/format';

export default function Step6NetWorth() {
  const { formData } = useFormData();
  const liquidAssets = Number(getIn(formData, 'assets.liquidAssets.total')) || 0;
  const fa = getIn(formData, 'assets.financialAssets') || {};
  const financialAssetsTotal = fa.inputMode === 'simple'
    ? Number(fa.total) || 0
    : ['stocks', 'funds', 'bonds', 'other'].reduce((s, k) => s + (Number(fa[k]) || 0), 0);
  const pensionAssets = Number(getIn(formData, 'assets.pensionAssets')) || 0;
  const realEstateTotal = Number(getIn(formData, 'assets.realEstateAssets.total')) || 0;
  const otherAssetsTotal = Number(getIn(formData, 'assets.otherAssets.total')) || 0;
  const totalAssets = liquidAssets + financialAssetsTotal + pensionAssets + realEstateTotal + otherAssetsTotal;
  const totalDebt = Number(getIn(formData, 'assets.debtStatus.totalBalance')) || 0;
  const netWorth = totalAssets - totalDebt;

  return (
    <div className="step">
      <h2 className="step-title">6. 순자산</h2>

      <section className="step-section">
        <h3><span className="step-icon">⚖️</span> 현재 순자산</h3>
        <table className="grade-table compact">
          <tbody>
            <tr className="total-row"><td>현재 순자산</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(netWorth)}</td></tr>
            <tr><td>총자산</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(totalAssets)}</td></tr>
            <tr><td>총부채</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(totalDebt)}</td></tr>
          </tbody>
        </table>
        <span className="field-helper">4. 자산, 5. 부채 단계에서 입력하신 값을 기준으로 자동 계산됩니다</span>
      </section>
    </div>
  );
}
