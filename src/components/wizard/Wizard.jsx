import { useState } from 'react';
import Step1Income from './steps/Step1Income';
import Step2Expense from './steps/Step2Expense';
import Step3Savings from './steps/Step3Savings';
import Step4Assets from './steps/Step4Assets';
import Step5Debt from './steps/Step5Debt';
import Step6NetWorth from './steps/Step6NetWorth';
import Step7Scenarios from './steps/Step7Scenarios';
import { useFormData } from '../../state/formState';
import icon1 from '../../assets/wizard-icon-1.png';
import icon2 from '../../assets/wizard-icon-2.png';
import icon3 from '../../assets/wizard-icon-3.png';
import icon4 from '../../assets/wizard-icon-4.png';
import icon5 from '../../assets/wizard-icon-5.png';
import icon6 from '../../assets/wizard-icon-6.png';
import icon7 from '../../assets/wizard-icon-7.png';

const STEPS = [
  { key: 'income', title: '수입', Component: Step1Income, icon: icon1 },
  { key: 'expense', title: '지출', Component: Step2Expense, icon: icon2 },
  { key: 'savings', title: '저축', Component: Step3Savings, icon: icon3 },
  { key: 'assets', title: '자산', Component: Step4Assets, icon: icon4 },
  { key: 'debt', title: '부채', Component: Step5Debt, icon: icon5 },
  { key: 'netWorth', title: '순자산', Component: Step6NetWorth, icon: icon6 },
  { key: 'scenarios', title: '대응방안', Component: Step7Scenarios, icon: icon7 },
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
            <span className="wizard-progress-dot"><img src={s.icon} alt="" /></span>
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
