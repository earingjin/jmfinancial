export function formatWon(value) {
  const n = Number(value) || 0;
  return `${n.toLocaleString('ko-KR')}만원`;
}

export function formatPercent(value) {
  const n = Number(value) || 0;
  return `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
}

export function formatNumber(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('ko-KR');
}
