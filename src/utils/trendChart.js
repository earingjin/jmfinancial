// 선형 스케일 계산기 - 실제 데이터 좌표를 SVG 픽셀 좌표로 변환한다. 순수 함수.

export function scaleLinear([d0, d1], [r0, r1]) {
  if (d1 === d0) return () => (r0 + r1) / 2;
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

export function toPolyline(points, xScale, yScale) {
  return points.map((p) => `${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`).join(' ');
}
