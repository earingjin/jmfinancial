import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import FinanceBarChart from './FinanceBarChart';
import { buildPieSegments } from '../../../utils/pieChart';
import { formatNumber, formatWon, formatPercent } from '../../../utils/format';

function round1(v) {
  return Math.round(v * 10) / 10;
}

export default function CashFlowOutlookPage({ aggregates: agg, simulation, feedback, pageNumber, totalPages }) {
  const currentIncome = agg.monthlyIncome;
  const currentSavings = agg.monthlySavings;
  const currentLivingCost = agg.totalExpenseMonthlyExSavings;
  const retirementLivingCost = simulation.retirementLivingCostNow;
  const retirementLumpSum = simulation.requiredAtRetirement;

  // 준비율(%)은 100을 넘을 수 있으나(자체 준비자산 > 필요자산), 달성률 표/도넛은 0~100% 범위로만
  // 의미가 있으므로 표시용으로만 클램프한다 - simulation.preparationRate 원본 값 자체는 건드리지 않는다.
  const readyPercent = Math.min(100, Math.max(0, simulation.preparationRate));
  const shortfallPercent = round1(100 - readyPercent);
  const donut = buildPieSegments([
    { key: 'ready', label: '준비자금', value: readyPercent, color: 'var(--navy-700)' },
    { key: 'shortfall', label: '부족자금', value: shortfallPercent, color: 'var(--red)' },
  ]);

  const bars = [
    { label: `현재(${formatNumber(simulation.currentAge)}세)\n월 소득`, value: currentIncome, color: 'var(--navy-700)' },
    { label: '월 저축\n투자금액', value: currentSavings, color: 'var(--navy-600)' },
    { label: '현재 생활비', value: currentLivingCost, color: 'var(--red)' },
    { label: '노후 월생활비', value: retirementLivingCost, color: 'var(--red)' },
  ];

  return (
    <PageFrame eyebrow="Retirement Cash Flow" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="4" label="현금흐름 및 은퇴자산 분석" />
      <p className="intro-text" style={{ marginBottom: 14 }}>
        현금흐름은 우리 가정에 들어오고 나가는 돈을 나타냅니다. 안정적인 미래 현금흐름을 위해서는 현재 삶을 위한
        생활비와 미래 삶을 위한 저축에 대한 적정 밸런스가 필요합니다. 현재 생활비 수준과 돈을 사용하는 습관이
        미래 노후 생활비에도 그대로 영향을 준다는 것을 기억하며 현재 소비를 관리해주세요.
      </p>

      <FinanceBarChart bars={bars} zeroLabel="-" showValues />

      <div className="fine-print report-cashflow-chart-note">
        {feedback || '현재 소득과 생활비 정보를 확인하면 저축 여력과 노후 생활비 목표에 대한 안내를 확인할 수 있습니다.'}
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionBadge label="은퇴자산 종합분석결과" />
      </div>

      <h3 className="card-title" style={{ marginBottom: 8 }}>■ 은퇴자금 달성률</h3>
      <div className="retirement-achievement-layout">
        <div className="retirement-donut-wrap">
          {/* buildPieSegments의 labels는 "속이 찬 파이"용 반지름 기준이라 도넛의 뚫린 중앙 구멍
              안쪽에 찍혀 안 보이게 된다 - 기존 DonutChart.jsx와 동일하게 도넛에서는 링 안 라벨을
              그리지 않고, 범례에 퍼센트를 표기하는 방식만 쓴다. */}
          <svg viewBox={donut.viewBox} width={donut.size} height={donut.size} role="img" aria-label={`은퇴자금 달성률: 준비자금 ${formatPercent(readyPercent)}, 부족자금 ${formatPercent(shortfallPercent)}`}>
            {donut.paths.map((p) => <path key={p.key} d={p.d} fill={p.color} />)}
            <circle cx={donut.size / 2} cy={donut.size / 2} r={donut.size * 0.36} fill="var(--card)" />
            <text className="retirement-donut-center-label" x={donut.size / 2} y={(donut.size / 2) - 5}>준비율</text>
            <text className="retirement-donut-center-value" x={donut.size / 2} y={(donut.size / 2) + 12}>{formatPercent(readyPercent)}</text>
          </svg>
          <ul className="retirement-donut-legend">
            <li><span className="pie-dot" style={{ background: 'var(--navy-700)' }} />준비자금 {formatPercent(readyPercent)}</li>
            <li><span className="pie-dot" style={{ background: 'var(--red)' }} />부족자금 {formatPercent(shortfallPercent)}</li>
          </ul>
        </div>
        <div className="retirement-achievement-copy">
          <strong>은퇴자금 준비율 {formatPercent(readyPercent)}</strong>
          <span>필요자금과 준비자금의 금액은 아래 은퇴부족자금 표에서 확인할 수 있습니다.</span>
          <div className="retirement-achievement-rows">
            <div className="retirement-achievement-row" style={{ color: 'var(--ink-soft)' }}>
              <span>은퇴 시 필요한 총금액</span><b>{formatWon(retirementLumpSum)}</b>
            </div>
            <div className="retirement-achievement-row is-strong">
              <span>은퇴 시까지 준비 가능한 금액</span><b>{formatWon(simulation.readyAssetsAtRetirement)}</b>
            </div>
          </div>
        </div>
      </div>

      <h3 className="card-title" style={{ marginTop: 22, marginBottom: 8 }}>■ 은퇴부족자금</h3>
      <table className="grade-table compact retirement-shortfall-table" style={{ marginBottom: 14 }}>
        <tbody>
          <tr style={{ color: 'var(--ink-soft)' }}><td>현재 준비자산</td><td className="num">{formatWon(simulation.currentReadyAssets)}</td></tr>
          <tr><td>현재 자산의 은퇴 시점 예상금액</td><td className="num">{formatWon(simulation.currentAssetsAtRetirement)}</td></tr>
          <tr><td>은퇴 전까지 추가 저축 예상금액</td><td className="num">{formatWon(simulation.futureSavingsAtRetirement)}</td></tr>
          <tr style={{ color: 'var(--ink-soft)' }}><td>은퇴 시 필요한 총금액</td><td className="num">{formatWon(retirementLumpSum)}</td></tr>
          <tr><td>은퇴 시까지 준비 가능한 금액</td><td className="num">{formatWon(simulation.readyAssetsAtRetirement)}</td></tr>
          <tr className="total-row"><td>은퇴 시점에서 부족한 금액</td><td className="num is-shortfall">{formatWon(simulation.shortfall)}</td></tr>
        </tbody>
      </table>
      <div className="fine-print" style={{ marginBottom: 14 }}>
        준비 가능 금액은 현재 준비자산과 은퇴 전까지의 추가 저축을 각각 기존 예상 운용수익률로 반영한 값입니다.
      </div>
    </PageFrame>
  );
}
