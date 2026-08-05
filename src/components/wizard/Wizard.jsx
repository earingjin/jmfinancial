import { useState } from 'react';
import Step1Income from './steps/Step1Income';
import Step2Expense from './steps/Step2Expense';
import Step3Savings from './steps/Step3Savings';
import Step4Assets from './steps/Step4Assets';
import Step5Debt from './steps/Step5Debt';
import Step6NetWorth from './steps/Step6NetWorth';
import Step7Scenarios from './steps/Step7Scenarios';
import { useFormData } from '../../state/formState';

const STEPS = [
  { key: 'income', title: '수입', Component: Step1Income },
  { key: 'expense', title: '지출', Component: Step2Expense },
  { key: 'savings', title: '저축', Component: Step3Savings },
  { key: 'assets', title: '자산', Component: Step4Assets },
  { key: 'debt', title: '부채', Component: Step5Debt },
  { key: 'netWorth', title: '순자산', Component: Step6NetWorth },
  { key: 'scenarios', title: '대응방안', Component: Step7Scenarios },
];

export default function Wizard({ onSubmit, startAtLastStep = false }) {
  const [stepIndex, setStepIndex] = useState(startAtLastStep ? STEPS.length - 1 : 0);
  const { formData } = useFormData();
  const { Component } = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

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
          <button type="button" className="btn-primary" onClick={() => onSubmit(formData)}>
            진단 결과 보기
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}>
            다음
          </button>
        )}
      </div>
    </div>
  );
}
