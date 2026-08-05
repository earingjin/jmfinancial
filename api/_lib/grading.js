// 등급/점수 판정 유틸. api/ 폴더는 Vercel 서버리스 함수 전용이며 클라이언트 번들에 포함되지 않는다.
//
// 계산 정밀도 원칙(CLAUDE.md "Financial Calculation Safety" 참고):
// - 점수 판정에는 rawValue(반올림하지 않은 원본 비율)를 사용한다.
// - displayValue는 화면 표시 전용으로 rawValue를 소수점 첫째 자리로 반올림한 값이다.
// - bands는 실수 전체를 빈틈없이(연속적으로) 배타적으로 덮어야 하며, 미매칭은 개발 오류로 취급한다.

export function round1(v) {
  return Math.round(v * 10) / 10;
}

/**
 * bands: [{ test: (v) => bool, score, status, reason, rangeLabel }]
 * 첫 번째로 test를 통과하는 band를 현재 등급으로 판정한다. (배열 순서 = 우선순위)
 * bands는 실수 전체를 빈틈없이 덮도록 구성해야 하며, 매칭 실패는 구간 정의 결함이므로 예외를 던진다.
 */
export function evaluateBands(rawValue, bands, maxScore) {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    throw new Error(`evaluateBands: rawValue must be a finite number, got ${rawValue}`);
  }

  const matchedIndex = bands.findIndex((b) => b.test(rawValue));
  if (matchedIndex === -1) {
    throw new Error(`evaluateBands: no band matched rawValue=${rawValue}. Band definitions must be continuous and exhaustive.`);
  }
  const matched = bands[matchedIndex];
  const displayValue = round1(rawValue);

  return {
    rawValue,
    displayValue,
    value: displayValue, // 기존 소비 코드(.value 참조) 호환을 위한 별칭 - displayValue와 항상 동일
    score: matched.score,
    maxScore,
    status: matched.status,
    notCalculable: false,
    reason: null,
    table: bands.map((b, i) => ({
      rangeLabel: b.rangeLabel,
      score: b.score,
      status: b.status,
      reason: b.reason,
      isCurrent: i === matchedIndex,
    })),
  };
}

/** 분모가 0(또는 비수치)이라 비율 자체가 성립하지 않을 때 사용하는 공통 N/A 결과 구조. */
export function notCalculableResult(maxScore, reason) {
  return {
    rawValue: null,
    displayValue: null,
    value: null,
    score: null,
    maxScore,
    status: null,
    notCalculable: true,
    reason,
    table: null,
  };
}

/** 순수 비율(퍼센트 아님). 분모가 0/빈값/비수치면 null(=N/A)을 반환한다. */
export function divOrNA(numerator, denominator) {
  const d = Number(denominator);
  if (!d || !Number.isFinite(d)) return null;
  return numerator / d;
}

/** 퍼센트 비율. 분모가 0/빈값/비수치면 null(=N/A)을 반환한다. 분자·분모가 모두 0이어도 null이다. */
export function pctOrNA(numerator, denominator) {
  const ratio = divOrNA(numerator, denominator);
  return ratio === null ? null : ratio * 100;
}
