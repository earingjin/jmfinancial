import { Fragment } from 'react';
import PageFrame from './PageFrame';
import { formatNumber, formatPercent, formatWon } from '../../../utils/format';

const FINANCIAL_HEALTH_KEYS = ['household', 'emergency', 'dsr'];

const FINANCIAL_HEALTH_LABELS = {
  household: '매달 소득 중 지출 비율',
  emergency: '비상자금으로 버틸 수 있는 기간',
  dsr: '매달 소득 중 빚 갚는 비율',
};

function formatDate(generatedAt) {
  if (!generatedAt) return '-';
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function displayWon(value) {
  return !Number.isFinite(value) ? '산출 불가' : formatWon(value);
}

function displayNumber(value, unit = '') {
  return !Number.isFinite(value) ? '산출 불가' : `${formatNumber(value)}${unit}`;
}

function displayPercent(value) {
  return !Number.isFinite(value) ? '산출 불가' : formatPercent(value);
}

function indicatorValue(indicator) {
  if (!indicator) return '산출 불가';
  if (indicator.notApplicable) return '해당 없음';
  if (indicator.notCalculable || !Number.isFinite(indicator.value)) return '산출 불가';
  return indicator.key === 'emergency'
    ? `${formatNumber(indicator.value)}개월`
    : formatPercent(indicator.value);
}

function indicatorStatus(indicator) {
  if (!indicator) return '데이터 없음';
  if (indicator.notApplicable) return '해당 없음';
  if (indicator.notCalculable || indicator.value == null) return indicator.reason || '확인 필요';
  return indicator.status || '-';
}

function Metric({ label, value, tone = '' }) {
  return (
    <div className={`one-summary-metric${tone ? ` one-summary-metric--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function OnePageSummaryReportPage({ result, clientName }) {
  const indicators = result?.indicators || [];
  const aggregates = result?.aggregates || {};
  const donuts = result?.webSummary?.donuts || {};
  const retirement = result?.webSummary?.retirementReadiness || {};
  const targets = result?.webSummary?.futureFinance?.targets || [];
  const peerComparison = result?.peerComparison || {};
  const selectedIndicators = FINANCIAL_HEALTH_KEYS.map((key) => (
    indicators.find((item) => item.key === key)
  ));
  const peerRows = [
    ['순자산', peerComparison.netWorth],
    ['연소득', peerComparison.householdIncome],
    ['금융자산', peerComparison.financialAssets],
  ];
  const compositionRows = [
    ['월 소득 배분', donuts.income?.total],
    ['월 지출 구성', donuts.expense?.total],
    ['자산 구성', donuts.assets?.total],
    ['부채 구성', donuts.debt?.total],
    ['저축·투자 구성', donuts.savings?.total],
  ];

  return (
    <PageFrame
      eyebrow="One-page Summary"
      pageNumber={1}
      totalPages={1}
      contentClassName="one-page-summary-pad"
    >
      <header className="one-summary-header">
        <div>
          <h1>재무진단 요약 리포트</h1>
          <p>현재 재무상태와 은퇴 준비의 핵심 결과를 한 장에 정리했습니다.</p>
        </div>
        <div className="one-summary-meta">
          <span title={clientName || '고객'}>{clientName || '고객'}</span>
          <time dateTime={result?.generatedAt || undefined}>진단일 {formatDate(result?.generatedAt)}</time>
        </div>
      </header>

      <section className="one-summary-overview" aria-labelledby="one-summary-overview-title">
        <h2 id="one-summary-overview-title">종합 결과</h2>
        <div className="one-summary-overview-grid">
          <article>
            <b>현재 재무상태 종합</b>
            <div className="one-summary-representatives">
              {selectedIndicators.map((indicator, index) => {
                const key = FINANCIAL_HEALTH_KEYS[index];
                return (
                  <span className={`one-summary-representative one-summary-representative--${indicator?.ratioClass || 'unknown'}`} key={key}>
                    {FINANCIAL_HEALTH_LABELS[key]}
                    <strong>{indicatorValue(indicator)} · {indicatorStatus(indicator)}</strong>
                  </span>
                );
              })}
            </div>
          </article>
          <article>
            <b>은퇴 준비 종합</b>
            <div>
              <span>은퇴 시점 필요자금 <strong>{displayWon(retirement.requiredAtRetirement)}</strong></span>
              <span>예상 준비자산 <strong>{displayWon(retirement.readyAssetsAtRetirement)}</strong></span>
            </div>
          </article>
        </div>
      </section>

      <section className="one-summary-section" aria-labelledby="one-summary-current-title">
        <h2 id="one-summary-current-title">현재 재무상태</h2>
        <div className="one-summary-current-grid">
          <Metric label="월소득" value={displayWon(aggregates.monthlyIncome)} />
          <Metric label="월지출" value={displayWon(aggregates.totalExpenseMonthlyExSavings)} />
          <Metric label="월저축액" value={displayWon(aggregates.monthlySavings)} />
          <Metric label="총자산" value={displayWon(aggregates.totalAssets)} />
          <Metric label="총부채" value={displayWon(aggregates.totalDebt)} tone="debt" />
          <Metric label="순자산" value={displayWon(aggregates.netWorth)} tone="net" />
        </div>
      </section>

      <section className="one-summary-section" aria-labelledby="one-summary-composition-title">
        <h2 id="one-summary-composition-title">나의 재무 구성</h2>
        <div className="one-summary-composition-grid">
          {compositionRows.map(([label, value]) => (
            <Metric key={label} label={label} value={displayWon(value)} />
          ))}
        </div>
      </section>

      <section className="one-summary-section" aria-labelledby="one-summary-retirement-title">
        <h2 id="one-summary-retirement-title">은퇴 준비</h2>
        <div className="one-summary-retirement-grid">
          <Metric label="예상 은퇴 나이" value={displayNumber(retirement.retirementAge, '세')} />
          <Metric label="은퇴까지 남은 기간" value={displayNumber(retirement.yearsToRetirement, '년')} />
          <Metric label="은퇴 후 생활기간" value={displayNumber(retirement.retirementYears, '년')} />
          <Metric label="은퇴 시점 필요자금" value={displayWon(retirement.requiredAtRetirement)} />
          <Metric label="은퇴 시점 예상 준비자산" value={displayWon(retirement.readyAssetsAtRetirement)} />
          <Metric label="예상 부족자금" value={displayWon(retirement.shortfall)} tone="debt" />
          <Metric label="현재 노후소득보장률" value={displayPercent(retirement.retirementIncomeIndicator?.value)} tone="net" />
        </div>
      </section>

      <section className="one-summary-section" aria-labelledby="one-summary-future-title">
        <h2 id="one-summary-future-title">미래 연금소득 전망</h2>
        {targets.length > 0 ? (
          <table className="one-summary-table one-summary-future-table">
            <thead>
              <tr><th>나이</th><th>예상 생활비</th><th>예상 연금소득</th><th>충당률</th><th>부족·여유</th></tr>
            </thead>
            <tbody>
              {targets.map((item, index) => {
                const unavailable = Boolean(item.calculationReason);
                return (
                  <Fragment key={`${item.age}-${index}`}>
                    <tr className={unavailable ? 'is-unavailable' : ''}>
                      <th>{displayNumber(item.age, '세')}</th>
                      <td>{displayWon(item.livingExpense)}</td>
                      <td>{unavailable ? '산출 불가' : displayWon(item.pensionIncome)}</td>
                      <td>{unavailable ? '산출 불가' : displayPercent(item.coverageRate)}</td>
                      <td>{unavailable || item.balance == null
                        ? '산출 불가'
                        : item.balance < 0
                          ? `${formatWon(Math.abs(item.balance))} 부족`
                          : `${formatWon(item.balance)} 여유`}</td>
                    </tr>
                    {unavailable && (
                      <tr className="one-summary-reason-row">
                        <td colSpan="5" title={item.calculationReason}>산출 불가 사유: {item.calculationReason}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : <p className="one-summary-empty">표시할 미래 전망 연령이 없습니다.</p>}
      </section>

      <section className="one-summary-section" aria-labelledby="one-summary-peer-title">
        <h2 id="one-summary-peer-title">또래 비교</h2>
        <table className="one-summary-table one-summary-peer-table">
          <thead><tr><th>항목</th><th>우리집</th><th>또래 평균</th><th>비교 상태</th></tr></thead>
          <tbody>
            {peerRows.map(([label, metric]) => (
              <tr key={label}>
                <th>{label}</th>
                <td>{displayWon(metric?.value)}</td>
                <td>{displayWon(metric?.average)}</td>
                <td>{metric?.percentileLabel || '비교 데이터 부족'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="one-summary-note">세부 계산 근거와 항목별 안내는 상세 리포트에서 확인해 주세요.</p>
    </PageFrame>
  );
}
