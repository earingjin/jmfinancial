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
      <table className="grade-table household-detail-table">
        <thead><tr><th>항목</th><th>금액</th></tr></thead>
        <tbody>
          <tr><td>생활비(식비 · 생필품 등)</td><td className="num">{formatWon(agg.monthlyLivingCost)}</td></tr>
          {/* 생활비 세부의 "기타지출" 종류별 항목 - 이미 위 생활비 합계에 포함된 값을 항목별로
              풀어서 보여줄 뿐이므로 고정지출 합계 계산에는 영향이 없다. */}
          {(otherLivingExpenseItems || []).map((item) => (
            <tr key={item.key}>
              <td style={{ paddingLeft: 20, color: 'var(--ink-soft)', fontSize: 11 }}>└ {item.label}(기타지출)</td>
              <td className="num" style={{ color: 'var(--ink-soft)', fontSize: 11 }}>{formatWon(item.value)}</td>
            </tr>
          ))}
          <tr><td>주거비(관리비 · 공과금 · 통신비)</td><td className="num">{formatWon(agg.monthlyHousingCost)}</td></tr>
          <tr><td>보장성보험료</td><td className="num">{formatWon(agg.monthlyInsurancePremium)}</td></tr>
          <tr><td>부채상환액</td><td className="num">{formatWon(agg.monthlyDebtRepayment)}</td></tr>
          <tr><td>저축 · 투자액</td><td className="num">{formatWon(agg.monthlySavings)}</td></tr>
          <tr className="total-row"><td>고정지출 합계(월평균)</td><td className="num">{formatWon(fixedExpenseWithSavings)}</td></tr>
        </tbody>
      </table>
      <div className="fine-print" style={{ marginBottom: 8 }}>
        이 표는 매달 반복해서 나가는 생활비·주거비·보험료·부채 상환액과 저축·투자액을 함께 보여줍니다.
        합계에는 저축·투자액도 포함되지만, 저축은 소비한 돈이 아니라 자산으로 남는 돈이므로 실제 생활지출과는 구분해서 봅니다.
      </div>

      <section className="household-feedback-card household-feedback-card--expenses">
        <strong>고정지출 안내</strong>
        <p>
          매달 생활비와 고정비로 지출하는 금액은 평균 {formatWon(agg.totalExpenseMonthlyExSavings)}이며, 1년으로 환산하면 {formatWon(agg.totalExpenseMonthlyExSavings * 12)}입니다.
          {householdIndicator?.notCalculable && <> 현재 입력된 소득 정보만으로는 소득에 비해 지출이 어느 정도인지 판단하기 어렵습니다.</>}
          {householdIndicator && !householdIndicator.notCalculable && (
            <> 이는 소득의 {formatPercent(householdIndicator.value)}를 생활비와 고정비로 사용하고 있다는 뜻입니다. 비율이 높다면 매달 반복해서 나가는 비용 중 줄일 수 있는 항목이 있는지 살펴보세요.</>
          )}
        </p>
      </section>

      <h3 className="card-title" style={{ marginTop: 24, marginBottom: 6 }}>② 자산 · 부채 현황 (만원)</h3>
      <table className="grade-table household-detail-table">
        <thead><tr><th>자산</th><th>금액</th><th>부채</th><th>금액</th></tr></thead>
        <tbody>
          {Array.from({ length: detailRowCount }, (_, index) => {
            const asset = assetRows[index];
            const debt = debtRows[index];
            return (
              <tr key={debt?.key || `asset-${index}`} className={debt?.isTotal ? 'debt-total-row' : undefined}>
                <td style={asset?.isSub ? { color: 'var(--ink-soft)', fontSize: 11 } : undefined}>{asset?.label || ''}</td>
                <td className="num" style={asset?.isSub ? { color: 'var(--ink-soft)', fontSize: 11 } : undefined}>
                  {asset ? formatWon(asset.value) : ''}
                </td>
                <td>{debt?.label || ''}</td>
                <td className="num">{debt ? formatWon(debt.value) : ''}</td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td>총자산</td><td className="num">{formatWon(agg.totalAssets)}</td>
            <td>순자산</td><td className="num">{formatWon(agg.netWorth)}</td>
          </tr>
        </tbody>
      </table>
      <section className="household-feedback-card household-feedback-card--assets">
        <strong>자산·부채 안내</strong>
        <p>
          보유한 전체 자산은 {formatWon(agg.totalAssets)}, 갚아야 할 부채는 {formatWon(agg.totalDebt)}이며, 자산에서 부채를 뺀 실제 순자산은 {formatWon(agg.netWorth)}입니다.
          {financialAssetIndicator?.notCalculable && <> 현재 입력된 자산 정보만으로는 전체 자산 중 금융자산이 차지하는 정도를 판단하기 어렵습니다.</>}
          {financialAssetIndicator && !financialAssetIndicator.notCalculable && (
            <> 전체 자산 중 현금·예금·투자상품처럼 비교적 활용하기 쉬운 금융자산은 {formatPercent(financialAssetIndicator.value)}입니다. 이 비율이 낮다면 자산이 부동산 등에 많이 묶여 있어 갑자기 현금이 필요할 때 대응하기 어려울 수 있습니다.</>
          )}
        </p>
      </section>
    </PageFrame>
  );
}
