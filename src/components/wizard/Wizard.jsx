import { useEffect, useRef, useState } from 'react';
import Step1Income from './steps/Step1Income';
import Step2Expense from './steps/Step2Expense';
import Step3Savings from './steps/Step3Savings';
import Step4Assets from './steps/Step4Assets';
import Step5Debt from './steps/Step5Debt';
import Step6NetWorth from './steps/Step6NetWorth';
import Step7Scenarios from './steps/Step7Scenarios';
import { useFormData } from '../../state/formState';
import { getIn } from '../../state/pathUtils';
import DiagnosisAreaIcon from '../DiagnosisAreaIcon';

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

const formatSavedAt = (value) => value
  ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
  : null;

export default function Wizard({ onSubmit, startAtLastStep = false, initialStep = 0 }) {
  const [stepIndex, setStepIndexState] = useState(startAtLastStep ? STEPS.length - 1 : Math.min(initialStep, STEPS.length - 1));
  const [showRequiredError, setShowRequiredError] = useState(false);
  const [showProgressHint, setShowProgressHint] = useState(false);
  const progressRef = useRef(null);
  const { formData, draftState, saveCurrentDraft, setDraftStep } = useFormData();
  const { Component, key: currentStepKey } = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  useEffect(() => {
    const progress = progressRef.current;
    if (!progress) return undefined;
    const updateHint = () => setShowProgressHint(progress.scrollLeft + progress.clientWidth < progress.scrollWidth - 4);
    updateHint();
    progress.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);
    return () => {
      progress.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
    };
  }, []);
  const moveToStep = (next) => {
    const resolved = typeof next === 'function' ? next(stepIndex) : next;
    setDraftStep(resolved);
    setStepIndexState(resolved);
    void saveCurrentDraft(resolved).catch(() => {});
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
    moveToStep((i) => Math.min(STEPS.length - 1, i + 1));
  };

  const submit = async () => {
    if (basicInfoMissing) {
      setShowRequiredError(true);
      moveToStep(STEPS.findIndex((s) => s.key === 'income'));
      return;
    }
    if (retirementLivingCostMissing) {
      setShowRequiredError(true);
      moveToStep(STEPS.findIndex((s) => s.key === 'expense'));
      return;
    }
    setShowRequiredError(false);
    try {
      await saveCurrentDraft(stepIndex);
      await onSubmit(formData);
    } catch {
      // saveCurrentDraft keeps the input in memory and exposes the retry state.
    }
  };

  return (
    <div className="wizard">
      <div className={`wizard-draft-status ${draftState.status === 'saved' ? 'is-saved' : ''} ${draftState.status === 'error' ? 'is-error' : ''}`} role="status">
        <span>
          {draftState.status === 'saving' && '임시 저장 중…'}
          {draftState.status === 'error' && draftState.error}
          {draftState.status !== 'saving' && draftState.status !== 'error' && (draftState.updatedAt ? `마지막 저장: ${formatSavedAt(draftState.updatedAt)}` : '아직 저장되지 않았습니다')}
        </span>
        <button type="button" className="wizard-draft-save" disabled={draftState.status === 'saving' || !draftState.dirty} onClick={() => void saveCurrentDraft().catch(() => {})}>
          {draftState.status === 'error' ? '다시 저장' : '임시 저장'}
        </button>
      </div>
      <div className="wizard-progress-wrap">
        <div className="wizard-progress" ref={progressRef}>
          {STEPS.map((s, i) => (
            <button
              type="button"
              key={s.key}
              className={`wizard-progress-item ${i === stepIndex ? 'is-active' : ''} ${i < stepIndex ? 'is-done' : ''}`}
              onClick={() => moveToStep(i)}
              aria-current={i === stepIndex ? 'step' : undefined}
            >
              <span className="wizard-progress-dot" aria-hidden="true">{i + 1}</span>
              <DiagnosisAreaIcon className="wizard-progress-icon" type={s.key} />
              <span className="wizard-progress-label">{s.title}</span>
            </button>
          ))}
        </div>
        {showProgressHint && <span className="wizard-progress-more" aria-hidden="true">›</span>}
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
          onClick={() => moveToStep((i) => Math.max(0, i - 1))}
        >
          이전
        </button>
        {isLast ? (
          <button type="button" className="btn-primary" onClick={() => void submit()}>
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
