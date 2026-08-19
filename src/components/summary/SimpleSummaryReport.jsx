import { formatWon, formatPercent, formatNumber, round1 } from '../../utils/format';
import DonutChart from './DonutChart';
import '../../styles/simpleSummary.css';

const CHART_COLORS = ['var(--navy-700)', 'var(--teal)', 'var(--gold)', 'var(--navy-600)', 'var(--amber)', 'var(--red)', 'var(--navy-800)', 'var(--teal-soft)'];

function withColors(items) {
  return items.map((item, i) => ({ ...item, color: item.color || CHART_COLORS[i % CHART_COLORS.length] }));
}

function formatDesignDate(iso) {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

function formatLargeWon(value) {
  const amount = Math.round(Number(value) || 0);
  if (amount < 10000) return formatWon(amount);
  const eok = Math.floor(amount / 10000);
  const manwon = amount % 10000;
  return manwon > 0 ? `${eok}억 ${manwon.toLocaleString('ko-KR')}만원` : `${eok}억원`;
}

function getRetirementStatus(readiness) {
  if (readiness.notCalculable) {
    return {
      icon: '🤔',
      titleLines: ['은퇴 준비 상태를 확인하려면 정보가 조금 더 필요합니다.'],
      detailLines: [readiness.reason],
    };
  }

  const years = round1(readiness.retirementYears);
  if (readiness.shortfall <= 0) {
    return {
      icon: '😊',
      titleLines: [`고객님의 자산은 은퇴 후 ${years}년 동안`, '사용하기에 안정적인 상태입니다.'],
      detailLines: ['예상 준비자금이 필요한 자금을 충족합니다.', '현재 계획을 꾸준히 유지하는 것이 중요합니다.'],
    };
  }
  if (readiness.preparationRate >= 80) {
    return {
      icon: '🙂',
      titleLines: [`고객님의 자산은 은퇴 후 ${years}년 동안`, '사용하기에 일부 보완이 필요한 상태입니다.'],
      detailLines: [`예상 준비자금이 필요자금보다 ${formatLargeWon(readiness.shortfall)} 부족합니다.`, '지금부터 저축과 노후소득 계획을 조정하면 개선할 수 있습니다.'],
    };
  }
  if (readiness.preparationRate >= 50) {
    return {
      icon: '😥',
      titleLines: [`고객님의 자산은 은퇴 후 ${years}년 동안`, '사용하기에 부족한 상태입니다.'],
      detailLines: [`예상 준비자금이 필요자금보다 ${formatLargeWon(readiness.shortfall)} 부족합니다.`, '지금부터 저축과 노후소득 계획을 함께 점검할 필요가 있습니다.'],
    };
  }
  return {
    icon: '😰',
    titleLines: [`고객님의 자산은 은퇴 후 ${years}년 동안`, '사용하기에 많이 부족한 상태입니다.'],
    detailLines: [`예상 준비자금이 필요자금보다 ${formatLargeWon(readiness.shortfall)} 부족합니다.`, '우선순위를 정해 저축과 노후소득 계획을 조정할 필요가 있습니다.'],
  };
}

// 상세내역 카드의 한 줄. 입력 누락(missing)이면 "입력 필요"를, 아니면 0이라도 그대로 보여준다.
function DetailRow({ label, value, missing, bold, highlight, valueColor }) {
  return (
    <div className={`detail-row${bold ? ' detail-row--total' : ''}${highlight ? ' detail-row--highlight' : ''}`}>
      <span className="detail-row-label">{label}</span>
      <span className="detail-row-value" style={valueColor ? { color: valueColor } : undefined}>
        {missing ? <span className="overview-card-missing">입력 필요</span> : value}
      </span>
    </div>
  );
}

// 재무건강 총점은 연령대별 공식 통계(2025년 가계금융복지조사)가 없어 이번 갱신에서 제외한다
// (peerComparison.js의 retirementScore 자체는 하위호환을 위해 여전히 존재하지만 화면에는 표시하지 않음).
const PEER_METRIC_DEFS = [
  { key: 'netWorth', label: '순자산', unit: 'won' },
  { key: 'annualIncome', label: '연소득', unit: 'won', peerKey: 'householdIncome' },
  { key: 'financialAssets', label: '금융자산', unit: 'won' },
];

function PeerMetricRow({ label, metric, unit }) {
  const { value, average, diffPercent, percentileLabel } = metric;
  const formatValue = (v) => (unit === 'point' ? `${formatNumber(v)}점` : formatWon(v));
  const displayPercentileLabel = percentileLabel?.replace('또래 평균', '또래 가구 평균');

  if (value == null || !Number.isFinite(value)) {
    return (
      <div className="peer-row">
        <div className="peer-row-head">
          <span className="peer-row-label">{label}</span>
          <span className="peer-row-tag peer-row-tag--muted">비교 데이터 부족</span>
        </div>
      </div>
    );
  }

  const maxScale = Math.max(value, average, 1) * 1.2;
  const userPct = Math.min(100, Math.max(0, (value / maxScale) * 100));
  const avgPct = Math.min(100, Math.max(0, (average / maxScale) * 100));
  const diffClass = diffPercent == null ? '' : diffPercent >= 0 ? 'peer-diff-pos' : 'peer-diff-neg';

  return (
    <div className="peer-row">
      <div className="peer-row-head">
        <span className="peer-row-label">{label}</span>
        <span className="peer-row-tag">{displayPercentileLabel}</span>
      </div>
      <div className="peer-bar-track" role="img" aria-label={`${label} 내 값 ${formatValue(value)}, 또래 가구 평균 ${formatValue(average)}`}>
        <div className="peer-bar-fill" style={{ width: `${userPct}%` }} />
        <div className="peer-bar-avg-marker" style={{ left: `${avgPct}%` }}>
          <span className="peer-bar-avg-label">평균 {formatValue(average)}</span>
        </div>
      </div>
      <div className="peer-row-numbers">
        <span>내 값 <b>{formatValue(value)}</b></span>
        <span>또래 가구 평균 {formatValue(average)}</span>
        {diffPercent != null && <span className={diffClass}>{diffPercent > 0 ? '+' : ''}{diffPercent}%</span>}
      </div>
    </div>
  );
}

function FutureFinanceChart({ targets }) {
  const maxValue = Math.max(...targets.flatMap((item) => [item.livingExpense || 0, item.pensionIncome || 0]), 1);
  return (
    <div className="future-chart" role="img" aria-label="60세, 70세, 80세 예상 생활비와 예상 연금소득 비교">
      {targets.map((item) => (
        <div className="future-chart-group" key={item.age}>
          <div className="future-chart-bars">
            <div className="future-chart-bar future-chart-bar--expense" style={{ height: `${((item.livingExpense || 0) / maxValue) * 100}%` }}><span>{item.livingExpense == null ? 'N/A' : formatWon(item.livingExpense)}</span></div>
            <div className="future-chart-bar future-chart-bar--pension" style={{ height: `${((item.pensionIncome || 0) / maxValue) * 100}%` }}><span>{item.pensionIncome == null ? 'N/A' : formatWon(item.pensionIncome)}</span></div>
          </div>
          <strong>{item.age}세</strong>
        </div>
      ))}
      <div className="future-chart-legend"><span><i className="future-legend-expense" />예상 생활비</span><span><i className="future-legend-pension" />예상 연금소득</span></div>
    </div>
  );
}

export default function SimpleSummaryReport({ result, onBack, onHome, onDownload, onShare }) {
  const { generatedAt, peerComparison, webSummary } = result;
  const { overviewDetail: od, donuts, retirementReadiness } = webSummary;
  const rr = retirementReadiness;
  const future = webSummary.futureFinance;
  const storedPeerAge = peerComparison.userAge ?? result.simulation?.currentAge;
  const peerUserAge = Number.isFinite(storedPeerAge) && storedPeerAge > 0 ? storedPeerAge : null;
  const peerBracketLabel = peerComparison.userBracketLabel
    || peerComparison.ageBrackets?.find((bracket) => bracket.isUserBracket)?.label
    || '확인 불가';
  const retirementStatus = getRetirementStatus(rr);

  const requiredBarMax = Math.max(rr.requiredAtRetirement || 0, rr.readyAssetsAtRetirement || 0, rr.shortfall || 0, 1);
  const pensionMonthlyTotal = rr.monthlyIncomeCompare.nationalPensionMonthly + rr.monthlyIncomeCompare.severancePensionMonthly + rr.monthlyIncomeCompare.personalPensionMonthly;
  // 이전에 저장된 결과에도 계산 근거가 보이도록 기존 필드에서 안전하게 역산한다.
  const retirementMonths = rr.retirementYears * 12;
  const livingCostNow = rr.retirementLivingCostNow ?? rr.monthlyIncomeCompare.livingCostMonthly;
  const livingCostAtRetirement = rr.retirementLivingCostAtRetirement
    ?? (retirementMonths > 0 ? rr.requiredAtRetirement / retirementMonths : livingCostNow);
  const hasPreparationBreakdown = Number.isFinite(rr.currentReadyAssets) && Number.isFinite(rr.assumedReturnRate);
  const baseLivingCost = Math.round(livingCostNow * retirementMonths);
  const inflationIncrease = Math.max(0, rr.requiredAtRetirement - baseLivingCost);

  return (
    <div className="simple-summary">
      <div className="simple-summary-topbar">
        <button type="button" className="ss-back-btn" onClick={onHome}>
          홈으로
        </button>
        <button type="button" className="ss-back-btn" onClick={onBack}>
          ← 뒤로가기
        </button>
      </div>

      {/* 페이지가 6개 섹션으로 길게 이어지는데 이동 수단이 없어, 스크롤 중에도 원하는
          섹션으로 바로 이동할 수 있는 상단 고정 내비게이션을 추가한다. */}
      <nav className="ss-section-nav" aria-label="섹션 바로가기">
        <a href="#ss-h-hero">종합결과</a>
        <a href="#ss-h-overview">재무현황</a>
        <a href="#ss-h-composition">재무구성</a>
        <a href="#ss-h-peer">또래비교</a>
        <a href="#ss-h-future">미래전망</a>
        <a href="#ss-h-retirement">은퇴준비</a>
        <a href="#ss-h-download">다운로드</a>
      </nav>

      <div className="simple-summary-date">최근 설계일 {formatDesignDate(generatedAt)}</div>

      {/* 0. 종합 결과 (히어로) - result.summary는 이미 서버에서 계산돼 내려오지만
          지금까지 어떤 화면에도 노출되지 않던 값이라 여기서 처음 표시한다. */}
      <section aria-labelledby="ss-h-hero">
        <h2 id="ss-h-hero" className="simple-summary-title">종합 결과</h2>
        <div className="fhs-hero">
          <div className="ss-status-icon" aria-hidden="true">{retirementStatus.icon}</div>
          <div className="fhs-hero-text ss-status-copy">
            <div className="ss-status-title">
              {retirementStatus.titleLines.map((line) => <span key={line}>{line}</span>)}
            </div>
            <div className="ss-status-detail">
              {retirementStatus.detailLines.map((line) => <span key={line}>{line}</span>)}
            </div>
          </div>
        </div>
        {!rr.notCalculable && (
          <div className="ss-status-facts">
            <div>
              <span>향후 노후 생활 기간</span>
              <strong>{round1(rr.retirementYears)}년</strong>
            </div>
            <div>
              <span>월평균 지출비용</span>
              <strong>{formatNumber(rr.monthlyIncomeCompare.livingCostMonthly)}만원</strong>
            </div>
          </div>
        )}
        {!rr.notCalculable && (
          <details className="retirement-calculation retirement-calculation--hero">
            <summary>왜 이 금액이 나왔나요?</summary>
            <div className="retirement-calculation-body">
              <p>
                <span>① 은퇴 시점 월 생활비</span>
                <strong>
                  현재 {formatWon(livingCostNow)} → 물가 {rr.inflationRate != null ? `${formatPercent(rr.inflationRate)} ` : ''}반영 후 {formatWon(livingCostAtRetirement)}
                </strong>
              </p>
              <p>
                <span>② 은퇴생활 필요자금</span>
                <strong>
                  월 {formatNumber(livingCostAtRetirement)}만원 × {formatNumber(retirementMonths)}개월 = {formatWon(rr.requiredAtRetirement)}
                </strong>
              </p>
              <p className="retirement-calculation-result">
                <span>③ 최종 부족자금</span>
                <strong>
                  필요자금 {formatWon(rr.requiredAtRetirement)} − 준비자산 {formatWon(rr.readyAssetsAtRetirement)} = {formatWon(rr.shortfall)}
                </strong>
              </p>
            </div>
          </details>
        )}
      </section>

      {/* 1. 나의 재무 현황 */}
      <section aria-labelledby="ss-h-overview">
        <h2 id="ss-h-overview" className="simple-summary-title">나의 재무 현황</h2>
        <p className="simple-summary-subtitle">현재 수입과 지출, 자산과 부채를 한눈에 확인해 보세요.</p>

        <div className="detail-card">
          <div className="detail-card-header">
            <span className="detail-card-icon" aria-hidden="true">📊</span>
            <span className="detail-card-title">자산현황 세부내역</span>
          </div>

          <div className="detail-group">
            <div className="detail-group-head">수입 <span className="detail-group-tag">월평균</span></div>
            {od.income.salaryItems?.length ? (
              od.income.salaryItems.map((item) => (
                <DetailRow key={item.key} label={item.label} value={formatWon(item.value)} />
              ))
            ) : (
              <DetailRow label="급여" value={formatWon(od.income.salary)} missing={od.income.salaryMissing} />
            )}
            <DetailRow label="사업·기타소득" value={formatWon(od.income.businessAndOther)} missing={od.income.businessAndOtherMissing} />
            <DetailRow
              label="합계" bold
              value={<>{formatWon(od.income.monthlyTotal)} · 연 {formatWon(od.income.annualTotal)}</>}
            />
          </div>

          <div className="detail-group">
            <div className="detail-group-head">지출 <span className="detail-group-tag">월평균</span></div>
            <DetailRow label="생활비·주거비·보험" value={formatWon(od.expense.livingHousingInsurance)} missing={od.expense.livingHousingInsuranceMissing} />
            <DetailRow label="저축·투자" value={formatWon(od.expense.savings)} missing={od.expense.savingsMissing} />
            <DetailRow label="고정지출 합계" bold value={formatWon(od.expense.fixedTotal)} />
          </div>

          <div className="detail-group">
            <div className="detail-group-head">자산·부채</div>
            <DetailRow label="현금성자산" value={formatWon(od.balance.liquid)} missing={od.balance.liquidMissing} />
            <DetailRow label="금융·연금자산" value={formatWon(od.balance.financialAndPension)} missing={od.balance.financialAndPensionMissing} />
            <DetailRow
              label="부동산·총부채"
              value={formatWon(od.balance.realEstateNetOfDebt)}
              missing={od.balance.realEstateNetOfDebtMissing}
              valueColor={od.balance.realEstateNetOfDebt < 0 ? 'var(--red)' : undefined}
            />
            <DetailRow
              label="순자산" bold highlight
              value={formatWon(od.balance.netWorth)}
              valueColor={od.balance.netWorth < 0 ? 'var(--red)' : undefined}
            />
          </div>
        </div>
      </section>

      {/* 2. 나의 재무 구성 */}
      <section aria-labelledby="ss-h-composition">
        <h2 id="ss-h-composition" className="simple-summary-title">나의 재무 구성</h2>
        <p className="simple-summary-subtitle">수입이 어디에 사용되고 자산과 부채가 어떻게 구성되어 있는지 확인해 보세요.</p>
        <div className="donut-grid">
          <DonutChart
            title="월 소득 배분"
            centerLabel={donuts.income.isOverspending ? '월 지출 초과' : '월 총소득'}
            total={donuts.income.total}
            items={withColors(donuts.income.items)}
            footnote={
              donuts.income.isOverspending
                ? `⚠ 지출·저축이 소득을 초과해 매월 약 ${formatWon(donuts.income.overspendAmount)} 초과지출 상태입니다.`
                : '생활지출에는 주거비·변동지출(경조사 등)이 포함됩니다.'
            }
            footnoteTone={donuts.income.isOverspending ? 'warning' : undefined}
          />
          <DonutChart
            title="지출 구성"
            centerLabel="월 총지출"
            total={donuts.expense.total}
            items={withColors(donuts.expense.items)}
          />
          <DonutChart title="자산 구성" centerLabel="총자산" total={donuts.assets.total} items={withColors(donuts.assets.items)} />
          <DonutChart
            title="부채 구성"
            centerLabel="총부채"
            total={donuts.debt.total}
            items={withColors(donuts.debt.items)}
            emptyMessage={donuts.debt.isEmpty ? '현재 부채가 없습니다.' : '대출 상세 내역을 입력하면 부채 구성을 확인할 수 있습니다.'}
          />
          <DonutChart
            title="저축·투자 구성"
            centerLabel="월 저축·투자액"
            total={donuts.savings.total}
            items={withColors(donuts.savings.items)}
            emptyMessage={donuts.savings.isEmpty ? '현재 저축·투자액이 없습니다.' : '저축 상세 내역을 입력하면 저축 구성을 확인할 수 있습니다.'}
          />
        </div>
      </section>

      {/* 3. 또래와 비교한 나의 위치 */}
      <section aria-labelledby="ss-h-peer">
        <h2 id="ss-h-peer" className="simple-summary-title">또래와 비교한 나의 위치</h2>
        <p className="simple-summary-subtitle">같은 연령대와 비교해 현재 재무 수준을 확인해 보세요.</p>
        <div className="peer-age-summary" aria-label="또래 비교 연령 기준">
          <span>내 연령 <strong>{peerUserAge != null ? `${peerUserAge}세` : '미입력'}</strong></span>
          <span>비교 또래 연령군 <strong>{peerBracketLabel}</strong></span>
        </div>
        {peerComparison.benchmarkMeta && (
          <div className="fine-print" style={{ marginBottom: 10 }}>
            {peerComparison.benchmarkMeta.source}({peerComparison.benchmarkMeta.agency}) {peerComparison.benchmarkMeta.ageBasis} 평균입니다. 자산·부채는 {peerComparison.benchmarkMeta.assetAndDebtAsOf} 기준, 소득은 {peerComparison.benchmarkMeta.incomeYear}년 연간 기준입니다.
          </div>
        )}
        <div className="peer-compare-list">
          {PEER_METRIC_DEFS.map((def) => (
            <PeerMetricRow key={def.key} label={def.label} unit={def.unit} metric={peerComparison[def.peerKey || def.key]} />
          ))}
        </div>
      </section>

      <section aria-labelledby="ss-h-future">
        <h2 id="ss-h-future" className="simple-summary-title">미래 재무 전망</h2>
        <p className="simple-summary-subtitle">물가와 연금의 변화를 반영해 60·70·80세의 예상 현금흐름을 살펴봅니다.</p>

        {!future || future.missing.age ? (
          <p className="ss-guidance">나이를 입력하면 미래 재무 전망을 확인할 수 있습니다.</p>
        ) : future.targets.length === 0 ? (
          <p className="ss-guidance">80세 이후에는 현재 시점 기준 전망 대상 연령이 없습니다.</p>
        ) : (
          <>
            <h3 className="ss-section-title">연금소득 기준 생활비 충당률</h3>
            <div className="future-method-note">
              <b>계산 원리</b>
              <span>현재 월 생활비에는 매년 3%의 물가상승률을 복리로 적용합니다.</span>
              <span>국민연금은 수급개시연령 이후부터 연 2.1% 증가를 적용하며, 개인연금과 퇴직연금은 현재 월 수령액이 유지된다고 가정합니다.</span>
            </div>
            <div className="future-card-grid">
              {future.targets.map((item) => (
                <article className={`future-card future-card--${item.status}`} key={item.age}>
                  <div className="future-card-age">{item.age}세</div>
                  <span className="future-card-label">연금소득 기준 생활비 충당률</span>
                  <strong className="future-card-rate">{item.coverageRate == null ? '산출 불가' : `${Math.round(item.coverageRate)}%`}</strong>
                  <dl>
                    <div><dt>예상 생활비</dt><dd>{item.livingExpense == null ? '데이터 부족' : formatWon(item.livingExpense)}</dd></div>
                    <div><dt>예상 연금소득</dt><dd>{item.pensionIncome == null ? '산출 불가' : formatWon(item.pensionIncome)}</dd></div>
                  </dl>
                  {item.balance != null && <p className="future-card-balance">{item.balance < 0 ? `${formatWon(Math.abs(item.balance))} 부족` : `${formatWon(item.balance)} 여유`}</p>}
                  {item.calculationReason && <small>{item.calculationReason}</small>}
                </article>
              ))}
            </div>

            <h3 className="ss-section-title">현금흐름 비교</h3>
            <div className="future-method-note">
              <b>계산 원리</b>
              <span>생활비 충당률 = 해당 연령의 예상 연금소득 ÷ 예상 생활비 × 100</span>
              <span>연금소득에서 생활비를 뺀 값으로 매월 예상 부족액 또는 여유금액을 계산합니다.</span>
            </div>
            <FutureFinanceChart targets={future.targets} />
            {future.diagnosis && <p className="future-diagnosis">{future.diagnosis}</p>}
          </>
        )}

        <div className="future-purchasing-card">
          <h3>현재 자산의 미래 구매력</h3>
          <div className="future-method-note future-method-note--in-card">
            <b>계산 원리</b>
            <span>필요한 미래 금액 = 현재 순자산 × (1 + 물가상승률 3%)<sup>경과연수</sup></span>
            <span>자산이 해당 금액까지 실제로 늘어난다는 뜻이 아니라, 현재와 같은 구매력을 유지하기 위한 기준 금액입니다.</span>
          </div>
          {future?.purchasingPower ? (
            <div className="future-purchasing-flow">
              {future.purchasingPower.map((item, index) => (
                <div className="future-purchasing-step" key={item.years}>
                  {index > 0 && <span className="future-flow-arrow" aria-hidden="true">→</span>}
                  <span>{item.years === 0 ? '현재' : `${item.years}년 후`}</span>
                  <strong>{formatLargeWon(item.requiredAmount)}</strong>
                  {item.years > 0 && <small>동일 구매력 기준</small>}
                </div>
              ))}
            </div>
          ) : <p className="overview-card-missing">순자산 데이터가 부족합니다.</p>}
        </div>

        <p className="future-disclaimer">본 결과는 현재 입력값과 가정에 따른 예상치이며 실제 물가, 연금 및 자산가치 변화에 따라 달라질 수 있습니다.</p>
      </section>

      {/* 4. 나의 은퇴 준비 현황 */}
      <section aria-labelledby="ss-h-retirement">
        <h2 id="ss-h-retirement" className="simple-summary-title">나의 은퇴 준비 현황</h2>
        <p className="simple-summary-subtitle">예상 은퇴 시점에 필요한 자금과 준비된 자금을 비교해 보세요.</p>

        {rr.notCalculable ? (
          <p className="ss-guidance">{rr.reason}</p>
        ) : (
          <>
            <div className="overview-card-grid retirement-card-grid">
              <div className="overview-card">
                <div className="overview-card-label">예상 은퇴 나이</div>
                <div className="overview-card-value">{rr.retirementAge}세</div>
              </div>
              <div className="overview-card">
                <div className="overview-card-label">은퇴까지 남은 기간</div>
                <div className="overview-card-value">{rr.yearsToRetirement}년</div>
              </div>
              <div className="overview-card">
                <div className="overview-card-label">은퇴 후 생활 기간</div>
                <div className="overview-card-value">{round1(rr.retirementYears)}년</div>
              </div>
              <div className="overview-card overview-card--highlight">
                <div className="overview-card-label">은퇴 시점 필요자금</div>
                <div className="overview-card-value">{formatWon(rr.requiredAtRetirement)}</div>
              </div>
              <div className="overview-card overview-card--highlight">
                <div className="overview-card-label">은퇴 시점 예상 준비자산</div>
                <div className="overview-card-value">{formatWon(rr.readyAssetsAtRetirement)}</div>
              </div>
              <div className="overview-card overview-card--risk">
                <div className="overview-card-label">예상 부족자금</div>
                <div className="overview-card-value">{formatWon(rr.shortfall)}</div>
              </div>
              <div className="overview-card overview-card--wide">
                <div className="overview-card-label">현재 노후소득보장률</div>
                <div className="overview-card-value">
                  {rr.retirementIncomeIndicator?.notCalculable
                    ? <span className="overview-card-missing">산출 불가</span>
                    : formatPercent(rr.retirementIncomeIndicator?.value)}
                </div>
                {!rr.retirementIncomeIndicator?.notCalculable && (
                  <div className="overview-card-explanation">
                    <p>은퇴 후 필요한 월 생활비 중 예상 연금소득으로 충당할 수 있는 비율입니다.</p>
                    <p>
                      예상 연금소득이 은퇴 후 월 생활비의{' '}
                      <strong>{formatPercent(rr.retirementIncomeIndicator?.value)}</strong>를 충당합니다.
                    </p>
                  </div>
                )}
                <p className="overview-card-formula">월 예상 노후소득 ÷ 은퇴 후 월 필요생활비 × 100</p>
                {!rr.retirementIncomeIndicator?.notCalculable && rr.retirementIncomeIndicator?.value === 0 && (
                  <p className="overview-card-zero-reason">
                    {rr.retirementIncomeZeroReason || '월 수령 방식으로 입력된 노후 연금액이 없어 0%입니다.'}
                  </p>
                )}
              </div>
            </div>

            <h3 className="ss-section-title">필요자금 비교</h3>
            <div className="need-compare-bars">
              {[
                { key: 'required', label: '필요자금', value: rr.requiredAtRetirement, color: 'var(--red)' },
                { key: 'ready', label: '준비자산', value: rr.readyAssetsAtRetirement, color: 'var(--navy-700)' },
                { key: 'shortfall', label: '부족자금', value: rr.shortfall, color: 'var(--red)' },
              ].map((bar) => (
                <div className="need-compare-item" key={bar.key}>
                  <div className="need-compare-row">
                    <span className="need-compare-label">{bar.label}</span>
                    <div className="need-compare-track">
                      <div className="need-compare-fill" style={{ width: `${Math.min(100, (bar.value / requiredBarMax) * 100)}%`, background: bar.color }} />
                    </div>
                    <span className="need-compare-value">{formatWon(bar.value)}</span>
                  </div>
                  <details className="need-breakdown">
                    <summary>{bar.label} 내역 보기</summary>
                    {bar.key === 'required' && (
                      <div className="need-breakdown-list">
                        <DetailRow
                          label={`현재 기준 생활비 (월 ${formatNumber(livingCostNow)}만원 × ${formatNumber(retirementMonths)}개월)`}
                          value={formatWon(baseLivingCost)}
                        />
                        <DetailRow
                          label={`은퇴까지 ${formatNumber(rr.yearsToRetirement)}년간 물가상승분${rr.inflationRate != null ? ` (연 ${formatPercent(rr.inflationRate)})` : ''}`}
                          value={`+${formatWon(inflationIncrease)}`}
                        />
                        <DetailRow label="은퇴 시점 필요자금" value={formatWon(rr.requiredAtRetirement)} bold />
                      </div>
                    )}
                    {bar.key === 'ready' && (
                      <div className="need-breakdown-list">
                        {hasPreparationBreakdown ? (
                          <>
                            <DetailRow
                              label={`현재 보유자산 ${formatWon(rr.currentReadyAssets)}의 은퇴 시점 예상금액`}
                              value={formatWon(rr.currentAssetsAtRetirement)}
                            />
                            <DetailRow label="은퇴 전까지 추가 저축의 예상금액" value={formatWon(rr.futureSavingsAtRetirement)} />
                            <DetailRow label="은퇴 시점 예상 준비자산" value={formatWon(rr.readyAssetsAtRetirement)} bold />
                            <p className="need-breakdown-note">
                              준비자산은 현재 자산 {formatWon(rr.currentReadyAssets)}과 앞으로의 저축을 은퇴까지 연 {formatPercent(rr.assumedReturnRate)}로 운용한다고 가정한 금액입니다.
                            </p>
                          </>
                        ) : (
                          <>
                            <DetailRow label="은퇴 시점 예상 준비자산" value={formatWon(rr.readyAssetsAtRetirement)} bold />
                            <p className="need-breakdown-note">현재 금융·현금·연금자산과 은퇴 전까지의 추가 저축을 반영한 금액입니다.</p>
                          </>
                        )}
                      </div>
                    )}
                    {bar.key === 'shortfall' && (
                      <div className="need-breakdown-list">
                        <DetailRow label="은퇴 시점 필요자금" value={formatWon(rr.requiredAtRetirement)} />
                        <DetailRow label="은퇴 시점 예상 준비자산" value={`−${formatWon(rr.readyAssetsAtRetirement)}`} />
                        <DetailRow label="예상 부족자금" value={formatWon(rr.shortfall)} bold />
                      </div>
                    )}
                  </details>
                </div>
              ))}
            </div>
            <p className="need-compare-assumptions">
              계산 가정: 은퇴까지 {formatNumber(rr.yearsToRetirement)}년 · 은퇴 후 {formatNumber(rr.retirementYears)}년({formatNumber(retirementMonths)}개월)
              {rr.inflationRate != null ? ` · 물가상승률 연 ${formatPercent(rr.inflationRate)}` : ''}
              {rr.assumedReturnRate != null ? ` · 예상 운용수익률 연 ${formatPercent(rr.assumedReturnRate)}` : ''}
            </p>

            <h3 className="ss-section-title">은퇴시점 필요자금 · 소득공백기간</h3>
            {rr.incomeGap.notCalculable ? (
              <p className="ss-guidance">{rr.incomeGap.reason}</p>
            ) : rr.incomeGap.hasGap ? (
              <div className="detail-card gap-timeline-card">
                <div className="gap-timeline">
                  <div className="gap-timeline-point">
                    <div className="gap-timeline-age">{rr.retirementAge}세</div>
                    <div className="gap-timeline-label">정년(예정)</div>
                  </div>
                  <div className="gap-timeline-track">
                    <div className="gap-timeline-badge">{rr.incomeGap.gapYears}년 공백</div>
                    <div className="gap-timeline-line" aria-hidden="true" />
                  </div>
                  <div className="gap-timeline-point">
                    <div className="gap-timeline-age">{rr.incomeGap.nationalPensionStartAge}세</div>
                    <div className="gap-timeline-label">국민연금 개시</div>
                  </div>
                </div>
                <div className="ss-card-list">
                  <div className="ss-card-row">
                    <div className="ss-row-label">월 필요생활비</div>
                    <div className="ss-row-value-sm">{formatWon(rr.monthlyIncomeCompare.livingCostMonthly)}</div>
                  </div>
                  <div className="ss-card-row">
                    <div className="ss-row-label">공백기간 연 필요금액</div>
                    <div className="ss-row-value-sm">{formatWon(rr.incomeGap.annualGapCost)}</div>
                  </div>
                  <div className="ss-card-row ss-total-row">
                    <div className="ss-row-label"><b>{rr.incomeGap.gapYears}년간 총 필요금액</b></div>
                    <div className="ss-row-value-sm gap-total-value">{formatWon(rr.incomeGap.totalGapFundingNeeded)}</div>
                  </div>
                </div>
                <p className="ss-footnote-note">정년 이후 국민연금을 받기 전까지, 별도로 준비해야 하는 생활비예요.</p>
              </div>
            ) : (
              <p className="ss-gap-note">
                은퇴 시점({rr.retirementAge}세)에 이미 국민연금 수급개시연령({rr.incomeGap.nationalPensionStartAge}세)을 지나 있어
                별도의 소득공백기간이 없습니다.
              </p>
            )}

            <h3 className="ss-section-title">월 노후소득 비교</h3>
            <div className="ss-card-list">
              <div className="ss-card-row">
                <div className="ss-row-label">노후 월 필요생활비</div>
                <div className="ss-row-value-sm">{formatWon(rr.monthlyIncomeCompare.livingCostMonthly)}</div>
              </div>
              <div className="ss-card-row">
                <div className="ss-row-label">국민연금 예상 월소득</div>
                <div className="ss-row-value-sm">{formatWon(rr.monthlyIncomeCompare.nationalPensionMonthly)}</div>
              </div>
              <div className="ss-card-row">
                <div className="ss-row-label">퇴직연금 예상 월소득</div>
                <div className="ss-row-value-sm">{formatWon(rr.monthlyIncomeCompare.severancePensionMonthly)}</div>
              </div>
              <div className="ss-card-row">
                <div className="ss-row-label">개인연금 예상 월소득</div>
                <div className="ss-row-value-sm">{formatWon(rr.monthlyIncomeCompare.personalPensionMonthly)}</div>
              </div>
              <div className="ss-card-row ss-total-row">
                <div className="ss-row-label"><b>연금 합계</b></div>
                <div className="ss-row-value-sm">{formatWon(pensionMonthlyTotal)}</div>
              </div>
              <div className="ss-card-row">
                <div className="ss-row-label">월 소득 부족액</div>
                <div className="ss-row-value-sm" style={{ color: rr.monthlyIncomeCompare.shortfallMonthly > 0 ? 'var(--red)' : 'inherit' }}>
                  {formatWon(rr.monthlyIncomeCompare.shortfallMonthly)}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* 5. 상세 리포트 다운로드 */}
      <section className="ss-download-section" aria-labelledby="ss-h-download">
        <h2 id="ss-h-download" className="simple-summary-title">더 자세한 분석이 필요하신가요?</h2>
        <p className="simple-summary-subtitle">상세 리포트는 더 나은 분석을 위해 현재 개선 중입니다.</p>
        <button type="button" className="btn-primary ss-download-btn" onClick={onDownload} disabled aria-disabled="true" title="현재 개선 중인 기능입니다">
          상세 리포트 다운로드 (점검중입니다.)
        </button>
        <div className="ss-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>← 뒤로가기</button>
          <button type="button" className="btn-secondary" onClick={onShare}>공유하기</button>
        </div>
      </section>
    </div>
  );
}
