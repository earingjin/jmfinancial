import { createContext, useContext } from 'react';

const WizardValidationContext = createContext([]);

export function WizardValidationProvider({ issues, children }) {
  return <WizardValidationContext.Provider value={issues}>{children}</WizardValidationContext.Provider>;
}

export function useWizardFieldIssue(path) {
  const issues = useContext(WizardValidationContext);
  return path ? issues.find((issue) => issue.path === path) || null : null;
}

export function validationMessageId(path) {
  return `wizard-validation-${String(path).replace(/[^A-Za-z0-9_-]/g, '-')}`;
}

export function WizardFieldValidationMessage({ path }) {
  const issue = useWizardFieldIssue(path);
  if (!issue) return null;
  return (
    <span
      id={validationMessageId(path)}
      className={`field-helper ${issue.status === 'pending' ? 'field-helper--pending' : 'field-helper--error'}`}
    >
      {issue.status === 'pending'
        ? '입력값이 수정되었습니다. 진단 결과 보기에서 다시 확인합니다.'
        : issue.message}
    </span>
  );
}

export function WizardValidatedTextInput({ path, 'aria-describedby': describedBy, ...props }) {
  const issue = useWizardFieldIssue(path);
  const messageId = issue ? validationMessageId(path) : null;
  const ariaDescribedBy = [describedBy, messageId].filter(Boolean).join(' ') || undefined;

  return (
    <>
      <input
        {...props}
        id={path}
        aria-invalid={issue?.status === 'active' ? true : props['aria-invalid']}
        aria-describedby={ariaDescribedBy}
        data-validation-pending={issue?.status === 'pending' ? 'true' : undefined}
      />
      <WizardFieldValidationMessage path={path} />
    </>
  );
}
