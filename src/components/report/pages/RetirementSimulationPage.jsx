import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import AIFeedbackBox from './AIFeedbackBox';
import { formatWon, formatPercent, round1 } from '../../../utils/format';

// 국민연금 수급개시연령은 출생연도별로 법정 고정값이다(계산치가 아닌 참고 자료).
// 정년(고정 60세)과 수급개시연령 사이의 "소득공백기간"을 함께 보여준다.
const PENSION_COHORTS = [
  { range: '1957~1960년', from: 1957, to: 1960, retireAge: 60, pensionAge: 62, gapYears: 2 },
  { range: '1961~1964년', from: 1961, to: 1964, retireAge: 60, pensionAge: 63, gapYears: 3 },
  { range: '1965~1968년', from: 1965, to: 1968, retireAge: 60, pensionAge: 64, gapYears: 4 },
  { range: '1969년 이후', from: 1969, to: Infinity, retireAge: 60, pensionAge: 65, gapYears: 5 },
];

export default function RetirementSimulationPage({ simulation, aggregates: agg, retirementLivingCost, feedbackBars, feedbackPension, pageNumber, totalPages }) {
  const retirementAge = simulation.currentAge + simulation.yearsToRetirement;
  const currentReadyAssets = agg.liquidAssets + agg.financialAssetsTotal + agg.pensionAssets;
  const birthYear = new Date().getFullYear() - simulation.currentAge;
  const pensionCohort = PENSION_COHORTS.find((c) => birthYear >= c.from && birthYear <= c.to);

  const bars = [
    { label: `현재(${simulation.currentAge}세)\n현금·금융·연금자산`, value: currentReadyAssets, color: '#d9c7a3' },
    { label: `은퇴시점(${retirementAge}세)\n자체 준비자산`, value: simulation.readyAssetsAtRetirement, color: 'var(--navy-700)' },
    { label: `은퇴시점(${retirementAge}세)\n필요 준비자산`, value: simulation.requiredAtRetirement, color: 'var(--red)' },
  ];
  const maxBarValue = Math.max(...bars.map((b) => b.value), 1);
  const MAX_BAR_HEIGHT = 90;

  return (
    <PageFrame eyebrow="Retirement Simulation" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="7" label="은퇴자산 시뮬레이션" />
      <div className="shortfall-headline">
        <div className="lead">은퇴시점 필요자금에 비해</div>
        <div className="amount">{formatWon(simulation.shortfall)}</div>
        <div className="lead">부족할 것으로 예상돼요</div>
      </div>
      <div className="shortfall-sub">
        {retirementAge}세부터 {round1(retirementAge + simulation.retirementYears)}세까지 매년 목표 생활비(월 {formatWon(retirementLivingCost)})를 감당하려면<br />
        은퇴시점에 준비자산 {formatWon(simulation.requiredAtRetirement)}이 필요해요
      </div>

      <div className="bar-chart-wrap" style={{ height: 150 }}>
        {bars.map((bar) => (
          <div className="bar-col" key={bar.label}>
            <div className="bar-value-tag">{formatWon(bar.value)}</div>
            <div className="bar-fill" style={{ height: `${Math.max(4, (bar.value / maxBarValue) * MAX_BAR_HEIGHT)}px`, background: bar.color }} />
            <div className="bar-caption">{bar.label.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div>
          </div>
        ))}
      </div>

      <div className="bar-legend" style={{ margin: '4px auto 0' }}>
        <div className="bar-legend-item"><span className="pie-dot" style={{ background: 'var(--navy-700)' }} />자체 준비자산 <span className="val num">{formatWon(simulation.readyAssetsAtRetirement)}</span></div>
        <div className="bar-legend-item"><span className="pie-dot" style={{ background: 'var(--red)' }} />필요 준비자산 <span className="val num">{formatWon(simulation.requiredAtRetirement)}</span></div>
        <div className="bar-legend-item"><span className="pie-dot" style={{ background: 'var(--red)' }} />부족금액 <span className="val num" style={{ color: 'var(--red)' }}>{formatWon(simulation.shortfall)}</span></div>
        <div className="bar-legend-item"><span className="pie-dot" style={{ background: 'transparent' }} />준비율 <span className="val num" style={{ color: 'var(--navy-800)' }}>{formatPercent(simulation.preparationRate)}</span></div>
      </div>

      <div style={{ margin: '14px 0' }}>
        <AIFeedbackBox text={feedbackBars} />
      </div>

      <h3 className="card-title" style={{ margin: '18px 0 6px' }}>정년 · 국민연금 수급개시연령 · 소득공백기간</h3>
      <table className="grade-table compact" style={{ marginBottom: 6 }}>
        <thead>
          <tr>
            <th>출생연도</th>
            <th style={{ textAlign: 'right' }}>정년</th>
            <th style={{ textAlign: 'right' }}>국민연금 수급개시</th>
            <th style={{ textAlign: 'right' }}>소득공백기간</th>
            <th style={{ textAlign: 'right' }}>필요 금액(월)</th>
            <th style={{ textAlign: 'right' }}>필요 금액(년)</th>
            <th style={{ textAlign: 'right' }}>총 필요 금액</th>
          </tr>
        </thead>
        <tbody>
          {PENSION_COHORTS.map((c) => {
            const annualNeeded = retirementLivingCost * 12;
            const totalNeeded = annualNeeded * c.gapYears;
            return (
              <tr key={c.range} className={pensionCohort?.range === c.range ? 'grade-current' : ''}>
                <td>{c.range}{pensionCohort?.range === c.range ? ' ← 귀하' : ''}</td>
                <td className="num" style={{ textAlign: 'right' }}>{c.retireAge}세</td>
                <td className="num" style={{ textAlign: 'right' }}>{c.pensionAge}세</td>
                <td className="num" style={{ textAlign: 'right' }}>{c.gapYears}년</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatWon(retirementLivingCost)}</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatWon(annualNeeded)}</td>
                <td className="num" style={{ textAlign: 'right' }}>{formatWon(totalNeeded)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="fine-print" style={{ marginBottom: 6 }}>
        필요 금액은 귀하의 목표 생활비(월 {formatWon(retirementLivingCost)})를 기준으로, 정년부터 국민연금 수급개시 전까지의
        소득공백기간 동안 필요한 금액을 계산한 것입니다.
      </div>
      <div>
        <AIFeedbackBox text={feedbackPension} />
      </div>
    </PageFrame>
  );
}
