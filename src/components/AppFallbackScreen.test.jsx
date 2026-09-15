import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AppFallbackScreen from './AppFallbackScreen.jsx';

globalThis.React = React;

describe('AppFallbackScreen', () => {
  it('전달된 메시지를 그대로 보여준다', () => {
    const html = renderToStaticMarkup(<AppFallbackScreen message="서비스 설정 문제로 현재 이용할 수 없습니다." />);
    expect(html).toContain('서비스 설정 문제로 현재 이용할 수 없습니다.');
    expect(html).toContain('새로고침');
  });

  it('환경변수 이름·URL·API 키 등 설정값을 노출하지 않는다', () => {
    const html = renderToStaticMarkup(<AppFallbackScreen message="서비스 설정 문제로 현재 이용할 수 없습니다." />);
    expect(html).not.toContain('VITE_SUPABASE');
    expect(html).not.toContain('supabase.co');
  });

  it('시스템 오류 원인이 전달돼도 사용자 화면에 표시하지 않는다', () => {
    const html = renderToStaticMarkup(<AppFallbackScreen message="오류가 발생했습니다." detail="TypeError: PostgREST failed" />);
    expect(html).not.toContain('TypeError');
    expect(html).not.toContain('PostgREST');
  });

  it('새로고침 버튼을 누르면 window.location.reload를 호출한다', () => {
    const reloadSpy = vi.fn();
    vi.stubGlobal('window', { location: { reload: reloadSpy } });

    const element = AppFallbackScreen({ message: 'msg' });
    const button = element.props.children.find((child) => child?.type === 'button');
    button.props.onClick();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
