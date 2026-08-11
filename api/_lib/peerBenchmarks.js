// 또래 비교 기준 데이터 - 2025년 가계금융복지조사(가구주 연령대별) 공식 통계.
// 아래 값은 사용자 승인을 받은 실제 공식 통계이며, api/_lib/peerComparison.js의
// PLACEHOLDER_BENCHMARK(임의 추정치)와 다르다 - 임의로 값을 추정하거나 새로 만들지 않는다.
// 단위: 만원.

export const PEER_BENCHMARK_META = {
  source: '2025년 가계금융복지조사',
  agency: '국가데이터처·한국은행·금융감독원',
  assetAndDebtAsOf: '2025-03-31',
  incomeYear: 2024,
  ageBasis: '가구주 연령 기준',
};

// maxAge 기준 오름차순, 구간은 연속적이고 상호 배타적이다(빈 구간 없음, age <= maxAge인 첫 구간으로 판정).
export const PEER_AGE_BRACKETS = [
  { key: 'under29', label: '29세 이하', maxAge: 29, totalAssets: 15500, financialAssets: 8843, totalDebt: 4703, netWorth: 10796, annualIncome: 4509 },
  { key: '30to39', label: '30~39세', maxAge: 39, totalAssets: 35958, financialAssets: 14104, totalDebt: 10899, netWorth: 25060, annualIncome: 7386 },
  { key: '40to49', label: '40~49세', maxAge: 49, totalAssets: 62714, financialAssets: 16401, totalDebt: 14325, netWorth: 48389, annualIncome: 9333 },
  { key: '50to59', label: '50~59세', maxAge: 59, totalAssets: 66205, financialAssets: 16507, totalDebt: 11044, netWorth: 55161, annualIncome: 9416 },
  { key: '60plus', label: '60세 이상', maxAge: Infinity, totalAssets: 60095, financialAssets: 11236, totalDebt: 6504, netWorth: 53591, annualIncome: 5767 },
];

// 나이가 없거나(null/NaN) 유효하지 않으면 가장 낮은 연령구간으로 판정한다
// (age가 0(출생년도 미입력의 기존 기본값)일 때도 동일하게 처리 - api/_lib/aggregate.js:getCurrentAge와 동일한 기존 규약).
export function getPeerBracket(age) {
  if (!Number.isFinite(age)) return PEER_AGE_BRACKETS[0];
  return PEER_AGE_BRACKETS.find((b) => age <= b.maxAge) || PEER_AGE_BRACKETS[PEER_AGE_BRACKETS.length - 1];
}
