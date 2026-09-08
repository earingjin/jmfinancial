import { Activity, useEffect, useRef, useState } from 'react';
import Step1Income from './steps/Step1Income';
import Step2Expense from './steps/Step2Expense';
import Step3Savings from './steps/Step3Savings';
import Step4Assets from './steps/Step4Assets';
import Step5Debt from './steps/Step5Debt';
import Step6NetWorth from './steps/Step6NetWorth';
import Step7Scenarios from './steps/Step7Scenarios';
import { useFormData } from '../../state/formState';
import { computeWizardRequiredFields } from '../../state/wizardRequiredFields';
import { getWizardScreens, resolveWizardScreenIndex, getRequiredScreenIndex } from '../../state/wizardScreens';
import DiagnosisAreaIcon from '../DiagnosisAreaIcon';

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

const SUB_STEP_COUNTS = STEPS.map(({ key }) => getWizardScreens(key).length);

// oxlint-disable-next-line react/only-export-components
export function getNextWizardPosition(stepIndex, subStepIndex, subStepCounts = SUB_STEP_COUNTS) {
  if (subStepIndex < subStepCounts[stepIndex] - 1) {
    return { stepIndex, subStepIndex: subStepIndex + 1, stepChanged: false };
  }
  const nextStepIndex = Math.min(subStepCounts.length - 1, stepIndex + 1);
  return { stepIndex: nextStepIndex, subStepIndex: 0, stepChanged: nextStepIndex !== stepIndex };
}

// oxlint-disable-next-line react/only-export-components
export function getPreviousWizardPosition(stepIndex, subStepIndex, subStepCounts = SUB_STEP_COUNTS) {
  if (subStepIndex > 0) {
    return { stepIndex, subStepIndex: subStepIndex - 1, stepChanged: false };
  }
  const previousStepIndex = Math.max(0, stepIndex - 1);
  return {
    stepIndex: previousStepIndex,
    subStepIndex: previousStepIndex === stepIndex ? 0 : subStepCounts[previousStepIndex] - 1,
    stepChanged: previousStepIndex !== stepIndex,
  };
}

// oxlint-disable-next-line react/only-export-components
export function getRequiredFieldSubStep(stepKey, path, hasSpouse = false) {
  return getRequiredScreenIndex(stepKey, path, hasSpouse);
}

// 최종 제출 시 "임시 저장 실패가 계산·결과 저장 자체를 막으면 안 된다"는 규칙만 분리해 둔다
// (App.jsx의 handleSubmit → completePlannerSubmission은 이 formData를 그대로 쓰고 서버에 저장된
// 초안을 다시 읽지 않으므로, 임시 저장은 최종 제출의 필수 선행조건이 아니다). 클릭 시뮬레이션이
// 가능한 테스트 환경이 없어, Step1Income.jsx의 handleSeveranceType과 같은 이유로 컴포넌트 클로저
// 밖의 top-level 함수로 두어 saveCurrentDraft/onSubmit을 목(mock)으로 바꿔가며 단위 테스트한다.
export async function submitAfterDraftSave(saveCurrentDraft, stepIndex, onSubmit, formData) {
  await saveCurrentDraft(stepIndex).catch(() => {});
  await onSubmit(formData);
}

const formatSavedAt = (value) => value
  ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
  : null;

