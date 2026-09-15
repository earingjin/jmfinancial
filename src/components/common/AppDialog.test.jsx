import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmModal, NoticeModal } from './AppDialog';

describe('application dialogs', () => {
  it('renders an accessible destructive confirmation with disabled processing actions', () => {
    const html = renderToStaticMarkup(<ConfirmModal title="삭제할까요?" description="복구할 수 없습니다." cancelLabel="취소" confirmLabel="삭제하기" destructive processing onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('aria-describedby=');
    expect(html).toContain('app-dialog-destructive');
    expect(html.match(/disabled/g)).toHaveLength(2);
  });

  it('renders notices separately from confirmation dialogs', () => {
    const html = renderToStaticMarkup(<NoticeModal title="안내" description="현재 화면을 유지합니다." onClose={vi.fn()} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('현재 화면을 유지합니다.');
    expect(html).not.toContain('app-dialog-destructive');
  });
});
