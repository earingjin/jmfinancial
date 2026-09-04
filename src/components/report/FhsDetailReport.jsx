import PageFrame from './pages/PageFrame';
import SectionBadge from './pages/SectionBadge';
import CoverPage from './pages/CoverPage';
import BackCoverPage from './pages/BackCoverPage';
import { formatNumber, formatWon } from '../../utils/format';

// 한국형 가계재무비율 참고 8개 항목을 표시용으로 묶는다.
// 페이지 구성용 그룹핑이다.
const INDICATOR_GROUPS = [
  {
    number: '1', label: '소비 · 유동성', keys: ['household', 'emergency'],
    description: '소득으로 생활을 감당하고 비상상황에 버틸 수 있는가?',
  },
  {
    number: '2', label: '부채', keys: ['dsr', 'debtBurden'],
    description: '소득과 자산에 비해 빚이 부담스러운 수준인가?',
  },
  {
    number: '3', label: '저축 · 자산', keys: ['savingsRate', 'retirementSavings', 'financialAssetRatio'],
    description: '미래를 위해 꾸준히 저축하고 자산을 쌓고 있는가?',
  },
  {
    number: '4', label: '보장 · 노후준비', keys: ['insurance'],
    description: '예상치 못한 위험과 노후생활에 잘 대비하고 있는가?',
  },
];

// 지표별 구간표가 A4 인쇄 높이를 넘지 않도록, ③의 마지막 항목은 다음 페이지에 이어서 표시한다.
// 요약 페이지의 항목 묶음은 INDICATOR_GROUPS를 그대로 사용한다.
const DETAIL_PAGE_GROUPS = [
  INDICATOR_GROUPS[0],
  INDICATOR_GROUPS[1],
  { number: '3', label: '저축 · 자산', keys: ['savingsRate', 'retirementSavings'] },
  {
    number: '3', label: '저축 · 자산 (계속)', keys: ['financialAssetRatio'],
    trailingGroup: INDICATOR_GROUPS[3],
  },
];

// 지표별 방향성(계산 로직과 무관한 화면 표시용 정적 데이터).
// api/_lib/indicators.js의 실제 배점 구간표를 기준으로 판단했다:
// - lower: 값이 낮을수록 점수가 높아지는 단조감소형(atMost 계열 - household/dsr/debtBurden)
// - higher: 값이 높을수록 점수가 높아지는 단조증가형(atLeast 계열 - emergency/savingsRate/
//   retirementSavings/financialAssetRatio. financialAssetRatio는 40% 이상 구간에서 감점이
//   전혀 없는 단조증가형이라 "적정 구간 유지"가 아니라 "높을수록 좋음"으로 분류했다)
// - between: 특정 구간을 중심으로 위·아래 모두 감점되는 대칭형(insurance만 해당)
const INDICATOR_DIRECTION = {
  household: 'lower',
  emergency: 'higher',
  dsr: 'lower',
  debtBurden: 'lower',
  insurance: 'between',
  savingsRate: 'higher',
  retirementSavings: 'higher',
  financialAssetRatio: 'higher',
};

const DIRECTION_BADGE = {
  lower: { icon: '▼', text: '낮을수록 좋아요' },
  higher: { icon: '▲', text: '높을수록 좋아요' },
  between: { icon: '◆', text: '적정 구간을 유지하는 게 좋아요' },
};

function IndicatorDirectionBadge({ indicatorKey }) {
  const direction = INDICATOR_DIRECTION[indicatorKey];
  const badge = direction && DIRECTION_BADGE[direction];
  if (!badge) return null;
  return (
    <span className={`indicator-direction-badge indicator-direction-badge--${direction}`}>
      {badge.icon} {badge.text}
    </span>
  );
}

