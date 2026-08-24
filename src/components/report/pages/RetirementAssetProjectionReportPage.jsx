import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import { formatNumber, formatWon, formatPercent } from '../../../utils/format';
import { formatAssetProjectionOutlook, formatAssetProjectionReason } from '../../summary/summaryPresentation';

// 웹 요약 화면의 RetirementAssetProjectionChart와 동일한 규칙을 그대로 옮긴다: x축 나이 N은
// 항상 points[].age===N인 해의 "연말 잔액"이고(depletionAge 텍스트와 그래프의 0원 지점이
// 항상 같은 나이를 가리켜야 하므로), 은퇴 시작자산(연초 값)만 예외로 첫 점에 별도로 붙인다.
// 인쇄 페이지는 고정 높이(overflow:hidden)라 연도별 상세표는 넣지 않고 핵심 그래프·요약만 싣는다.
function AssetProjectionChart({ projection }) {
  const { points, retirementAge, lifeExpectancy, depletionAge } = projection;
  const chartPoints = [
    { age: retirementAge, value: points[0].startingBalance },
    ...points.map((p) => ({ age: p.age, value: p.endingBalance })),
  ];

  const width = 690;
  // 예상 목돈지출 표가 길어져도 고정 A4 페이지 안에 들어오도록 그래프 세로 공간을 압축한다.
  const height = 190;
  const plot = { left: 24, right: 24, top: 18, bottom: 30 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const minAge = retirementAge;
  const maxAge = lifeExpectancy;
  const dataMax = Math.max(...chartPoints.map((p) => p.value), 1);
  const dataMin = Math.min(...chartPoints.map((p) => p.value), 0);
  const minValue = depletionAge != null ? 0 : Math.max(0, dataMin);
  const maxValue = dataMax * 1.4;
  const x = (age) => plot.left + ((age - minAge) / Math.max(1, maxAge - minAge)) * plotWidth;
  const y = (value) => plot.top + plotHeight - ((Math.max(minValue, value) - minValue) / (maxValue - minValue)) * plotHeight;

  const linePoints = chartPoints.map((p) => `${x(p.age)},${y(p.value)}`).join(' ');
  const areaPoints = [
    `${x(minAge)},${y(minValue)}`,
    ...chartPoints.map((p) => `${x(p.age)},${y(p.value)}`),
    `${x(maxAge)},${y(minValue)}`,
  ].join(' ');

  const edgeAnchor = (age) => (age <= minAge ? 'start' : age >= maxAge ? 'end' : 'middle');
  const edgeDx = (age) => (age <= minAge ? 4 : age >= maxAge ? -4 : 0);
  const milestoneAges = [minAge, 70, 75, 80, 85, maxAge]
    .filter((age, i, arr) => age >= minAge && age <= maxAge && arr.indexOf(age) === i && age !== depletionAge);

  return (
    <div className="report-asset-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="은퇴 후 예상 자산잔액 추이">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const tickY = plot.top + plotHeight - ratio * plotHeight;
          return <line key={ratio} x1={plot.left} x2={width - plot.right} y1={tickY} y2={tickY} />;
        })}
        <polygon className="asset-area" points={areaPoints} />
        <polyline className="asset-line" points={linePoints} />
        {depletionAge != null && (
          <line className="depletion-line" x1={x(depletionAge)} x2={x(depletionAge)} y1={plot.top} y2={plot.top + plotHeight} />
        )}
        {milestoneAges.map((age) => {
          const value = age === minAge ? points[0].startingBalance : (points.find((p) => p.age === age)?.endingBalance ?? null);
          if (value == null) return null;
          return (
            <g key={age}>
              <circle className="asset-dot" cx={x(age)} cy={y(value)} r={age === minAge ? 4 : 3} />
              <text className="asset-value" style={{ textAnchor: edgeAnchor(age) }} x={x(age) + edgeDx(age)} y={Math.max(10, y(value) - 8)}>
                {formatWon(value)}
              </text>
              <text className="age-label" style={{ textAnchor: edgeAnchor(age) }} x={x(age) + edgeDx(age)} y={height - 13}>
                {age === minAge ? `은퇴 ${formatNumber(age)}세` : age === maxAge ? `기대수명 ${formatNumber(age)}세` : `${formatNumber(age)}세`}
              </text>
            </g>
          );
        })}
        {depletionAge != null && (
          <g>
            <circle className="asset-dot depletion-dot" cx={x(depletionAge)} cy={y(0)} r="4" />
            <text className="depletion-label" style={{ textAnchor: edgeAnchor(depletionAge) }} x={x(depletionAge) + edgeDx(depletionAge)} y={Math.max(10, y(0) - 8)}>
              ⚠ 자산 소진
            </text>
            <text className="age-label" style={{ textAnchor: edgeAnchor(depletionAge) }} x={x(depletionAge) + edgeDx(depletionAge)} y={height - 13}>
              {formatNumber(depletionAge)}세
            </text>
          </g>
        )}
      </svg>
      <div className="report-chart-legend">
        <span className="income">남은 준비자산</span>
        {depletionAge != null && <span className="expense">최초 자산 소진 예상</span>}
      </div>
    </div>
  );
}

