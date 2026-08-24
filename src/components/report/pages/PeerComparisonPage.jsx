import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import { formatNumber, formatWon } from '../../../utils/format';
import { getPeerAssetBarDisplay } from './peerAssetBarDisplay';

const MAX_BAR_HEIGHT = 150;

function computeChartScale(values) {
  const maxValue = Math.max(...values.filter((v) => Number.isFinite(v)), 1);
  const chartMax = Math.max(10000, Math.ceil(maxValue / 10000) * 10000);
  const axisTicks = Array.from({ length: 7 }, (_, i) => Math.round(chartMax - (chartMax / 6) * i));
  return { chartMax, axisTicks };
}

// 순자산과 같은 연령대별 비교 차트(전 연령대 평균 + 본인 구간 실제값)를 연소득·금융자산에도 그대로 재사용한다.
function AgeBracketChart({ label, ageBrackets, valueKey }) {
  // 이 필드가 없는 과거 저장 결과(히스토리에서 연 리포트)도 있을 수 있어, 없으면 임의로 만들지 않고
  // 산출 불가로 표시한다(크래시로 리포트 전체가 빈 화면이 되는 것을 막는다).
  if (!ageBrackets || ageBrackets.length === 0) {
    return (
      <div>
        <div className="report-metric-chart-title"><strong>{label}</strong></div>
        <div className="fine-print">연령대별 비교 데이터 산출 불가(새로 진단하면 표시됩니다).</div>
      </div>
    );
  }
  const { chartMax } = computeChartScale(ageBrackets.flatMap((b) => [b.average, b[valueKey]]));

  return (
    <div>
      <div className="report-metric-chart-title"><strong>{label}</strong></div>
      <div className="asset-chart-legend">
        <span><i className="asset-legend-swatch asset-legend-average" />평균</span>
        <span><i className="asset-legend-swatch asset-legend-net" />우리집</span>
      </div>
      <div className="asset-chart-with-axis asset-chart-with-axis--labels-hidden">
        <div className="asset-chart-plot">
          {ageBrackets.map((b) => (
            <div key={b.key} className={`asset-chart-group${b.isUserBracket ? ' is-current' : ''}`}>
              <div className="asset-chart-bars" style={{ height: MAX_BAR_HEIGHT }}>
                <div className="asset-chart-bar-wrap">
                  <span className="asset-chart-value">{formatNumber(b.average)}</span>
                  <div className="asset-chart-bar asset-chart-bar--average" style={{ height: Math.max(3, (b.average / chartMax) * MAX_BAR_HEIGHT) }} />
                </div>
                {b.isUserBracket && b[valueKey] != null && (
                  <div className="asset-chart-bar-wrap" role="img" aria-label={`${b.label} 우리집 ${formatWon(b[valueKey])}`}>
                    <span className="asset-chart-value" aria-hidden="true">{formatNumber(b[valueKey])}</span>
                    <div
                      className="asset-chart-bar asset-chart-bar--net"
                      style={{ height: Math.max(3, (b[valueKey] / chartMax) * MAX_BAR_HEIGHT) }}
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
              <div className="asset-chart-label">{b.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssetValueBar({ value, tone, chartMax, contextLabel }) {
  const display = getPeerAssetBarDisplay(value, chartMax, MAX_BAR_HEIGHT);

  return (
    <div role="img" aria-label={`${contextLabel}. ${display.ariaLabel}`}>
      <span className="asset-chart-value" aria-hidden="true">{display.valueLabel}</span>
      {display.showBar ? (
        <div
          className={`asset-chart-bar asset-chart-bar--${tone}`}
          style={{ height: display.barHeight }}
          aria-hidden="true"
        />
      ) : (
        <div className="asset-chart-negative" aria-hidden="true">
          <strong>순자산 마이너스</strong>
          <span>{display.warningText}</span>
        </div>
      )}
    </div>
  );
}

// 원래는 HouseholdDetailPage 하단에 같은 페이지로 함께 표시했으나, 자산·부채 표에 항목이 많은
// 진단 결과에서는 두 섹션을 합친 내용이 인쇄 페이지 높이(고정 A4, overflow:hidden)를 넘어
// 아래쪽(이 섹션)이 통째로 잘려 보이지 않는 문제가 있었다. 데이터 양에 따라 넘칠 수 있는
// 섹션이라 별도 페이지로 분리해, 내용이 얼마나 많든 잘리지 않게 한다.
export default function PeerComparisonPage({ peerComparison, feedback, pageNumber, totalPages }) {
  const { ageBrackets, focusCompare } = peerComparison;
  const comparisonRows = [
    { key: 'netWorth', label: '순자산', metric: peerComparison.netWorth },
    { key: 'householdIncome', label: '연소득', metric: peerComparison.householdIncome },
    { key: 'financialAssets', label: '금융자산', metric: peerComparison.financialAssets },
  ];

  const maxValue = Math.max(
    ...ageBrackets.flatMap((b) => [b.average, b.netWorth]),
    focusCompare.peerAverage,
    focusCompare.userNetWorth,
    focusCompare.referenceAverage,
    1,
  );
  const chartMax = Math.max(10000, Math.ceil(maxValue / 10000) * 10000);
  const axisTicks = Array.from({ length: 7 }, (_, i) => Math.round(chartMax - (chartMax / 6) * i));

  return (
    <PageFrame eyebrow="Peer Comparison" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge label="또래자산비교" />
      <p className="intro-text" style={{ marginBottom: 10 }}>
        현금흐름은 우리 가정에 들어오고 나가는 돈을 나타냅니다. 안정적인 미래 현금을 위해서는 현재 삶을 위한
        생활비와 저축에 대한 적정 밸런스가 필요합니다. 현재 생활비 수준과 돈을 사용하는 습관이 미래 노후
        생활비에도 그대로 영향을 줍니다.
      </p>

      <div className="fine-print" style={{ marginBottom: 14 }}>
        아래 연령대별 평균값은 2025년도 금융가계복지데이터를 근거로 한 데이터입니다.
      </div>

      <div className="peer-chart-card">
        <div className="report-metric-chart-title"><strong>순자산</strong></div>
        <div className="asset-chart-layout">
          <div className="asset-chart-main">
            <div className="asset-chart-legend">
              <span><i className="asset-legend-swatch asset-legend-average" />평균</span>
              <span><i className="asset-legend-swatch asset-legend-net" />우리집</span>
            </div>
            <div className="asset-chart-with-axis">
              <div className="asset-chart-axis" aria-hidden="true">
                {axisTicks.map((tick) => <span key={tick}>{formatNumber(tick)}</span>)}
              </div>
              <div className="asset-chart-plot">
                {ageBrackets.map((b) => (
                  <div key={b.key} className={`asset-chart-group${b.isUserBracket ? ' is-current' : ''}`}>
                    <div className="asset-chart-bars" style={{ height: MAX_BAR_HEIGHT }}>
                      <div className="asset-chart-bar-wrap">
                        <span className="asset-chart-value">{formatNumber(b.average)}</span>
                        <div className="asset-chart-bar asset-chart-bar--average" style={{ height: Math.max(3, (b.average / chartMax) * MAX_BAR_HEIGHT) }} />
                      </div>
                      {b.isUserBracket && (
                        <div className="asset-chart-bar-wrap">
                          <AssetValueBar value={b.netWorth} tone="net" chartMax={chartMax} contextLabel={`${b.label} 순자산`} />
                        </div>
                      )}
                    </div>
                    <div className="asset-chart-label">{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="asset-chart-focus">
            <div className="asset-focus-plot">
              {[
                { label: '연령평균', value: focusCompare.peerAverage, tone: 'average' },
                { label: '현재_우리집', value: focusCompare.userNetWorth, tone: 'net' },
                { label: '60세', value: focusCompare.referenceAverage, tone: 'average' },
              ].map((item) => (
                <div key={item.label} className="asset-focus-item">
                  <div className="asset-focus-bar-area">
                    <AssetValueBar value={item.value} tone={item.tone} chartMax={chartMax} contextLabel={item.label} />
                  </div>
                  <div className="asset-chart-label">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="report-metric-chart-row">
        <div className="peer-chart-card">
          <AgeBracketChart label="연소득" ageBrackets={peerComparison.incomeAgeBrackets} valueKey="annualIncome" />
        </div>
        <div className="peer-chart-card">
          <AgeBracketChart label="금융자산" ageBrackets={peerComparison.financialAssetsAgeBrackets} valueKey="financialAssets" />
        </div>
      </div>

      <table className="grade-table compact peer-report-compare-table">
        <thead><tr><th>비교 항목</th><th>우리집</th><th>또래 평균</th><th>평균 대비</th><th>상대 위치</th></tr></thead>
        <tbody>
          {comparisonRows.map(({ key, label, metric }) => (
            <tr key={key}>
              <td>{label}</td>
              <td className="num">{metric?.value == null ? '-' : formatWon(metric.value)}</td>
              <td className="num">{metric?.average == null ? '-' : formatWon(metric.average)}</td>
              <td className="num">{metric?.diffPercent == null ? '-' : `${metric.diffPercent > 0 ? '+' : ''}${metric.diffPercent}%`}</td>
              <td>{metric?.percentileLabel || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="peer-feedback-card">
        <strong>또래 비교 안내</strong>
        <p>{feedback || '자산과 소득 정보를 다시 확인하면 또래 가구와의 비교 안내를 확인할 수 있습니다.'}</p>
      </section>
      {peerComparison.benchmarkMeta && (
        <div className="fine-print peer-report-source">
          {peerComparison.benchmarkMeta.source}({peerComparison.benchmarkMeta.agency}) · {peerComparison.benchmarkMeta.ageBasis} 평균 · 자산·부채 {peerComparison.benchmarkMeta.assetAndDebtAsOf} 기준 · 소득 {peerComparison.benchmarkMeta.incomeYear}년 기준
        </div>
      )}
    </PageFrame>
  );
}
