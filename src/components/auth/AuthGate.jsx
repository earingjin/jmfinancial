import { useState } from 'react';
import { useAuth } from '../../state/authState';
import heroImage from '../../assets/리포트 표지 디자인.png';
import AppCopyright from '../AppCopyright';

function translateAuthError(message) {
  if (!message) return '알 수 없는 오류가 발생했습니다.';
  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (message.includes('User already registered')) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (message.includes('Password should be at least')) return '비밀번호는 6자 이상이어야 합니다.';
  if (message.toLowerCase().includes('rate limit')) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  return message;
}

function PrivacyConsentModal({ onClose, onConfirm }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>개인정보 수집·이용 동의</h4>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="consent-body">
          <p>본 서비스는 자산진단 및 결과 리포트 제공을 위해 아래와 같이 개인정보를 수집·이용합니다.</p>

          <h5>1. 수집·이용 목적</h5>
          <p>자산진단 서비스 제공</p>
          <p>맞춤형 재무분석 및 결과 리포트 생성</p>
          <p>서비스 이용자가 중간이탈시 자동저장</p>

          <h5>2. 수집항목</h5>
          <p><strong>필수항목</strong></p>
          <p>이메일 주소</p>
          <p>비밀번호</p>
          <p>출생연도</p>

          <p><strong>선택항목</strong></p>
          <p>소득, 자산, 부채 관련 정보</p>
          <p>재무목표</p>
          <p>기타 이용자가 입력하는 재무 관련 정보</p>

          <h5>보유 및 이용기간</h5>
          <p>수집된 개인정보는 자산진단 결과 제공 완료 후 7일간 보관되며, 이후 자동으로 파기됩니다.</p>

          <h5>동의 거부 권리</h5>
          <p>이용자는 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다. 다만 필수항목 수집에 동의하지 않을 경우 자산진단 서비스 이용이 제한될 수 있습니다.</p>

          <p className="consent-quote">"입력된 재무정보는 진단 결과 생성 목적으로만 사용되며 제3자에게 제공되지 않습니다."</p>
        </div>
        <label className="consent-checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>개인정보 수집·이용에 동의합니다.</span>
        </label>
        <button type="button" className="btn-primary consent-confirm" disabled={!checked} onClick={onConfirm}>
          확인
        </button>
      </div>
    </div>
  );
}

export default function AuthGate({ title = '잭앤리치', allowSignup = true, initialMode = 'login', noticeMessage, secondaryAction }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setNotice('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (mode === 'signup' && !consentGiven) {
      setError('개인정보 수집·이용에 동의해야 회원가입할 수 있습니다.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await signUp(email, password, name);
        if (err) throw err;
        if (!data.session) {
          setNotice('가입해 주셔서 감사합니다. 이메일로 전송된 확인 링크를 클릭하면 로그인할 수 있습니다.');
        }
      } else {
        const { error: err } = await signIn(email, password);
        if (err) throw err;
      }
    } catch (err) {
      setError(translateAuthError(err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-gate">
      <div className="auth-page-heading">
        <div className="auth-page-brand">JM FINANCIAL PLANNER</div>
        <p className="auth-page-title">제이엠 자산관리 플래너</p>
      </div>
      {mode === 'login' && title === '잭앤리치' && (
        <ul className="auth-login-notice">
          <li>제3자에게 제공되지 않습니다</li>
          <li>진단결과 제공 7일 후 자동삭제됩니다.</li>
          <li>회원탈퇴시 바로 삭제됩니다.</li>
        </ul>
      )}
      <div className="auth-card">
        <div className="auth-card-bg">
          <img src={heroImage} alt="전문적인 재무진단 리포트 표지" />
        </div>
        <div className="auth-card-content">
          {title !== '잭앤리치' && <h1 className="auth-title">{title}</h1>}

          {noticeMessage && <p className="auth-switch-notice">{noticeMessage}</p>}

          {allowSignup && (
            <div className="radio-group auth-mode-toggle">
              <button type="button" className={`radio-pill ${mode === 'login' ? 'is-active' : ''}`} onClick={() => switchMode('login')}>
                로그인
              </button>
              <button type="button" className={`radio-pill ${mode === 'signup' ? 'is-active' : ''}`} onClick={() => switchMode('signup')}>
                회원가입
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <button type="button" className="auth-consent-trigger" onClick={() => setShowConsentModal(true)}>
              개인정보 수집 동의하기
            </button>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && (
              <p className="auth-signup-reassurance">
                이메일은 진단 중 중도 이탈할 경우 저장된 기록을 찾기 위해 입력합니다.<br />
                진단 결과는 진단 완료 후 7일 이내에 자동 삭제됩니다.<br />
                전화번호 등 추가 개인정보는 요구하지 않으며, 광고성 이메일은 보내지 않습니다.
              </p>
            )}
            {mode === 'signup' && (
              <label className="field">
                <span className="field-label">이름</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="홍길동" />
              </label>
            )}
            <label className="field">
              <span className="field-label">이메일</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label className="field">
              <span className="field-label">비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="6자 이상"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </label>

            {error && <p className="auth-error">{error}</p>}
            {notice && <p className="auth-notice">{notice}</p>}

            <button
              type="submit"
              className="btn-primary auth-submit"
              disabled={submitting || (mode === 'signup' && !consentGiven)}
            >
              {submitting ? 'Loading...' : mode === 'signup' ? '회원가입' : '로그인'}
            </button>
          </form>

          {secondaryAction && (
            <button type="button" className="auth-secondary-action" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      </div>
      {showConsentModal && (
        <PrivacyConsentModal
          onClose={() => setShowConsentModal(false)}
          onConfirm={() => {
            setConsentGiven(true);
            setShowConsentModal(false);
          }}
        />
      )}
      <AppCopyright className="auth-copyright" />
    </div>
  );
}
