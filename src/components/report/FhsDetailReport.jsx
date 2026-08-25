import PageFrame from './pages/PageFrame';
import SectionBadge from './pages/SectionBadge';
import CoverPage from './pages/CoverPage';
import { formatNumber } from '../../utils/format';

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
  { number: '3', label: '저축 · 자산 (계속)', keys: ['financialAssetRatio'] },
  INDICATOR_GROUPS[3],
];

// 게이지·등급 배지·구간표는 app.css에 이미 정의되어 있던 스타일(.indicator-detail, .gauge-*,
// .pill-good/caution/risk, .indicator-benchmark-table)을 그대로 쓴다 - 새 디자인을 만들지 않는다.
function IndicatorGauge({ gauge, ratioClass, unit }) {
  return (
    <div className="gauge-wrap">
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

function IndicatorDefinition({ indicator }) {
  const definition = INDICATOR_DEFINITIONS[indicator.key];
  return definition ? <p className="indicator-definition"><b>이 지표는</b> {definition}</p> : null;
}

function IndicatorDetailCard({ indicator }) {
  const unit = indicator.unit || '%';

  if (indicator.notCalculable) {
    return (
      <div className="report-composition-card indicator-detail">
        <h4 className="indicator-detail-title">{indicator.label}</h4>
        <IndicatorDefinition indicator={indicator} />
        <p className="overview-card-missing">{indicator.reason}</p>
        <p className="fine-print">참고 범위: {indicator.guideline}</p>
      </div>
    );
  }

  const currentBand = indicator.table?.find((band) => band.isCurrent);

  return (
    <div className="report-composition-card indicator-detail">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <h4 className="indicator-detail-title" style={{ margin: 0 }}>{indicator.label}</h4>
        <span className={`status-tag pill-${indicator.ratioClass}`}>{indicator.status}</span>
      </div>
      <IndicatorDefinition indicator={indicator} />
      <div className="indicator-value">{formatNumber(indicator.value)}{unit}</div>

      <IndicatorGauge gauge={indicator.gauge} ratioClass={indicator.ratioClass} unit={unit} />

      {currentBand?.reason && <p className="indicator-feedback">{currentBand.reason}</p>}
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
              <td className="dim">{band.reason}</td>
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

function getConclusionGroups(indicators, conclusion) {
  const financialHealthKeys = new Set(INDICATOR_GROUPS.flatMap((group) => group.keys));
  const applicable = (indicators || []).filter(
    (indicator) => financialHealthKeys.has(indicator.key) && !indicator.notCalculable && !indicator.notApplicable
  );
  const names = (items) => items.map((indicator) => indicator.label).join(' · ') || '해당 없음';

  return [
    {
      label: '점검 우선 지표',
      value: names(applicable.filter((indicator) => indicator.ratioClass === 'risk' || indicator.ratioClass === 'caution')),
    },
    {
      label: '안정적인 지표',
      value: names(applicable.filter((indicator) => indicator.ratioClass === 'good')),
    },
    {
      label: '도출되는 점',
      value: conclusion || '산출 가능한 8개 지표 결과를 바탕으로 현재 재무상태를 함께 확인해 주세요.',
    },
  ];
}

function IndicatorSummaryPage({ indicators, interpretation, pageNumber, totalPages }) {
  const categoryByKey = new Map((interpretation?.categories || []).map((category) => [category.key, category]));
  const groupKeys = ['spendingLiquidity', 'debt', 'savingsAssets', 'protection'];

  return (
    <PageFrame
      eyebrow="JMFinancial Household Finance Review"
      title="JMFinancial 재무건강지수 평가 항목 요약"
      pageNumber={pageNumber}
      totalPages={totalPages}
    >
      <p className="fhs-summary-intro">
        한국형 가계재무비율을 참고한 8개 지표의 점수와 현재 상태를 함께 정리했습니다.
      </p>
      <section className="fhs-definition" aria-labelledby="fhs-definition-title">
        <h3 id="fhs-definition-title">재무건강지수란?</h3>
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
          <span>한눈에 보기</span>
        </div>
        <ul className="fhs-overall-conclusion-list">
          {getConclusionGroups(indicators, interpretation?.conclusion).map((item) => (
            <li key={item.label} className={item.label === '도출되는 점' ? 'fhs-overall-conclusion-insight' : ''}>
              {item.label === '도출되는 점' ? item.value : <><b>{item.label} :</b> {item.value}</>}
            </li>
          ))}
        </ul>
      </section>
      <div className="fhs-summary-grid">
        {INDICATOR_GROUPS.map((group, groupIndex) => {
          const category = getCategoryFeedback(group, indicators, categoryByKey.get(groupKeys[groupIndex]));
          return (
          <section className="fhs-summary-group" key={group.label}>
            <header className="fhs-summary-group-head">
              <span>{group.number}</span>
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
      <p className="fine-print fhs-summary-note">
        세부 산출 기준과 지표별 해석은 다음 페이지에서 확인할 수 있습니다.
      </p>
    </PageFrame>
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
        title="재무건강지수 심화 리포트"
        subtitle="JMFinancial Household Finance Review"
      />

      <IndicatorSummaryPage
        indicators={indicators}
        interpretation={financialHealthInterpretation}
        pageNumber={nextPage()}
        totalPages={totalPages}
      />

      {DETAIL_PAGE_GROUPS.map((group) => (
        <PageFrame key={group.label} eyebrow="JMFinancial Household Finance Review" pageNumber={nextPage()} totalPages={totalPages}>
          <SectionBadge number={group.number} label={group.label} />
          {group.keys.map((key) => {
            const indicator = (indicators || []).find((ind) => ind.key === key);
            return indicator ? <IndicatorDetailCard key={key} indicator={indicator} /> : null;
          })}
        </PageFrame>
      ))}
    </div>
  );
}
