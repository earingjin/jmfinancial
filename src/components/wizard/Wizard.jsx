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
import { updateDraftStep } from '../../state/draftStorage';
import incomeIcon from '../../assets/1.수입.png';
import expenseIcon from '../../assets/2.지출.png';
import savingsIcon from '../../assets/3.저축.png';
import assetsIcon from '../../assets/4.자산.png';
import debtIcon from '../../assets/5.부채.png';
import netWorthIcon from '../../assets/6.순자산.png';

const isFilled = (value) => value !== '' && value !== null && value !== undefined;
const SHOW_SCENARIO_STEP = false;

const STEPS = [
  { key: 'income', title: '수입', icon: incomeIcon, Component: Step1Income },
  { key: 'expense', title: '지출', icon: expenseIcon, Component: Step2Expense },
  { key: 'savings', title: '저축', icon: savingsIcon, Component: Step3Savings },
  { key: 'assets', title: '자산', icon: assetsIcon, Component: Step4Assets },
  { key: 'debt', title: '부채', icon: debtIcon, Component: Step5Debt },
  { key: 'netWorth', title: '순자산', icon: netWorthIcon, Component: Step6NetWorth },
  ...(SHOW_SCENARIO_STEP ? [{ key: 'scenarios', title: '대응방안', Component: Step7Scenarios }] : []),
];

export default function Wizard({ onSubmit, startAtLastStep = false, initialStep = 0, userId, draftSavedAt }) {
  const [stepIndex, setStepIndexState] = useState(startAtLastStep ? STEPS.length - 1 : Math.min(initialStep, STEPS.length - 1));
  const [showRequiredError, setShowRequiredError] = useState(false);
  const { formData } = useFormData();
  const { Component, key: currentStepKey } = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const setStepIndex = (next) => {
    setStepIndexState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      updateDraftStep(userId, resolved);
      return resolved;
    });
  };

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
      <div className={`wizard-draft-status ${draftSavedAt ? 'is-saved' : ''}`} role="status">
        <span aria-hidden="true">{draftSavedAt ? '✓' : '○'}</span>
        {draftSavedAt ? '입력 내용이 자동으로 임시 저장되었습니다' : '입력 내용은 자동으로 임시 저장됩니다'}
      </div>
      <div className="wizard-progress">
        {STEPS.map((s, i) => (
          <button
            type="button"
            key={s.key}
            className={`wizard-progress-item ${i === stepIndex ? 'is-active' : ''} ${i < stepIndex ? 'is-done' : ''}`}
            onClick={() => setStepIndex(i)}
            aria-current={i === stepIndex ? 'step' : undefined}
          >
            <span className="wizard-progress-dot" aria-hidden="true">{i + 1}</span>
            <img className="wizard-progress-icon" src={s.icon} alt="" />
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
