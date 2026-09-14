import { useState } from 'react';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, normalizeSignupLoginId } from '../../state/authIdentifier.js';
import { requestAccountReset, validateResetPassword } from '../../services/accountReset.js';
import AppCopyright from '../AppCopyright.jsx';

export default function AccountResetGate({ onCancel, onComplete = onCancel }) {
  const [step, setStep] = useState('warning');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const continueToPassword = () => {
    if (loginId.length !== 8) {
      setError('휴대폰 번호 뒤 8자리를 입력해 주세요.');
      return;
    }
    setError('');
    setStep('password');
  };

  const submitReset = async (event) => {
    event.preventDefault();
    const validationError = validateResetPassword(password, passwordConfirm);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSubmitting(true);
    const result = await requestAccountReset({ loginId, password, passwordConfirm });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep('complete');
  };

  return (
    <div className="auth-gate account-reset-gate">
      <div className="auth-page-heading">
        <div className="auth-page-brand">JM FINANCIAL PLANNER</div>
        <p className="auth-page-title">제이엠 자산관리 플래너</p>
      </div>
      <div className="auth-card">
        <div className="auth-card-content">
          {step === 'warning' && (
            <section aria-labelledby="account-reset-title">
              <h1 id="account-reset-title" className="account-reset-title">비밀번호를 새로 설정하시겠어요?</h1>
              <div className="account-reset-warning">
                <p>개인정보 보호를 위해 별도의 본인확인 정보를 보관하지 않습니다.</p>
                <p>따라서 새 비밀번호를 설정하면 현재 아이디에 저장된 모든 진단 기록이 영구적으로 삭제됩니다.</p>
                <strong>삭제된 기록은 복구할 수 없습니다.</strong>
                <ul>
                  <li>진행 중인 진단</li>
                  <li>완료된 진단 결과</li>
                  <li>저장된 재무정보 및 리포트</li>
                </ul>
              </div>
              <label className="field">
                <span className="field-label">휴대폰 번호 뒤 8자리</span>
                <input
                  type="text"
                  value={loginId}
                  onChange={(event) => setLoginId(normalizeSignupLoginId(event.target.value))}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  autoComplete="username"
                  placeholder="예: 12345678"
                />
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="account-reset-actions">
                <button type="button" className="btn-secondary" onClick={onCancel}>취소</button>
                <button type="button" className="btn-primary" onClick={continueToPassword}>기록을 삭제하고 계속</button>
              </div>
            </section>
          )}

          {step === 'password' && (
            <form className="auth-form" onSubmit={submitReset} aria-labelledby="new-password-title">
              <h1 id="new-password-title" className="account-reset-title">새 비밀번호 설정</h1>
              <p className="account-reset-step-note">요청이 완료되면 기존 진단 기록은 모두 삭제되고 모든 로그인 세션이 종료됩니다.</p>
              <label className="field">
                <span className="field-label">새 비밀번호</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                  autoComplete="new-password"
                  placeholder="6자 이상"
                />
              </label>
              <label className="field">
                <span className="field-label">새 비밀번호 확인</span>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                  autoComplete="new-password"
                  placeholder="새 비밀번호를 다시 입력"
                />
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="account-reset-actions">
                <button type="button" className="btn-secondary" onClick={() => { setError(''); setStep('warning'); }}>이전</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? '초기화 중…' : '기록 삭제 및 새 비밀번호 설정'}
                </button>
              </div>
            </form>
          )}

          {step === 'complete' && (
            <section className="account-reset-complete" aria-labelledby="account-reset-complete-title">
              <h1 id="account-reset-complete-title" className="account-reset-title">계정 초기화 요청을 처리했습니다.</h1>
              <p>입력한 아이디의 계정이 존재하는 경우 새 비밀번호로 로그인할 수 있습니다.</p>
              <button type="button" className="btn-primary" onClick={onComplete}>로그인으로 돌아가기</button>
            </section>
          )}
        </div>
      </div>
      <AppCopyright className="auth-copyright" />
    </div>
  );
}