export default function Wizard({ onSubmit, startAtLastStep = false, initialStep = 0, onStepChange }) {
  const [stepIndex, setStepIndexState] = useState(startAtLastStep ? STEPS.length - 1 : Math.min(initialStep, STEPS.length - 1));
  const [screenId, setScreenId] = useState(null);
  const [visitedSteps, setVisitedSteps] = useState(() => new Set([stepIndex]));
  const [showRequiredError, setShowRequiredError] = useState(false);
  const [showProgressHint, setShowProgressHint] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const progressRef = useRef(null);
  const restingViewportHeightRef = useRef(0);
  const { formData, draftState, saveCurrentDraft, setDraftStep } = useFormData();
  const { key: currentStepKey } = STEPS[stepIndex];
  const hasSpouse = !!formData.basic.hasSpouse;
  const subSteps = getWizardScreens(currentStepKey, hasSpouse);
  const subStepCounts = STEPS.map(({ key }) => getWizardScreens(key, hasSpouse).length);
  const subStepIndex = resolveWizardScreenIndex(currentStepKey, screenId, hasSpouse);
  const resolvedScreenId = subSteps[subStepIndex].id;
  // 식별자로 현재 묶음을 유지하고, 제외된 배우자 화면은 렌더링 전에 보정한다.
  if (screenId !== resolvedScreenId) setScreenId(resolvedScreenId);
  const setSubStepIndex = (index) => setScreenId(subSteps[index].id);
  const isLastSubStep = subStepIndex === subSteps.length - 1;
  const isLast = stepIndex === STEPS.length - 1 && isLastSubStep;
  const isFirst = stepIndex === 0 && subStepIndex === 0;
  // startAtLastStep일 때는 stepIndex의 초기값이 useState 초기화에서만 정해지므로(moveToStep을
  // 거치지 않음), 마운트 시 한 번 실제 시작 단계를 부모(App)에 동기화해 홈↔위저드 왕복 후에도
  // 정확한 단계를 이어갈 수 있게 한다.
  useEffect(() => {
    onStepChange?.(stepIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 모바일 브라우저에서 가상 키보드가 열린 동안 상단 진행 영역을 축소해 입력칸에 쓸 세로 공간을 확보한다.
  // visualViewport를 지원하지 않는 브라우저에서는 포커스 자동 스크롤만 적용된다.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    restingViewportHeightRef.current = viewport.height;
    const updateKeyboardState = () => {
      const keyboardHeight = restingViewportHeightRef.current - viewport.height;
      const keyboardOpen = keyboardHeight > 150;
      if (!keyboardOpen && viewport.height > restingViewportHeightRef.current) {
        restingViewportHeightRef.current = viewport.height;
      }
      setIsKeyboardOpen(keyboardOpen);
    };
    updateKeyboardState();
    viewport.addEventListener('resize', updateKeyboardState);
    const resetViewportHeight = () => {
      restingViewportHeightRef.current = viewport.height;
      setIsKeyboardOpen(false);
    };
    window.addEventListener('orientationchange', resetViewportHeight);
    return () => {
      viewport.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('orientationchange', resetViewportHeight);
    };
  }, []);
  // 포커스된 입력칸을 보이는 화면 중앙으로 이동해 가상 키보드에 가려지는 일을 줄인다.
  useEffect(() => {
    const scrollFocusedFieldIntoView = (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      window.setTimeout(() => field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }), 150);
    };
    document.addEventListener('focusin', scrollFocusedFieldIntoView);
    return () => document.removeEventListener('focusin', scrollFocusedFieldIntoView);
  }, []);
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
  useEffect(() => {
    const updateScrolledState = () => setIsScrolled(window.scrollY > 100);
    updateScrolledState();
    window.addEventListener('scroll', updateScrolledState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrolledState);
  }, []);
  const prepareForScreenChange = () => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) activeElement.blur();
    window.scrollTo(0, 0);
    setIsScrolled(false);
  };

  const moveToSubStep = (nextSubStep) => {
    if (nextSubStep === subStepIndex) return;
    prepareForScreenChange();
    setSubStepIndex(nextSubStep);
  };

  const moveToStep = (next, nextSubStep = 0) => {
    const resolved = typeof next === 'function' ? next(stepIndex) : next;
    if (resolved !== stepIndex || nextSubStep !== subStepIndex) prepareForScreenChange();
    setDraftStep(resolved);
    setVisitedSteps((previous) => previous.has(resolved) ? previous : new Set([...previous, resolved]));
    setStepIndexState(resolved);
    setScreenId(getWizardScreens(STEPS[resolved].key, hasSpouse)[nextSubStep].id);
    onStepChange?.(resolved);
    void saveCurrentDraft(resolved).catch(() => {});
  };

  // path·label을 함께 들고 있어야 안내 문구에 항목명을 나열하고, 그 중 첫 번째 항목으로 화면을
  // 스크롤·포커스할 수 있다(NumberField가 path를 그대로 input id로 쓴다). 판정 조건 자체는
  // wizardRequiredFields.js 참고(api/_lib/validate.js와 동일 기준).
  const { missingIncomeFields, missingExpenseFields, basicInfoMissing, retirementLivingCostMissing, requiredErrorMessage } =
    computeWizardRequiredFields(formData);

  // 안내 문구가 가리키는 첫 번째 미입력 항목으로 화면을 이동한다. moveToStep이 다른 스텝으로
  // 넘어가는 경우 그 스텝의 DOM이 그려질 시간이 필요하므로(150ms는 위 79번째 줄의 포커스 스크롤과
  // 동일한 지연), 스텝 이동이 없을 때도 같은 지연을 그대로 써서 로직을 하나로 유지한다.
  const scrollToField = (path) => {
    if (!path) return;
    window.setTimeout(() => {
      const el = document.getElementById(path);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }, 150);
  };

  const goNext = () => {
    if (!isLastSubStep) {
      moveToSubStep(subStepIndex + 1);
      return;
    }
    if (currentStepKey === 'income' && basicInfoMissing) {
      setShowRequiredError(true);
      moveToSubStep(getRequiredFieldSubStep('income', missingIncomeFields[0][0], hasSpouse));
      scrollToField(missingIncomeFields[0][0]);
      return;
    }
    if (currentStepKey === 'expense' && retirementLivingCostMissing) {
      setShowRequiredError(true);
      moveToSubStep(getRequiredFieldSubStep('expense', missingExpenseFields[0][0]));
      scrollToField(missingExpenseFields[0][0]);
      return;
    }
    setShowRequiredError(false);
    const nextPosition = getNextWizardPosition(stepIndex, subStepIndex, subStepCounts);
    moveToStep(nextPosition.stepIndex, nextPosition.subStepIndex);
  };

  const goPrevious = () => {
    const previousPosition = getPreviousWizardPosition(stepIndex, subStepIndex, subStepCounts);
    if (previousPosition.stepChanged) {
      moveToStep(previousPosition.stepIndex, previousPosition.subStepIndex);
      return;
    }
    moveToSubStep(previousPosition.subStepIndex);
  };

  const submit = async () => {
    if (basicInfoMissing) {
      setShowRequiredError(true);
      moveToStep(STEPS.findIndex((s) => s.key === 'income'), getRequiredFieldSubStep('income', missingIncomeFields[0][0], hasSpouse));
      scrollToField(missingIncomeFields[0][0]);
      return;
    }
    if (retirementLivingCostMissing) {
      setShowRequiredError(true);
      moveToStep(STEPS.findIndex((s) => s.key === 'expense'), getRequiredFieldSubStep('expense', missingExpenseFields[0][0]));
      scrollToField(missingExpenseFields[0][0]);
      return;
    }
    setShowRequiredError(false);
    await submitAfterDraftSave(saveCurrentDraft, stepIndex, onSubmit, formData);
  };

  return (
    <div className={`wizard${isKeyboardOpen ? ' wizard--keyboard-open' : ''}${isScrolled ? ' wizard--scrolled' : ''}`}>
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
              onClick={() => moveToStep(i, 0)}
              aria-current={i === stepIndex ? 'step' : undefined}
            >
              <span className="wizard-progress-dot" aria-hidden="true">{i + 1}</span>
              <DiagnosisAreaIcon className="wizard-progress-icon" type={s.key} />
              <span className="wizard-progress-label">{s.title}</span>
            </button>
          ))}
        </div>
        {showProgressHint && <span className="wizard-progress-more" aria-hidden="true">›</span>}
        <button
          type="button"
          className="wizard-sticky-save"
          disabled={draftState.status === 'saving' || !draftState.dirty}
          onClick={() => void saveCurrentDraft().catch(() => {})}
        >
          {draftState.status === 'saving' ? '저장 중…' : draftState.status === 'error' ? '다시 저장' : '임시저장'}
        </button>
      </div>

      <div className="wizard-substep-progress" aria-label={`${STEPS[stepIndex].title} 소단계 진행`}>
        <div className="wizard-substep-progress-head">
          <strong>{subSteps[subStepIndex].label}</strong>
          <span>{subStepIndex + 1} / {subSteps.length}</span>
        </div>
        <div className="wizard-substep-progress-track" aria-hidden="true">
          <span style={{ width: `${((subStepIndex + 1) / subSteps.length) * 100}%` }} />
        </div>
      </div>

      <div className="wizard-body">
        {/* Activity는 화면의 내부 상태를 보존하고 비활성 영역의 effect는 중지한다. */}
        {STEPS.map(({ key, Component }, index) => visitedSteps.has(index) && (
          <Activity key={key} mode={index === stepIndex ? 'visible' : 'hidden'}>
            <Component
              subStepIndex={index === stepIndex ? subStepIndex : 0}
              screenId={index === stepIndex ? resolvedScreenId : getWizardScreens(key, hasSpouse)[0].id}
            />
          </Activity>
        ))}
      </div>

      {showRequiredError && (
        <p className="wizard-required-error">{requiredErrorMessage}</p>
      )}

      <div className="wizard-nav">
        <button
          type="button"
          className="btn-secondary"
          disabled={isFirst}
          onClick={goPrevious}
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
