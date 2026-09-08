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
      <AuthGate initialMode="login" />
    </AuthContext.Provider>
  );
}

describe('AuthGate signup consent', () => {
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

  it('shows the phone-number label on login while retaining the existing email compatibility internally', () => {
    const html = renderLogin();
    expect(html).toContain('휴대폰 번호 8자리');
    expect(html).not.toContain('아이디 또는 이메일');
  });
});