// 게이지·등급 배지·구간표는 app.css에 이미 정의되어 있던 스타일(.indicator-detail, .gauge-*,
// .pill-good/caution/risk, .indicator-benchmark-table)을 그대로 쓴다 - 새 디자인을 만들지 않는다.
function IndicatorGauge({ gauge, ratioClass, unit, value }) {
  // gauge가 없으면(과거 저장 결과·불완전 데이터) 게이지만 표시하지 않는다 - notCalculable/value==null이
  // 아닌데도 gauge 자체가 비어 있는 예외적인 경우를 대비한 최소 방어다(A7의 카드 전체 대체와는 다른
  // 층위: 카드의 나머지 부분(정의·구간표·breakdown)은 그대로 보여줄 수 있으므로 그대로 둔다).
  if (!gauge) return null;
  const labelTransform = gauge.valuePct <= 12 ? 'translateX(0)' : gauge.valuePct >= 88 ? 'translateX(-100%)' : 'translateX(-50%)';

  return (
    <div className="gauge-wrap">
      <div className="gauge-value-slot">
        <span
          className="indicator-value"
          style={{ left: `${gauge.valuePct}%`, transform: labelTransform }}
        >
          {formatNumber(value)}{unit}
        </span>
      </div>
      <div className="gauge-track">
        <div className={`gauge-fill fill-${ratioClass}`} style={{ width: `${gauge.valuePct}%` }} />
        {gauge.benchType === 'between' ? (
          <div
            className="gauge-bench-band"
            style={{ left: `${gauge.benchMinPct}%`, width: `${gauge.benchMaxPct - gauge.benchMinPct}%` }}
          />
        ) : (
          <div className="gauge-bench" style={{ left: `${gauge.benchValuePct}%` }} />
        )}
        <div className="gauge-marker" style={{ left: `${gauge.valuePct}%` }} />
      </div>
      <div className="gauge-scale">
        <span>0{unit}</span>
        <span>{gauge.gaugeMax}{unit}</span>
      </div>
    </div>
  );
}

// 비율(%, 배)의 근거가 된 실제 금액(분자/분모)을 "구분 | 금액 | 비율" 2행 표로 보여준다.
// breakdown은 indicators.js가 판정에 이미 쓴 agg 값을 그대로 표시용으로 붙인 것이라, 여기서는
// formatWon으로 포맷만 할 뿐 새로 계산하지 않는다. breakdown이 없으면(분모 0 · 65세 이상 해당
// 없음 · breakdown 필드가 없는 과거 저장 결과) 아무것도 렌더링하지 않는다 - 하위호환.
function IndicatorBreakdownTable({ breakdown, indicator }) {
  if (!breakdown) return null;
  const unit = indicator.unit || '%';
  return (
    <table className="grade-table indicator-breakdown-table compact">
      <thead>
        <tr>
          <th className="breakdown-label-col">구분</th>
          <th className="breakdown-amount-col">금액</th>
          <th className="breakdown-ratio-col">비율</th>
        </tr>
      </thead>
      <tbody>
        <tr className="indicator-breakdown-numerator">
          <td>{breakdown.numerator.label}</td>
          <td className="num">{formatWon(breakdown.numerator.amount)}</td>
          <td className="num">{formatNumber(indicator.value)}{unit}</td>
        </tr>
        <tr className="indicator-breakdown-denominator">
          <td>{breakdown.denominator.label}</td>
          <td className="num">{formatWon(breakdown.denominator.amount)}</td>
          <td className="num">기준</td>
        </tr>
      </tbody>
    </table>
  );
}

