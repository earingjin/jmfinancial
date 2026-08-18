import SectionBadge from './SectionBadge';
import { formatNumber } from '../../../utils/format';
import { getPeerAssetBarDisplay } from './peerAssetBarDisplay';

const MAX_BAR_HEIGHT = 150;

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

// 자산현황_세부내역 페이지 하단에 함께 표시되는 섹션(별도 페이지 아님) - PageFrame을 여기서
// 감싸지 않고, 호출하는 쪽(HouseholdDetailPage)의 페이지 안에 그대로 들어간다.
export default function PeerComparisonPage({ peerComparison }) {
  const { ageBrackets, focusCompare } = peerComparison;

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
    <div style={{ marginTop: 22 }}>
      <SectionBadge number="2" label="또래자산비교" />
      <p className="intro-text" style={{ marginBottom: 10 }}>
        현금흐름은 우리 가정에 들어오고 나가는 돈을 나타냅니다. 안정적인 미래 현금을 위해서는 현재 삶을 위한
        생활비와 저축에 대한 적정 밸런스가 필요합니다. 현재 생활비 수준과 돈을 사용하는 습관이 미래 노후
        생활비에도 그대로 영향을 줍니다.
      </p>

      <div className="fine-print" style={{ marginBottom: 14 }}>
        아래 연령대별 평균값은 2025년도 금융가계복지데이터를 근거로 한 데이터입니다.
      </div>

      <div className="asset-chart-layout">
        <div className="asset-chart-main">
          <div className="asset-chart-legend">
            <span><i className="asset-legend-swatch asset-legend-average" />평균</span>
            <span><i className="asset-legend-swatch asset-legend-net" />순자산</span>
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
  );
}
