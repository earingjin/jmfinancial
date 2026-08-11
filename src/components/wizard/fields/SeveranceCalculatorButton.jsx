import { useState } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import NumberField from './NumberField';

// 퇴직 전 3개월간의 총 일수(간이 모의계산기 통례값 - 실제 퇴직일 기준 정확한 일수가 아니라
// '모의계산기'이므로 근사치를 사용한다. 사용자 승인됨).
const THREE_MONTH_DAYS = 90;

/**
 * 퇴직금을 모르는 사용자를 위한 모의계산기. 3개월 급여 총액·연간 상여금 총액·연차수당(calcBasePath 하위)과
 * 근속년수(serviceYearsPath)를 입력하고 "확인"을 누르면 아래 공식으로 퇴직금을 추정해 lumpsumPath에 반영한다.
 * "수정"을 누르면 다시 입력 상태로 돌아간다(입력값은 유지).
 *
 *   1일 평균임금 = (3개월 급여 총액 + 연간 상여금 총액×3/12 + 연차수당×3/12) ÷ 90
 *   추정 퇴직금 = 1일 평균임금 × 30일 × 근속년수   (= 근로기준법상 "1일 평균임금×30×총재직일수/365"와 동일,
 *                                                근속년수×365÷365가 근속년수로 약분됨)
 *
 * lifeExpectancyPath·retirementAgePath를 함께 넘기면(본인만 해당 - 배우자는 해당 데이터가 없음),
 * 예상 노후 생활 개월수(기대수명-은퇴연령)로 퇴직금 총액을 나눈 월 환산 수령액도 함께 보여준다.
 *
 * serviceYearsFromBasicInfo가 true면(본인) 근속년수를 "기본 정보"에서 입력한 값을 그대로 연동해
 * 읽기 전용으로 보여준다(패널 안에 별도 입력칸을 두지 않음 - 두 곳에 같은 값을 따로 입력하는 혼란 방지).
 * false면(배우자, 기본 정보에 해당 데이터가 없음) 패널 안에서 직접 입력받는다.
 */
