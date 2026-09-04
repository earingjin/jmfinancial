// App 렌더링(ErrorBoundary) 실패와 필수 설정(Supabase 환경변수) 누락, 두 가지 "앱을 시작조차
// 못 하는" 상황이 공유하는 최소한의 안내 화면. 기존 App.jsx의 error/save-error 화면과 같은
// .error-state/.btn-primary 스타일을 그대로 재사용해 새 디자인을 만들지 않는다. 개발자가 원인을
// 찾을 데이터(스택 트레이스, 환경변수 이름, 내부 설정값)는 여기 표시하지 않고 console에만 남긴다.
export default function AppFallbackScreen({ message }) {
  return (
    <div className="error-state">
      <p>{message}</p>
      <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
        새로고침
      </button>
    </div>
  );
}
