import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import { formatNumber, formatPercent, formatWon } from '../../../utils/format';

function CashFlowLineChart({ outlook, pensionStartAge }) {
  const width = 690;
  const height = 250;
  const plot = { left: 24, right: 18, top: 24, bottom: 38 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const minAge = outlook[0].age;
  const maxAge = outlook.at(-1).age;
  const highestValue = Math.max(...outlook.flatMap((item) => [item.livingExpense || 0, item.totalIncome || 0]), 1);
  const maxValue = highestValue * 1.4;
  const x = (age) => plot.left + ((age - minAge) / Math.max(1, maxAge - minAge)) * plotWidth;
  const y = (value) => plot.top + plotHeight - (Math.max(0, value) / maxValue) * plotHeight;
  const expensePoints = outlook.map((item) => `${x(item.age)},${y(item.livingExpense || 0)}`).join(' ');
  const incomePoints = outlook.map((item) => `${x(item.age)},${y(item.totalIncome || 0)}`).join(' ');
  const gapPoints = [...outlook.map((item) => `${x(item.age)},${y(item.livingExpense || 0)}`), ...[...outlook].reverse().map((item) => `${x(item.age)},${y(item.totalIncome || 0)}`)].join(' ');
  const labelY = (pointY, offset) => Math.max(12, Math.min(height - plot.bottom - 6, pointY + offset));
  const incomeLabelOffset = (pointY, index) => (
    pointY > height - plot.bottom - 24
      ? (index % 2 === 0 ? -28 : -36)
      : (index % 2 === 0 ? 15 : 23)
  );
  const labelAnchor = (index) => (index === 0 ? 'start' : index === outlook.length - 1 ? 'end' : 'middle');
  const labelDx = (index) => (index === 0 ? 4 : index === outlook.length - 1 ? -4 : 0);
  const pensionStartIsVisible = Number.isFinite(pensionStartAge) && pensionStartAge >= minAge && pensionStartAge <= maxAge;
  const pensionLabelAnchor = pensionStartAge <= minAge ? 'start' : pensionStartAge >= maxAge ? 'end' : 'middle';
  const pensionLabelDx = pensionStartAge <= minAge ? 4 : pensionStartAge >= maxAge ? -4 : 0;

  return (
    <div className="report-cashflow-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="은퇴 후 예상 월 생활비와 예상 월 총소득 비교">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const tickY = plot.top + plotHeight - ratio * plotHeight;
          return <line key={ratio} x1={plot.left} x2={width - plot.right} y1={tickY} y2={tickY} />;
        })}
        <polygon points={gapPoints} />
        {pensionStartIsVisible && (
          <g className="pension-start-marker">
            <line className="pension-start-line" x1={x(pensionStartAge)} x2={x(pensionStartAge)} y1={plot.top} y2={plot.top + plotHeight} />
            <text
              className="pension-start-label"
              style={{ textAnchor: pensionLabelAnchor }}
              x={x(pensionStartAge) + pensionLabelDx}
              y={height - 27}
            >
              연금 수령 시작
            </text>
          </g>
        )}
        <polyline className="expense-line" points={expensePoints} />
        <polyline className="income-line" points={incomePoints} />
        {outlook.map((item, index) => (
          <g key={item.age}>
            <circle className="expense-dot" cx={x(item.age)} cy={y(item.livingExpense || 0)} r="3.5" />
            <circle className="income-dot" cx={x(item.age)} cy={y(item.totalIncome || 0)} r="3.5" />
            <text
              className="cashflow-point-value cashflow-point-value--expense"
              style={{ textAnchor: labelAnchor(index) }}
              x={x(item.age) + labelDx(index)}
              y={labelY(y(item.livingExpense || 0), index % 2 === 0 ? -10 : -18)}
            >
              {formatWon(item.livingExpense || 0)}
            </text>
            <text
              className="cashflow-point-value cashflow-point-value--income"
              style={{ textAnchor: labelAnchor(index) }}
              x={x(item.age) + labelDx(index)}
              y={labelY(y(item.totalIncome || 0), incomeLabelOffset(y(item.totalIncome || 0), index))}
            >
              {formatWon(item.totalIncome || 0)}
            </text>
            <text className="age-label" x={x(item.age)} y={height - 13}>{formatNumber(item.age)}세</text>
          </g>
        ))}
      </svg>
      <div className="report-chart-legend"><span className="expense">예상 월 생활비</span><span className="income">예상 월 총소득</span><span className="gap">두 금액의 간극</span></div>
    </div>
  );
}

export default function FiveYearOutlookReportPage({ futureFinance, pageNumber, totalPages }) {
  const outlook = futureFinance?.fiveYearOutlook || [];
  const chartOutlook = futureFinance?.retirementCashFlowOutlook || [];

  return (
    <PageFrame eyebrow="Five-year Outlook" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="7" label="5년 단위 생활비·소득 전망" />
      <p className="intro-text report-compact-intro">
        현재 입력한 소득의 유지 기간과 연금 수령 시점을 반영해, 은퇴 후 예상 생활비와 총소득의 차이를 5년 단위로
        보여드립니다. 생활비는 연 3%씩 상승한다고 가정합니다.
      </p>

      {outlook.length > 0 ? (
        <>
          {chartOutlook.length > 0 && <CashFlowLineChart outlook={chartOutlook} pensionStartAge={futureFinance?.nationalPensionStartAge} />}
          <p className="fine-print report-chart-help">주황색은 예상 월 생활비, 초록색은 예상 월 총소득입니다. 두 선 사이가 넓을수록 매월 예상되는 부족액 또는 여유금액이 큽니다.</p>
          <table className="grade-table compact report-outlook-table">
            <thead><tr><th>나이</th><th>예상 월 생활비</th><th>예상 월 총소득</th><th>충당률</th><th>월 차이</th></tr></thead>
            <tbody>
              {outlook.map((item) => (
                <tr key={item.age}>
                  <td className="num">{formatNumber(item.age)}세</td>
                  <td className="num">{item.livingExpense == null ? '산출 불가' : formatWon(item.livingExpense)}</td>
                  <td className="num">
                    {item.totalIncome == null ? '산출 불가' : formatWon(item.totalIncome)}
                    {item.incomeLabel && <small>{item.incomeLabel}</small>}
                  </td>
                  <td className="num">{item.coverageRate == null ? '산출 불가' : formatPercent(item.coverageRate)}</td>
                  <td className={`num ${item.balance < 0 ? 'is-shortfall' : ''}`}>{item.balance == null ? '산출 불가' : item.balance < 0 ? `${formatWon(Math.abs(item.balance))} 부족` : `${formatWon(item.balance)} 여유`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fine-print report-outlook-disclaimer">본 결과는 현재 입력값과 일정한 소득 유지 가정을 바탕으로 한 예상치이며, 실제 소득·물가·연금 변동에 따라 달라질 수 있습니다.</p>
        </>
      ) : (
        <div className="report-empty-box">이전 저장 결과이거나 필수 입력값이 없어 5년 단위 전망을 표시할 수 없습니다.</div>
      )}
    </PageFrame>
  );
}