export default function SeveranceCalculatorButton({
  calcBasePath,
  serviceYearsPath,
  lumpsumPath,
  lifeExpectancyPath,
  retirementAgePath,
  serviceYearsFromBasicInfo = false,
}) {
  const { formData, setField } = useFormData();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showMissingWarning, setShowMissingWarning] = useState(false);

  const threeMonthSalary = getIn(formData, `${calcBasePath}.threeMonthSalary`);
  const annualBonus = getIn(formData, `${calcBasePath}.annualBonus`);
  const annualLeavePay = getIn(formData, `${calcBasePath}.annualLeavePay`);
  const serviceYears = getIn(formData, serviceYearsPath);

  const isFilled = (v) => v !== '' && v != null && Number.isFinite(Number(v));

  const missingLabels = [
    !isFilled(threeMonthSalary) && '3개월 급여 총액',
    !isFilled(annualBonus) && '연간 상여금 총액',
    !isFilled(annualLeavePay) && '연차수당',
    !isFilled(serviceYears) && (serviceYearsFromBasicInfo ? '근속년수(기본 정보)' : '근속년수'),
  ].filter(Boolean);
  const canCalculate = missingLabels.length === 0;

  const computeSeverance = () => {
    const dailyAvgWage =
      (Number(threeMonthSalary) + Number(annualBonus) * (3 / 12) + Number(annualLeavePay) * (3 / 12)) / THREE_MONTH_DAYS;
    return Math.round(dailyAvgWage * 30 * Number(serviceYears));
  };

  const confirmedSeverance = confirmed ? Number(getIn(formData, lumpsumPath)) || 0 : null;

  // 월 수령액 = 퇴직금 총액 ÷ 예상 노후 생활 개월수(기대수명-은퇴연령). rawValue를 그대로 나누며,
  // 화면 표시에서만 소수 첫째 자리로 반올림한다(rawValue 자체를 반올림하지 않는다).
  let monthlyAmount = null;
  if (confirmed && lifeExpectancyPath && retirementAgePath) {
    const lifeExpectancy = Number(getIn(formData, lifeExpectancyPath));
    const retirementAge = Number(getIn(formData, retirementAgePath));
    const hasAges =
      isFilled(getIn(formData, lifeExpectancyPath)) && isFilled(getIn(formData, retirementAgePath));
    const months = hasAges ? Math.max(0, lifeExpectancy - retirementAge) * 12 : 0;
    monthlyAmount = months > 0 ? Math.round((confirmedSeverance / months) * 10) / 10 : null;
  }

  const handleConfirm = () => {
    if (!canCalculate) {
      setShowMissingWarning(true);
      return;
    }
    const result = computeSeverance();
    setField(lumpsumPath, result);
    setConfirmed(true);
    setShowMissingWarning(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="repeatable-add" onClick={() => setOpen((v) => !v)}>
        {open ? '퇴직금 모의계산기 닫기' : '퇴직금을 모르시나요? 모의계산기 열기'}
      </button>

      {open && (
        <div className="repeatable-item" style={{ marginTop: 10 }}>
          {!confirmed ? (
            <>
              <p className="field-helper" style={{ marginBottom: 10 }}>
                {serviceYearsFromBasicInfo
                  ? '아래 3개 항목을 입력하고 확인을 누르면 퇴직금을 추정합니다. 근속년수는 위 기본 정보에 입력한 값이 자동으로 연동됩니다.'
                  : '아래 4개 항목을 모두 입력하고 확인을 누르면 퇴직금을 추정합니다.'}
              </p>
              <div className="field-grid three-col">
                <NumberField path={`${calcBasePath}.threeMonthSalary`} label="3개월 급여 총액" unit="만원" />
                <NumberField path={`${calcBasePath}.annualBonus`} label="연간 상여금 총액" unit="만원" />
                <NumberField path={`${calcBasePath}.annualLeavePay`} label="연차수당" unit="만원" />
                {!serviceYearsFromBasicInfo && (
                  <NumberField
                    path={serviceYearsPath}
                    label="근속년수"
                    unit="년"
                    helper="현재 직장의 입사일부터 퇴직(예정)일까지의 전체 재직기간을 입력해 주세요."
                  />
                )}
              </div>
              {serviceYearsFromBasicInfo && (
                <p className="field-helper" style={{ marginTop: 8 }}>
                  근속년수: {isFilled(serviceYears) ? `${serviceYears}년 (기본 정보와 연동됨)` : '기본 정보에서 근속년수를 입력해 주세요'}
                </p>
              )}
              <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={handleConfirm}>
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
                <span className="field-label">추정 퇴직금</span>
                <div className="field-navy-box">
                  <span className="field-navy-label">예상 퇴직금은</span>
                  <div className="field-navy-value">
                    <span>{confirmedSeverance}</span>
                    <span className="unit">만원</span>
                  </div>
                </div>
              </div>
              {lifeExpectancyPath && retirementAgePath && (
                <div className="field" style={{ marginTop: 10 }}>
                  <span className="field-label">기대수명까지 월 환산 수령액</span>
                  <div className="field-navy-box">
                    <span className="field-navy-label">월 수령액은</span>
                    <div className="field-navy-value">
                      <span>{monthlyAmount != null ? monthlyAmount : '-'}</span>
                      <span className="unit">만원</span>
                    </div>
                  </div>
                  <span className="field-helper">
                    {monthlyAmount != null
                      ? '퇴직금 총액을 예상 노후 생활 개월수(기대수명-은퇴연령)로 나눈 값입니다'
                      : '은퇴(예정) 연령과 기대수명을 입력하면 월 환산 수령액도 함께 계산됩니다'}
                  </span>
                </div>
              )}
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
