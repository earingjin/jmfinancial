import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import FinanceBarChart from './FinanceBarChart';
import { buildPieSegments } from '../../../utils/pieChart';
import { formatWon, formatPercent } from '../../../utils/format';

function formatEok(value) {
  if (value >= 10000) {
    const eok = Math.floor(value / 10000);
    const man = Math.round(value % 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString('ko-KR')}만원` : `${eok}억원`;
  }
  return formatWon(value);
}

// 현재소득 대비 저축·생활비 비중(참고용 단순 비율) - 새로운 판정 기준이 아니라 이미 있는 두 값의 나눗셈이다.
function ratio(part, whole) {
  return whole > 0 ? formatPercent((part / whole) * 100) : '-';
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

export default function CashFlowOutlookPage({ aggregates: agg, simulation, pageNumber, totalPages }) {
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
    { label: `현재(${simulation.currentAge}세)\n월 소득`, value: currentIncome, color: 'var(--navy-700)' },
    { label: '월 저축\n투자금액', value: currentSavings, color: 'var(--navy-600)' },
    { label: '현재 생활비', value: currentLivingCost, color: 'var(--red)' },
    { label: '노후 월생활비', value: retirementLivingCost, color: 'var(--red)' },
  ];

  return (
    <PageFrame eyebrow="Retirement Cash Flow" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="1" label="현금흐름" />
      <p className="intro-text" style={{ marginBottom: 14 }}>
        현금흐름은 우리 가정에 들어오고 나가는 돈을 나타냅니다. 안정적인 미래 현금흐름을 위해서는 현재 삶을 위한
        생활비와 미래 삶을 위한 저축에 대한 적정 밸런스가 필요합니다. 현재 생활비 수준과 돈을 사용하는 습관이
        미래 노후 생활비에도 그대로 영향을 준다는 것을 기억하며 현재 소비를 관리해주세요.
      </p>

      <FinanceBarChart bars={bars} zeroLabel="-" />

      <table className="grade-table compact" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th />
            <th style={{ textAlign: 'right' }}>현재 소득(월)</th>
            <th style={{ textAlign: 'right' }}>현재 저축/투자</th>
            <th style={{ textAlign: 'right' }}>현재 생활비</th>
            <th style={{ textAlign: 'right' }}>노후 월생활비</th>
            <th style={{ textAlign: 'right' }}>노후 목돈</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>금액</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(currentIncome)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(currentSavings)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(currentLivingCost)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatWon(retirementLivingCost)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{formatEok(retirementLumpSum)}</td>
          </tr>
          <tr>
            <td>(%)</td>
            <td className="num" style={{ textAlign: 'right' }}>100%</td>
            <td className="num" style={{ textAlign: 'right' }}>{ratio(currentSavings, currentIncome)}</td>
            <td className="num" style={{ textAlign: 'right' }}>{ratio(currentLivingCost, currentIncome)}</td>
            <td className="num" style={{ textAlign: 'right' }}>-</td>
            <td className="num" style={{ textAlign: 'right' }}>-</td>
          </tr>
        </tbody>
      </table>
      <div className="fine-print" style={{ marginTop: 8 }}>
        &apos;노후 목돈&apos;은 은퇴시점부터 목표 생활비를 감당하기 위해 필요한 준비자산 총액입니다(은퇴자산 시뮬레이션과 동일 기준).
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionBadge number="2" label="은퇴자산 종합분석결과" />
      </div>

      <h3 className="card-title" style={{ marginBottom: 8 }}>■ 은퇴부족자금</h3>
      <table className="grade-table compact" style={{ marginBottom: 14 }}>
        <tbody>
          <tr><td>은퇴 시 필요한 총금액</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(retirementLumpSum)}</td></tr>
          <tr><td>은퇴 시까지 준비 가능한 금액</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(simulation.readyAssetsAtRetirement)}</td></tr>
          <tr><td>은퇴 시점에서 부족한 금액</td><td className="num" style={{ textAlign: 'right' }}>{formatWon(simulation.shortfall)}</td></tr>
          <tr><td>현재 일시금으로 준비할 자금</td><td className="num" style={{ textAlign: 'right', fontWeight: 800 }}>산출 불가</td></tr>
          <tr><td>월 추가 적립액(정액)</td><td className="num" style={{ textAlign: 'right', fontWeight: 800 }}>산출 불가</td></tr>
          <tr><td>월 추가 적립액(증액) - 증액률 연 5%</td><td className="num" style={{ textAlign: 'right' }}>산출 불가</td></tr>
        </tbody>
      </table>
      <div className="fine-print" style={{ marginBottom: 14 }}>
        &apos;현재 일시금으로 준비할 자금&apos;과 &apos;월 추가 적립액&apos;은 현재가치 환산·적립 이자율 가정이 필요한 항목으로, 아직 계산
        로직이 마련되지 않아 산출하지 않습니다.
      </div>

      <h3 className="card-title" style={{ marginBottom: 8 }}>■ 은퇴자금 달성률</h3>
      <div className="retirement-achievement-layout">
        <table className="grade-table compact">
          <thead>
            <tr><th>구 분</th><th style={{ textAlign: 'right' }}>필요자금</th><th style={{ textAlign: 'right' }}>준비자금</th><th style={{ textAlign: 'right' }}>부족자금</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>금 액</td>
              <td className="num" style={{ textAlign: 'right', fontWeight: 800 }}>{formatWon(retirementLumpSum)}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(simulation.readyAssetsAtRetirement)}</td>
              <td className="num" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--red)' }}>{formatWon(simulation.shortfall)}</td>
            </tr>
            <tr>
              <td>달 성 율</td>
              <td className="num" style={{ textAlign: 'right' }}>100%</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatPercent(readyPercent)}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatPercent(shortfallPercent)}</td>
            </tr>
          </tbody>
        </table>

        <div className="retirement-donut-wrap">
          {/* buildPieSegments의 labels는 "속이 찬 파이"용 반지름 기준이라 도넛의 뚫린 중앙 구멍
              안쪽에 찍혀 안 보이게 된다 - 기존 DonutChart.jsx와 동일하게 도넛에서는 링 안 라벨을
              그리지 않고, 범례에 퍼센트를 표기하는 방식만 쓴다. */}
          <svg viewBox={donut.viewBox} width={donut.size} height={donut.size} role="img" aria-label={`은퇴자금 달성률: 준비자금 ${formatPercent(readyPercent)}, 부족자금 ${formatPercent(shortfallPercent)}`}>
            {donut.paths.map((p) => <path key={p.key} d={p.d} fill={p.color} />)}
            <circle cx={donut.size / 2} cy={donut.size / 2} r={donut.size * 0.36} fill="var(--card)" />
          </svg>
          <ul className="retirement-donut-legend">
            <li><span className="pie-dot" style={{ background: 'var(--navy-700)' }} />준비자금 {formatPercent(readyPercent)}</li>
            <li><span className="pie-dot" style={{ background: 'var(--red)' }} />부족자금 {formatPercent(shortfallPercent)}</li>
          </ul>
        </div>
      </div>
    </PageFrame>
  );
}