const INDICATOR_DEFINITIONS = {
  household: '현재 소득 가운데 생활과 각종 지출에 사용하는 비중으로, 소득으로 가계 지출을 안정적으로 감당하는지를 봅니다.',
  emergency: '갑작스러운 소득 중단이나 예상하지 못한 지출이 생겼을 때 유동성자산으로 생활을 얼마나 유지할 수 있는지를 봅니다.',
  dsr: '현재 소득 가운데 대출 원금과 이자를 갚는 데 사용하는 비중으로, 부채가 현금흐름에 주는 부담을 봅니다.',
  debtBurden: '현재 보유한 전체 자산과 비교한 부채 규모로, 가계의 자산·부채 구조가 안정적인지를 봅니다.',
  insurance: '현재 소득 가운데 질병·상해·사망 등 위험에 대비하기 위해 지출하는 보장성보험료의 비중을 봅니다.',
  savingsRate: '현재 소득 가운데 실제 저축으로 배분하는 비중으로, 미래 재무목표를 위해 자산을 쌓는 흐름을 봅니다.',
  retirementSavings: '전체 저축 가운데 노후생활을 위해 배분하는 비중으로, 현재 저축이 노후 준비로 얼마나 연결되는지를 봅니다.',
  financialAssetRatio: '전체 자산 가운데 금융자산이 차지하는 비중으로, 자산이 실물자산에 지나치게 집중됐는지와 활용 가능한 자산을 봅니다.',
};

// 과거 저장 결과의 구간표에는 현재 제거된 "JMFinancial 참고 범위" 문구가 reason에 남아 있다.
// 저장 결과를 재계산하지 않고 표시 문구만 현재 버전과 맞추기 위한 하위호환 매핑이다.
const LEGACY_TABLE_REASON_OVERRIDES = new Map([
  ['JMFinancial 참고 범위(70% 이하) 안으로, 가계수지가 비교적 안정적인 수준', '가계수지가 비교적 안정적인 수준'],
  ['JMFinancial 참고 범위를 다소 넘었으나 지출 구조를 점검해볼 수 있는 수준', '지출 비중이 다소 높지만 지출 구조를 점검해볼 수 있는 수준'],
  ['JMFinancial 참고 범위 상단에 가까워 예비자금이 넉넉한 편', '예비자금이 넉넉한 편'],
  ['JMFinancial 참고 범위(4~6개월) 안에서 유동성을 확보한 상태', '비상 상황에 대응할 유동성을 확보한 상태'],
  ['JMFinancial 참고 범위보다 낮아 비상 상황 대응력을 점검할 필요가 있음', '예비자금이 부족해 비상 상황 대응력을 점검할 필요가 있음'],
  ['JMFinancial 참고 범위(30% 이하)보다 여유가 있는 수준', '원리금 상환 부담이 낮아 여유가 있는 수준'],
  ['JMFinancial 참고 범위 안이나 상환 부담을 함께 살펴볼 필요가 있는 수준', '원리금 상환 부담을 함께 살펴볼 필요가 있는 수준'],
  ['JMFinancial 참고 범위를 넘어 원리금 상환이 가계에 부담으로 작용할 수 있음', '원리금 상환이 가계에 부담으로 작용할 수 있음'],
  ['JMFinancial 참고 범위(40% 이하)보다 여유가 있는 수준', '자산 대비 부채 부담이 낮아 여유가 있는 수준'],
  ['JMFinancial 참고 범위 안에서 부채가 비교적 안정적으로 관리되는 상태', '부채가 비교적 안정적으로 관리되는 상태'],
  ['JMFinancial 참고 범위 상단에 가까워 자산 대비 부채 비중을 살펴볼 필요가 있음', '자산 대비 부채 비중을 살펴볼 필요가 있음'],
  ['JMFinancial 참고 범위를 넘어 자산 대비 부채 부담이 큰 편', '자산 대비 부채 부담이 큰 편'],
  ['JMFinancial 참고 범위 안으로, 위험 대비와 저축 여력의 균형을 함께 점검한 상태', '위험 대비와 저축 여력의 균형을 함께 점검한 상태'],
  ['JMFinancial 참고 범위(30% 이상)를 웃돌아 자산을 쌓을 여력이 큰 편', '저축 비중이 높아 자산을 쌓을 여력이 큰 편'],
  ['JMFinancial 참고 범위 안으로, 장기 자산 형성을 이어갈 수 있는 수준', '장기 자산 형성을 이어갈 수 있는 수준'],
  ['JMFinancial 참고 범위보다 낮아 저축 여력을 점검해볼 수 있는 수준', '저축 비중이 낮아 저축 여력을 점검해볼 수 있는 수준'],
  ['JMFinancial 참고 범위(50% 이상)를 웃돌아 노후 목적 저축 비중이 높은 편', '노후 목적 저축 비중이 높은 편'],
  ['JMFinancial 참고 범위(50% 이상)에 해당하는 수준', '노후 목적 저축을 일정 수준 유지하고 있음'],
  ['JMFinancial 참고 범위보다 낮아 노후 목적 저축 비중을 점검할 필요가 있음', '노후 목적 저축 비중을 점검할 필요가 있음'],
  ['JMFinancial 참고 범위에 해당하며, 활용하기 쉬운 자산 비중이 높은 편', '활용하기 쉬운 자산 비중이 높은 편'],
  ['JMFinancial 참고 범위에 가까워 자산구조가 비교적 균형적인 편', '자산구조가 비교적 균형적인 편'],
]);

