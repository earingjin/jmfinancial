import welcomeImage from '../../assets/웰컴화면.webp';
import AppCopyright from '../AppCopyright';

// 로그인 직후 랜딩 화면. 바로 마법사로 보내지 않고, 새 진단 시작 / 이전 결과 보기 중 고르게 한다.
export default function HomeScreen({ userName, onStart, onViewHistory, onSignOut }) {
  const displayName = userName?.trim() || '고객';

  return (
    <div className="welcome-page home-welcome-page">
      <section className="welcome-shell" aria-labelledby="home-title">
        <div className="welcome-visual">
          <img src={welcomeImage} alt="자산의 성장을 표현한 그래프와 원화 아이콘" />
        </div>

        <div className="welcome-panel">
          <h1 id="home-title">{displayName}님, 반갑습니다.</h1>
          <p>현재 자산을 진단하고<br />미래의 여유를 설계하세요.</p>

          <div className="welcome-actions">
            <button type="button" className="welcome-login" onClick={onStart}>자산진단 시작하기</button>
            <button type="button" className="welcome-signup" onClick={onViewHistory}>이전 결과 보기</button>
          </div>
          <button type="button" className="home-signout" onClick={onSignOut}>로그아웃</button>
          <AppCopyright className="welcome-copyright" />
        </div>
      </section>
    </div>
  );
}
