import { useState } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatWon } from '../../../utils/format';

export default function Step6NetWorth() {
  const { formData } = useFormData();
  const [assetDetailsOpen, setAssetDetailsOpen] = useState(false);
  const [debtDetailsOpen, setDebtDetailsOpen] = useState(false);
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
  const assetItems = [
    ['현금성 자산', liquidAssets],
    ['금융자산', financialAssetsTotal],
    ['연금자산', pensionAssets],
    ['부동산', realEstateTotal],
    ['기타 자산', otherAssetsTotal],
  ].filter(([, value]) => value > 0);
  const debtLabels = {
    mortgage: '주택담보대출', depositLoan: '보증금대출', businessLoan: '사업자대출',
    buildingLoan: '빌딩대출', carLoan: '차량대출', studentLoan: '학자금대출', otherLoan: '기타대출',
  };
  const debtBreakdown = getIn(formData, 'assets.debtStatus.breakdown') || {};
  const debtItems = getIn(formData, 'assets.debtStatus.inputMode') === 'detailed'
    ? Object.entries(debtLabels)
      .map(([key, label]) => [label, Number(debtBreakdown[key]?.principal) || 0])
      .filter(([, value]) => value > 0)
    : [];

  return (
    <div className="step">
      <h2 className="step-title">6. 순자산</h2>
      <section className="step-section">
        <h3><span className="step-icon">⚖️</span> 현재 순자산</h3>
        <div className="net-worth-summary">
          <div className="net-worth-summary-item">
            <div className="net-worth-summary-main"><span>총 자산</span><strong>{formatWon(totalAssets)}</strong></div>
            {assetItems.length > 0 && (
              <>
                <button type="button" className="net-worth-breakdown-toggle" aria-expanded={assetDetailsOpen} onClick={() => setAssetDetailsOpen((open) => !open)}>
                  {assetDetailsOpen ? '내역 접기 ∧' : '내역 보기 ▾'}
                </button>
                {assetDetailsOpen && <div className="net-worth-breakdown-list">
                  {assetItems.map(([label, value]) => <div className="net-worth-breakdown-row" key={label}><span>{label}</span><strong>{formatWon(value)}</strong></div>)}
                </div>}
              </>
            )}
          </div>
          <span className="net-worth-summary-operator" aria-hidden="true">−</span>
          <div className="net-worth-summary-item">
            <div className="net-worth-summary-main"><span>총 부채</span><strong>{formatWon(totalDebt)}</strong></div>
            {debtItems.length > 0 && (
              <>
                <button type="button" className="net-worth-breakdown-toggle" aria-expanded={debtDetailsOpen} onClick={() => setDebtDetailsOpen((open) => !open)}>
                  {debtDetailsOpen ? '내역 접기 ∧' : '내역 보기 ▾'}
                </button>
                {debtDetailsOpen && <div className="net-worth-breakdown-list">
                  {debtItems.map(([label, value]) => <div className="net-worth-breakdown-row" key={label}><span>{label}</span><strong>{formatWon(value)}</strong></div>)}
                </div>}
              </>
            )}
          </div>
          <span className="net-worth-summary-operator" aria-hidden="true">=</span>
          <div className="net-worth-summary-item net-worth-summary-item--result"><div className="net-worth-summary-main"><span>순자산</span><strong>{formatWon(netWorth)}</strong></div></div>
        </div>
        <span className="field-helper">4. 자산, 5. 부채 단계에서 입력하신 값을 기준으로 자동 계산됩니다</span>
      </section>
    </div>
  );
}
