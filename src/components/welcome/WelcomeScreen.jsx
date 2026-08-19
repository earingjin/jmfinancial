import welcomeImage from '../../assets/웰컴화면.webp';
import AppCopyright from '../AppCopyright';

export default function WelcomeScreen({ onLogin, onSignup }) {
  return (
    <div className="welcome-page">
      <section className="welcome-shell" aria-labelledby="welcome-title">
        <div className="welcome-visual">
          <img src={welcomeImage} alt="자산의 성장을 표현한 그래프와 원화 아이콘" />
        </div>

        <div className="welcome-panel">
          <div className="welcome-brand-label">제이엠 자산관리 플래너</div>
          <h1 id="welcome-title">자산의 가치를<br /><span>더 크게, 더 현명하게</span></h1>

          <div className="welcome-actions">
            <button type="button" className="welcome-login" onClick={onLogin}>로그인</button>
            <button type="button" className="welcome-signup" onClick={onSignup}>회원가입</button>
          </div>
          <AppCopyright className="welcome-copyright" />
        </div>
      </section>
    </div>
  );
}
