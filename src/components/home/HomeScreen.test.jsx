import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import HomeScreen from './HomeScreen';

vi.mock('../AppCopyright', () => ({ default: () => null }));

const defaultProps = {
  userName: '테스트',
  onStart: vi.fn(),
  onStartNew: vi.fn(),
  onViewHistory: vi.fn(),
  onSignOut: vi.fn(),
  onDeleteAccount: vi.fn(),
};

describe('HomeScreen diagnosis CTA', () => {
  it('shows the existing new-diagnosis CTA when there is no working draft', () => {
    const html = renderToStaticMarkup(<HomeScreen {...defaultProps} hasWorkingDraft={false} />);

    expect(html).toContain('자산진단 시작하기');
    expect(html).not.toContain('자산진단 이어하기');
    expect(html).not.toContain('새로 입력');
    expect(html).not.toContain('작성 중인 진단이 있습니다. 이전에 입력하던 단계부터 계속할 수 있습니다.');
  });

  it('shows the resume CTA and guidance only when there is a working draft', () => {
    const html = renderToStaticMarkup(<HomeScreen {...defaultProps} hasWorkingDraft />);

    expect(html).toContain('자산진단 이어하기');
    expect(html).toContain('새로 입력');
    expect(html).toContain('작성 중인 진단이 있습니다. 이전에 입력하던 단계부터 계속할 수 있습니다.');
    expect(html).not.toContain('자산진단 시작하기');
    expect(html).not.toContain('진단 전 안내');
  });

  it('opens the existing guide only after the home reset succeeds', async () => {
    const source = await readFile(new URL('./HomeScreen.jsx', import.meta.url), 'utf8');

    expect(source).toContain('if (await onStartNew()) setShowDiagnosisGuide(true)');
    expect(source).toContain('onClick={hasWorkingDraft ? onStart : () => setShowDiagnosisGuide(true)}');
    expect(source).toContain('onClick={startAfterGuide}');
  });
});
