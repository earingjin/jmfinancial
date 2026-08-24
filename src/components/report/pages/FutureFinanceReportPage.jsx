import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';
import { formatWon } from '../../../utils/format';

export default function FutureFinanceReportPage({ futureFinance, pageNumber, totalPages }) {
  const targets = futureFinance?.targets || [];
  const purchasingPower = futureFinance?.purchasingPower || [];
  const currentPurchasingPower = purchasingPower.find((item) => item.years === 0);
  const tenYearPurchasingPower = purchasingPower.find((item) => item.years === 10);
  const twentyYearPurchasingPower = purchasingPower.find((item) => item.years === 20);
  const inflationRate = futureFinance?.assumptions?.inflationRate;

  return (
    <PageFrame eyebrow="Future Finance" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="6" label="미래재무 전망" />
      <p className="intro-text report-compact-intro">
        현재 생활비와 연금 입력값을 기준으로 60·70·80세의 예상 현금흐름을 비교합니다. 이 충당률은 전체 자산이 아닌
        연금소득만으로 예상 생활비를 얼마나 충당하는지를 나타냅니다.
      </p>

      {targets.length > 0 ? (
        <>
          <div className="report-future-card-grid">
            {targets.map((item) => (
              <article className="report-future-card" key={item.age}>
                <strong>{item.age}세</strong>
                <span>연금소득 기준 생활비 충당률</span>
                <b>{item.coverageRate == null ? '산출 불가' : `${Math.round(item.coverageRate)}%`}</b>
                <dl>
                  <div><dt>예상 월 생활비</dt><dd>{item.livingExpense == null ? '-' : formatWon(item.livingExpense)}</dd></div>
                  <div><dt>예상 월 연금소득</dt><dd>{item.pensionIncome == null ? '-' : formatWon(item.pensionIncome)}</dd></div>
                  <div><dt>월 차이</dt><dd className={item.balance < 0 ? 'is-shortfall' : ''}>{item.balance == null ? '-' : item.balance < 0 ? `${formatWon(Math.abs(item.balance))} 부족` : `${formatWon(item.balance)} 여유`}</dd></div>
                </dl>
                {item.calculationReason && <small>{item.calculationReason}</small>}
              </article>
            ))}
          </div>

          {futureFinance.diagnosis && <div className="report-diagnosis-box">{futureFinance.diagnosis}</div>}

          <h3 className="card-title report-subsection-title">지금과 같은 생활 수준을 유지하려면 필요한 자산</h3>
          <p className="fine-print report-inline-note">
            미래 순자산 예상액이 아니라, 현재 순자산과 같은 구매력을 유지하기 위해 필요한 기준 금액입니다.
          </p>
          <div className="report-purchasing-grid">
            {purchasingPower.map((item) => (
              <div key={item.years}>
                <span>{item.years === 0 ? '현재 순자산' : `${item.years}년 후`}</span>
                <strong>{formatWon(item.requiredAmount)}</strong>
              </div>
            ))}
          </div>
          {currentPurchasingPower && tenYearPurchasingPower && twentyYearPurchasingPower && (
            <div className="report-purchasing-feedback">
              물가가 매년 {Number.isFinite(inflationRate) ? `${Math.round(inflationRate * 1000) / 10}%` : '현재 가정만큼'} 오른다고 보면,
              현재 {formatWon(currentPurchasingPower.requiredAmount)}과 같은 구매력을 유지하려면 10년 후에는 {formatWon(tenYearPurchasingPower.requiredAmount)},
              20년 후에는 {formatWon(twentyYearPurchasingPower.requiredAmount)}이 필요합니다. 이 금액은 자산이 자동으로 늘어난다는 뜻이 아니라,
              지금과 같은 가치 수준을 지키기 위한 목표 금액입니다.
            </div>
          )}

          <div className="report-assumption-box">
            <strong>계산 가정</strong>
            <span>생활비는 연 3%의 물가상승률을 복리로 적용합니다.</span>
            <span>국민연금은 수급개시 후 연 2.1% 증가하며, 개인연금과 퇴직연금은 현재 월 수령액이 유지된다고 가정합니다.</span>
            <span>실제 물가·연금·자산가치 변화에 따라 결과는 달라질 수 있습니다.</span>
          </div>
          <section className="report-key-note report-key-note--future" aria-label="사용자 메모 영역">
            <div className="report-key-note-heading">
              <strong>KEY NOTE</strong>
              <span>미래 생활비와 연금소득 전망을 확인하며 준비할 내용을 기록해 보세요.</span>
            </div>
            <div className="report-key-note-space" aria-hidden="true" />
          </section>
        </>
      ) : (
        <div className="report-empty-box">이전 저장 결과이거나 필수 입력값이 없어 미래 재무 전망을 표시할 수 없습니다.</div>
      )}
    </PageFrame>
  );
}
