const STEP_TITLES = {
  income: '1. 수입', expense: '2. 지출', savings: '3. 저축', assets: '4. 자산', debt: '5. 부채',
  netWorth: '6. 순자산', unknown: '위치 확인 필요',
};

export default function WizardErrorSummary({ issues, currentStepKey, onSelect }) {
  if (!issues.length) return null;
  const activeCount = issues.filter((issue) => issue.status === 'active').length;
  const pendingCount = issues.filter((issue) => issue.status === 'pending').length;
  const groups = Object.entries(issues.reduce((result, issue) => {
    const key = issue.stepKey || 'unknown';
    return { ...result, [key]: [...(result[key] || []), issue] };
  }, {}));

  return (
    <section className="wizard-error-summary" role="alert" aria-labelledby="wizard-error-summary-title">
      <div className="wizard-error-summary-head">
        <div>
          <h3 id="wizard-error-summary-title">입력 오류가 있어 수정할 단계로 돌아왔습니다.</h3>
          <p>
            {activeCount > 0 && `수정 필요 ${activeCount}개`}
            {activeCount > 0 && pendingCount > 0 && ' · '}
            {pendingCount > 0 && `재확인 대기 ${pendingCount}개`}
          </p>
        </div>
      </div>
      <p className="wizard-error-summary-guide">항목을 선택하면 수정할 위치로 이동합니다. 수정 후 다시 진단 결과 보기를 눌러 확인해 주세요.</p>
      <div className="wizard-error-groups">
        {groups.map(([stepKey, groupIssues]) => (
          <details key={stepKey} open={stepKey === currentStepKey || stepKey === 'unknown'}>
            <summary>
              <span>{STEP_TITLES[stepKey] || stepKey}</span>
              <strong>{groupIssues.length}개</strong>
            </summary>
            <ul>
              {groupIssues.map((issue) => (
                <li key={issue.key}>
                  <button
                    type="button"
                    onClick={() => onSelect(issue)}
                    disabled={issue.stepIndex == null}
                  >
                    <span>{issue.label}</span>
                    <small>{issue.status === 'pending'
                      ? '입력값이 수정되었습니다. 진단 결과 보기에서 다시 확인합니다.'
                      : issue.message}</small>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

