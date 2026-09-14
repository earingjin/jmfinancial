import PageFrame from './PageFrame';
import { formatNumber, formatPercent, formatWon, round1 } from '../../../utils/format';
import {
  getFinancialHealthExplanation,
  getFinancialHealthStatus,
  getFinancialIndicatorInterpretation,
  getRetirementSummaryPresentation,
  getSeveranceLumpSumDisplayItems,
  RETIREMENT_SIMPLE_COMPARISON_NOTE,
} from '../../summary/summaryPresentation';

const FINANCIAL_INDICATORS = [
  { key: 'household', label: '매달 소득 중 지출 비율' },
  { key: 'emergency', label: '비상자금으로 버틸 수 있는 기간' },
  { key: 'dsr', label: '매달 소득 중 빚 갚는 비율' },
];

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
  return Number.isFinite(value) ? formatWon(value) : '산출 불가';
}

function displayYears(value, useRound = false) {
  if (!Number.isFinite(value)) return '산출 불가';
  return `${useRound ? round1(value) : formatNumber(value)}년`;
}

function displayIndicator(indicator) {
  if (!indicator || indicator.notCalculable) return '산출 불가';
  return indicator.key === 'emergency'
    ? `${formatNumber(indicator.value)}개월`
    : formatPercent(indicator.value);
}

function peerStatus(metric) {
  if (!metric) return '비교 데이터 부족';
  return metric.percentileLabel || metric.comparisonLabel || '비교 데이터 부족';
}

function peerBarWidth(value, maximum) {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) return '0%';
  return `${Math.min(100, Math.max(0, (value / maximum) * 100))}%`;
}

function PeerComparisonBar({ label, metric }) {
  const ownValue = Number(metric?.value);
  const averageValue = Number(metric?.average);
  const maximum = Math.max(
    Number.isFinite(ownValue) ? Math.max(0, ownValue) : 0,
    Number.isFinite(averageValue) ? Math.max(0, averageValue) : 0,
  );

  return (
    <article className="one-summary-peer-row">
      <h3>{label}</h3>
      <div className="one-summary-peer-values">
        <div><span>나</span><strong>{displayWon(metric?.value)}</strong></div>
        <div><span>또래 평균</span><strong>{displayWon(metric?.average)}</strong></div>
      </div>
      <div className="one-summary-peer-visual">
        <div className="one-summary-peer-bar" aria-label={`나 ${displayWon(metric?.value)}`}>
          <span className="one-summary-peer-bar-fill one-summary-peer-bar-fill--mine" style={{ width: peerBarWidth(ownValue, maximum) }} />
        </div>
        <div className="one-summary-peer-bar" aria-label={`또래 평균 ${displayWon(metric?.average)}`}>
          <span className="one-summary-peer-bar-fill one-summary-peer-bar-fill--average" style={{ width: peerBarWidth(averageValue, maximum) }} />
        </div>
        <p>{peerStatus(metric)}</p>
      </div>
    </article>
  );
}

