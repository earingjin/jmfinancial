import PageFrame from './pages/PageFrame';
import SectionBadge from './pages/SectionBadge';
import CoverPage from './pages/CoverPage';
import { formatNumber } from '../../utils/format';

// 한국형 가계재무비율 참고 8개 항목과 JMFinancial 자체 추가 항목을 표시용으로 묶는다.
// 점수·등급 산출(api/_lib/indicators.js)과는 무관하다.
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

function getIndicatorOrigin() {
  return '한국형 가계재무비율 참고 지표';
}

function buildCategoryFeedback(group, indicators) {
  const items = group.keys
    .map((key) => (indicators || []).find((indicator) => indicator.key === key))
    .filter(Boolean);
  const available = items.filter((indicator) => !indicator.notCalculable);

  if (available.length === 0) {
    return '입력 정보가 부족해 현재 상태를 해석하기 어렵습니다. 관련 입력값을 확인해 주세요.';
  }

  const statusSummary = available
    .map((indicator) => `${indicator.label} ${indicator.status}`)
    .join(' · ');
  const hasUnavailable = available.length !== items.length;

  return hasUnavailable
    ? `${statusSummary}입니다. 산출되지 않은 항목은 관련 입력값을 확인해 주세요.`
    : `${statusSummary}입니다. 세부 페이지에서 항목별 원인과 참고 범위를 확인해 보세요.`;
}

function IndicatorDetailCard({ indicator }) {
  const unit = indicator.unit || '%';

  if (indicator.notCalculable) {
    return (
      <div className="report-composition-card indicator-detail">
        <h4 className="indicator-detail-title">{indicator.label}</h4>
        <p className="indicator-origin">{getIndicatorOrigin(indicator)}</p>
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
      <p className="indicator-origin">{getIndicatorOrigin(indicator)}</p>
      <div className="indicator-value">{formatNumber(indicator.value)}{unit}</div>

      <IndicatorGauge gauge={indicator.gauge} ratioClass={indicator.ratioClass} unit={unit} />

      {currentBand?.reason && <p className="indicator-feedback">{currentBand.reason}</p>}
      <p className="fine-print">참고 범위: {indicator.guideline} · {indicator.benchmark?.gapText}</p>

      {indicator.notApplicable && (
        <p className="indicator-policy-note">
          65세 이상에서는 JMFinancial 자체 평가정책에 따라 이 지표의 15점을 별도 내부 노후 평가 항목으로 이전합니다.
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

function IndicatorSummaryPage({ indicators, pageNumber, totalPages }) {
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
      <div className="fhs-summary-grid">
        {INDICATOR_GROUPS.map((group) => (
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
                      {indicator.notCalculable ? '산출 불가' : `${indicator.score} / ${indicator.maxScore}점`}
                    </div>
                    <span className={`status-tag ${indicator.notCalculable ? 'pill-unavailable' : `pill-${indicator.ratioClass}`}`}>
                      {indicator.notCalculable ? '확인 필요' : indicator.status}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="fhs-summary-feedback">{buildCategoryFeedback(group, indicators)}</p>
          </section>
        ))}
      </div>
      <p className="fine-print fhs-summary-note">
        세부 산출 기준과 지표별 해석은 다음 페이지에서 확인할 수 있습니다.
      </p>
    </PageFrame>
  );
}

export default function FhsDetailReport({ result, onRestart, onBack, onHome, clientName }) {
  const { generatedAt, indicators } = result;
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
