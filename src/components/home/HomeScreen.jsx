import homeImage from '../../assets/홈화면.webp';
import AppCopyright from '../AppCopyright';

// 로그인 직후 랜딩 화면. 바로 마법사로 보내지 않고, 새 진단 시작 / 이전 결과 보기 중 고르게 한다.
export default function HomeScreen({ userName, onStart, onViewHistory, onSignOut }) {
  const displayName = userName?.trim() || '고객';

  return (
    <div className="welcome-page home-welcome-page">
      <section className="welcome-shell" aria-labelledby="home-title">
        <div className="welcome-visual">
          <img src={homeImage} alt="자산의 성장을 표현한 그래프와 원화 아이콘" width="941" height="1672" decoding="async" fetchPriority="high" />
        </div>

        <div className="welcome-panel">
          <div className="home-intro">
            <h1 id="home-title">{displayName}님, 반갑습니다.</h1>
            <p className="home-tagline">
              <span>현재 자산을 진단하고</span>
              <span className="home-tagline-emphasis">미래의 여유를 설계하세요.</span>
            </p>
          </div>

          <div className="home-orientation" aria-label="자산진단 사전 안내">
            <div className="home-orientation-summary">
              <div><span aria-hidden="true">◷</span><strong>약 10~15분</strong></div>
              <div><span aria-hidden="true">✓</span><strong>6개 영역</strong></div>
              <div><span aria-hidden="true">▤</span><strong>맞춤 리포트</strong></div>
            </div>
            <ul className="home-orientation-notes">
              <li>진단 완료 후 맞춤 리포트를 제공합니다.</li>
              <li>현재 재무현황, 또래 비교, 미래 재무전망 등을 한눈에 확인할 수 있어요.</li>
              <li>소득·생활비·자산·대출·연금 정보를 확인해두면 더 빠르게 진행할 수 있어요.</li>
              <li>중간에 멈춰도 입력 내용은 임시 저장됩니다.</li>
            </ul>
          </div>

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
