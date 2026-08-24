import { useState } from 'react';
import { formatWon, formatPercent, formatNumber, round1 } from '../../utils/format';
import DonutChart from './DonutChart';
import { formatAssetProjectionOutlook, formatIndicatorStatusBadge, getFinancialHealthStatus } from './summaryPresentation';
import '../../styles/simpleSummary.css';

const CHART_COLORS = ['#e76f00', '#1976d2', '#2e8b57', '#c23b73', '#d4a017', '#d64545', '#708238', '#8c564b'];
const CHART_COLOR_BY_KEY = {
  carInsurance: '#00a6a6',
  debtRepay: '#54278f',
};

function withColors(items) {
  return items.map((item, i) => ({
    ...item,
    color: CHART_COLOR_BY_KEY[item.key] || item.color || CHART_COLORS[i % CHART_COLORS.length],
  }));
}

function formatDesignDate(iso) {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
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
      detailLines: [`예상 준비자금이 필요자금보다 ${formatWon(readiness.shortfall)} 부족합니다.`, '지금부터 저축과 노후소득 계획을 조정하면 개선할 수 있습니다.'],
    };
  }
  if (readiness.preparationRate >= 50) {
    return {
      icon: '😥',
      titleLines: [`고객님의 자산은 은퇴 후 ${years}년 동안`, '사용하기에 부족한 상태입니다.'],
      detailLines: [`예상 준비자금이 필요자금보다 ${formatWon(readiness.shortfall)} 부족합니다.`, '지금부터 저축과 노후소득 계획을 함께 점검할 필요가 있습니다.'],
    };
  }
  return {
    icon: '😰',
    titleLines: [`고객님의 자산은 은퇴 후 ${years}년 동안`, '사용하기에 많이 부족한 상태입니다.'],
    detailLines: [`예상 준비자금이 필요자금보다 ${formatWon(readiness.shortfall)} 부족합니다.`, '우선순위를 정해 저축과 노후소득 계획을 조정할 필요가 있습니다.'],
  };
}

// 상세내역 카드의 한 줄. 입력 누락(missing)이면 "입력 필요"를, 아니면 0이라도 그대로 보여준다.
function DetailRow({ label, value, missing, bold, subtotal, highlight, valueColor }) {
  return (
    <div className={`detail-row${bold ? ' detail-row--total' : ''}${subtotal ? ' detail-row--subtotal' : ''}${highlight ? ' detail-row--highlight' : ''}`}>
      <span className="detail-row-label">{label}</span>
      <span className="detail-row-value" style={valueColor ? { color: valueColor } : undefined}>
        {missing ? <span className="overview-card-missing">입력 필요</span> : value}
      </span>
    </div>
  );
}

// "종합 결과"의 현재 재무상태 세부 내역 드롭다운에서 보여주는 수입·지출·자산 내역(od는 server가
// 이미 계산한 값을 표시만 한다).
function FinancialOverviewCard({ od, aggregates }) {
  const incomeMinusExpenseMissing = !Number.isFinite(od.expense.incomeMinusExpense);
  const realEstate = Number.isFinite(od.balance.realEstate) ? od.balance.realEstate : aggregates.realEstateTotal;
  const totalDebt = Number.isFinite(od.balance.totalDebt) ? od.balance.totalDebt : aggregates.totalDebt;

  return (
    <div className="detail-card">
      <div className="detail-card-header">
        <span className="detail-card-icon" aria-hidden="true">📊</span>
        <span className="detail-card-title">나의 자산 현황</span>
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
          label="합계" bold subtotal
          value={<>{formatWon(od.income.monthlyTotal)} · 연 {formatWon(od.income.annualTotal)}</>}
        />
      </div>

      <div className="detail-group">
        <div className="detail-group-head">지출 <span className="detail-group-tag">월평균</span></div>
        <DetailRow label="생활비·주거비·보험" value={formatWon(od.expense.livingHousingInsurance)} missing={od.expense.livingHousingInsuranceMissing} />
        <DetailRow label="저축·투자" value={formatWon(od.expense.savings)} missing={od.expense.savingsMissing} />
        <DetailRow label="고정지출 합계" bold subtotal value={formatWon(od.expense.fixedTotal)} />
      </div>

      <div className="detail-group">
        <DetailRow
          label="소득 - 지출금액"
          bold subtotal
          value={formatWon(od.expense.incomeMinusExpense)}
          missing={incomeMinusExpenseMissing}
          valueColor={od.expense.incomeMinusExpense < 0 ? 'var(--red)' : undefined}
        />
      </div>

      <div className="detail-group">
        <div className="detail-group-head">자산·부채</div>
        <DetailRow label="현금성자산" value={formatWon(od.balance.liquid)} missing={od.balance.liquidMissing} />
        <DetailRow label="금융·연금자산" value={formatWon(od.balance.financialAndPension)} missing={od.balance.financialAndPensionMissing} />
        <DetailRow
          label="부동산자산"
          value={formatWon(realEstate)}
          missing={od.balance.realEstateMissing}
        />
        <DetailRow
          label="총부채"
          value={formatWon(totalDebt)}
          missing={od.balance.totalDebtMissing}
          valueColor={totalDebt > 0 ? 'var(--red)' : undefined}
        />
        <DetailRow
          label="순자산" bold highlight
          value={formatWon(od.balance.netWorth)}
          valueColor={od.balance.netWorth < 0 ? 'var(--red)' : undefined}
        />
      </div>
    </div>
  );
}

// "종합 결과"의 현재 재무상태 카드에 쓰는 3개 대표 FHS 지표. 점수·등급·권장기준은 전부
// api/_lib/indicators.js·indicatorMeta.js에서 이미 계산·enrich된 값을 그대로 쓰고, 여기서는
// 화면 표시용 라벨만 다시 붙인다(재무 기준 자체를 새로 만들지 않음).
const FHS_REP_KEYS = ['household', 'emergency', 'dsr'];
const FHS_REP_LABELS = { household: '매달 소득 중 지출 비율', emergency: '비상자금으로 버틸 수 있는 기간', dsr: '매달 소득 중 빚 갚는 비율' };

