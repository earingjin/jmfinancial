import NumberField from '../fields/NumberField';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

export default function Step6NetWorth() {
  const { formData } = useFormData();
  const liquidAssets = Number(getIn(formData, 'assets.liquidAssets.total')) || 0;
  const fa = getIn(formData, 'assets.financialAssets') || {};
  const financialAssetsTotal = ['stocks', 'funds', 'other']
    .reduce((s, k) => s + (Number(fa[k]) || 0), 0);
  const pensionAssets = Number(getIn(formData, 'assets.pensionAssets')) || 0;
  const realEstateTotal = Number(getIn(formData, 'assets.realEstateAssets.total')) || 0;
  const totalAssets = liquidAssets + financialAssetsTotal + pensionAssets + realEstateTotal;
  const totalDebt = Number(getIn(formData, 'assets.debtStatus.totalBalance')) || 0;
  const netWorth = totalAssets - totalDebt;

  return (
    <div className="step">
      <h2 className="step-title">6. 순자산</h2>

      <section className="step-section">
        <h3>⚖️ 현재 순자산</h3>
        <table className="grade-table compact">
          <tbody>
            <tr><td>총자산</td><td className="num" style={{ textAlign: 'right' }}>{totalAssets}만원</td></tr>
            <tr><td>총부채</td><td className="num" style={{ textAlign: 'right' }}>{totalDebt}만원</td></tr>
            <tr className="total-row"><td>현재 순자산</td><td className="num" style={{ textAlign: 'right' }}>{netWorth}만원</td></tr>
          </tbody>
        </table>
        <span className="field-helper">4. 자산, 5. 부채 단계에서 입력하신 값을 기준으로 자동 계산됩니다</span>
      </section>

      <section className="step-section">
        <h3>📅 순자산 비교</h3>
        <div className="field-grid">
          <NumberField path="assets.netWorthPriorYear" label="전년도(또는 기준 시점) 순자산" unit="만원" />
        </div>
      </section>
    </div>
  );
}
