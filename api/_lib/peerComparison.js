// 동일 연령대 비교용 참고 벤치마크.
// TODO: 아래는 실제 통계(가계금융복지조사, 국민연금연구원 노후준비지표 등) 연동 전까지 쓰는
// 자리표시(placeholder) 값입니다. 실제 서비스 전에는 신뢰할 수 있는 벤치마크 데이터로 교체하세요.

const AGE_BRACKETS = [
  { key: 'under29', label: '29세이하', maxAge: 29, average: 10796, sampleNetWorth: 5000 },
  { key: 'under39', label: '39세이하', maxAge: 39, average: 25060, sampleNetWorth: 15585 },
  { key: 'under49', label: '49세이하', maxAge: 49, average: 48389, sampleNetWorth: 28384 },
  { key: 'under59', label: '59세이하', maxAge: 59, average: 55161, sampleNetWorth: 31685 },
  { key: 'over60', label: '60세이상', maxAge: Infinity, average: 53951, sampleNetWorth: 25000 },
];

function getBracket(age) {
  if (age == null) return AGE_BRACKETS[0];
  return AGE_BRACKETS.find((b) => age <= b.maxAge) || AGE_BRACKETS[AGE_BRACKETS.length - 1];
}

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
}) {
  const netWorth = totalAssets - totalDebt;
  const userBracket = getBracket(age);

  const ageBrackets = AGE_BRACKETS.map((b) => ({
    key: b.key,
    label: b.label,
    average: b.average,
    netWorth: b.key === userBracket.key ? Math.max(0, netWorth) : b.sampleNetWorth,
    isUserBracket: b.key === userBracket.key,
  }));

  const over60 = AGE_BRACKETS.find((b) => b.key === 'over60');

  return {
    ageBrackets,
    userBracketKey: userBracket.key,
    userNetWorth: Math.max(0, netWorth),
    percentileRank: estimatePercentileRank(netWorth, userBracket.average),
    focusCompare: {
      peerAverage: userBracket.average,
      userNetWorth: Math.max(0, netWorth),
      referenceAverage: over60.average,
    },
    netWorth: buildMetric(netWorth, PLACEHOLDER_BENCHMARK.netWorthAverage),
    householdIncome: buildMetric(annualIncome, PLACEHOLDER_BENCHMARK.householdIncomeAverage),
    financialAssets: buildMetric(financialAssetsTotal, PLACEHOLDER_BENCHMARK.financialAssetsAverage),
    retirementScore: buildMetric(retirementScore, PLACEHOLDER_BENCHMARK.retirementScoreAverage),
    isPlaceholderData: true,
  };
}

const PLACEHOLDER_BENCHMARK = {
  netWorthAverage: 51131,
  householdIncomeAverage: 10800,
  financialAssetsAverage: 23000,
  retirementScoreAverage: 69.9,
};

// 값이 없거나(null/undefined) NaN·Infinity면 산술을 시도하지 않고 "비교 데이터 부족" 상태를 그대로 반환한다.
function buildMetric(value, average) {
  if (!Number.isFinite(value)) {
    return { value: null, average, diffPercent: null, percentileLabel: '비교 데이터 부족' };
  }
  return {
    value,
    average,
    diffPercent: average ? round1(((value - average) / average) * 100) : null,
    percentileLabel: estimatePercentileLabel(value, average),
  };
}

// 실제 분포(가계금융복지조사 등) 데이터 없이 평균 대비 비율만으로 판단하므로, "상위 20%"처럼
// 확정적인 백분위 표현은 쓰지 않는다 - 평균 대비 상대적 위치만 서술한다.
function estimatePercentileLabel(value, average) {
  if (!average) return '비교 데이터 부족';
  const ratio = value / average;
  if (ratio >= 1.1) return '또래 평균보다 높음';
  if (ratio >= 0.9) return '또래 평균과 비슷함';
  return '또래 평균보다 낮음';
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
