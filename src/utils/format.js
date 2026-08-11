export function formatWon(value) {
  const n = Number(value) || 0;
  return `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`;
}

export function formatPercent(value) {
  const n = Number(value) || 0;
  return `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
}

export function formatNumber(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

// 소수점 둘째 자리에서 반올림해 첫째 자리까지만 남긴다 - 화면 표시 전용(원본 계산값은 바꾸지 않는다).
// 나이·기간 뺄셈(예: lifeExpectancy - retirementAge)에서 생기는 부동소수점 오차(37.599999999999994 등)를
// 화면에 그대로 노출하지 않기 위한 용도. api/_lib/simulation.js의 서버측 round1()과 동일한 공식이다.
export function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}
