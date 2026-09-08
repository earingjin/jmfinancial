import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AccountResetGate from './AccountResetGate.jsx';

globalThis.React = React;

describe('AccountResetGate', () => {
  it('shows a generic destructive warning, deletion scope, id input, and both choices without old account data', () => {
    const html = renderToStaticMarkup(<AccountResetGate onCancel={vi.fn()} />);

    expect(html).toContain('비밀번호를 새로 설정하시겠어요?');
    expect(html).toContain('휴대폰 번호 뒤 8자리');
    expect(html).toContain('진행 중인 진단');
    expect(html).toContain('완료된 진단 결과');
    expect(html).toContain('저장된 재무정보 및 리포트');
    expect(html).toContain('취소');
    expect(html).toContain('기록을 삭제하고 계속');
    expect(html).not.toMatch(/사용자 이름|진단 날짜|자산 [0-9]|소득 [0-9]|부채 [0-9]|연금 [0-9]/);
  });
});