export default function RetirementAssetProjectionReportPage({ retirementAssetProjection, pageNumber, totalPages }) {
  const projection = retirementAssetProjection;
  const calculable = projection && !projection.notCalculable && projection.points?.length > 0;
  const lumpSumEvents = calculable
    ? projection.points
      .filter((p) => p.lumpSumEvents?.length > 0)
      .flatMap((p) => p.lumpSumEvents.map((ev, i) => ({ ...ev, age: p.age, key: `${p.age}-${i}` })))
    : [];

  return (
    <PageFrame eyebrow="Retirement Asset Projection" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="9" label="예상 자산 유지 기간" />
      <p className="intro-text report-compact-intro">
        은퇴 후 예상 소득으로 부족한 생활비 · 목돈지출을 준비자산에서 충당한다고 가정했을 때, 자산이 몇 살까지
        유지되는지를 연 단위로 전망합니다.
      </p>

      {calculable ? (
        <>
          <div className="report-asset-stat-grid">
            <div>
              <span>은퇴 시작자산</span>
              <strong>{formatWon(projection.startingAssets)}</strong>
            </div>
            <div className="is-highlight">
              <span>{projection.assetsRemainAtLifeExpectancy ? '예상 자산 유지' : '최초 자산 소진 예상'}</span>
              <strong>{projection.assetsRemainAtLifeExpectancy ? '기대수명까지' : `${formatNumber(projection.depletionAge)}세`}</strong>
            </div>
            <div>
              <span>기대수명</span>
              <strong>{formatNumber(projection.lifeExpectancy)}세</strong>
            </div>
          </div>

          <AssetProjectionChart projection={projection} />
          <div className="fine-print report-chart-help report-asset-projection-feedback">
            <strong>{formatAssetProjectionOutlook(projection)}</strong>
            <span>{formatAssetProjectionReason(projection)}</span>
          </div>

          {lumpSumEvents.length > 0 && (
            <>
              <h3 className="card-title report-subsection-title">예상 목돈지출</h3>
              <table className="grade-table compact report-lump-sum-table">
                <thead><tr><th>나이</th><th>지출 용도</th><th>금액</th></tr></thead>
                <tbody>
                  {lumpSumEvents.map((ev) => (
                    <tr key={ev.key}>
                      <td className="num">{formatNumber(ev.age)}세</td>
                      <td>{ev.name}</td>
                      <td className="num">{formatWon(ev.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="report-assumption-box">
            <strong>계산 기준</strong>
            <span className="report-assumption-note">
              연 단위 전망으로, 연초 자산에 예상수익률을 적용한 뒤 해당 연도의 소득과 생활비를 반영합니다. 실제 월별
              자금 흐름과는 차이가 있을 수 있습니다.
            </span>
            <div className="report-assumption-row"><span>은퇴 시작자산</span><b>{formatWon(projection.startingAssets)}</b></div>
            <div className="report-assumption-row"><span>적용 수익률</span><b>연 {formatPercent(projection.assumedReturnRate)}</b></div>
            <div className="report-assumption-row"><span>생활비 물가상승률</span><b>연 {formatPercent(projection.inflationRate)}</b></div>
            <div className="report-assumption-row"><span>포함된 소득 종류</span><b>국민연금·퇴직연금·개인연금·근로소득·사업소득·기타소득</b></div>
            <div className="report-assumption-row"><span>목돈지출</span><b>{projection.lumpSumExpenseIncluded ? '입력한 예상 나이와 금액을 해당 연도에 차감' : '입력 없음'}</b></div>
            <span className="report-assumption-note">{projection.lumpSumExpenseNote}</span>
          </div>
        </>
      ) : (
        <div className="report-empty-box">
          {projection?.reason || '이전 저장 결과이거나 필수 입력값이 없어 자산잔액 전망을 표시할 수 없습니다.'}
        </div>
      )}
    </PageFrame>
  );
}
