import welcomeImage from '../../assets/웰컴화면.webp';

export default function WelcomeScreen({ onLogin, onSignup }) {
  return (
    <div className="welcome-page">
      <section className="welcome-shell" aria-labelledby="welcome-title">
        <div className="welcome-visual">
          <img src={welcomeImage} alt="편안한 공간에서 자산관리를 시작하는 모습" />
        </div>

        <div className="welcome-panel">
          <div className="welcome-accent" aria-hidden="true" />
          <h1 id="welcome-title">제이엠 자산관리 플래너</h1>
          <p>나의 오늘을 살펴보고,<br />더 나은 미래를 준비하세요.</p>

          <div className="welcome-actions">
            <button type="button" className="welcome-login" onClick={onLogin}>로그인</button>
            <button type="button" className="welcome-signup" onClick={onSignup}>회원가입</button>
          </div>
        </div>
      </section>
    </div>
  );
}
