import { formatWon, formatNumber } from '../../../utils/format';

function getNiceScale(maxValue, tickCount = 4) {
  const rawStep = Math.max(maxValue, 1) / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = niceNormalized * magnitude;
  // axisMax는 반드시 step * tickCount여야 마지막 눈금이 정확히 0이 된다(그렇지 않으면
  // maxValue가 step의 배수보다 조금만 작을 때 가장 아래 눈금이 0 밑으로(음수) 내려간다).
  const axisMax = Math.max(Math.ceil(Math.max(maxValue, 1) / step), tickCount) * step;
  return { axisMax, ticks: Array.from({ length: tickCount + 1 }, (_, index) => axisMax - (step * index)) };
}

export default function FinanceBarChart({ bars, tickStep, tickCount = 4, zeroLabel = '0', showValues = false, headroom = 0 }) {
  const maxValue = Math.max(...bars.map((b) => Math.max(0, b.value)), 1);
  const safeHeadroom = Math.max(0, headroom);
  const scaledMaxValue = maxValue * (1 + safeHeadroom);
  const scale = safeHeadroom > 0
    ? {
        axisMax: scaledMaxValue,
        ticks: Array.from(
          { length: tickCount + 1 },
          (_, index) => scaledMaxValue * ((tickCount - index) / tickCount),
        ),
      }
    : tickStep
    ? {
        axisMax: Math.max(tickStep, Math.ceil(scaledMaxValue / tickStep) * tickStep),
        ticks: Array.from(
          { length: Math.max(1, Math.ceil(scaledMaxValue / tickStep)) + 1 },
          (_, index) => (Math.max(1, Math.ceil(scaledMaxValue / tickStep)) - index) * tickStep,
        ),
      }
    : getNiceScale(scaledMaxValue, tickCount);
  const { axisMax, ticks } = scale;

  return (
    <div className="finance-bar-chart">
      <div className="finance-chart-unit">(단위: 만원)</div>
      <div className="finance-chart-body">
        <div className="finance-chart-axis" aria-hidden="true">
          {ticks.map((tick) => <span key={tick}>{tick === 0 ? zeroLabel : formatNumber(tick)}</span>)}
        </div>
        <div className="finance-chart-plot">
          <div className="finance-chart-grid" aria-hidden="true">
            {ticks.map((tick) => <i key={tick} />)}
          </div>
          <div className="finance-chart-bars">
            {bars.map((bar) => {
              const barHeight = Math.max(0, (Math.max(0, bar.value) / axisMax) * 100);
              // 막대가 축 최댓값에 닿아도 값 라벨이 차트 바깥(표·제목 영역)으로 올라가지 않도록,
              // 상단 12% 안에서는 라벨을 차트 안쪽에 표시한다.
              const valueLabelBottom = Math.min(88, barHeight);
              return (
                <div className="finance-chart-col" key={bar.label}>
                  {showValues && (
                    <span
                      className="finance-chart-value"
                      style={{ bottom: `${valueLabelBottom}%` }}
                    >
                      {formatWon(bar.value)}
                    </span>
                  )}
                  <div
                    className="finance-chart-fill"
                    style={{ height: `${Math.max(2, barHeight)}%`, background: bar.color }}
                    title={formatWon(bar.value)}
                  />
                  <div className="finance-chart-caption">
                    {bar.label.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
