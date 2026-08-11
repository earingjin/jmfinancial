import { useState } from 'react';
import Step1Income from './steps/Step1Income';
import Step2Expense from './steps/Step2Expense';
import Step3Savings from './steps/Step3Savings';
import Step4Assets from './steps/Step4Assets';
import Step5Debt from './steps/Step5Debt';
import Step6NetWorth from './steps/Step6NetWorth';
import Step7Scenarios from './steps/Step7Scenarios';
import { useFormData } from '../../state/formState';
import { getIn } from '../../state/pathUtils';

const isFilled = (value) => value !== '' && value !== null && value !== undefined;
const SHOW_SCENARIO_STEP = false;

const STEPS = [
  { key: 'income', title: '수입', Component: Step1Income },
  { key: 'expense', title: '지출', Component: Step2Expense },
  { key: 'savings', title: '저축', Component: Step3Savings },
  { key: 'assets', title: '자산', Component: Step4Assets },
  { key: 'debt', title: '부채', Component: Step5Debt },
  { key: 'netWorth', title: '순자산', Component: Step6NetWorth },
  ...(SHOW_SCENARIO_STEP ? [{ key: 'scenarios', title: '대응방안', Component: Step7Scenarios }] : []),
];

export default function Wizard({ onSubmit, startAtLastStep = false }) {
  const [stepIndex, setStepIndex] = useState(startAtLastStep ? STEPS.length - 1 : 0);
  const [showRequiredError, setShowRequiredError] = useState(false);
  const { formData } = useFormData();
  const { Component, key: currentStepKey } = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const requiredBasicPaths = ['basic.birthYear', 'basic.retirementAge', 'basic.lifeExpectancy', 'basic.serviceYears'];
  const basicInfoMissing = requiredBasicPaths.some((path) => !isFilled(getIn(formData, path)));
  const retirementLivingCostMissing = !isFilled(getIn(formData, 'expense.retirementLivingCost'));
  const requiredErrorMessage = basicInfoMissing
    ? '"1. 수입"의 기본 정보는 모두 필수 입력 항목입니다. 출생년도, 은퇴연령, 기대수명, 근속년수를 입력해 주세요.'
    : '"2. 지출"의 노후 월 평균 생활비는 필수 입력 항목입니다. 값을 입력한 뒤 진행해 주세요.';

  const goNext = () => {
    if (currentStepKey === 'income' && basicInfoMissing) {
      setShowRequiredError(true);
      return;
    }
    if (currentStepKey === 'expense' && retirementLivingCostMissing) {
      setShowRequiredError(true);
      return;
    }
    setShowRequiredError(false);
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };

  const submit = () => {
    if (basicInfoMissing) {
      setShowRequiredError(true);
      setStepIndex(STEPS.findIndex((s) => s.key === 'income'));
      return;
    }
    if (retirementLivingCostMissing) {
      setShowRequiredError(true);
      setStepIndex(STEPS.findIndex((s) => s.key === 'expense'));
      return;
    }
    setShowRequiredError(false);
    onSubmit(formData);
  };

  return (
    <div className="wizard">
      <div className="wizard-progress">
        {STEPS.map((s, i) => (
          <button
            type="button"
            key={s.key}
            className={`wizard-progress-item ${i === stepIndex ? 'is-active' : ''} ${i < stepIndex ? 'is-done' : ''}`}
            onClick={() => setStepIndex(i)}
          >
            <span className="wizard-progress-dot" aria-hidden="true">{i + 1}</span>
            <span className="wizard-progress-label">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="wizard-body">
        <Component />
      </div>

      {showRequiredError && (
        <p className="wizard-required-error">{requiredErrorMessage}</p>
      )}

      <div className="wizard-nav">
        <button
          type="button"
          className="btn-secondary"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          이전
        </button>
        {isLast ? (
          <button type="button" className="btn-primary" onClick={submit}>
            진단 결과 보기
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={goNext}>
            다음
          </button>
        )}
      </div>
    </div>
  );
}
