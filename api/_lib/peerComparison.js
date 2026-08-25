// 또래(연령대) 비교.
// 순자산/연소득/금융자산 평균은 peerBenchmarks.js의 2025년 가계금융복지조사 공식 통계를
// 사용자 나이에 해당하는 연령구간으로 자동 연결한다(사용자 승인됨).

import { PEER_AGE_BRACKETS, getPeerBracket, PEER_BENCHMARK_META } from './peerBenchmarks.js';

export function buildPeerComparison({
  age,
  totalAssets,
  totalDebt,
  annualIncome,
  financialAssetsTotal,
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
    netWorth: b.key === userBracket.key ? netWorth : null,
    isUserBracket: b.key === userBracket.key,
  }));

  // 연소득/금융자산도 순자산과 같은 2025년 가계금융복지조사 연령대별 공식 통계를 이미 갖고 있으므로
  // (userBracket.annualIncome/financialAssets), 사용자 구간 평균 하나만 쓰지 않고 전 연령대를 그대로 노출한다.
  const incomeAgeBrackets = PEER_AGE_BRACKETS.map((b) => ({
    key: b.key,
    label: b.label,
    average: b.annualIncome,
    annualIncome: b.key === userBracket.key && !annualIncomeMissing && Number.isFinite(annualIncome) ? annualIncome : null,
    isUserBracket: b.key === userBracket.key,
  }));
  const financialAssetsAgeBrackets = PEER_AGE_BRACKETS.map((b) => ({
    key: b.key,
    label: b.label,
    average: b.financialAssets,
    financialAssets: b.key === userBracket.key && !financialAssetsMissing && Number.isFinite(financialAssetsTotal) ? financialAssetsTotal : null,
    isUserBracket: b.key === userBracket.key,
  }));

  const reference = PEER_AGE_BRACKETS.find((b) => b.key === '60plus');

  return {
    ageBrackets,
    incomeAgeBrackets,
    financialAssetsAgeBrackets,
    userAge: Number.isFinite(age) && age > 0 ? age : null,
    userBracketKey: userBracket.key,
    userBracketLabel: userBracket.label,
    userNetWorth: netWorth,
    percentileRank: null,
    focusCompare: {
      peerAverage: userBracket.netWorth,
      userNetWorth: netWorth,
      referenceAverage: reference.netWorth,
    },
    netWorth: buildMetric(netWorth, userBracket.netWorth, { missing: netWorthMissing, binaryLabel: true }),
    householdIncome: buildMetric(annualIncome, userBracket.annualIncome, { missing: annualIncomeMissing, binaryLabel: true }),
    financialAssets: buildMetric(financialAssetsTotal, userBracket.financialAssets, { missing: financialAssetsMissing, binaryLabel: true }),
    benchmarkMeta: PEER_BENCHMARK_META,
  };
}

// 값이 없거나(null/undefined) NaN·Infinity면, 또는 explicitly missing(미입력)이면
// 산술을 시도하지 않고 "비교 데이터 부족" 상태를 그대로 반환한다.
// 미입력과 실제 0원은 다르다 - 미입력을 0원으로 취급해 -100%를 보여주지 않기 위해 missing을 별도로 받는다.
function buildMetric(value, average, opts = {}) {
  const { missing = false } = opts;
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
    percentileLabel: binaryPercentileLabel(rawDiffRatio),
  };
}

// 사용자 승인된 표시 규칙: 또래 가구 평균 이상이면 '높음', 미달이면 '낮음' (연속적/상호배타적 이분법).
function binaryPercentileLabel(rawDiffRatio) {
  return rawDiffRatio >= 0 ? '또래 가구 평균보다 높음' : '또래 가구 평균보다 낮음';
}

// 실제 분포(가계금융복지조사 등) 데이터 없이 평균 대비 비율만으로 판단하므로, "상위 20%"처럼
// 확정적인 백분위 표현은 쓰지 않는다 - 평균 대비 상대적 위치만 서술한다.

function round1(v) {
  // -0을 0으로 정규화한다 - 그렇지 않으면 근소하게 낮은 값이 "-0.0%"로 표시되어
  // 실제로는 낮음으로 판정된 값이 화면에서 0(또는 양수처럼)으로 오인될 수 있다.
  return Math.round(v * 10) / 10 || 0;
}
