// 또래(연령대) 비교.
// 순자산/연소득/금융자산 평균은 peerBenchmarks.js의 2025년 가계금융복지조사 공식 통계를
// 사용자 나이에 해당하는 연령구간으로 자동 연결한다(사용자 승인됨).
// 재무건강 총점(retirementScore)은 연령대별 공식 통계가 없어 이번 갱신 대상에서 제외하고,
// 기존 placeholder 평균을 그대로 유지한다(사용자 확인됨) - 새 기준을 임의로 만들지 않는다.

import { PEER_AGE_BRACKETS, getPeerBracket, PEER_BENCHMARK_META } from './peerBenchmarks.js';

// PDF 리포트 3페이지 차트에서 "내 구간이 아닌 다른 구간"에 예시로 표시하는 개인 순자산 값.
// 2025년 가계금융복지조사에는 개인 단위 예시가 없어(평균만 제공) 기존 placeholder를 그대로 유지한다
// (사용자 승인 범위는 연령대별 average뿐이었다 - 임의로 새 기준을 만들지 않는다).
const SAMPLE_NET_WORTH_BY_KEY = {
  under29: 5000,
  '30to39': 15585,
  '40to49': 28384,
  '50to59': 31685,
  '60plus': 25000,
};

// 평균 대비 배수를 [5, 95] 범위의 대략적인 백분위로 근사한다.
// 실제 분포(가계금융복지조사 등) 연동 전까지 쓰는 단순 근사치임을 유의할 것.
function estimatePercentileRank(value, average) {
  if (!average) return null;
  const ratio = value / average;
  const percentile = Math.round(50 - (ratio - 1) * 40);
  return Math.min(95, Math.max(5, percentile));
}

export function buildPeerComparison({
  age,
  totalAssets,
  totalDebt,
  annualIncome,
  financialAssetsTotal,
  retirementScore,
  netWorthMissing = false,
  annualIncomeMissing = false,
  financialAssetsMissing = false,
}) {
  const netWorth = totalAssets - totalDebt;
  const userBracket = getPeerBracket(age);

  const ageBrackets = PEER_AGE_BRACKETS.map((b) => ({
    key: b.key,
    label: b.label,
    average: b.netWorth,
    netWorth: b.key === userBracket.key ? Math.max(0, netWorth) : SAMPLE_NET_WORTH_BY_KEY[b.key],
    isUserBracket: b.key === userBracket.key,
  }));

  const reference = PEER_AGE_BRACKETS.find((b) => b.key === '60plus');

  return {
    ageBrackets,
    userBracketKey: userBracket.key,
    userNetWorth: Math.max(0, netWorth),
    percentileRank: estimatePercentileRank(netWorth, userBracket.netWorth),
    focusCompare: {
      peerAverage: userBracket.netWorth,
      userNetWorth: Math.max(0, netWorth),
      referenceAverage: reference.netWorth,
    },
    netWorth: buildMetric(netWorth, userBracket.netWorth, { missing: netWorthMissing, binaryLabel: true }),
    householdIncome: buildMetric(annualIncome, userBracket.annualIncome, { missing: annualIncomeMissing, binaryLabel: true }),
    financialAssets: buildMetric(financialAssetsTotal, userBracket.financialAssets, { missing: financialAssetsMissing, binaryLabel: true }),
    retirementScore: buildMetric(retirementScore, PLACEHOLDER_BENCHMARK.retirementScoreAverage),
    benchmarkMeta: PEER_BENCHMARK_META,
    // netWorth/householdIncome/financialAssets는 이제 2025년 가계금융복지조사 공식 통계이므로
    // "자리표시 데이터" 전체 배지를 붙이면 안 된다 - retirementScore에만 남은 placeholder 여부를
    // 별도로 표시한다(화면에 재무건강 총점을 표시하지 않는 요약페이지에서는 쓰이지 않음).
    retirementScoreIsPlaceholder: true,
  };
}

// 재무건강 총점은 연령대별 공식 통계가 없어 유지하는 유일한 placeholder 값.
const PLACEHOLDER_BENCHMARK = {
  retirementScoreAverage: 69.9,
};

// 값이 없거나(null/undefined) NaN·Infinity면, 또는 explicitly missing(미입력)이면
// 산술을 시도하지 않고 "비교 데이터 부족" 상태를 그대로 반환한다.
// 미입력과 실제 0원은 다르다 - 미입력을 0원으로 취급해 -100%를 보여주지 않기 위해 missing을 별도로 받는다.
function buildMetric(value, average, opts = {}) {
  const { missing = false, binaryLabel = false } = opts;
  if (missing || !Number.isFinite(value)) {
    return { value: null, average, diffPercent: null, percentileLabel: '비교 데이터 부족' };
  }
  // 라벨(등급 판정)은 화면에 보일 반올림된 diffPercent가 아니라 반올림 전 원시 비율로 판정한다
  // (rawValue로 판정하고 displayValue로 재판정하지 않는다).
  if (!average) {
    return { value, average, diffPercent: null, percentileLabel: '비교 데이터 부족' };
  }
  const rawDiffRatio = (value - average) / average;
  return {
    value,
    average,
    diffPercent: round1(rawDiffRatio * 100),
    percentileLabel: binaryLabel ? binaryPercentileLabel(rawDiffRatio) : estimatePercentileLabel(rawDiffRatio),
  };
}

// 사용자 승인된 표시 규칙: 또래 평균 이상이면 '높음', 미달이면 '낮음' (연속적/상호배타적 이분법).
function binaryPercentileLabel(rawDiffRatio) {
  return rawDiffRatio >= 0 ? '또래 평균보다 높음' : '또래 평균보다 낮음';
}

// 실제 분포(가계금융복지조사 등) 데이터 없이 평균 대비 비율만으로 판단하므로, "상위 20%"처럼
// 확정적인 백분위 표현은 쓰지 않는다 - 평균 대비 상대적 위치만 서술한다.
// (재무건강 총점 전용 - 연령대별 공식 통계가 없어 기존 3단계 판정을 그대로 유지한다.)
function estimatePercentileLabel(rawDiffRatio) {
  const ratio = rawDiffRatio + 1;
  if (ratio >= 1.1) return '또래 평균보다 높음';
  if (ratio >= 0.9) return '또래 평균과 비슷함';
  return '또래 평균보다 낮음';
}

function round1(v) {
  // -0을 0으로 정규화한다 - 그렇지 않으면 근소하게 낮은 값이 "-0.0%"로 표시되어
  // 실제로는 낮음으로 판정된 값이 화면에서 0(또는 양수처럼)으로 오인될 수 있다.
  return Math.round(v * 10) / 10 || 0;
}
