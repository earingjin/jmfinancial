// 리포트 렌더링에 필요한 "표시용 파생값"을 서버에서 미리 계산해 응답에 실어 보낸다.
// (게이지 위치, 참고 범위 비교 문구, 등급 배지 색, 생활수준 구간 등)
// 9개 지표의 점수·등급 산출 자체(indicators.js)에는 전혀 관여하지 않는다 — 이미 계산된
// 결과를 화면에 "그리기 좋은 형태"로 한 번 더 가공하는 단계일 뿐이다.
// 클라이언트는 이 값을 그대로 렌더링만 하면 되므로, 게이지 임계값·등급 커트라인·생활수준
// 구간표 같은 기준 데이터가 클라이언트 번들에 존재하지 않는다.

import { getIndicatorMeta, pct, describeBenchmark, classifyByRatio } from './indicatorMeta.js';
import { buildLifestyleTrack } from './lifestyleTiers.js';
import { buildIndicatorComposition } from './indicatorComposition.js';

const FINANCIAL_HEALTH_GROUPS = [
  {
    key: 'spendingLiquidity',
    label: '소비 · 유동성',
    keys: ['household', 'emergency'],
    stable: '현재 생활을 감당하는 흐름과 비상상황 대응 여력이 함께 안정적인 편입니다.',
    watch: '현재 지출 흐름과 비상자금 중 일부를 보완하면 현금흐름의 안정성을 높일 수 있습니다.',
    risk: '생활비 부담 또는 비상자금 여력을 우선 점검해야 현재 현금흐름의 충격 대응력을 높일 수 있습니다.',
  },
  {
    key: 'debt',
    label: '부채',
    keys: ['dsr', 'debtBurden'],
    stable: '소득 대비 상환 부담과 자산 대비 부채 규모가 함께 안정적인 편입니다.',
    watch: '상환 부담과 전체 부채 규모 중 주의가 필요한 부분을 점검할 필요가 있습니다.',
    risk: '소득 또는 자산에 비해 부채 부담이 커질 수 있어 상환 구조를 우선 점검해야 합니다.',
  },
  {
    key: 'savingsAssets',
    label: '저축 · 자산',
    keys: ['savingsRate', 'retirementSavings', 'financialAssetRatio'],
    stable: '저축 수준, 노후 목적 배분, 금융자산 구성이 전반적으로 안정적인 편입니다.',
    watch: '저축 규모·노후 목적 배분·금융자산 구성 중 보완할 부분을 차례로 점검할 필요가 있습니다.',
    risk: '미래 자산 형성에 제약이 될 수 있는 항목이 있어 저축 구조와 자산 구성을 우선 조정할 필요가 있습니다.',
  },
  {
    key: 'protection',
    label: '보장',
    keys: ['insurance'],
    stable: '소득 대비 보장성보험료 부담이 적정 범위에 가까운 편입니다.',
    watch: '보험료 부담과 실제 보장 내용을 함께 확인해 균형을 점검할 필요가 있습니다.',
    risk: '보험료가 지나치게 낮거나 높을 수 있으므로 보장 공백과 현금흐름 부담을 함께 점검해야 합니다.',
  },
];

const ACTION_BY_INDICATOR = {
  household: '고정비와 반복 지출을 나눠 조정 가능한 항목부터 점검하세요.',
  emergency: '즉시 사용할 수 있는 비상자금을 월 지출 기준으로 따로 확보하세요.',
  dsr: '월 원리금 상환액과 대출별 금리·상환기간을 함께 점검하세요.',
  debtBurden: '보유자산과 전체 부채를 함께 놓고 상환 우선순위를 정하세요.',
  savingsRate: '월 저축 가능액을 먼저 정하고 자동이체 등 실행 가능한 방법으로 고정하세요.',
  retirementSavings: '전체 저축에서 노후 목적 자금이 차지하는 비중을 다시 확인하세요.',
  financialAssetRatio: '부동산 등 실물자산 편중과 즉시 활용 가능한 금융자산 규모를 함께 점검하세요.',
  insurance: '보험료 비율뿐 아니라 중복 보장과 필요한 보장범위를 함께 확인하세요.',
};

const MAINTENANCE_ACTION = {
  spendingLiquidity: '현재 지출 수준을 유지하면서 비상자금이 실제로 바로 사용 가능한 형태인지 정기적으로 확인하세요.',
  debt: '추가 대출 전 월 상환 부담과 총부채 규모를 다시 확인하세요.',
  savingsAssets: '현재 저축 흐름과 자산 구성을 정기적으로 점검해 재무목표와의 연결을 유지하세요.',
  protection: '생활 변화가 있을 때 보험료와 보장범위를 함께 재점검하세요.',
};