function RecordValue({ label, value }) {
  return (
    <div className="one-summary-record-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function financialStatusHeadline(title) {
  return String(title || '')
    .replace(/^현재 재무상태가\s*/, '')
    .replace(/^현재 재무상태는\s*/, '')
    .replace(/^현재 재무구조에서\s*/, '')
    .replace(/^현재 재무상태를 확인하려면\s*/, '')
    .replace(/입니다\.$/, '')
    .replace(/이 있습니다\.$/, '')
    .replace(/가 필요합니다\.$/, '가 필요');
}

function RecordGroup({ title, values, finalLabel, finalValue, finalTone = 'primary', finalNote }) {
  return (
    <div className="one-summary-record-group">
      <h3>{title}</h3>
      <div className={`one-summary-record-values${values.length === 3 ? ' is-three' : ''}`}>
        {values.map((item) => <RecordValue key={item.label} {...item} />)}
      </div>
      {finalLabel && (
        <div className={`one-summary-record-final one-summary-record-final--${finalTone}`}>
          <span>{finalLabel}</span>
          <strong>{finalNote && <small>{finalNote}</small>}{finalValue}</strong>
        </div>
      )}
    </div>
  );
}

export default function OnePageSummaryReportPage({ result, input, clientName }) {
  const aggregates = result?.aggregates || {};
  const indicators = result?.indicators || [];
  const overview = result?.webSummary?.overviewDetail || {};
  const retirement = result?.webSummary?.retirementReadiness || {};
  const futureFinance = result?.webSummary?.futureFinance || {};
  const peerComparison = result?.peerComparison || {};
  const representativeIndicators = FINANCIAL_INDICATORS.map(({ key, label }) => ({
    key,
    label,
    indicator: indicators.find((item) => item.key === key),
  }));
  const financialIndicators = representativeIndicators.map((item) => item.indicator);
  const financialHealth = getFinancialHealthStatus(financialIndicators);
  const financialExplanation = getFinancialHealthExplanation(financialIndicators, financialHealth.detail);
  const {
    retirementStatus,
    retirementStatusPresentation: retirementPresentation,
    retirementMonthlyCoverage,
    nationalPensionMonthlyCoverage,
    nationalPensionCoverageFallbackMessage,
  } = getRetirementSummaryPresentation(retirement, futureFinance);
  const severanceLumpSums = getSeveranceLumpSumDisplayItems(input, retirement.retirementAge);
  const peerRows = [
    ['순자산', peerComparison.netWorth],
    ['연소득', peerComparison.householdIncome],
    ['금융자산', peerComparison.financialAssets],
  ];
  const totalDebtDisplay = overview.balance?.totalDebtNone
    ? '부채 없음'
    : displayWon(overview.balance?.totalDebt ?? aggregates.totalDebt);

  return (
    <PageFrame eyebrow="One-page Summary" title="재무진단 요약 리포트" pageNumber={1} totalPages={1} contentClassName="one-page-summary-pad">
      <header className="one-summary-header">
        <p className="intro-text report-compact-intro">진단 당시의 재무상태와 은퇴 준비상태를 한 장에 담았습니다.</p>
        <div className="one-summary-meta">
          <span title={clientName || '고객'}>{clientName || '고객'}</span>
          <time dateTime={result?.generatedAt || undefined}>진단일 {formatDate(result?.generatedAt)}</time>
        </div>
      </header>

      <section className="one-summary-section one-summary-overall" aria-labelledby="one-summary-overall-title">
        <div className="one-summary-section-heading">
          <h2 className="subsection-head" id="one-summary-overall-title">01. 종합 결과</h2>
        </div>
        <div className="one-summary-overall-grid">
          <article className="one-summary-result-card">
            <div className="one-summary-part">Part 1. 재무</div>
            <div className="one-summary-result-heading">
              <span aria-hidden="true">{financialHealth.icon}</span>
              <div>
                <span>현재 재무상태</span>
                <strong>{financialStatusHeadline(financialHealth.title)}</strong>
              </div>
            </div>
            <p>{financialExplanation}</p>
            <div className="one-summary-indicator-list">
              {representativeIndicators.map(({ key, label, indicator }) => (
                <div key={key} className={`one-summary-indicator-row one-summary-indicator-row--${indicator?.ratioClass || 'unknown'}`}>
                  <span>{label}</span>
                  <strong>{displayIndicator(indicator)}</strong>
                  <small>{getFinancialIndicatorInterpretation(indicator)}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="one-summary-result-card one-summary-result-card--retirement">
            <div className="one-summary-part">Part 2. 은퇴</div>
            <div className="one-summary-result-heading">
              <span aria-hidden="true">{retirementStatus.icon}</span>
              <div>
                <span>예상 자산 유지 기간</span>
                <strong>{retirementPresentation.headline}</strong>
              </div>
            </div>
            <div className="one-summary-monthly-coverage-set">
              <div className="one-summary-monthly-coverage">
                <span>월 생활비 충당 <i aria-hidden="true">·</i> 은퇴 시점 기준</span>
                {retirementMonthlyCoverage.calculable ? (
                  <>
                    <small><b>은퇴 목표생활비(물가 반영)</b>{displayWon(retirementMonthlyCoverage.livingCost)}</small>
                    <small><b>은퇴 시점 예상 연금소득</b>{displayWon(retirementMonthlyCoverage.pensionIncome)}</small>
                  </>
                ) : <small className="one-summary-monthly-coverage-reason">{retirementMonthlyCoverage.reason}</small>}
                <strong>→ {retirementMonthlyCoverage.result}</strong>
              </div>
              <div className="one-summary-monthly-coverage">
                <span>월 생활비 충당 <i aria-hidden="true">·</i> 국민연금 수령 후 기준</span>
                {nationalPensionMonthlyCoverage.calculable ? (
                  <>
                    <small><b>은퇴 목표생활비(물가 반영)</b>{displayWon(nationalPensionMonthlyCoverage.livingCost)}</small>
                    <small><b>예상 연금소득</b>{displayWon(nationalPensionMonthlyCoverage.pensionIncome)}</small>
                    <small><b>국민연금 수령 시점</b>{formatNumber(futureFinance.nationalPensionStartSnapshot?.age)}세</small>
                  </>
                ) : (
                  <>
                    <small className="one-summary-monthly-coverage-reason">{nationalPensionCoverageFallbackMessage}</small>
                    {futureFinance.nationalPensionStartSnapshot && (
                      <small><b>국민연금 수령 시점</b>{Number.isFinite(futureFinance.nationalPensionStartSnapshot.age) ? `${formatNumber(futureFinance.nationalPensionStartSnapshot.age)}세` : '확인 필요'}</small>
                    )}
                  </>
                )}
                <strong>→ {nationalPensionMonthlyCoverage.result}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <div className="one-summary-middle-grid">
        <section className="one-summary-section" aria-labelledby="one-summary-current-title">
          <div className="one-summary-section-heading">
            <div>
              <h2 className="subsection-head" id="one-summary-current-title">02. 현재 재무상태</h2>
            </div>
          </div>
          <div className="one-summary-record-panel">
            <RecordGroup
              title="월 현금흐름"
              values={[
                { label: '월 수입 합계', value: displayWon(overview.income?.monthlyTotal) },
                { label: '월 고정지출 합계', value: displayWon(overview.expense?.fixedTotal) },
              ]}
              finalLabel="월 소득 합계 − 고정지출 합계"
              finalValue={displayWon(overview.expense?.incomeMinusExpense)}
              finalTone="secondary"
            />
            <RecordGroup
              title="자산 현황"
              values={[
                { label: '총자산', value: displayWon(aggregates.totalAssets) },
                { label: '총부채', value: totalDebtDisplay },
              ]}
              finalLabel="순자산"
              finalValue={displayWon(aggregates.netWorth)}
            />
          </div>
        </section>

        <section className="one-summary-section" aria-labelledby="one-summary-retirement-title">
          <div className="one-summary-section-heading">
            <div>
              <h2 className="subsection-head" id="one-summary-retirement-title">03. 은퇴 준비 현황</h2>
            </div>
          </div>
          {retirement.notCalculable ? (
            <p className="one-summary-empty">{retirement.reason || '은퇴 준비 결과를 표시할 수 없습니다.'}</p>
          ) : (
            <>
              <div className="one-summary-record-panel">
                <RecordGroup
                  title="은퇴 시점"
                  values={[
                    { label: '예상 은퇴 나이', value: Number.isFinite(retirement.retirementAge) ? `${formatNumber(retirement.retirementAge)}세` : '산출 불가' },
                    { label: '은퇴까지 남은 기간', value: displayYears(retirement.yearsToRetirement) },
                    { label: '은퇴 후 생활 기간', value: displayYears(retirement.retirementYears, true) },
                  ]}
                />
                <RecordGroup
                  title="은퇴자금 비교"
                  values={[
                    { label: '은퇴생활비 기준 필요자금', value: displayWon(retirement.requiredAtRetirement) },
                    { label: '은퇴 시점 예상 준비자산', value: displayWon(retirement.readyAssetsAtRetirement) },
                  ]}
                  finalLabel="은퇴 시점 단순 비교 차이"
                  finalValue={displayWon(retirement.shortfall)}
                  finalNote="참고값"
                />
              </div>
              <p className="one-summary-retirement-reference">{RETIREMENT_SIMPLE_COMPARISON_NOTE}</p>
              {severanceLumpSums.length > 0 && (
                <div className="one-summary-lumpsums">
                  <span>향후 예정 목돈</span>
                  <div className="one-summary-lumpsum-items">
                    {severanceLumpSums.map((item) => (
                      <b key={`${item.label}-${item.age}`}>
                        {item.label} 퇴직급여 일시금 · {displayWon(item.amount)} · {formatNumber(item.age)}세 수령 예정
                      </b>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <section className="one-summary-section one-summary-peer" aria-labelledby="one-summary-peer-title">
        <div className="one-summary-section-heading">
          <div>
            <h2 className="subsection-head" id="one-summary-peer-title">04. 또래와 비교</h2>
            <p className="intro-text one-summary-section-description">동일 연령대 가구와 진단 당시의 재무 수준을 비교합니다.</p>
          </div>
          <p className="one-summary-section-meta">{peerComparison.userBracketLabel || peerComparison.benchmarkMeta?.ageBasis || '동일 연령대 기준'}</p>
        </div>
        <div className="one-summary-peer-comparison-list">
          {peerRows.map(([label, metric]) => <PeerComparisonBar key={label} label={label} metric={metric} />)}
        </div>
        {peerComparison.benchmarkMeta && (
          <p className="one-summary-peer-source">
            {peerComparison.benchmarkMeta.source}({peerComparison.benchmarkMeta.agency}) · {peerComparison.benchmarkMeta.ageBasis} 평균 · 자산·부채 {peerComparison.benchmarkMeta.assetAndDebtAsOf} 기준 · 소득 {peerComparison.benchmarkMeta.incomeYear}년 기준
          </p>
        )}
      </section>

      <p className="one-summary-note">이 진단은 방향을 처방하지 않습니다. 현재의 재무상태와 은퇴 준비 정도를 이해하기 위한 진단 결과입니다.</p>
    </PageFrame>
  );
}
