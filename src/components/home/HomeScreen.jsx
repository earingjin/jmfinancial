// 로그인 직후 랜딩 화면. 바로 마법사로 보내지 않고, 새 진단 시작 / 이전 결과 보기 중 고르게 한다.
export default function HomeScreen({ onStart, onViewHistory }) {
  return (
    <div className="home-card">
      <h1 className="home-title">안녕하세요. 제이엠 자산관리 플래너입니다.</h1>
      <p className="home-subtitle">내 자산관리, 어디서부터 시작해야 할까요?</p>
      <p className="home-desc">현재 자산현황부터 재무건전성, 또래 비교, 은퇴 준비까지 종합적으로 진단합니다.</p>
      <div className="home-actions">
        <button type="button" className="btn-primary" onClick={onStart}>
          자산진단 시작하기
        </button>
        <button type="button" className="btn-secondary" onClick={onViewHistory}>
          이전 결과 보기
        </button>
      </div>
    </div>
  );
}
