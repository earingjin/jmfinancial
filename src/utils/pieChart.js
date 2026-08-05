// 도넛/파이 차트 SVG 조각(arc) 계산. 순수 함수 - 실제 값에서 각도·라벨 위치를 도출한다.

const SIZE = 130;
const CENTER = SIZE / 2;
const RADIUS = 62;
const LABEL_RADIUS = RADIUS * 0.62;

function polarToCartesian(angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) };
}

function labelPoint(angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + LABEL_RADIUS * Math.cos(rad), y: CENTER + LABEL_RADIUS * Math.sin(rad) };
}

// items: [{ key, label, value, color }] (value >= 0). 0 이하 항목은 제외한다.
export function buildPieSegments(items) {
  const clean = items.filter((it) => it.value > 0);
  const total = clean.reduce((sum, it) => sum + it.value, 0);
  if (total <= 0) {
    return { size: SIZE, viewBox: `0 0 ${SIZE} ${SIZE}`, paths: [], labels: [], legend: items.map((it) => ({ ...it, percent: 0 })) };
  }

  let cursor = 0;
  const paths = [];
  const labels = [];

  clean.forEach((item, i) => {
    const percent = (item.value / total) * 100;
    const startAngle = cursor;
    const sweepAngle = (item.value / total) * 360;
    const endAngle = cursor + sweepAngle;
    cursor = endAngle;

    const isFullCircle = clean.length === 1;
    let d;
    if (isFullCircle) {
      d = `M${CENTER},${CENTER - RADIUS} A${RADIUS},${RADIUS} 0 1 1 ${CENTER - 0.01},${CENTER - RADIUS} Z`;
    } else {
      const start = polarToCartesian(startAngle);
      const end = polarToCartesian(endAngle);
      const largeArc = sweepAngle > 180 ? 1 : 0;
      d = `M${CENTER},${CENTER} L${start.x.toFixed(2)},${start.y.toFixed(2)} A${RADIUS},${RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)},${end.y.toFixed(2)} Z`;
    }

    paths.push({ key: item.key ?? i, d, color: item.color });

    if (percent >= 6) {
      const mid = labelPoint((startAngle + endAngle) / 2);
      labels.push({
        key: item.key ?? i,
        x: mid.x.toFixed(1),
        y: mid.y.toFixed(1),
        text: `${round1(percent)}%`,
        color: item.labelColor || '#fff',
      });
    }
  });

  const legend = items.map((it) => ({ ...it, percent: total > 0 ? round1((it.value / total) * 100) : 0 }));

  return { size: SIZE, viewBox: `0 0 ${SIZE} ${SIZE}`, paths, labels, legend };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
