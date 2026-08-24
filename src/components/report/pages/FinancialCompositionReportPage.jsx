import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import DonutChart from '../../summary/DonutChart';

const REPORT_CHART_COLORS = ['#ff8420', '#5f9d79', '#e8b052', '#375f79', '#d7674f', '#7d6b92', '#b98b5f', '#90a984'];
const withColors = (items = []) => items.map((item, index) => ({ ...item, color: item.color || REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length] }));

export default function FinancialCompositionReportPage({ donuts, pageNumber, totalPages }) {
  return (
    <PageFrame eyebrow="Financial Composition" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="2" label="재무 구성" />
      <p className="intro-text report-compact-intro">월 소득의 사용처와 지출·자산·부채·저축의 세부 구성을 금액과 비중으로 정리했습니다.</p>
      {donuts ? (
        <div className="report-composition-grid">
          <DonutChart
            title="월 소득 배분"
            centerLabel={donuts.income.isOverspending ? '월 지출·저축 합계' : '월 총소득'}
            total={donuts.income.total}
            items={withColors(donuts.income.items)}
            footnote={donuts.income.feedback}
            footnoteTone={donuts.income.isOverspending ? 'warning' : undefined}
          />
          <DonutChart title="지출 구성" centerLabel="월 총지출" total={donuts.expense.total} items={withColors(donuts.expense.items)} footnote={donuts.expense.feedback} />
          <DonutChart title="자산 구성" centerLabel="총자산" total={donuts.assets.total} items={withColors(donuts.assets.items)} footnote={donuts.assets.feedback} />
          <DonutChart title="부채 구성" centerLabel="총부채" total={donuts.debt.total} items={withColors(donuts.debt.items)} footnote={donuts.debt.feedback} emptyMessage={donuts.debt.isEmpty ? '현재 부채가 없습니다.' : '부채 상세 내역을 입력하면 구성을 확인할 수 있습니다.'} />
          <DonutChart title="저축·투자 구성" centerLabel="월 저축·투자액" total={donuts.savings.total} items={withColors(donuts.savings.items)} footnote={donuts.savings.feedback} emptyMessage={donuts.savings.isEmpty ? '현재 저축·투자액이 없습니다.' : '저축 상세 내역을 입력하면 구성을 확인할 수 있습니다.'} />
        </div>
      ) : <div className="report-empty-box">이전 저장 결과에는 재무 구성 데이터가 포함되어 있지 않습니다.</div>}
    </PageFrame>
  );
}
