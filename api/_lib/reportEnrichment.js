// 리포트 렌더링에 필요한 "표시용 파생값"을 서버에서 미리 계산해 응답에 실어 보낸다.
// (게이지 위치, 참고 범위 비교 문구, 등급 배지 색, 생활수준 구간 등)
// 9개 지표의 점수·등급 산출 자체(indicators.js)에는 전혀 관여하지 않는다 — 이미 계산된
// 결과를 화면에 "그리기 좋은 형태"로 한 번 더 가공하는 단계일 뿐이다.
// 클라이언트는 이 값을 그대로 렌더링만 하면 되므로, 게이지 임계값·등급 커트라인·생활수준
// 구간표 같은 기준 데이터가 클라이언트 번들에 존재하지 않는다.

import { INDICATOR_META, pct, describeBenchmark, classifyByRatio } from './indicatorMeta.js';
import { GRADE_BANDS, REFERENCE_SCORE, nextGradeInfo } from './gradeBands.js';
import { buildLifestyleTrack } from './lifestyleTiers.js';
import { buildIndicatorComposition } from './indicatorComposition.js';

function enrichIndicator(indicator, aggregates, retirementLivingCost) {
  const meta = INDICATOR_META[indicator.key];

  // 분모 0 등으로 산출 자체가 불가능한 지표는 게이지·벤치마크·구성분석을 만들지 않는다(null 산술로
  // "0%"처럼 조용히 잘못 표시되는 것을 막는다) - 화면은 notCalculable/reason을 보고 "산출 불가"를 표시한다.
  // 다만 recommendedLabel/guideline은 값과 무관한 지표 설명(가이드라인)이므로 N/A여도 계속 제공한다.
  if (indicator.notCalculable) {
    return {
      ...indicator,
      recommendedLabel: meta?.recommendedLabel,
      guideline: meta?.guideline,
      ratioClass: 'na',
      composition: null,
      benchmark: null,
      gauge: null,
    };
  }

  const composition = buildIndicatorComposition(indicator.key, aggregates, indicator, retirementLivingCost);
  const ratioClass = classifyByRatio(indicator.score, indicator.maxScore);

  if (!meta) {
    return { ...indicator, ratioClass, composition, benchmark: null, gauge: null };
  }

  const unit = indicator.unit || '%';
  const benchmark = describeBenchmark(indicator.value, meta.bench, unit);
  const gauge = {
    gaugeMax: meta.gaugeMax,
    benchType: meta.bench.type,
    valuePct: pct(indicator.value, meta.gaugeMax),
    benchMinPct: meta.bench.type === 'between' ? pct(meta.bench.min, meta.gaugeMax) : null,
    benchMaxPct: meta.bench.type === 'between' ? pct(meta.bench.max, meta.gaugeMax) : null,
    benchValuePct: meta.bench.type !== 'between' ? pct(meta.bench.value, meta.gaugeMax) : null,
  };

  return {
    ...indicator,
    recommendedLabel: meta.recommendedLabel,
    guideline: meta.guideline,
    ratioClass,
    benchmark,
    gauge,
    composition,
  };
}

/**
 * calcIndicators()의 결과(indicators, totalScore, weakest, strongest)를 받아
 * 표시용 파생값이 붙은 indicators 배열과, 등급 배지·다음 등급 정보를 함께 반환한다.
 */
export function enrichIndicators({ indicators, totalScore, weakest, strongest, aggregates, retirementLivingCost }) {
  const enrichedIndicators = indicators.map((ind) => enrichIndicator(ind, aggregates, retirementLivingCost));
  const byKey = (key) => enrichedIndicators.find((ind) => ind.key === key);

  const belowRecommendedCount = enrichedIndicators.filter(
    (ind) => ind.maxScore > 0 && ind.benchmark && !ind.benchmark.withinRecommended
  ).length;

  // totalScore가 null(종합점수 산출 불가)이면 "다음 등급까지 남은 점수" 같은 파생값도 의미가 없다.
  const { nextGrade, pointsToNextGrade } = totalScore === null ? { nextGrade: null, pointsToNextGrade: null } : nextGradeInfo(totalScore);

  return {
    indicators: enrichedIndicators,
    weakest: weakest ? byKey(weakest.key) || weakest : null,
    strongest: strongest ? byKey(strongest.key) || strongest : null,
    gradeBands: GRADE_BANDS,
    referenceScore: REFERENCE_SCORE,
    nextGrade,
    pointsToNextGrade,
    belowRecommendedCount,
  };
}

export function enrichSimulation(simulation, retirementLivingCost) {
  return { ...simulation, lifestyleTrack: buildLifestyleTrack(retirementLivingCost) };
}
