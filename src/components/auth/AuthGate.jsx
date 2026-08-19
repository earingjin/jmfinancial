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

export default function AuthGate({ title = '잭앤리치', allowSignup = true, initialMode = 'login', noticeMessage, secondaryAction }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setNotice('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
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

          <form onSubmit={handleSubmit} className="auth-form">
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

            <button type="submit" className="btn-primary auth-submit" disabled={submitting}>
              {submitting ? '처리 중…' : mode === 'signup' ? '회원가입' : '로그인'}
            </button>
          </form>

          {secondaryAction && (
            <button type="button" className="auth-secondary-action" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      </div>
      <AppCopyright className="auth-copyright" />
    </div>
  );
}