function formatIndicatorReason(reason) {
  return LEGACY_TABLE_REASON_OVERRIDES.get(reason) || reason;
}

function IndicatorDefinition({ indicator }) {
  const definition = INDICATOR_DEFINITIONS[indicator.key];
  return definition ? <p className="indicator-definition"><b>이 지표는</b> {definition}</p> : null;
}

function IndicatorDetailCard({ indicator }) {
  const unit = indicator.unit || '%';

  // notCalculable(분모 0 등으로 지표 자체 산출 불가)뿐 아니라, notApplicable이면서도 value가
  // null인 경우(예: 65세 이상 + 총저축액 0원 - indicators.js 참고)도 게이지·구간표 없이 같은
  // 카드로 사유만 보여준다. gauge/benchmark가 없는 상태에서 아래 전체 카드를 그리면 값을
  // 지어내거나 렌더링이 깨질 수 있다.
  if (indicator.notCalculable || indicator.value == null) {
    return (
      <div className="report-composition-card indicator-detail">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h4 className="indicator-detail-title" style={{ margin: 0 }}>{indicator.label}</h4>
          <IndicatorDirectionBadge indicatorKey={indicator.key} />
        </div>
        <IndicatorDefinition indicator={indicator} />
        <p className="overview-card-missing">{indicator.reason}</p>
        <p className="fine-print">참고 범위: {indicator.guideline}</p>
      </div>
    );
  }

  return (
    <div className="report-composition-card indicator-detail">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h4 className="indicator-detail-title" style={{ margin: 0 }}>{indicator.label}</h4>
          <IndicatorDirectionBadge indicatorKey={indicator.key} />
        </div>
        <span className={`status-tag pill-${indicator.ratioClass}`}>{indicator.status}</span>
      </div>
      <IndicatorDefinition indicator={indicator} />

      {/* 게이지는 축소하고 그만큼 확보된 가로 공간에 breakdown 표를 나란히 배치한다(순수 레이아웃
          변경 - 두 컴포넌트의 props·내부 렌더링 로직은 그대로다). breakdown이 없는 과거 저장
          결과는 표가 안 뜨므로 오른쪽이 비지 않도록 게이지를 다시 전체 폭으로 되돌린다. */}
      <div className={`indicator-gauge-breakdown-row${indicator.breakdown ? '' : ' indicator-gauge-breakdown-row--gauge-only'}`}>
        <IndicatorGauge gauge={indicator.gauge} ratioClass={indicator.ratioClass} unit={unit} value={indicator.value} />
        <IndicatorBreakdownTable breakdown={indicator.breakdown} indicator={indicator} />
      </div>

      <p className="fine-print">참고 범위: {indicator.guideline} · {indicator.benchmark?.gapText}</p>

      {indicator.notApplicable && (
        <p className="indicator-policy-note">
          65세 이상은 자산을 적립하기보다 인출하는 단계로 보아 이 지표를 적용하지 않습니다.
        </p>
      )}

      <table className="grade-table indicator-benchmark-table compact">
        <thead>
          <tr>
            <th className="benchmark-range-col">구간</th>
            <th className="benchmark-score-col">배점</th>
            <th className="benchmark-status-col">평가</th>
            <th className="benchmark-reason-col">설명</th>
          </tr>
        </thead>
        <tbody>
          {indicator.table?.map((band) => (
            <tr key={band.rangeLabel} className={band.isCurrent ? 'grade-current' : ''}>
              <td>{band.rangeLabel}</td>
              <td className="num">{band.score}</td>
              <td>{band.status}</td>
              <td className="dim">{formatIndicatorReason(band.reason)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LEGACY_FEEDBACK_TEXTS = [
  '입력 정보가 부족해 현재 상태를 해석하기 어렵습니다.',
  '관련 입력값을 확인한 뒤 다시 진단해 주세요.',
];

function getCategoryFeedback(group, indicators, storedCategory) {
  const items = group.keys
    .map((key) => (indicators || []).find((indicator) => indicator.key === key))
    .filter(Boolean);
  const applicable = items.filter((indicator) => !indicator.notCalculable && !indicator.notApplicable);
  const unavailable = items.filter((indicator) => indicator.notCalculable);
  const hasLegacyText = LEGACY_FEEDBACK_TEXTS.some(
    (text) => storedCategory?.summary?.includes(text) || storedCategory?.action?.includes(text)
  );

  if (applicable.length === 0 && unavailable.length > 0) {
    const detail = unavailable
      .map((indicator) => `${indicator.label}: ${indicator.reason}`)
      .join(' / ');

    return {
      summary: `현재 영역은 다음 지표가 산출되지 않아 종합 해석을 제공하지 않습니다. ${detail}`,
      action: '위 사유를 확인한 뒤 다시 진단해 주세요.',
    };
  }

  if (storedCategory && !hasLegacyText) return storedCategory;

  if (applicable.length > 0) {
    return {
      summary: applicable.map((indicator) => `${indicator.label}: ${indicator.status}`).join(' / '),
      action: unavailable.length > 0
        ? `산출되지 않은 항목: ${unavailable.map((indicator) => `${indicator.label}: ${indicator.reason}`).join(' / ')}`
        : '각 지표의 현재 상태와 세부 해석을 확인해 주세요.',
    };
  }

  return {
    summary: '현재 영역에 표시할 지표 결과가 없습니다.',
    action: '지표 결과가 생성되었는지 확인해 주세요.',
  };
}

function getConclusionSummary(indicators) {
  const financialHealthKeys = new Set(INDICATOR_GROUPS.flatMap((group) => group.keys));
  const financialHealthIndicators = (indicators || []).filter((indicator) => financialHealthKeys.has(indicator.key));
  const applicable = financialHealthIndicators.filter((indicator) => !indicator.notCalculable && !indicator.notApplicable);
  const risks = applicable.filter((indicator) => indicator.ratioClass === 'risk');
  const cautions = applicable.filter((indicator) => indicator.ratioClass === 'caution');
  const unavailableCount = financialHealthIndicators.filter((indicator) => indicator.notCalculable).length;

  return {
    priorities: [...risks, ...cautions],
    stable: applicable.filter((indicator) => indicator.ratioClass === 'good'),
    scoreSummary: {
      score: unavailableCount > 0 ? null : applicable.reduce((total, indicator) => total + indicator.score, 0),
      maxScore: financialHealthIndicators.reduce((total, indicator) => total + indicator.maxScore, 0),
      notCalculable: unavailableCount > 0,
    },
  };
}

function IndicatorSummaryPage({ indicators, interpretation, pageNumber, totalPages }) {
  const categoryByKey = new Map((interpretation?.categories || []).map((category) => [category.key, category]));
  const groupKeys = ['spendingLiquidity', 'debt', 'savingsAssets', 'protection'];
  const conclusionSummary = getConclusionSummary(indicators);
  const indicatorNames = (items) => items.map((indicator) => indicator.label).join(' · ') || '해당 없음';
  // scoreSummary가 저장되기 전의 과거 결과도 원본 입력을 재계산하지 않고, 이미 저장된 서버 지표
  // 점수만 합산해 같은 표시를 제공한다. 새 결과에서는 서버 scoreSummary를 항상 우선한다.
  const scoreSummary = interpretation?.scoreSummary || conclusionSummary.scoreSummary;

  return (
    <PageFrame
      eyebrow="현재 우리 집 재무상태는 괜찮은 건가요? 어떤 기준으로 관리하면 되나요?"
      title="재무건강지수 평가 항목 요약"
      pageNumber={pageNumber}
      totalPages={totalPages}
      plan="Pro"
    >
      <p className="fhs-summary-intro">
        재무건강지수는 한국형 가계재무 가이드라인 지표로서 한국FP학회에서 권장하는 재무권장 기준을 준수합니다. <br></br>본 가이드라인은 절대적인 기준은 아니고 바람직한 기준입니다.
      </p>
      <section className="fhs-definition" aria-labelledby="fhs-definition-title">
        <h3 id="fhs-definition-title">재무건강지수 읽는 방법</h3>
        <p>
          현재 소득과 지출, 비상자금, 부채 등을 바탕으로 가계의 전반적인 재무 안정성을 살펴봅니다.
        </p>
        <div className="fhs-definition-guide">
          <span><b>점수</b> 설정된 평가 구간에서의 위치를 보여줘요.</span>
          <span><b>상태</b> 현재 수준을 쉬운 말로 알려줘요.</span>
          <span><b>활용</b> 보완할 항목의 우선순위를 찾는 데 도움을 줘요.</span>
        </div>
      </section>
      <section className="fhs-overall-conclusion" aria-labelledby="fhs-overall-conclusion-title">
        <div className="fhs-overall-conclusion-head">
          <h3 id="fhs-overall-conclusion-title">8개 지표 종합결론</h3>
          {scoreSummary && (
            <div className="fhs-overall-score" aria-label={`8개 재무건강지표 총점 ${scoreSummary.notCalculable ? '산출 불가' : scoreSummary.score}점 / ${scoreSummary.maxScore}점`}>
              <span>총점</span>
              <strong>{scoreSummary.notCalculable ? '산출 불가' : scoreSummary.score}<small> / {scoreSummary.maxScore}</small></strong>
            </div>
          )}
        </div>
        <p className="fhs-overall-conclusion-hero">
          현재는 <strong>{conclusionSummary.priorities.length}개 항목</strong>을 먼저 점검하는 것이 좋습니다.
        </p>
        <div className="fhs-overall-status-grid" aria-label="재무건강지표 상태 요약">
          <div className="fhs-overall-status-card">
            <div className="fhs-overall-status fhs-overall-status--attention">
              <span>점검 우선</span>
              <strong>{conclusionSummary.priorities.length}개</strong>
            </div>
            <p>{indicatorNames(conclusionSummary.priorities)}</p>
          </div>
          <div className="fhs-overall-status-card">
            <div className="fhs-overall-status fhs-overall-status--stable">
              <span>안정적</span>
              <strong>{conclusionSummary.stable.length}개</strong>
            </div>
            <p>{indicatorNames(conclusionSummary.stable)}</p>
          </div>
        </div>
      </section>
      <div className="fhs-summary-grid">
        {INDICATOR_GROUPS.map((group, groupIndex) => {
          const category = getCategoryFeedback(group, indicators, categoryByKey.get(groupKeys[groupIndex]));
          return (
          <section className="fhs-summary-group" key={group.label}>
            <header className="fhs-summary-group-head">
              <span>Part {group.number}</span>
              <div>
                <h3>{group.label}</h3>
                <p className="fhs-summary-group-description">{group.description}</p>
              </div>
            </header>
            <div className="fhs-summary-list">
              {group.keys.map((key) => {
                const indicator = (indicators || []).find((item) => item.key === key);
                if (!indicator) return null;

                return (
                  <div className="fhs-summary-row" key={key}>
                    <div className="fhs-summary-name">{indicator.label}</div>
                    <div className="fhs-summary-score">
                      {indicator.notApplicable
                        ? '해당 없음'
                        : indicator.notCalculable
                          ? '산출 불가'
                          : `${indicator.score} / ${indicator.maxScore}점`}
                    </div>
                    <span className={`status-tag ${indicator.notCalculable || indicator.notApplicable ? 'pill-unavailable' : `pill-${indicator.ratioClass}`}`}>
                      {indicator.notApplicable ? '해당 없음' : indicator.notCalculable ? '확인 필요' : indicator.status}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="fhs-summary-feedback">
              <p>{category.summary}</p>
              <p>{category.action}</p>
            </div>
          </section>
          );
        })}
      </div>
    </PageFrame>
  );
}

function FhsKeyNote() {
  return (
    <section className="report-key-note report-key-note--fhs" aria-label="사용자 메모 영역">
      <div className="report-key-note-heading">
        <strong>KEY NOTE</strong>
      </div>
      <div className="report-key-note-space" aria-hidden="true" />
    </section>
  );
}

export default function FhsDetailReport({ result, onRestart, onBack, onHome, clientName }) {
  const { generatedAt, indicators, financialHealthInterpretation } = result;
  const totalPages = DETAIL_PAGE_GROUPS.length + 1;
  let page = 0;
  const nextPage = () => ++page;
  const openPrintDialog = () => window.print();

  return (
    <div>
      <div className="report-actions no-print" aria-label="보고서 작업">
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← 뒤로가기
        </button>
        <button type="button" className="btn-primary" onClick={openPrintDialog}>
          PDF로 저장
        </button>
        <button type="button" className="btn-secondary" onClick={onHome}>
          홈 화면으로 가기
        </button>
        <button type="button" className="btn-secondary" onClick={onRestart}>
          다시 입력하기
        </button>
        <p className="report-actions-hint">
          PDF로 저장하려면 인쇄 창의 프린터에서 ‘PDF로 저장’을 선택하세요.
        </p>
      </div>

      <CoverPage
        generatedAt={generatedAt}
        clientName={clientName}
        title="제이엠 자산관리 플래너"
        titleSuffix="(Pro)"
        subtitle="JM Financial Planner"
      />

      <IndicatorSummaryPage
        indicators={indicators}
        interpretation={financialHealthInterpretation}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />

      {DETAIL_PAGE_GROUPS.map((group, groupIndex) => (
        <PageFrame
          key={group.label}
          pageNumber={nextPage()}
          totalPages={totalPages}
          plan="Pro"
          contentClassName={groupIndex < 3 ? 'fhs-keynote-page' : ''}
        >
          <SectionBadge number={null} label={`Part ${group.number} ${group.label}`} />
          {group.keys.map((key) => {
            const indicator = (indicators || []).find((ind) => ind.key === key);
            return indicator ? <IndicatorDetailCard key={key} indicator={indicator} /> : null;
          })}
          {group.trailingGroup && <>
            <SectionBadge number={null} label={`Part ${group.trailingGroup.number} ${group.trailingGroup.label}`} />
            {group.trailingGroup.keys.map((key) => {
              const indicator = (indicators || []).find((ind) => ind.key === key);
              return indicator ? <IndicatorDetailCard key={key} indicator={indicator} /> : null;
            })}
          </>}
          {groupIndex < 3 && <>
            <div className="fhs-keynote-gap" aria-hidden="true" />
            <FhsKeyNote />
          </>}
        </PageFrame>
      ))}

      <BackCoverPage generatedAt={generatedAt} />
    </div>
  );
}
