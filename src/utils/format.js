// 1억(=10,000만원) 이상이면 "3억 6,900만원"처럼 억 단위를 분리해서 보여준다.
// 화면 표시 전용 포맷팅이며, 값 자체(계산에 쓰이는 rawValue)는 바꾸지 않는다.
export function formatWon(value) {
  const n = Number(value) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs < 10000) {
    return `${sign}${abs.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`;
  }
  const rounded = Math.round(abs);
  const eok = Math.floor(rounded / 10000);
  const manwon = rounded % 10000;
  const eokText = `${sign}${eok.toLocaleString('ko-KR')}억`;
  return manwon > 0 ? `${eokText} ${manwon.toLocaleString('ko-KR')}만원` : `${eokText}원`;
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
