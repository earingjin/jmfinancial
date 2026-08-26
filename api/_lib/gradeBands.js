// 1_계산로직.html §6 "종합등급 산출" 표와 동일한 S~F 6단계 구간. 표시 전용(리포트 게이지·표 렌더링용).
// 원래 클라이언트 번들에 있었으나 서버로 옮겨, 응답에는 계산된 결과(gradeBands 배열, 다음 등급 정보)만 내려간다.

export const GRADE_BANDS = [
  { letter: 'F', label: '심각', min: 0, max: 49, width: 49, color: '#8A7A5C', rangeLabel: '49 이하', desc: '지표 대부분이 위험 수준으로 즉각적인 재무 개선이 필요함' },
  { letter: 'D', label: '위험', min: 50, max: 59, width: 10, color: '#B7A67D', rangeLabel: '50~59', desc: '다수의 지표가 위험 수준에 있어 재무상태 전반의 조정이 시급함' },
  { letter: 'C', label: '개선 필요', min: 60, max: 69, width: 10, color: '#D9CBA0', textColor: '#5B4E33', rangeLabel: '60~69', desc: '여러 평가 항목에서 보완이 필요한 상태' },
  { letter: 'B', label: '양호', min: 70, max: 79, width: 10, color: 'var(--gold)', rangeLabel: '70~79', desc: '평가 항목이 대체로 안정적이며 일부 보완 여지가 있는 상태' },
  { letter: 'A', label: '건강', min: 80, max: 89, width: 10, color: '#E3A23C', rangeLabel: '80~89', desc: '대부분의 평가 항목이 안정적으로 관리되는 상태' },
  { letter: 'S', label: '매우 건강', min: 90, max: 100, width: 11, color: '#C9791F', rangeLabel: '90~100', desc: '평가 항목 전반이 매우 안정적으로 관리되는 상태' },
];

// "양호(B)" 등급 하한 - 재무건강 최소 권장선으로 참조. 표시 전용 값이라 여기서 계산해 응답에 실어 보낸다.
export const REFERENCE_SCORE = GRADE_BANDS.find((g) => g.letter === 'B').min;

export function nextGradeInfo(totalScore) {
  const nextGrade = [...GRADE_BANDS].reverse().find((g) => g.min > totalScore);
  return { nextGrade, pointsToNextGrade: nextGrade ? nextGrade.min - totalScore : 0 };
}
