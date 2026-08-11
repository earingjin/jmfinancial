import homeImage from '../../assets/home.png';

// 로그인 직후 랜딩 화면. 바로 마법사로 보내지 않고, 새 진단 시작 / 이전 결과 보기 중 고르게 한다.
export default function HomeScreen({ userName, onStart, onViewHistory }) {
  const displayName = userName?.trim() || '고객';

  return (
    <section className="home-screen">
      <h1 className="home-title">
        <span>반갑습니다 {displayName}님!</span>
        <span>제이엠 자산관리 플래너입니다.</span>
      </h1>
      <div className="home-card">
        <p className="home-subtitle">내 자산관리, 어디서부터 시작해야 할까요?</p>
        <p className="home-desc">현재 자산현황부터 재무건전성, 또래 비교, 은퇴 준비까지 종합적으로 진단합니다.</p>
        <img className="home-visual" src={homeImage} alt="자산 진단 안내 이미지" />
        <div className="home-actions">
          <button type="button" className="btn-primary" onClick={onStart}>
            자산진단 시작하기
          </button>
          <button type="button" className="btn-secondary" onClick={onViewHistory}>
            이전 결과 보기
          </button>
        </div>
      </div>
    </section>
  );
}
