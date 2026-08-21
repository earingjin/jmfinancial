import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import { formatWon, formatPercent } from '../../../utils/format';

export default function HouseholdDetailPage({ aggregates: agg, indicators, debtBreakdown, otherLivingExpenseItems, otherLiquidAssetItems, pageNumber, totalPages }) {
  const householdIndicator = indicators.find((i) => i.key === 'household');
  const financialAssetIndicator = indicators.find((i) => i.key === 'financialAssetRatio');
  const fixedExpenseWithSavings = agg.fixedExpenseMonthly + agg.monthlySavings;
  // 현금성 자산의 "기본 항목 외 추가" 종류별 항목 - 이미 위 현금성자산 합계에 포함된 값을
  // 항목별로 풀어서 보여줄 뿐이므로 총자산 계산에는 영향이 없다.
  const enteredLiquidItems = (otherLiquidAssetItems || []).filter((item) => Number(item.value) > 0);
  const assetRows = [
    { label: '현금성자산', value: agg.liquidAssets },
    ...enteredLiquidItems.map((item) => ({ label: `└ ${item.label}(기타)`, value: item.value, isSub: true })),
    { label: '금융자산', value: agg.financialAssetsTotal },
    { label: '연금자산', value: agg.pensionAssets },
    { label: '부동산자산', value: agg.realEstateTotal },
    { label: '기타 자산', value: agg.otherAssetsTotal },
  ];
  const enteredDebts = (debtBreakdown || []).filter((item) => Number(item.value) > 0);
  const debtRows = enteredDebts.length > 0
    ? [...enteredDebts, { key: 'debt-total', label: '부채 합계', value: agg.totalDebt, isTotal: true }]
    : [{ key: 'debt-total', label: '부채 합계', value: agg.totalDebt, isTotal: true }];
  const detailRowCount = Math.max(assetRows.length, debtRows.length);

  return (
    <PageFrame eyebrow="Household Cash Flow" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="3" label="자산·부채 현황" />
      <h3 className="card-title" style={{ marginBottom: 6 }}>① 지출 현황 — 고정지출 (5개 항목, 월평균, 만원)</h3>
      <table className="grade-table compact">
        <thead><tr><th>항목</th><th style={{ textAlign: 'right' }}>금액</th></tr></thead>
        <tbody>
          <tr><td>생활비(식비 · 생필품 등)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.monthlyLivingCost)}</td></tr>
          {/* 생활비 세부의 "기타지출" 종류별 항목 - 이미 위 생활비 합계에 포함된 값을 항목별로
              풀어서 보여줄 뿐이므로 고정지출 합계 계산에는 영향이 없다. */}
          {(otherLivingExpenseItems || []).map((item) => (
            <tr key={item.key}>
              <td style={{ paddingLeft: 20, color: 'var(--ink-soft)', fontSize: 11 }}>└ {item.label}(기타지출)</td>
              <td className="num" style={{ textAlign: 'right', color: 'var(--ink-soft)', fontSize: 11 }}>{formatWon(item.value)}</td>
            </tr>
          ))}
          <tr><td>주거비(관리비 · 공과금 · 통신비)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.monthlyHousingCost)}</td></tr>
          <tr><td>보장성보험료</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.monthlyInsurancePremium)}</td></tr>
          <tr><td>부채상환액</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.monthlyDebtRepayment)}</td></tr>
          <tr><td>저축 · 투자액</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.monthlySavings)}</td></tr>
          <tr className="total-row"><td>고정지출 합계(월평균)</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(fixedExpenseWithSavings)}</td></tr>
        </tbody>
      </table>
      <div className="fine-print" style={{ marginBottom: 8 }}>
        저축 · 투자액 {formatWon(agg.monthlySavings)}은 소멸성 지출이 아닌 자산증가로 분류되어, 가계수지지표 계산 시 총지출에서 제외되고 총저축성향지표 계산에 활용됩니다.
      </div>

      <div className="indicator-feedback" style={{ marginBottom: 8 }}>
        귀하의 월평균 경상지출(저축 제외)은 {formatWon(agg.totalExpenseMonthlyExSavings)}이고, 연간 경상지출은 {formatWon(agg.totalExpenseMonthlyExSavings * 12)}입니다.
        {householdIndicator?.notCalculable && <> {householdIndicator.reason}</>}
        {householdIndicator && !householdIndicator.notCalculable && (
          <> 총소득 대비 경상지출 비중은 {formatPercent(householdIndicator.value)}로, 나머지 {formatPercent(round1(100 - householdIndicator.value))}가 저축여력입니다.</>
        )}
      </div>

      <h3 className="card-title" style={{ marginBottom: 6 }}>② 자산 · 부채 현황 (만원)</h3>
      <table className="grade-table compact">
        <thead><tr><th>자산</th><th style={{ textAlign: 'right' }}>금액</th><th>부채</th><th style={{ textAlign: 'right' }}>금액</th></tr></thead>
        <tbody>
          {Array.from({ length: detailRowCount }, (_, index) => {
            const asset = assetRows[index];
            const debt = debtRows[index];
            return (
              <tr key={debt?.key || `asset-${index}`} className={debt?.isTotal ? 'debt-total-row' : undefined}>
                <td style={asset?.isSub ? { color: 'var(--ink-soft)', fontSize: 11 } : undefined}>{asset?.label || ''}</td>
                <td className="num" style={{ textAlign: 'right', ...(asset?.isSub ? { color: 'var(--ink-soft)', fontSize: 11 } : {}) }}>
                  {asset ? formatWon(asset.value) : ''}
                </td>
                <td>{debt?.label || ''}</td>
                <td className="num" style={{ textAlign: 'right' }}>{debt ? formatWon(debt.value) : ''}</td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td>총자산</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.totalAssets)}</td>
            <td>순자산</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(agg.netWorth)}</td>
          </tr>
        </tbody>
      </table>
      <div className="indicator-feedback">
        귀하의 총자산은 {formatWon(agg.totalAssets)}, 총부채는 {formatWon(agg.totalDebt)}, 순자산은 {formatWon(agg.netWorth)}입니다.
        {financialAssetIndicator?.notCalculable && <> {financialAssetIndicator.reason}</>}
        {financialAssetIndicator && !financialAssetIndicator.notCalculable && (
          <> 총자산 중 금융자산 비중은 {formatPercent(financialAssetIndicator.value)}로, 금융자산비중지표(권장 40% 이상)와 비교해 실물자산 편중 여부를 확인하세요.</>
        )}
      </div>
    </PageFrame>
  );
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
