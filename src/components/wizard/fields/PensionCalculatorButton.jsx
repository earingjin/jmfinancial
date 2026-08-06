import { useState } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatNumber } from '../../../utils/format';

// 연 3~4% 수준의 장기 수익률을 단순 반영한 시뮬레이션 계수(사용자 제공 값).
const INVESTMENT_MULTIPLIER = 1.3;

/**
 * 퇴직연금(월지급)의 예상 총액을 추정하는 모의계산기(수익률 반영 모의계산).
 * 예상 퇴직연금(총액) = (연봉÷12) × 남은근무기간 × 1.3 = 월급(상여금 제외) × 남은근무기간(년) × 1.3
 * 연봉÷12는 월급 그 자체이므로 monthlySalaryPath(급여만, 상여금 제외) 값을 바로 곱한다.
 * "남은근무기간"은 "남은 퇴직기간"과 같은 개념이므로 별도로 입력받지 않고, remainingMonthsPath(예:
 * income.salary.months / spouse.salary.months, 급여 섹션의 "남은 퇴직기간"이 저장되는 곳)를 월→년으로
 * 환산해 그대로 연동한다.
 * "확인"을 누르면 예상 퇴직연금(총액)을 보여주고, 이미 입력된 수령 개월 수(pensionMonthsPath, "퇴직연금
 * 수령 기간"에서 자동 계산된 값)로 나눈 월 수령 금액을 pensionMonthlyPath에 반영한다. 수령 개월 수가 아직
 * 입력되지 않았다면 총액만 보여주고 반영하지 않는다(나눗셈 기준이 없어 산출 불가).
 */
export default function PensionCalculatorButton({
  monthlySalaryPath,
  remainingMonthsPath,
  pensionMonthsPath,
  pensionMonthlyPath,
}) {
  const { formData, setField } = useFormData();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showMissingWarning, setShowMissingWarning] = useState(false);

  const monthlySalary = getIn(formData, monthlySalaryPath);
  const remainingMonths = getIn(formData, remainingMonthsPath);
  const pensionMonths = getIn(formData, pensionMonthsPath);

  const isFilled = (v) => v !== '' && v != null && Number.isFinite(Number(v));
  const remainingYears = isFilled(remainingMonths) ? Number(remainingMonths) / 12 : null;
  const hasPensionMonths = isFilled(pensionMonths) && Number(pensionMonths) > 0;

  const missingLabels = [
    !isFilled(monthlySalary) && '급여(월)',
    !isFilled(remainingMonths) && '남은 퇴직기간',
  ].filter(Boolean);
  const canCalculate = missingLabels.length === 0;

  const estimatedPension = canCalculate
    ? Math.round(Number(monthlySalary) * remainingYears * INVESTMENT_MULTIPLIER)
    : null;

  const estimatedMonthly =
    confirmed && canCalculate && hasPensionMonths ? Math.round(estimatedPension / Number(pensionMonths)) : null;

  const handleConfirm = () => {
    if (!canCalculate) {
      setShowMissingWarning(true);
      return;
    }
    if (hasPensionMonths) {
      setField(pensionMonthlyPath, Math.round(estimatedPension / Number(pensionMonths)));
    }
    setConfirmed(true);
    setShowMissingWarning(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="repeatable-add" onClick={() => setOpen((v) => !v)}>
        {open ? '퇴직연금 모의계산기 닫기' : '퇴직연금을 모르시나요? 모의계산기 열기'}
      </button>

      {open && (
        <div className="repeatable-item" style={{ marginTop: 10 }}>
          {!confirmed ? (
            <>
              <p className="field-helper" style={{ marginBottom: 10 }}>
                급여(월)와 남은근무기간(=남은 퇴직기간)을 위에 입력한 값 그대로 연동해, 확인을 누르면 수익률을
                반영한 예상 퇴직연금 총액을 추정하고, 위에서 입력한 수령 기간으로 나눈 월 수령 금액을 자동으로
                반영합니다.
              </p>
              <p className="field-helper" style={{ marginBottom: 4 }}>
                급여(월): {isFilled(monthlySalary) ? `${formatNumber(monthlySalary)}만원 (급여 입력값과 연동됨)` : '위에서 급여(월)를 입력해 주세요'}
              </p>
              <p className="field-helper" style={{ marginBottom: 4 }}>
                남은근무기간: {remainingYears != null ? `${formatNumber(Math.round(remainingYears * 10) / 10)}년 (남은 퇴직기간과 연동됨)` : '남은 퇴직기간이 입력되면 자동으로 연동됩니다'}
              </p>
              <p className="field-helper" style={{ marginBottom: 10 }}>
                수령 기간: {hasPensionMonths ? `${formatNumber(pensionMonths)}개월 (수령 기간과 연동됨)` : '위에서 수령 기간을 입력하면 월 수령 금액도 함께 반영됩니다'}
              </p>
              <button type="button" className="btn-primary" onClick={handleConfirm}>
                확인
              </button>
              {showMissingWarning && !canCalculate && (
                <span className="field-helper" style={{ marginTop: 8, display: 'block', color: 'var(--red)' }}>
                  아직 입력하지 않은 항목이 있습니다: {missingLabels.join(', ')}
                </span>
              )}
            </>
          ) : (
            <>
              <div className="field">
                <span className="field-label">예상 퇴직연금(총액)</span>
                <div className="field-navy-box">
                  <span className="field-navy-label">예상 퇴직연금은</span>
                  <div className="field-navy-value">
                    <span>{formatNumber(estimatedPension)}</span>
                    <span className="unit">만원</span>
                  </div>
                </div>
                <span className="field-helper">
                  1.3은 연 3~4% 수준의 장기 수익률을 단순 반영한 시뮬레이션 계수입니다.
                </span>
              </div>
              <div className="field" style={{ marginTop: 10 }}>
                <span className="field-label">월 수령 금액</span>
                <div className="field-navy-box">
                  <span className="field-navy-label">월 수령 금액은</span>
                  <div className="field-navy-value">
                    <span>{estimatedMonthly != null ? formatNumber(estimatedMonthly) : '-'}</span>
                    <span className="unit">만원</span>
                  </div>
                </div>
                <span className="field-helper">
                  {estimatedMonthly != null
                    ? '예상 퇴직연금(총액)을 수령 기간(개월)으로 나눈 값이며, 위 "퇴직연금 월 수령 금액"에 자동으로 반영되었습니다.'
                    : '수령 기간을 입력하지 않아 월 수령 금액을 반영하지 못했습니다. "수정"을 눌러 수령 기간을 입력한 뒤 다시 확인해 주세요.'}
                </span>
              </div>
              <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={() => setConfirmed(false)}>
                수정
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