// 비상예비금지표는 서버에서 "배"(유동성자산 ÷ 월지출) 단위로 계산되지만, 월지출 대비 몇 개월을
// 버틸 수 있는지와 정확히 같은 숫자이므로 사용자에게는 "개월"로 바꿔 표시한다 - 값은 그대로,
// 표시 문구만 바꾸는 것이라 계산에는 영향이 없다.
function formatIndicatorValue(indicator) {
  return indicator.key === 'emergency' ? `${formatNumber(indicator.value)}개월` : formatPercent(indicator.value);
}

// "종합 결과"의 왼쪽 카드 - 가계수지/비상예비금/DSR 3개 대표지표와 FHS 총점을 보여준다.
// 값·상태·등급은 모두 서버 계산 결과(indicators, summary)를 그대로 표시만 한다.
function FinancialHealthSummaryCard({ indicators }) {
  const reps = FHS_REP_KEYS.map((key) => (indicators || []).find((ind) => ind.key === key)).filter(Boolean);
  const status = getFinancialHealthStatus(reps);

  return (
    <div className="summary-status-card">
      <div className="fhs-hero">
        <div className="summary-card-kicker">Part 1. 재무</div>
        <div className="fhs-hero-row">
          <div className="ss-status-icon" aria-hidden="true">{status.icon}</div>
          <div className="fhs-hero-text ss-status-copy">
            <div className="ss-status-title"><span>{status.title}</span></div>
            <div className="ss-status-detail"><span>{status.detail}</span></div>
          </div>
        </div>
      </div>
      {reps.length > 0 && (
        <div className="ss-status-facts">
          {reps.map((ind) => (
            <div key={ind.key}>
              <span>{FHS_REP_LABELS[ind.key]}</span>
              <strong>
                {ind.notCalculable ? (
                  <span className="overview-card-missing">산출 불가</span>
                ) : (
                  <>
                    {formatIndicatorValue(ind)}
                    <span className={`fhs-status-pill fhs-status-pill--${ind.ratioClass || 'unknown'}`}>{formatIndicatorStatusBadge(ind)}</span>
                  </>
                )}
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// "종합 결과"의 오른쪽 카드 - 기존 은퇴 준비 히어로(icon/title/detail + 핵심 사실 3가지)를
// 그대로 컴포넌트로 분리한 것뿐, 계산 로직은 하나도 바꾸지 않았다.
function RetirementSummaryCard({ rr, retirementStatus, currentLivingCost, livingCostAtRetirement }) {
  return (
    <div className="summary-status-card">
      <div className="fhs-hero">
        <div className="summary-card-kicker">Part 2. 은퇴</div>
        <div className="fhs-hero-row">
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
      </div>
      {!rr.notCalculable && (
        <div className="ss-status-facts">
          <div>
            <span>향후 노후 생활 기간</span>
            <strong>{round1(rr.retirementYears)}년</strong>
          </div>
          <div>
            <span>은퇴 시점 예상 월 생활비</span>
            <strong>{formatWon(livingCostAtRetirement)}</strong>
          </div>
          <div>
            <span>현재 월 생활비</span>
            <strong>{formatWon(currentLivingCost)}</strong>
          </div>
        </div>
      )}
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
      <div className="peer-bar-track" role="img" aria-label={`${label} ${formatValue(value)}, 또래 가구 평균 ${formatValue(average)}`}>
        <div className="peer-bar-fill" style={{ width: `${userPct}%` }} />
        <div className="peer-bar-avg-marker" style={{ left: `${avgPct}%` }}>
          <span className="peer-bar-avg-label">평균 {formatValue(average)}</span>
        </div>
      </div>
      <div className="peer-row-numbers">
        <span>{label} <b>{formatValue(value)}</b></span>
        <span>또래 가구 평균 {formatValue(average)}</span>
        {diffPercent != null && <span className={diffClass}>{diffPercent > 0 ? '+' : ''}{diffPercent}%</span>}
      </div>
    </div>
  );
}

function RetirementCashFlowChart({ outlook }) {
  if (!outlook?.length || outlook.some((item) => !Number.isFinite(item.totalIncome))) {
    return <p className="ss-guidance">전체소득 전망이 없는 이전 결과입니다. 재무진단을 다시 실행하면 은퇴 후 현금흐름 그래프를 확인할 수 있습니다.</p>;
  }

  const width = 640;
  const height = 290;
  const plot = { left: 18, right: 18, top: 24, bottom: 48 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const minAge = outlook[0].age;
  const maxAge = outlook.at(-1).age;
  const maxValue = Math.max(...outlook.flatMap((item) => [item.livingExpense || 0, item.totalIncome || 0]), 1);
  const x = (age) => plot.left + ((age - minAge) / Math.max(1, maxAge - minAge)) * plotWidth;
  const y = (value) => plot.top + plotHeight - (Math.max(0, value) / maxValue) * plotHeight;
  const expensePoints = outlook.map((item) => `${x(item.age)},${y(item.livingExpense || 0)}`).join(' ');
  const incomePoints = outlook.map((item) => `${x(item.age)},${y(item.totalIncome || 0)}`).join(' ');
  const gapPoints = [
    ...outlook.map((item) => `${x(item.age)},${y(item.livingExpense || 0)}`),
    ...[...outlook].reverse().map((item) => `${x(item.age)},${y(item.totalIncome || 0)}`),
  ].join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="retirement-cashflow-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="은퇴 시점부터 예상 월 생활비와 예상 월 총소득의 차이">
        {ticks.map((ratio) => {
          const tickY = plot.top + plotHeight - ratio * plotHeight;
          return (
            <line key={ratio} className="retirement-chart-grid" x1={plot.left} x2={width - plot.right} y1={tickY} y2={tickY} />
          );
        })}
        <polygon className="retirement-chart-gap" points={gapPoints} />
        <polyline className="retirement-chart-line retirement-chart-line--expense" points={expensePoints} />
        <polyline className="retirement-chart-line retirement-chart-line--income" points={incomePoints} />
        {outlook.map((item, index) => {
          const incomeY = y(item.totalIncome || 0);
          const expenseY = item.livingExpense != null ? y(item.livingExpense) : null;
          // 소득선과 생활비선이 가까운 해(거의 균형)에서는 두 값 라벨이 겹치므로, 항상 화면상
          // 더 위에 있는 값의 라벨은 위로, 더 아래에 있는 값의 라벨은 아래로 밀어 최소 간격을 둔다.
          const incomeOnTop = expenseY == null || incomeY <= expenseY;
          const incomeLabelY = incomeOnTop ? Math.max(11, incomeY - 10) : incomeY + 17;
          const expenseLabelY = expenseY == null ? null : incomeOnTop ? expenseY + 17 : Math.max(11, expenseY - 10);
          return (
            <g key={item.age}>
              <circle className="retirement-chart-dot retirement-chart-dot--expense" cx={x(item.age)} cy={y(item.livingExpense || 0)} r="4" />
              <circle className="retirement-chart-dot retirement-chart-dot--income" cx={x(item.age)} cy={y(item.totalIncome || 0)} r="4" />
              <text className="retirement-chart-value retirement-chart-value--income" x={x(item.age)} y={incomeLabelY}>
                {formatWon(item.totalIncome)}
              </text>
              {expenseLabelY != null && (
                <text className="retirement-chart-value retirement-chart-value--expense" x={x(item.age)} y={expenseLabelY}>
                  {formatWon(item.livingExpense)}
                </text>
              )}
              <text className="retirement-chart-age" x={x(item.age)} y={height - 18}>{index === 0 ? `은퇴 ${item.age}세` : `${item.age}세`}</text>
            </g>
          );
        })}
      </svg>
      <div className="retirement-chart-legend">
        <span><i className="is-expense" />예상 월 생활비</span>
        <span><i className="is-income" />예상 월 총소득</span>
        <span><i className="is-gap" />생활비와 소득의 간극</span>
      </div>
    </div>
  );
}

function FiveYearOutlookTable({ outlook }) {
  if (!outlook?.length) return null;
  return (
    <div className="future-outlook-table-wrap">
      <table className="future-outlook-table">
        <thead>
          <tr>
            <th scope="col">나이</th>
            <th scope="col">예상 월 생활비</th>
            <th scope="col">예상 월 총소득<br /><small>월급·연금 등</small></th>
            <th scope="col">충당률</th>
            <th scope="col">월 차이</th>
          </tr>
        </thead>
        <tbody>
          {outlook.map((item) => (
            <tr key={item.age}>
              <th scope="row">{item.age}세</th>
              <td data-label="예상 월 생활비"><span className="future-cell-value">{item.livingExpense == null ? '산출 불가' : formatWon(item.livingExpense)}</span></td>
              <td data-label="예상 월 총소득">
                <span className="future-cell-value">
                  {item.totalIncome == null ? '산출 불가' : formatWon(item.totalIncome)}
                  {item.incomeLabel && <small className="future-income-label">{item.incomeLabel}</small>}
                </span>
              </td>
              <td data-label="충당률"><span className="future-cell-value">{item.coverageRate == null ? '산출 불가' : `${Math.round(item.coverageRate)}%`}</span></td>
              <td data-label="월 차이" className={item.balance == null ? '' : item.balance < 0 ? 'is-shortfall' : 'is-surplus'}>
                <span className="future-cell-value">{item.balance == null ? '산출 불가' : item.balance < 0 ? `${formatWon(Math.abs(item.balance))} 부족` : `${formatWon(item.balance)} 여유`}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 은퇴 후 자산잔액 시뮬레이션(webSummary.futureFinance.retirementAssetProjection)을 그리는
// 메인 그래프. x축의 나이 N은 항상 points[].age===N인 해의 연말 잔액(endingBalance)을
// 가리킨다 - depletionAge(카드·문구에 쓰는 텍스트)와 그래프가 0원에 닿는 나이가 반드시
// 일치해야 하기 때문이다(예: "84세 자산 소진" 텍스트라면 그래프도 84세 지점에서 0원).
function RetirementAssetProjectionChart({ projection }) {
  const { points, retirementAge, lifeExpectancy, depletionAge } = projection;
  if (!points?.length) return null;

  // x축의 나이 N은 항상 points[].age===N인 해의 "연말 잔액"(endingBalance)을 가리킨다 - 텍스트로
  // 보여주는 depletionAge와 그래프가 0원에 닿는 나이가 절대 어긋나면 안 되기 때문이다. 은퇴
  // 시작자산(연초 값)만 예외로 은퇴 나이 자리에 별도 시작점으로 덧붙인다(그 나이의 연말 값과
  // 다를 수 있어 시작→첫 해 말 사이에 짧은 구간이 보일 수 있다 - 실제로 그 해에 일어난 변화다).
  const chartPoints = [
    { age: retirementAge, value: points[0].startingBalance },
    ...points.map((p) => ({ age: p.age, value: p.endingBalance })),
  ];

  const width = 640;
  const height = 300;
  // 좌우 여백을 동일하게 두어 그래프(선·영역)가 y축(세로 중심) 기준으로 좌우 대칭이 되게 한다.
  const plot = { left: 32, right: 32, top: 30, bottom: 46 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const minAge = retirementAge;
  const maxAge = lifeExpectancy;
  const dataMax = Math.max(...chartPoints.map((p) => p.value), 1);
  const dataMin = Math.min(...chartPoints.map((p) => p.value), 0);
  const dataRange = dataMax - dataMin;
  // 자산이 실제로 소진되면(선이 0에 닿아야 함) 0을 그대로 하한으로 유지해 "바닥에 닿는" 그래프를
  // 지킨다. 소진되지 않을 때만 하한을 데이터 최솟값 쪽으로 끌어올린다 - 값이 좁은 범위(예: 15억대
  // 안에서만 오르내림)에서만 움직여도 세로 공간을 넓게 써서 변화가 잘 보이도록 확대하는 표시
  // 방식일 뿐, 실제 잔액·소진 판정 값 자체는 전혀 바꾸지 않는다.
  const padding = dataRange > 0 ? dataRange * 0.15 : dataMax * 0.05;
  const minValue = depletionAge != null ? 0 : Math.max(0, dataMin - padding);
  const maxValue = dataMax + padding;
  const x = (age) => plot.left + ((age - minAge) / Math.max(1, maxAge - minAge)) * plotWidth;
  const y = (value) => plot.top + plotHeight - ((Math.max(minValue, value) - minValue) / (maxValue - minValue)) * plotHeight;
  // 맨 왼쪽(은퇴 시작)·맨 오른쪽(기대수명) 라벨은 가운데 정렬(text-anchor:middle)로 두면 글자
  // 절반이 그래프 바깥(화면 밖)으로 삐져나간다 - 양 끝에서만 안쪽으로 붙는 정렬을 쓴다.
  const edgeAnchor = (age) => (age <= minAge ? 'start' : age >= maxAge ? 'end' : 'middle');
  const edgeDx = (age) => (age <= minAge ? 6 : age >= maxAge ? -6 : 0);

  const linePoints = chartPoints.map((p) => `${x(p.age)},${y(p.value)}`).join(' ');
  const areaPoints = [
    `${x(minAge)},${y(0)}`,
    ...chartPoints.map((p) => `${x(p.age)},${y(p.value)}`),
    `${x(maxAge)},${y(0)}`,
  ].join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  // 표시할 핵심 시점만 고른다 - 은퇴 시작·기대수명은 항상, 70/75/80/85는 구간 안에 있을 때만
  // (자산소진 시점과 겹치면 제외 - 경고 마커가 대신 그 나이를 표시한다).
  const candidateAges = [70, 75, 80, 85]
    .filter((age) => age > retirementAge && age < lifeExpectancy && age !== depletionAge);
  const lifeValue = points.find((p) => p.age === lifeExpectancy)?.endingBalance ?? null;
  const milestones = [
    { age: retirementAge, label: `은퇴 ${retirementAge}세`, value: points[0].startingBalance, kind: 'start' },
    ...candidateAges.map((age) => ({
      age, label: `${age}세`, value: points.find((p) => p.age === age)?.endingBalance ?? null, kind: 'mid',
    })),
    { age: lifeExpectancy, label: `기대수명 ${lifeExpectancy}세`, value: lifeValue, kind: 'life' },
  ].filter((m) => m.value != null);

  const depletionValue = depletionAge != null ? (points.find((p) => p.age === depletionAge)?.endingBalance ?? 0) : null;

  // 발생 시점이 명확한 목돈지출(expense.retirementLumpSumExpenses)만 그래프 위에 이벤트로
  // 표시한다 - 그래프는 금액 위주로만 간결하게 보여주고, 항목명은 hover에만 의존하지 않도록
  // 그래프 아래 "예상 목돈지출" 요약 목록에서 항상 확인할 수 있게 한다(모바일 포함).
  // 목돈지출 시점이 이정표(70/75/80/85세 등)나 다른 목돈지출 시점과 가까우면 라벨이 겹치므로,
  // 겹치는 항목은 한 단씩 더 위로 쌓아(lane) 항상 최소 간격을 두게 한다.
  const LABEL_MIN_GAP = 60;
  const milestoneXs = milestones.map((m) => x(m.age));
  const lumpSumLaneLastX = [];
  const lumpSumMarkers = points
    .filter((p) => p.lumpSumEvents?.length > 0)
    .map((p) => ({ age: p.age, amount: p.lumpSumExpense, y: y(p.endingBalance) }))
    .sort((a, b) => a.age - b.age)
    .map((m) => {
      const mx = x(m.age);
      const laneConflicts = (candidateLane) => {
        if (candidateLane === 0 && milestoneXs.some((mmx) => Math.abs(mmx - mx) < LABEL_MIN_GAP)) return true;
        return (lumpSumLaneLastX[candidateLane] ?? -Infinity) > mx - LABEL_MIN_GAP;
      };
      let lane = 0;
      while (laneConflicts(lane)) lane++;
      lumpSumLaneLastX[lane] = mx;
      return { age: m.age, amount: m.amount, y: m.y, lane };
    });

  const altText = (depletionAge != null
    ? `은퇴 자산잔액 그래프: 은퇴 ${retirementAge}세 시작자산 ${formatWon(points[0].startingBalance)}, ${depletionAge}세에 자산 소진 예상, 기대수명 ${lifeExpectancy}세`
    : `은퇴 자산잔액 그래프: 은퇴 ${retirementAge}세 시작자산 ${formatWon(points[0].startingBalance)}, 기대수명 ${lifeExpectancy}세까지 유지`)
    + (lumpSumMarkers.length > 0 ? `, 목돈지출 ${lumpSumMarkers.length}건 표시(아래 예상 목돈지출 목록 참고)` : '');

  return (
    <div className="asset-projection-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={altText}>
        {ticks.map((ratio) => {
          const tickY = plot.top + plotHeight - ratio * plotHeight;
          return (
            <line key={ratio} className="retirement-chart-grid" x1={plot.left} x2={width - plot.right} y1={tickY} y2={tickY} />
          );
        })}
        <polygon className="asset-projection-area" points={areaPoints} />
        <polyline className="asset-projection-line" points={linePoints} />
        {depletionAge != null && (
          <line
            className="asset-projection-depletion-line"
            x1={x(depletionAge)} x2={x(depletionAge)}
            y1={plot.top} y2={plot.top + plotHeight}
          />
        )}
        {milestones.map((m) => (
          <g key={m.kind === 'mid' ? m.age : m.kind}>
            <circle
              className={`asset-projection-dot${m.kind === 'life' && m.value === 0 ? ' is-muted' : ''}`}
              cx={x(m.age)} cy={y(m.value)} r={m.kind === 'start' ? 5 : 4}
            />
            <text
              className="asset-projection-value"
              style={{ textAnchor: edgeAnchor(m.age) }}
              x={x(m.age) + edgeDx(m.age)} y={Math.max(11, y(m.value) - 10)}
            >
              {formatWon(m.value)}
            </text>
            <text
              className="retirement-chart-age"
              style={{ textAnchor: edgeAnchor(m.age) }}
              x={x(m.age) + edgeDx(m.age)} y={height - 20}
            >
              {m.label}
            </text>
          </g>
        ))}
        {depletionAge != null && (
          <g>
            <circle className="asset-projection-dot is-warning" cx={x(depletionAge)} cy={y(depletionValue)} r="5" />
            <text
              className="asset-projection-warning-label"
              style={{ textAnchor: edgeAnchor(depletionAge) }}
              x={x(depletionAge) + edgeDx(depletionAge)} y={y(depletionValue) - 12}
            >
              ⚠ 예상 자산 소진
            </text>
            <text
              className="retirement-chart-age is-warning"
              style={{ textAnchor: edgeAnchor(depletionAge) }}
              x={x(depletionAge) + edgeDx(depletionAge)} y={height - 6}
            >
              {depletionAge}세
            </text>
          </g>
        )}
        {lumpSumMarkers.map((m) => {
          const markerY = Math.max(plot.top + 12, m.y - 24 - m.lane * 26);
          return (
            <g key={`lumpsum-${m.age}`}>
              <line className="asset-projection-lumpsum-line" x1={x(m.age)} x2={x(m.age)} y1={markerY + 8} y2={m.y} />
              <text
                className="asset-projection-lumpsum-marker"
                style={{ textAnchor: edgeAnchor(m.age) }}
                x={x(m.age) + edgeDx(m.age)} y={markerY}
              >
                ▼
              </text>
              <text
                className="asset-projection-lumpsum-amount"
                style={{ textAnchor: edgeAnchor(m.age) }}
                x={x(m.age) + edgeDx(m.age)} y={markerY - 9}
              >
                {formatWon(m.amount)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="retirement-chart-legend">
        <span><i className="is-asset" />남은 준비자산</span>
        {depletionAge != null && <span><i className="is-warning" />최초 자산 소진 예상 시점</span>}
        {lumpSumMarkers.length > 0 && <span><i className="is-lumpsum" />목돈지출 시점</span>}
      </div>
    </div>
  );
}

export default function SimpleSummaryReport({ result, onBack, onHome, onDownload, onShare }) {
  const { generatedAt, peerComparison, webSummary, aggregates, indicators } = result;
  const { overviewDetail: od, donuts, retirementReadiness } = webSummary;
  const rr = retirementReadiness;
  const future = webSummary.futureFinance;
  const storedPeerAge = peerComparison.userAge ?? result.simulation?.currentAge;
  const peerUserAge = Number.isFinite(storedPeerAge) && storedPeerAge > 0 ? storedPeerAge : null;
  const peerBracketLabel = peerComparison.userBracketLabel
    || peerComparison.ageBrackets?.find((bracket) => bracket.isUserBracket)?.label
    || '확인 불가';
  const retirementStatus = getRetirementStatus(rr);
  const allIndicators = indicators || [];

  const pensionMonthlyTotal = rr.monthlyIncomeCompare.nationalPensionMonthly + rr.monthlyIncomeCompare.severancePensionMonthly + rr.monthlyIncomeCompare.personalPensionMonthly;
  // 이전에 저장된 결과에도 계산 근거가 보이도록 기존 필드에서 안전하게 역산한다.
  const retirementMonths = rr.retirementYears * 12;
  const livingCostNow = rr.retirementLivingCostNow ?? rr.monthlyIncomeCompare.livingCostMonthly;
  const livingCostAtRetirement = rr.retirementLivingCostAtRetirement
    ?? (retirementMonths > 0 ? rr.requiredAtRetirement / retirementMonths : livingCostNow);
  const hasPreparationBreakdown = Number.isFinite(rr.currentReadyAssets) && Number.isFinite(rr.assumedReturnRate);
  const baseLivingCost = Math.round(livingCostNow * retirementMonths);
  const inflationIncrease = Math.max(0, rr.requiredAtRetirement - baseLivingCost);
  const [showCoverageMethod, setShowCoverageMethod] = useState(false);
  const [showPurchasingMethod, setShowPurchasingMethod] = useState(false);
  const [retirementDetailKey, setRetirementDetailKey] = useState(null);
  const [showFiveYearTable, setShowFiveYearTable] = useState(false);
  const assetProjection = future?.retirementAssetProjection;

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

      {/* 페이지가 여러 섹션으로 길게 이어지므로, 스크롤 중에도 원하는
          섹션으로 바로 이동할 수 있는 상단 고정 내비게이션을 추가한다. */}
      <nav className="ss-section-nav" aria-label="섹션 바로가기">
        <a href="#ss-h-hero">종합 결과</a>
        <a href="#ss-h-composition">나의 재무 구성</a>
        <a href="#ss-h-peer">또래 비교</a>
        <a href="#ss-h-retirement">은퇴 준비 현황</a>
        <a href="#ss-h-future">미래 재무 전망</a>
      </nav>

      <div className="simple-summary-date">최근 설계일 {formatDesignDate(generatedAt)}</div>

      {/* 0. 종합 결과 - 현재 재무상태(FHS 대표 3개 지표)와 은퇴 준비상태를 한 화면에서 바로
          비교할 수 있도록 카드 두 개로 구성한다. 두 카드 모두 서버가 이미 계산해 내려준 값
          (indicators/summary, webSummary.retirementReadiness)을 표시만 할 뿐, 새 계산을 하지 않는다. */}
      <section aria-labelledby="ss-h-hero">
        <h2 id="ss-h-hero" className="simple-summary-title">종합 결과</h2>

        {/* 데스크톱에서는 카드 2개가 나란히, 그 아래 각 세부 내역이 나란히 배치되지만
            (grid-template-areas로 위치를 명시), 모바일 1열에서는 area 순서 그대로
            카드1 → 세부내역1 → 카드2 → 세부내역2 순으로 쌓여 각 세부 내역이 자기 카드
            바로 아래에 온다. */}
        <div className="summary-cards-grid">
          <div className="summary-grid-area--card1">
            <FinancialHealthSummaryCard indicators={allIndicators} />
          </div>

          <details className="retirement-calculation summary-grid-area--details1">
            <summary>현재 재무상태 세부 내역</summary>
            <FinancialOverviewCard od={od} aggregates={aggregates} />
          </details>

          <div className="summary-grid-area--card2">
            <RetirementSummaryCard
              rr={rr}
              retirementStatus={retirementStatus}
              currentLivingCost={aggregates.monthlyLivingCost}
              livingCostAtRetirement={livingCostAtRetirement}
            />
          </div>

          <details className="retirement-calculation summary-grid-area--details2">
            <summary>은퇴 준비상태 세부 내역</summary>
            <div className="retirement-calculation-body">
              {rr.notCalculable ? (
                <p className="ss-guidance">{rr.reason}</p>
              ) : (
                <>
                  <p>
                    <span>① 은퇴 시점 월 생활비</span>
                    <strong>
                      현재 {formatWon(livingCostNow)} → 물가 {rr.inflationRate != null ? `${formatPercent(rr.inflationRate)} ` : ''}반영 후 {formatWon(livingCostAtRetirement)}
                    </strong>
                  </p>
                  <p>
                    <span>② 은퇴생활 필요자금</span>
                    <strong>
                      월 {formatWon(livingCostAtRetirement)} × {formatNumber(retirementMonths)}개월 = {formatWon(rr.requiredAtRetirement)}
                    </strong>
                  </p>
                  <p className="retirement-calculation-result">
                    <span>③ 최종 부족자금</span>
                    <strong>
                      필요자금 {formatWon(rr.requiredAtRetirement)} − 준비자산 {formatWon(rr.readyAssetsAtRetirement)} = {formatWon(rr.shortfall)}
                    </strong>
                  </p>
                </>
              )}
              <button
                type="button"
                className="ss-info-toggle"
                onClick={() => document.getElementById('ss-h-retirement')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                더 자세히 보기
              </button>
            </div>
          </details>
        </div>
      </section>

      {/* 1. 나의 재무 구성 */}
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

      {/* 2. 또래와 비교한 나의 위치 */}
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

      {/* 3. 나의 은퇴 준비 현황 */}
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
              <button
                type="button"
                className="overview-card overview-card--highlight overview-card--clickable"
                onClick={() => setRetirementDetailKey('required')}
              >
                <div className="overview-card-label">은퇴 시점 필요자금</div>
                <div className="overview-card-value">{formatWon(rr.requiredAtRetirement)}</div>
                <span className="overview-card-hint">내역 보기</span>
              </button>
              <button
                type="button"
                className="overview-card overview-card--highlight overview-card--clickable"
                onClick={() => setRetirementDetailKey('ready')}
              >
                <div className="overview-card-label">은퇴 시점 예상 준비자산</div>
                <div className="overview-card-value">{formatWon(rr.readyAssetsAtRetirement)}</div>
                <span className="overview-card-hint">내역 보기</span>
              </button>
              <button
                type="button"
                className="overview-card overview-card--risk overview-card--clickable"
                onClick={() => setRetirementDetailKey('shortfall')}
              >
                <div className="overview-card-label">예상 부족자금</div>
                <div className="overview-card-value">{formatWon(rr.shortfall)}</div>
                <span className="overview-card-hint">내역 보기</span>
              </button>
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

            {retirementDetailKey && (
              <div className="modal-overlay" onClick={() => setRetirementDetailKey(null)}>
                <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h4>
                      {retirementDetailKey === 'required' && '은퇴 시점 필요자금 내역'}
                      {retirementDetailKey === 'ready' && '은퇴 시점 예상 준비자산 내역'}
                      {retirementDetailKey === 'shortfall' && '예상 부족자금 내역'}
                    </h4>
                    <button type="button" className="modal-close" onClick={() => setRetirementDetailKey(null)} aria-label="닫기">
                      ✕
                    </button>
                  </div>
                  {retirementDetailKey === 'required' && (
                    <div className="need-breakdown-list">
                      <DetailRow
                        label={`현재 기준 생활비 (월 ${formatWon(livingCostNow)} × ${formatNumber(retirementMonths)}개월)`}
                        value={formatWon(baseLivingCost)}
                      />
                      <DetailRow
                        label={`은퇴까지 ${formatNumber(rr.yearsToRetirement)}년간 물가상승분${rr.inflationRate != null ? ` (연 ${formatPercent(rr.inflationRate)})` : ''}`}
                        value={`+${formatWon(inflationIncrease)}`}
                      />
                      <DetailRow label="은퇴 시점 필요자금" value={formatWon(rr.requiredAtRetirement)} bold />
                    </div>
                  )}
                  {retirementDetailKey === 'ready' && (
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
                  {retirementDetailKey === 'shortfall' && (
                    <div className="need-breakdown-list">
                      <DetailRow label="은퇴 시점 필요자금" value={formatWon(rr.requiredAtRetirement)} />
                      <DetailRow label="은퇴 시점 예상 준비자산" value={`−${formatWon(rr.readyAssetsAtRetirement)}`} />
                      <DetailRow label="예상 부족자금" value={formatWon(rr.shortfall)} bold />
                    </div>
                  )}
                  <p className="need-compare-assumptions">
                    계산 가정: 은퇴까지 {formatNumber(rr.yearsToRetirement)}년 · 은퇴 후 {formatNumber(rr.retirementYears)}년({formatNumber(retirementMonths)}개월)
                    {rr.inflationRate != null ? ` · 물가상승률 연 ${formatPercent(rr.inflationRate)}` : ''}
                    {rr.assumedReturnRate != null ? ` · 예상 운용수익률 연 ${formatPercent(rr.assumedReturnRate)}` : ''}
                  </p>
                </div>
              </div>
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
                    <div className="ss-row-label">은퇴 시점 월 필요생활비</div>
                    <div className="ss-row-value-sm">{formatWon(rr.retirementLivingCostAtRetirement)}</div>
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
          </>
        )}

        {/* 은퇴 후 생활비·목돈지출을 준비자산에서 인출하면서 잔액이 몇 살까지 유지되는지의 전망.
            webSummary.futureFinance.retirementAssetProjection이 없는 과거 저장 결과에서는 안내
            문구만 보여주고, 화면이 깨지거나 재계산을 시도하지 않는다. */}
        <h3 className="ss-section-title">예상 자산 유지 기간</h3>
        {!assetProjection ? (
          <p className="ss-guidance">이전 진단 결과에서는 자산잔액 전망을 제공하지 않습니다. 다시 진단하면 확인할 수 있습니다.</p>
        ) : assetProjection.notCalculable ? (
          <p className="ss-guidance">{assetProjection.reason}</p>
        ) : (
          <>
            <div className="overview-card-grid">
              <div className="overview-card">
                <div className="overview-card-label">은퇴 시작자산</div>
                <div className="overview-card-value">{formatWon(assetProjection.startingAssets)}</div>
              </div>
              <div className="overview-card overview-card--highlight">
                <div className="overview-card-label">{assetProjection.assetsRemainAtLifeExpectancy ? '예상 자산 유지' : '최초 자산 소진 예상'}</div>
                <div className="overview-card-value">
                  {assetProjection.assetsRemainAtLifeExpectancy ? '기대수명까지' : `${assetProjection.depletionAge}세`}
                </div>
                {!assetProjection.assetsRemainAtLifeExpectancy && assetProjection.recoveredAfterDepletion && (
                  <p className="overview-card-formula">이후 소득 증가로 다시 회복될 것으로 예상됩니다.</p>
                )}
              </div>
              <div className="overview-card">
                <div className="overview-card-label">기대수명</div>
                <div className="overview-card-value">{assetProjection.lifeExpectancy}세</div>
              </div>
            </div>

            <RetirementAssetProjectionChart projection={assetProjection} />

            <p className="future-diagnosis">{formatAssetProjectionOutlook(assetProjection)}</p>
            <p className="future-chart-help">
              은퇴 후 예상 소득으로 부족한 생활비는 준비자산에서 충당한다고 가정한 결과입니다. 남은 자산에는 입력한 예상 수익률이 적용됩니다.
            </p>

            <div className="asset-lumpsum-summary">
              <div className="asset-lumpsum-summary-title">예상 목돈지출</div>
              {assetProjection.lumpSumExpenseIncluded ? (
                assetProjection.points
                  .filter((p) => p.lumpSumEvents?.length > 0)
                  .flatMap((p) => p.lumpSumEvents.map((ev, i) => ({ ...ev, age: p.age, key: `${p.age}-${i}` })))
                  .map((ev) => (
                    <div className="asset-lumpsum-summary-row" key={ev.key}>
                      <span className="asset-lumpsum-age">{ev.age}세</span>
                      <span className="asset-lumpsum-name">{ev.name}</span>
                      <span className="asset-lumpsum-amount">{formatWon(ev.amount)}</span>
                    </div>
                  ))
              ) : (
                <p className="asset-lumpsum-empty">입력한 목돈지출이 없습니다.</p>
              )}
            </div>

            <details className="retirement-calculation" style={{ marginTop: 14 }}>
              <summary>계산 기준 보기</summary>
              <div className="retirement-calculation-body">
                <p className="need-breakdown-note" style={{ margin: '0 0 8px' }}>
                  연 단위 전망으로, 연초 자산에 예상수익률을 적용한 뒤 해당 연도의 소득과 생활비를 반영합니다. 실제 월별 자금 흐름과는 차이가 있을 수 있습니다.
                </p>
                <p><span>은퇴 시작자산</span><strong>{formatWon(assetProjection.startingAssets)}</strong></p>
                <p><span>적용 수익률</span><strong>연 {formatPercent(assetProjection.assumedReturnRate)}</strong></p>
                <p><span>생활비 물가상승률</span><strong>연 {formatPercent(assetProjection.inflationRate)}</strong></p>
                <p><span>포함된 소득 종류</span><strong>국민연금·퇴직연금·개인연금·근로소득·사업소득·기타소득</strong></p>
                <p><span>목돈지출</span><strong>{assetProjection.lumpSumExpenseIncluded ? '입력한 예상 나이와 금액을 해당 연도에 차감' : '입력 없음'}</strong></p>
                <small>{assetProjection.lumpSumExpenseNote}</small>
              </div>
            </details>
          </>
        )}
      </section>

      {/* 4. 미래 재무 전망 */}
      <section aria-labelledby="ss-h-future">
        <h2 id="ss-h-future" className="simple-summary-title">미래 재무 전망</h2>
        <p className="simple-summary-subtitle">물가와 연금의 변화를 반영해 60·70·80세의 예상 현금흐름을 살펴봅니다.</p>

        {!future || future.missing.age ? (
          <p className="ss-guidance">나이를 입력하면 미래 재무 전망을 확인할 수 있습니다.</p>
        ) : future.targets.length === 0 ? (
          <p className="ss-guidance">80세 이후에는 현재 시점 기준 전망 대상 연령이 없습니다.</p>
        ) : (
          <>
            <div className="ss-section-title-row">
              <h3 className="ss-section-title">연금소득 기준 생활비 충당률</h3>
              <button
                type="button"
                className="ss-info-toggle"
                aria-expanded={showCoverageMethod}
                onClick={() => setShowCoverageMethod((prev) => !prev)}
              >
                계산 원리 {showCoverageMethod ? '숨기기' : '보기'}
              </button>
            </div>
            {showCoverageMethod && (
              <div className="future-method-note future-method-note--coverage">
                <b>계산 원리</b>
                <div className="future-method-formula">생활비 충당률 = 해당 연령의 예상 연금소득 ÷ 예상 생활비 × 100</div>
                <ul className="future-method-list">
                  <li><strong>예상 생활비</strong><span>현재 월 생활비에 매년 3%의 물가상승률을 복리로 적용합니다.</span></li>
                  <li><strong>국민연금</strong><span>수급개시연령 이후부터 연 2.1% 증가를 적용합니다.</span></li>
                  <li><strong>개인·퇴직연금</strong><span>현재 월 수령액이 유지된다고 가정합니다.</span></li>
                  <li><strong>부족·여유액</strong><span>연금소득에서 생활비를 뺀 값으로 매월 예상 금액을 계산합니다.</span></li>
                  <li><strong>해석 범위</strong><span>연금소득만으로 생활비를 얼마나 충당하는지를 나타내며, 종합 은퇴 준비도를 의미하지 않습니다.</span></li>
                </ul>
              </div>
            )}
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

            {future.fiveYearOutlook?.length > 0 && (
              <>
                <div className="ss-section-title-row">
                  <h3 className="ss-section-title">5년 단위 생활비·소득 전망</h3>
                  <button
                    type="button"
                    className="ss-info-toggle"
                    aria-expanded={showFiveYearTable}
                    onClick={() => setShowFiveYearTable((prev) => !prev)}
                  >
                    연령별 상세 표 {showFiveYearTable ? '숨기기' : '보기'}
                  </button>
                </div>
                <p className="simple-summary-subtitle">현재 입력한 소득의 유지 기간과 연금 수령 시점을 반영해, 은퇴 후 예상 생활비와 총소득의 차이를 5년 단위로 보여드립니다. 생활비는 연 3%씩 상승한다고 가정합니다.</p>
                <RetirementCashFlowChart outlook={future.retirementCashFlowOutlook} />
                <p className="future-chart-help">주황색은 예상 월 생활비, 초록색은 예상 월 총소득입니다. 두 선 사이가 넓을수록 매월 예상되는 부족액 또는 여유금액이 큽니다.</p>
                {showFiveYearTable && (
                  <>
                    <FiveYearOutlookTable outlook={future.fiveYearOutlook} />
                    <p className="future-outlook-disclaimer">본 결과는 현재 입력값과 일정한 소득 유지 가정을 바탕으로 한 예상치이며, 실제 소득·물가·연금 변동에 따라 달라질 수 있습니다.</p>
                  </>
                )}
              </>
            )}
          </>
        )}

        <div className="future-purchasing-card">
          <div className="ss-section-title-row">
            <h3>현재 자산과 같은 소비를 유지하려면</h3>
            <button
              type="button"
              className="ss-info-toggle"
              aria-expanded={showPurchasingMethod}
              onClick={() => setShowPurchasingMethod((prev) => !prev)}
            >
              계산 원리 {showPurchasingMethod ? '숨기기' : '보기'}
            </button>
          </div>
          {showPurchasingMethod && (
            <div className="future-method-note future-method-note--in-card future-method-note--purchasing">
              <b>구매력 유지 계산</b>
              <div className="future-method-formula">필요한 미래 금액 = 현재 순자산 × (1 + 물가상승률 3%)<sup>경과연수</sup></div>
              <strong className="future-purchasing-warning">자산이 아래 금액으로 불어난다는 예상이 아닙니다.</strong>
              <span>물가가 오를수록 현재와 같은 구매력을 유지하기 위해 미래에 필요한 목표금액이 커진다는 의미입니다.</span>
            </div>
          )}
          {future?.purchasingPower ? (
            <div className="future-purchasing-flow">
              {future.purchasingPower.map((item, index) => (
                <div className="future-purchasing-step" key={item.years}>
                  {index > 0 && <span className="future-flow-arrow" aria-hidden="true">→</span>}
                  <span className="future-purchasing-label">{item.years === 0 ? '현재 순자산' : `${item.years}년 후 필요금액`}</span>
                  <strong>{formatWon(item.requiredAmount)}</strong>
                  {item.years > 0 && <small>동일 구매력 유지 목표</small>}
                </div>
              ))}
            </div>
          ) : <p className="overview-card-missing">순자산 데이터가 부족합니다.</p>}
        </div>

        <p className="future-disclaimer">본 결과는 현재 입력값과 가정에 따른 예상치이며 실제 물가, 연금 및 자산가치 변화에 따라 달라질 수 있습니다.</p>
      </section>

      {/* 5. 상세 리포트 다운로드 */}
      <section className="ss-download-section" aria-labelledby="ss-h-download">
        <h2 id="ss-h-download" className="simple-summary-title">더 자세한 분석이 필요하신가요?</h2>
        <p className="simple-summary-subtitle">상세 리포트에서 재무 현황과 분석 내용을 확인해 보세요.</p>
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
