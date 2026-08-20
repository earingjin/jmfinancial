import { formatWon } from '../../../utils/format';

// "OOO은 XXX만원" 형태의 강조 박스(급여 총액, 퇴직금·연금 총액, 노후 생활비 지출 총액 등에서 공통으로 사용).
export default function TotalAmountBox({ label, amount, valueLabel = '총 수입은', secondaryAmount, secondaryValueLabel }) {
  const hasSecondaryAmount = secondaryAmount !== undefined && secondaryAmount !== null;
  return (
    <div className="field" style={{ marginTop: 12 }}>
      <span className="field-label">{label}</span>
      <div className={`field-navy-box ${hasSecondaryAmount ? 'has-multiple-values' : ''}`}>
        <div className="field-navy-row">
          <span className="field-navy-label">{valueLabel}</span>
          <div className="field-navy-value">
            <span>{formatWon(Math.round(amount))}</span>
          </div>
        </div>
        {hasSecondaryAmount && (
          <div className="field-navy-row">
            <span className="field-navy-label">{secondaryValueLabel}</span>
            <div className="field-navy-value">
              <span>{formatWon(Math.round(secondaryAmount))}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