export function buildFinancialHealthInterpretation(indicators) {
  const byKey = new Map(indicators.map((indicator) => [indicator.key, indicator]));
  const categories = FINANCIAL_HEALTH_GROUPS.map((group) => {
    const items = group.keys.map((key) => byKey.get(key)).filter(Boolean);
    const applicable = items.filter((item) => !item.notCalculable && !item.notApplicable);
    const unavailable = items.filter((item) => item.notCalculable);
    const priority = applicable.filter((item) => item.ratioClass === 'risk');
    const watch = applicable.filter((item) => item.ratioClass === 'caution');
    const needsAttention = [...priority, ...watch];
    const unavailableDetail = unavailable
      .map((item) => `${item.label}: ${item.reason}`)
      .join(' / ');

    if (applicable.length === 0) {
      return {
        key: group.key,
        label: group.label,
        summary: `현재 영역은 다음 지표가 산출되지 않아 종합 해석을 제공하지 않습니다. ${unavailableDetail}`,
        action: '위 사유를 확인한 뒤 다시 진단해 주세요.',
        priority: 'unavailable',
      };
    }

    const summary = priority.length > 0 ? group.risk : watch.length > 0 ? group.watch : group.stable;
    const actions = needsAttention.map((item) => ACTION_BY_INDICATOR[item.key]).filter(Boolean);
    const action = actions.length > 0
      ? [...new Set(actions)].join(' ')
      : MAINTENANCE_ACTION[group.key];
    const unavailableNote = unavailable.length > 0
      ? ` 산출되지 않은 항목: ${unavailableDetail}`
      : '';

    return {
      key: group.key,
      label: group.label,
      summary: `${summary}${unavailableNote}`,
      action,
      priority: priority.length > 0 ? 'risk' : watch.length > 0 ? 'caution' : 'good',
    };
  });

  const financialHealthIndicators = FINANCIAL_HEALTH_GROUPS
    .flatMap((group) => group.keys)
    .map((key) => byKey.get(key))
    .filter(Boolean);
  const applicable = financialHealthIndicators.filter((item) => !item.notCalculable && !item.notApplicable);
  const unavailableCount = financialHealthIndicators.filter((item) => item.notCalculable).length;
  const risks = applicable.filter((item) => item.ratioClass === 'risk');
  const cautions = applicable.filter((item) => item.ratioClass === 'caution');
  const strengths = applicable.filter((item) => item.ratioClass === 'good');
  const priorities = [...risks, ...cautions];
  const scoreSummary = {
    score: unavailableCount > 0 ? null : applicable.reduce((total, item) => total + item.score, 0),
    maxScore: financialHealthIndicators.reduce((total, item) => total + item.maxScore, 0),
    notCalculable: unavailableCount > 0,
  };

  let conclusion;
  if (applicable.length === 0) {
    conclusion = '8개 재무건강지표를 종합해 해석하려면 관련 입력값을 먼저 확인해야 합니다.';
  } else if (priorities.length === 0) {
    conclusion = `적용 가능한 ${applicable.length}개 지표를 함께 보면 네 영역이 전반적으로 안정적입니다. 현재 구조를 유지하되 소득·지출·자산 변화가 있을 때 다시 점검하세요.`;
  } else {
    const priorityNames = priorities.slice(0, 3).map((item) => item.label).join('·');
    const strengthText = strengths.length > 0
      ? ` ${strengths.slice(0, 2).map((item) => item.label).join('·')}는 상대적으로 안정적입니다.`
      : '';
    conclusion = `적용 가능한 ${applicable.length}개 지표를 함께 보면 ${priorityNames}부터 점검하는 것이 우선입니다.${strengthText} 각 영역의 행동제안을 순서대로 실행한 뒤 지표 변화를 다시 확인하세요.`;
  }

  if (unavailableCount > 0) {
    conclusion += ` 산출되지 않은 ${unavailableCount}개 지표는 입력을 보완한 뒤 함께 해석해야 합니다.`;
  }

  return { categories, conclusion, scoreSummary };
}

function enrichIndicator(indicator, aggregates, retirementLivingCost, age) {
  const meta = getIndicatorMeta(indicator.key, age);

  // 분모 0 등으로 산출 자체가 불가능한 지표는 게이지·벤치마크·구성분석을 만들지 않는다(null 산술로
  // "0%"처럼 조용히 잘못 표시되는 것을 막는다) - 화면은 notCalculable/reason을 보고 "산출 불가"를 표시한다.
  // notCalculable이 아니어도 value가 null인 경우가 있다(예: 65세 이상 노후대비저축지표는
  // notApplicable로 배점만 제외하지만, 총저축액이 0원이면 참고용 비율 자체를 만들 수 없다 -
  // indicators.js 참고). 이런 값 없는 지표도 같은 방식으로 게이지·벤치마크를 만들지 않는다.
  // 다만 recommendedLabel/guideline은 값과 무관한 지표 설명(가이드라인)이므로 N/A여도 계속 제공한다.
  if (indicator.notCalculable || indicator.value == null) {
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
 * calcIndicators()의 결과를 받아 지표별 표시용 파생값을 붙인다.
 */
export function enrichIndicators({ indicators, weakest, strongest, aggregates, retirementLivingCost, age }) {
  const enrichedIndicators = indicators.map((ind) => enrichIndicator(ind, aggregates, retirementLivingCost, age));
  const byKey = (key) => enrichedIndicators.find((ind) => ind.key === key);

  const belowRecommendedCount = enrichedIndicators.filter(
    (ind) => ind.maxScore > 0 && ind.benchmark && !ind.benchmark.withinRecommended
  ).length;

  return {
    indicators: enrichedIndicators,
    weakest: weakest ? byKey(weakest.key) || weakest : null,
    strongest: strongest ? byKey(strongest.key) || strongest : null,
    belowRecommendedCount,
  };
}

export function enrichSimulation(simulation, retirementLivingCost) {
  return { ...simulation, lifestyleTrack: buildLifestyleTrack(retirementLivingCost) };
}
