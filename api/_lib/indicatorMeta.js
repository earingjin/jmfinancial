// 지표별 표시 전용 메타데이터(게이지 눈금·권장기준 라벨). 1_계산로직.html §1 "권장기준" 컬럼과
// 리포트 목업(JM_재무진단_리포트_미리보기.html)의 게이지 스케일을 그대로 반영한 값이다.
// 9개 지표의 점수·등급 산출(indicators.js) 자체에는 관여하지 않고, 리포트에 표시할 게이지
// 위치·권장기준 비교 문구를 만드는 데만 쓰인다. 원래 클라이언트 번들에 있었으나, 계산 방식을
// 외부에 노출하지 않기 위해 서버(api/_lib)로 옮겼다 — reportEnrichment.js에서만 참조한다.

export const INDICATOR_META = {
  household: {
    recommendedLabel: '70% 이하', gaugeMax: 100, bench: { type: 'atMost', value: 70 },
    guideline: '총 소득 대비 총 지출 70% 이하',
  },
  emergency: {
    recommendedLabel: '2~6배', gaugeMax: 8, bench: { type: 'between', min: 2, max: 6 },
    guideline: '총 지출금액 대비 유동성자산 금액 2~6배',
  },
  dsr: {
    recommendedLabel: '30% 이하', gaugeMax: 60, bench: { type: 'atMost', value: 30 },
    guideline: '총 소득 대비 총부채상환액이 30% 이하',
  },
  debtBurden: {
    recommendedLabel: '40% 이하', gaugeMax: 60, bench: { type: 'atMost', value: 40 },
    guideline: '총 자산대비 총부채는 40% 이하',
  },
  insurance: {
    recommendedLabel: '8~10%', gaugeMax: 20, bench: { type: 'between', min: 8, max: 10 },
    guideline: '총 소득 대비 보장성 보험료는 8~10%',
  },
  savingsRate: {
    recommendedLabel: '30% 이상', gaugeMax: 50, bench: { type: 'atLeast', value: 30 },
    guideline: '총 소득 대비 총 저축은 30% 이상',
  },
  retirementSavings: {
    recommendedLabel: '50% 이상', gaugeMax: 100, bench: { type: 'atLeast', value: 50 },
    guideline: '총 저축액 중 노후대비 저축이 차지하는 비중 50% 이상',
  },
  financialAssetRatio: {
    recommendedLabel: '40% 이상', gaugeMax: 50, bench: { type: 'atLeast', value: 40 },
    guideline: '총 자산에서 금융자산 비중 40% 이상',
  },
  // 게이지 눈금은 손익분기점(100%)을 기준으로 삼는다. FHS 요약표의 "권장기준" 표기는
  // 1_계산로직.html §1과 동일하게 120% 이상(최고 점수 구간)을 그대로 사용한다.
  retirementIncome: {
    recommendedLabel: '120% 이상', gaugeMax: 150, bench: { type: 'atLeast', value: 100 },
    guideline: '은퇴후 필요생활비 대비 노후소득으로 120% 이상 권장',
  },
};

export function pct(value, max) {
  if (!max) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

// 값과 권장기준을 비교해 "권장기준(...) 대비 X%p 여유/부족" 형태의 문구를 만든다.
export function describeBenchmark(value, bench, unit = '%') {
  if (bench.type === 'atMost') {
    const gap = round1(bench.value - value);
    return gap >= 0
      ? { withinRecommended: true, gap, gapText: `권장기준(${bench.value}${unit} 이하) 대비 ${gap}${unit}p 여유가 있습니다` }
      : { withinRecommended: false, gap, gapText: `권장기준(${bench.value}${unit} 이하) 대비 ${round1(-gap)}${unit}p 초과했습니다` };
  }
  if (bench.type === 'atLeast') {
    const gap = round1(value - bench.value);
    return gap >= 0
      ? { withinRecommended: true, gap, gapText: `권장기준(${bench.value}${unit} 이상) 대비 ${gap}${unit}p 상회합니다` }
      : { withinRecommended: false, gap, gapText: `권장기준(${bench.value}${unit} 이상) 대비 ${round1(-gap)}${unit}p 부족합니다` };
  }
  const within = value >= bench.min && value <= bench.max;
  return {
    withinRecommended: within,
    gap: null,
    gapText: within
      ? `적정구간(${bench.min}~${bench.max}${unit}) 이내입니다`
      : `적정구간(${bench.min}~${bench.max}${unit})을 벗어났습니다`,
  };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

// 지표별 상태 문구가 제각각(매우 우수 / 여유로운 노후 가능 / 적정 등)이라 점수 비율로
// 게이지·배지 색을 통일해 결정한다.
export function classifyByRatio(score, maxScore) {
  if (!maxScore) return 'caution';
  const ratio = score / maxScore;
  if (ratio >= 0.8) return 'good';
  if (ratio >= 0.4) return 'caution';
  return 'risk';
}
