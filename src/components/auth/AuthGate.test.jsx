import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../state/authState';

globalThis.React = React;
const { default: AuthGate } = await import('./AuthGate');

function renderSignup() {
  return renderToStaticMarkup(
    <AuthContext.Provider value={{ signIn: vi.fn(), signUp: vi.fn() }}>
      <AuthGate initialMode="signup" />
    </AuthContext.Provider>
  );
}

function renderLogin() {
  return renderToStaticMarkup(
    <AuthContext.Provider value={{ signIn: vi.fn(), signUp: vi.fn() }}>
      <AuthGate initialMode="login" onForgotPassword={vi.fn()} />
    </AuthContext.Provider>
  );
}

describe('AuthGate signup consent', () => {
  it('shows the concise 30-day data policy above the login form', () => {
    const html = renderLogin();

    expect(html).toContain('안심하고 이용하세요');
    expect(html).toContain('입력하신 정보는 제3자에게 제공되지 않습니다.');
    expect(html).toContain('진단 결과는 진단 완료일로부터 30일 후 자동 삭제됩니다.');
    expect(html).toContain('회원 탈퇴 시 저장된 진단 정보는 즉시 삭제됩니다.');
    expect(html).not.toContain('진단결과 제공 7일 후 자동삭제됩니다.');
  });

  it('puts the required consent checkbox directly above the signup button', () => {
    const html = renderSignup();
    const consentIndex = html.indexOf('개인정보 수집·이용에 동의합니다.');
    const submitIndex = html.indexOf('auth-submit');

    expect(consentIndex).toBeGreaterThan(-1);
    expect(consentIndex).toBeLessThan(submitIndex);
    expect(html).toContain('내용 보기');
    expect(html).not.toContain('개인정보 수집 동의하기');
    expect(html.slice(submitIndex)).toContain('disabled=""');
  });

  it('shows the password-loss warning and requires its separate acknowledgement before signup', () => {
    const html = renderSignup();
    const warningIndex = html.indexOf('비밀번호를 꼭 기억해 주세요');
    const acknowledgementIndex = html.indexOf('비밀번호 분실 시 기존 진단 기록이 삭제되는 것을 확인했습니다.');
    const submitIndex = html.indexOf('auth-submit');

    expect(warningIndex).toBeGreaterThan(-1);
    expect(acknowledgementIndex).toBeGreaterThan(warningIndex);
    expect(acknowledgementIndex).toBeLessThan(submitIndex);
    expect(html.slice(submitIndex)).toContain('disabled=""');
  });

  it('shows the phone-number label on login while retaining the existing email compatibility internally', () => {
    const html = renderLogin();
    expect(html).toContain('휴대폰 번호 8자리');
    expect(html).not.toContain('아이디 또는 이메일');
    expect(html).toContain('비밀번호를 잊으셨나요?');
  });
});
