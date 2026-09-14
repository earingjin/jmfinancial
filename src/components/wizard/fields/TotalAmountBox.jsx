import { formatWon } from '../../../utils/format';

// "OOO은 XXX만원" 형태의 강조 박스(급여 총액, 퇴직금·연금 총액, 노후 생활비 지출 총액 등에서 공통으로 사용).
export default function TotalAmountBox({ label, amount, valueLabel = '총 수입은', secondaryAmount, secondaryValueLabel, breakdownItems = [] }) {
  const rows = [
    { label: valueLabel, amount },
    ...(secondaryAmount !== undefined && secondaryAmount !== null ? [{ label: secondaryValueLabel, amount: secondaryAmount }] : []),
    ...breakdownItems,
  ];
  const hasMultipleValues = rows.length > 1;
  return (
    <div className="field" style={{ marginTop: 12 }}>
      <span className="field-label">{label}</span>
      <div className={`field-navy-box ${hasMultipleValues ? 'has-multiple-values' : ''}`}>
        {rows.map((row, index) => (
          <div className="field-navy-row" key={`${row.label}-${index}`}>
            <span className="field-navy-label">{row.label}</span>
            <div className="field-navy-value">
              <span>{formatWon(Math.round(row.amount))}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
