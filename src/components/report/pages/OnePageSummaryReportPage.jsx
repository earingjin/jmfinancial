import PageFrame from './PageFrame';
import { formatNumber, formatPercent, formatWon } from '../../../utils/format';
import { getFinancialHealthStatus } from '../../summary/summaryPresentation';

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

function displayPercent(value) {
  return Number.isFinite(value) ? formatPercent(value) : '산출 불가';
}

function StatementGroup({ label, value, details = [] }) {
  return (
    <div className="one-summary-statement-group" aria-label={`${label} 구성내역`}>
      <div className="one-summary-statement-total">
        <span>{label}</span>
        <strong>{displayWon(value)}</strong>
      </div>
      {details.length > 0 && (
        <div className="one-summary-breakdown">
          {details.map((item) => (
            <div key={item.key || item.label}>
              <span>{item.label}</span>
              <b>{displayWon(item.value)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function peerStatus(metric) {
  if (!metric) return '비교 데이터 부족';
  return metric.percentileLabel || metric.comparisonLabel || '비교 데이터 부족';
}

export default function OnePageSummaryReportPage({ result, clientName }) {
  const aggregates = result?.aggregates || {};
  const indicators = result?.indicators || [];
  const donuts = result?.webSummary?.donuts || {};
  const retirement = result?.webSummary?.retirementReadiness || {};
  const future = result?.webSummary?.futureFinance || {};
  const peerComparison = result?.peerComparison || {};
  const financialHealth = getFinancialHealthStatus([
    indicators.find((item) => item.key === 'household'),
    indicators.find((item) => item.key === 'emergency'),
    indicators.find((item) => item.key === 'dsr'),
  ]);
  const financialHealthLabel = {
    '😊': '양호',
    '🙂': '점검 필요',
    '😥': '보완 필요',
    '🤔': '확인 필요',
  }[financialHealth.icon];
  const retirementNeedsSupplement = Number.isFinite(retirement.shortfall) && retirement.shortfall > 0;
  const retirementLabel = retirement.notCalculable
    ? '확인 필요'
    : retirementNeedsSupplement ? '보완 필요' : '준비 가능';
  const retirementSummary = retirement.notCalculable
    ? retirement.reason || '은퇴 준비 결과를 확인하려면 정보가 더 필요합니다.'
    : retirementNeedsSupplement
      ? `예상 준비자산이 필요자금보다 ${formatWon(retirement.shortfall)} 부족합니다.`
      : '예상 준비자산이 은퇴 시점 필요자금을 충당합니다.';
  const retirementIncome = retirement.retirementIncomeIndicator;
  const assetDetails = (donuts.assets?.items || []).filter((item) => Number(item?.value) > 0);
  const debtDetails = (donuts.debt?.items || []).filter((item) => Number(item?.value) > 0 && item.key !== 'total');
  const byPerson = aggregates.retirementIncomeByPerson || {};
  const severanceLumpSums = [
    ['본인', byPerson.self?.severanceLumpsum],
    ['배우자', byPerson.spouse?.severanceLumpsum],
  ].filter(([, amount]) => Number.isFinite(amount) && amount > 0);
  const peerRows = [
    ['순자산', peerComparison.netWorth],
    ['연소득', peerComparison.householdIncome],
    ['금융자산', peerComparison.financialAssets],
  ];
  const targetsByAge = new Map((future.targets || []).map((item) => [item.age, item]));
  const fiveYearHighlights = (future.fiveYearOutlook || [])
    .filter((item) => targetsByAge.has(item.age))
    .map((item) => ({ ...item, target: targetsByAge.get(item.age) }));
  const hasDuplicateRetirementCoverage = fiveYearHighlights.some((item) => (
    item.age === retirement.retirementAge
    && Number.isFinite(retirementIncome?.value)
    && item.target.coverageRate === retirementIncome.value
  ));
  const retirementRequiredAmount = retirement.requiredAtRetirement;
  const retirementReadyAmount = retirement.readyAssetsAtRetirement;
  const retirementShortfallAmount = retirement.shortfall;
  const hasRetirementDiagram = [retirementRequiredAmount, retirementReadyAmount, retirementShortfallAmount]
    .every((value) => Number.isFinite(value) && value >= 0)
    && retirementRequiredAmount > 0;
  const retirementReadyRatio = hasRetirementDiagram
    ? Math.min(1, retirementReadyAmount / retirementRequiredAmount)
    : 0;
  const retirementShortfallRatio = hasRetirementDiagram
    ? Math.min(1 - retirementReadyRatio, retirementShortfallAmount / retirementRequiredAmount)
    : 0;
  const showRetirementShortfallOutside = retirementShortfallRatio < 0.12;

  return (
    <PageFrame eyebrow="One-page Summary" title="재무진단 요약 리포트" pageNumber={1} totalPages={1} contentClassName="one-page-summary-pad">
      <header className="one-summary-header">
        <p className="intro-text report-compact-intro">현재 상태부터 은퇴 후 생활비 전망까지, 핵심 결과만 한 장에 정리했습니다.</p>
        <div className="one-summary-meta">
          <span title={clientName || '고객'}>{clientName || '고객'}</span>
          <time dateTime={result?.generatedAt || undefined}>진단일 {formatDate(result?.generatedAt)}</time>
        </div>
      </header>

      <section className="one-summary-judgment" aria-label="종합 결과">
        <div className="one-summary-judgment-grid">
          <article>
            <span>현재 재무상태</span>
            <strong className="one-summary-judgment-label">{financialHealthLabel}</strong>
            <p>{financialHealth.detail}</p>
          </article>
          <article className="is-retirement">
            <span>은퇴 준비상태</span>
            <strong className="one-summary-judgment-label">{retirementLabel}</strong>
            <p>{retirementSummary}</p>
          </article>
        </div>
      </section>

      <section className="one-summary-section" aria-labelledby="one-summary-current-title">
        <div className="one-summary-section-heading">
          <div>
            <h2 className="subsection-head" id="one-summary-current-title">현재 재무상태</h2>
            <p className="intro-text one-summary-section-description">보유 자산과 부채를 기준으로 현재 상태를 보여드립니다.</p>
          </div>
          <p className="one-summary-section-meta">가구 기준 현재 자산과 부채</p>
        </div>
        <div className="one-summary-balance-sheet">
          <StatementGroup label="총자산" value={aggregates.totalAssets} details={assetDetails} />
          <StatementGroup label="총부채" value={aggregates.totalDebt} details={debtDetails} />
          <div className="one-summary-net-result">
            <span>총자산 − 총부채</span>
            <b>순자산</b>
            <strong>{displayWon(aggregates.netWorth)}</strong>
          </div>
        </div>
      </section>

      <section className="one-summary-section one-summary-retirement" aria-labelledby="one-summary-retirement-title">
        <div className="one-summary-section-heading">
          <div>
            <h2 className="subsection-head" id="one-summary-retirement-title">은퇴 준비</h2>
            <p className="intro-text one-summary-section-description">필요자금과 예상 준비자산의 차이를 보여드립니다.</p>
          </div>
          <p className="one-summary-section-meta">{Number.isFinite(retirement.retirementAge) ? `${formatNumber(retirement.retirementAge)}세 은퇴 기준` : '은퇴 기준 확인 필요'}</p>
        </div>
        {retirement.notCalculable ? (
          <p className="one-summary-empty">{retirement.reason || '은퇴 준비 결과를 표시할 수 없습니다.'}</p>
        ) : (
          <>
            {hasRetirementDiagram ? (
              <div className="one-summary-retirement-diagram" aria-label="필요자금, 예상 준비자산, 부족자금 관계">
                <div className="one-summary-retirement-required">
                  <span>은퇴 시점 필요자금</span>
                  <strong>{displayWon(retirementRequiredAmount)}</strong>
                </div>
                <div className="one-summary-retirement-composition">
                  <div
                    className="one-summary-retirement-ready"
                    style={{ flexGrow: retirementReadyRatio, flexBasis: 0 }}
                  >
                    <span>예상 준비자산</span>
                    <strong>{displayWon(retirementReadyAmount)}</strong>
                  </div>
                  <div
                    className={`one-summary-retirement-shortfall${showRetirementShortfallOutside ? ' is-compact' : ''}`}
                    style={{ flexGrow: retirementShortfallRatio, flexBasis: 0 }}
                  >
                    {!showRetirementShortfallOutside && <><span>예상 부족자금</span><strong>{displayWon(retirementShortfallAmount)}</strong></>}
                  </div>
                </div>
                {showRetirementShortfallOutside && (
                  <p className="one-summary-retirement-shortfall-note">
                    <span>예상 부족자금</span><strong>{displayWon(retirementShortfallAmount)}</strong>
                  </p>
                )}
              </div>
            ) : (
              <div className="one-summary-retirement-flow">
                <div className="is-shortfall"><span>예상 부족자금</span><strong>{displayWon(retirement.shortfall)}</strong></div>
                <div><span>은퇴 시점 필요자금</span><strong>{displayWon(retirement.requiredAtRetirement)}</strong></div>
                <div><span>예상 준비자산</span><strong>{displayWon(retirement.readyAssetsAtRetirement)}</strong></div>
              </div>
            )}
            {severanceLumpSums.length > 0 && (
              <div className="one-summary-lumpsums">
                <span>예정 퇴직급여 일시금</span>
                {severanceLumpSums.map(([owner, amount]) => <b key={owner}>{owner} {displayWon(amount)}</b>)}
                <small>기존 입력 및 계산 결과 기준</small>
              </div>
            )}
          </>
        )}
      </section>

      <section className="one-summary-section one-summary-peer" aria-labelledby="one-summary-peer-title">
        <div className="one-summary-section-heading">
          <div>
            <h2 className="subsection-head" id="one-summary-peer-title">또래 비교</h2>
            <p className="intro-text one-summary-section-description">동일 연령대 가구와 현재 재무 수준을 비교합니다.</p>
          </div>
          <p className="one-summary-section-meta">{peerComparison.userBracketLabel || peerComparison.benchmarkMeta?.ageBasis || '동일 연령대 기준'}</p>
        </div>
        <table className="one-summary-peer-table">
          <thead><tr><th>항목</th><th>나</th><th>또래 기준</th><th>비교</th></tr></thead>
          <tbody>
            {peerRows.map(([label, metric]) => (
              <tr key={label}>
                <th>{label}</th>
                <td>{displayWon(metric?.value)}</td>
                <td>{displayWon(metric?.average)}</td>
                <td>{peerStatus(metric)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="one-summary-section one-summary-future" aria-labelledby="one-summary-future-title">
        <div className="one-summary-section-heading">
          <div>
            <h2 className="subsection-head" id="one-summary-future-title">은퇴 후 생활비 충당 전망</h2>
            <p className="intro-text one-summary-section-description">연금소득으로 생활비를 얼마나 충당하는지 보여드립니다.</p>
          </div>
          <p className="one-summary-section-meta">은퇴 시점 기준 · 연령별 전망과 별도</p>
        </div>
        {!hasDuplicateRetirementCoverage && (
          <div className="one-summary-coverage">
            <span>은퇴 시점 월 필요생활비 대비</span>
            <strong>{retirementIncome?.notCalculable ? '산출 불가' : displayPercent(retirementIncome?.value)}</strong>
            <small>전체 자산이 아닌 예상 연금소득 기준입니다.</small>
          </div>
        )}
        {fiveYearHighlights.length > 0 ? (
          <div className="one-summary-outlook" aria-label="5년 단위 생활비와 연금소득의 핵심 시점">
            {fiveYearHighlights.map((item) => (
              <div key={item.age}>
                <b><i aria-hidden="true" />{formatNumber(item.age)}세</b>
                <em>생활비의 {displayPercent(item.target.coverageRate)} 충당</em>
                <span>생활비 <strong>{displayWon(item.livingExpense)}</strong></span>
                <span>연금소득 <strong>{displayWon(item.target.pensionIncome)}</strong></span>
              </div>
            ))}
          </div>
        ) : <p className="one-summary-empty">기존 저장 결과에서는 5년 단위 전망을 표시할 수 없습니다.</p>}
      </section>

      <p className="one-summary-note">본 요약은 기존 진단 결과를 간추린 자료입니다. 세부 계산 근거와 항목별 안내는 상세 리포트에서 확인해 주세요.</p>
    </PageFrame>
  );
}
