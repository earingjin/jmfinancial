import welcomeImage from '../../assets/웰컴화면.png';

// 로그인 직후 랜딩 화면. 바로 마법사로 보내지 않고, 새 진단 시작 / 이전 결과 보기 중 고르게 한다.
export default function HomeScreen({ userName, onStart, onViewHistory, onSignOut }) {
  const displayName = userName?.trim() || '고객';

  return (
    <div className="welcome-page home-welcome-page">
      <section className="welcome-shell" aria-labelledby="home-title">
        <div className="welcome-visual">
          <img src={welcomeImage} alt="편안한 공간에서 자산관리를 시작하는 모습" />
        </div>

        <div className="welcome-panel">
          <div className="welcome-accent" aria-hidden="true" />
          <h1 id="home-title">제이엠 자산관리 플래너</h1>
          <p><strong>{displayName}님, 반갑습니다.</strong><br />나의 오늘을 살펴보고, 더 나은 미래를 준비하세요.</p>

          <div className="welcome-actions">
            <button type="button" className="welcome-login" onClick={onStart}>자산진단 시작하기</button>
            <button type="button" className="welcome-signup" onClick={onViewHistory}>이전 결과 보기</button>
          </div>
          <button type="button" className="home-signout" onClick={onSignOut}>로그아웃</button>
        </div>
      </section>
    </div>
  );
}
