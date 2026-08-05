import { formatWon, formatPercent, formatNumber } from '../../utils/format';
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

const PEER_METRIC_DEFS = [
  { key: 'netWorth', label: '순자산', unit: 'won' },
  { key: 'annualIncome', label: '연소득', unit: 'won', peerKey: 'householdIncome' },
  { key: 'financialAssets', label: '금융자산', unit: 'won' },
  { key: 'retirementScore', label: '재무건강 총점', unit: 'point' },
];

function PeerMetricRow({ label, metric, unit }) {
  const { value, average, diffPercent, percentileLabel } = metric;
  const formatValue = (v) => (unit === 'point' ? `${formatNumber(v)}점` : formatWon(v));

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
        <span className="peer-row-tag">{percentileLabel}</span>
      </div>
      <div className="peer-bar-track" role="img" aria-label={`${label} 내 값 ${formatValue(value)}, 또래 평균 ${formatValue(average)}`}>
        <div className="peer-bar-fill" style={{ width: `${userPct}%` }} />
        <div className="peer-bar-avg-marker" style={{ left: `${avgPct}%` }} title="또래 평균 위치" />
      </div>
      <div className="peer-row-numbers">
        <span>내 값 <b>{formatValue(value)}</b></span>
        <span>또래 평균 {formatValue(average)}</span>
        {diffPercent != null && <span className={diffClass}>{diffPercent > 0 ? '+' : ''}{diffPercent}%</span>}
      </div>
    </div>
  );
}

export default function SimpleSummaryReport({ result, onBack, onDownload, onShare }) {
  const { generatedAt, peerComparison, webSummary } = result;
  const { overviewDetail: od, donuts, retirementReadiness } = webSummary;
  const rr = retirementReadiness;

  const requiredBarMax = Math.max(rr.requiredAtRetirement || 0, rr.readyAssetsAtRetirement || 0, rr.shortfall || 0, 1);
  const pensionMonthlyTotal = rr.monthlyIncomeCompare.nationalPensionMonthly + rr.monthlyIncomeCompare.severancePensionMonthly + rr.monthlyIncomeCompare.personalPensionMonthly;

  return (
    <div className="simple-summary">
      <div className="simple-summary-topbar">
        <button type="button" className="ss-back-btn" onClick={onBack}>
          ← 뒤로가기
        </button>
      </div>
      <div className="simple-summary-date">최근 설계일 {formatDesignDate(generatedAt)}</div>

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
            <DetailRow label="급여" value={formatWon(od.income.salary)} missing={od.income.salaryMissing} />
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
        {peerComparison.isPlaceholderData && (
          <div className="ss-placeholder-badge">참고용 예시 비교 — 실제 공식 통계 연동 전까지 사용하는 자리표시 데이터입니다.</div>
        )}
        <div className="peer-compare-list">
          {PEER_METRIC_DEFS.map((def) => (
            <PeerMetricRow key={def.key} label={def.label} unit={def.unit} metric={peerComparison[def.peerKey || def.key]} />
          ))}
        </div>
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
                <div className="overview-card-value">{rr.retirementYears}년</div>
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
              <div className="overview-card">
                <div className="overview-card-label">현재 노후소득보장률</div>
                <div className="overview-card-value">
                  {rr.retirementIncomeIndicator?.notCalculable
                    ? <span className="overview-card-missing">산출 불가</span>
                    : formatPercent(rr.retirementIncomeIndicator?.value)}
                </div>
              </div>
            </div>

            <h3 className="ss-section-title">필요자금 비교</h3>
            <div className="need-compare-bars">
              {[
                { label: '필요자금', value: rr.requiredAtRetirement, color: 'var(--red)' },
                { label: '준비자산', value: rr.readyAssetsAtRetirement, color: 'var(--navy-700)' },
                { label: '부족자금', value: rr.shortfall, color: 'var(--amber)' },
              ].map((bar) => (
                <div className="need-compare-row" key={bar.label}>
                  <span className="need-compare-label">{bar.label}</span>
                  <div className="need-compare-track">
                    <div className="need-compare-fill" style={{ width: `${Math.min(100, (bar.value / requiredBarMax) * 100)}%`, background: bar.color }} />
                  </div>
                  <span className="need-compare-value">{formatWon(bar.value)}</span>
                </div>
              ))}
            </div>

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
        <p className="simple-summary-subtitle">상세 재무지표와 은퇴 시뮬레이션, 개선 방향을 전체 리포트에서 확인할 수 있습니다.</p>
        <button type="button" className="btn-primary ss-download-btn" onClick={onDownload}>
          상세 리포트 다운로드
        </button>
        <div className="ss-actions">
          <button type="button" className="btn-secondary" onClick={onBack}>← 뒤로가기</button>
          <button type="button" className="btn-secondary" onClick={onShare}>공유하기</button>
        </div>
      </section>
    </div>
  );
}
