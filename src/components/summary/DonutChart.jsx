import { buildPieSegments } from '../../utils/pieChart';
import { formatWon } from '../../utils/format';

// 요약 화면 전용 재사용 도넛 차트. 각도 계산은 기존 pieChart.js 유틸(buildPieSegments)을 그대로
// 재사용하고, 중앙에 구멍을 내는 원과 합계 표시만 이 컴포넌트에서 추가한다 - 새로운 차트 수학을
// 만들지 않는다. items는 항상 0 이상의 값만 들어와야 한다(호출부에서 방어).
export default function DonutChart({ title, description, items, total, centerLabel, emptyMessage, footnote, footnoteTone }) {
  const hasData = total > 0 && items.some((it) => it.value > 0);
  const { size, viewBox, paths, legend } = buildPieSegments(items);
  const center = size / 2;
  const holeRadius = size * 0.36;

  const visibleLegend = legend.filter((it) => it.value > 0);
  const altText = hasData
    ? `${title} 도넛 차트: ${visibleLegend.map((l) => `${l.label} ${formatWon(l.value)}(${l.percent}%)`).join(', ')}`
    : `${title} 도넛 차트: ${emptyMessage || '표시할 데이터가 없습니다.'}`;

  return (
    <div className="donut-card">
      <div className="donut-card-title">{title}</div>
      {description && <p className="donut-card-desc">{description}</p>}

      {hasData ? (
        <>
          <div className="donut-chart-wrap" role="img" aria-label={altText}>
            <svg viewBox={viewBox} width={size} height={size} aria-hidden="true" focusable="false">
              {paths.map((p) => <path key={p.key} d={p.d} fill={p.color} />)}
              <circle cx={center} cy={center} r={holeRadius} fill="var(--card)" />
            </svg>
            <div className="donut-center-label">
              <div className="donut-center-value">{formatWon(total)}</div>
              {centerLabel && <div className="donut-center-caption">{centerLabel}</div>}
            </div>
          </div>
          <ul className="donut-legend">
            {visibleLegend.map((item) => (
              <li key={item.key}>
                <span className="donut-legend-dot" style={{ background: item.color }} aria-hidden="true" />
                <span className="donut-legend-label">{item.label}</span>
                <span className="donut-legend-value">{formatWon(item.value)} · {item.percent}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="donut-chart-wrap" role="img" aria-label={altText}>
          {/* 값이 전부 0일 때 "고장난 화면"처럼 텅 비어 보이지 않도록, 실제 도넛과 같은 크기의
              점선 링 자리표시자를 보여준다 - 데이터가 없을 뿐 정상 상태임을 시각적으로 알려준다. */}
          <svg viewBox={viewBox} width={size} height={size} aria-hidden="true" focusable="false">
            <circle cx={center} cy={center} r={holeRadius + 8} fill="none" stroke="var(--line)" strokeWidth={16} strokeDasharray="5 6" />
          </svg>
          <div className="donut-center-label">
            <p className="donut-empty-message">{emptyMessage || '표시할 데이터가 없습니다.'}</p>
          </div>
        </div>
      )}

      {footnote && (
        <p className={`donut-footnote${footnoteTone === 'warning' ? ' donut-footnote--warning' : ''}`}>{footnote}</p>
      )}
    </div>
  );
}
