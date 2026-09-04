import { Component } from 'react';
import AppFallbackScreen from './AppFallbackScreen';

// A9: 예상하지 못한 React 렌더링 오류가 화면 전체를 흰 화면으로 만드는 것을 막는 최상위
// 안전망이다. main.jsx가 <App/>을 이걸로 감싼다. 클래스 컴포넌트인 이유는 getDerivedStateFromError/
// componentDidCatch가 React에서 오류를 잡을 수 있는 유일한 방법(훅 대응 없음)이기 때문이다.
//
// 잡지 못하는 오류: 이 컴포넌트 자신을 포함해 main.jsx가 <App/>을 mount하기도 전에 모듈
// import/초기화 단계에서 발생하는 오류(예: 필수 환경변수 누락으로 supabaseClient.js가 실패하는
// 경우)는 React 렌더링 트리 밖에서 일어나므로 ErrorBoundary가 잡을 수 없다 - 그건 A10에서 별도로
// 처리한다. 이벤트 핸들러 안에서 발생하는 오류도 React ErrorBoundary의 대상이 아니다(React 공식
// 동작).
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // 사용자 화면에는 스택 트레이스 등 개발 세부정보를 절대 노출하지 않는다 - 개발자가 원인을
    // 찾을 정보는 console에만 남긴다.
    // eslint-disable-next-line no-console
    console.error('예상하지 못한 렌더링 오류가 발생했습니다.', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <AppFallbackScreen message="예상하지 못한 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요." />;
    }
    return this.props.children;
  }
}
