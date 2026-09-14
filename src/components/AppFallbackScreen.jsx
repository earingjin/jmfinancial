// App 렌더링(ErrorBoundary) 실패와 필수 설정(Supabase 환경변수) 누락, 두 가지 "앱을 시작조차
// 못 하는" 상황이 공유하는 최소한의 안내 화면. 기존 App.jsx의 error/save-error 화면과 같은
// .error-state/.btn-primary 스타일을 그대로 재사용해 새 디자인을 만들지 않는다. 오류 원인으로
// 전달된 짧은 메시지는 보여주되 스택 트레이스·환경변수·내부 설정값은 전달하거나 표시하지 않는다.
export default function AppFallbackScreen({ message, detail }) {
  return (
    <div className="error-state">
      <p>{message}</p>
      {detail && <p>오류 원인: {detail}</p>}
      <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
        새로고침
      </button>
    </div>
  );
}
