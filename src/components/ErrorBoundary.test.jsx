import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary.jsx';
import AppFallbackScreen from './AppFallbackScreen.jsx';

globalThis.React = React;

function Fine() {
  return <div>정상 화면</div>;
}

// A9 회귀 테스트.
// react-dom/server의 renderToStaticMarkup(이 프로젝트가 쓰는 유일한 렌더링 테스트 도구, jsdom 없음)은
// 서버 렌더링 중 발생한 오류를 error boundary로 잡지 않고 그대로 다시 던진다(React의 서버 렌더러
// 자체 동작) - 그래서 "자식이 throw했을 때 잡아서 fallback을 보여주는지"는 실제 브라우저에서 React가
// 호출하는 것과 동일한 두 지점(getDerivedStateFromError로 상태 전환, componentDidCatch로 로깅,
// render()로 fallback 출력)을 직접 호출해 검증한다.
describe('ErrorBoundary (A9)', () => {
  it('자식 컴포넌트가 정상 렌더되면 그대로 보여준다', () => {
    const html = renderToStaticMarkup(<ErrorBoundary><Fine /></ErrorBoundary>);
    expect(html).toContain('정상 화면');
  });

  it('getDerivedStateFromError는 오류 발생 시 hasError 상태로 전환한다(React가 실제로 호출하는 지점)', () => {
    expect(ErrorBoundary.getDerivedStateFromError(new Error('아무 오류'))).toEqual({ hasError: true });
  });

  it('hasError 상태에서는 흰 화면 대신 AppFallbackScreen을 렌더링한다', () => {
    const instance = new ErrorBoundary({ children: <Fine /> });
    instance.state = { hasError: true };
    const output = instance.render();
    expect(output.type).toBe(AppFallbackScreen);
    expect(output.props.message).toBe('예상하지 못한 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.');
  });

  it('오류가 없으면 children을 그대로 반환한다(래핑하지 않음)', () => {
    const instance = new ErrorBoundary({ children: <Fine /> });
    instance.state = { hasError: false };
    expect(instance.render()).toEqual(<Fine />);
  });

  it('fallback 메시지에는 오류 메시지·스택 등 개발 세부정보가 전혀 포함되지 않는다', () => {
    const instance = new ErrorBoundary({ children: null });
    instance.state = { hasError: true };
    const html = renderToStaticMarkup(instance.render());
    expect(html).not.toContain('Error');
    expect(html).not.toContain('.jsx');
    expect(html).not.toContain('at ');
  });

  it('componentDidCatch는 사용자에게 보여주지 않되 console.error로 개발자용 원인을 남긴다(전부 제거 금지)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const instance = new ErrorBoundary({ children: null });
    const error = new Error('민감한 내부 스택 정보');
    instance.componentDidCatch(error, { componentStack: 'at SomeInternalComponent' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('예상하지 못한 렌더링 오류');
    expect(spy.mock.calls[0][1]).toBe(error); // console(개발자용)에는 그대로 전달 - 화면에는 안 뜸
    spy.mockRestore();
  });
});
