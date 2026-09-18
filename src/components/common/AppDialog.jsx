import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function DialogFrame({ title, description, role, children, onDismiss }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector(FOCUSABLE)?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [...panel.querySelectorAll(FOCUSABLE)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  return (
    <div className="modal-overlay app-dialog-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onDismiss?.();
    }}>
      <section ref={panelRef} className="modal-panel app-dialog" role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="app-dialog-body">
          <h4 id={titleId}>{title}</h4>
          <p id={descriptionId}>{description}</p>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ConfirmModal({
  title, description, cancelLabel = '취소', secondaryLabel, confirmLabel = '확인', destructive = false,
  onCancel, onSecondary, onConfirm, processing = false, disabled = false,
}) {
  const [internalProcessing, setInternalProcessing] = useState(false);
  const confirmingRef = useRef(false);
  const blocked = processing || internalProcessing || disabled;
  const handleConfirm = async () => {
    if (blocked || confirmingRef.current) return;
    confirmingRef.current = true;
    setInternalProcessing(true);
    try {
      await onConfirm();
    } finally {
      confirmingRef.current = false;
      setInternalProcessing(false);
    }
  };
  return (
    <DialogFrame title={title} description={description} role="alertdialog" onDismiss={blocked ? undefined : onCancel}>
      <div className={`app-dialog-actions ${secondaryLabel ? 'app-dialog-actions--three' : ''}`}>
        <button type="button" className="welcome-signup" onClick={onCancel} disabled={blocked}>{cancelLabel}</button>
        {secondaryLabel && <button type="button" className="welcome-login" onClick={onSecondary} disabled={blocked}>
          {secondaryLabel}
        </button>}
        <button type="button" className={destructive ? 'app-dialog-destructive' : 'welcome-login'} onClick={() => void handleConfirm()} disabled={blocked}>
          {processing || internalProcessing ? '처리 중…' : confirmLabel}
        </button>
      </div>
    </DialogFrame>
  );
}

export function NoticeModal({ title, description, confirmLabel = '확인', onClose }) {
  return (
    <DialogFrame title={title} description={description} role="dialog" onDismiss={onClose}>
      <div className="app-dialog-actions app-dialog-actions--notice">
        <button type="button" className="welcome-login" onClick={onClose}>{confirmLabel}</button>
      </div>
    </DialogFrame>
  );
}

// oxlint-disable-next-line react/only-export-components
export function useConfirmRequest() {
  const [options, setOptions] = useState(null);
  const resolverRef = useRef(null);
  const requestConfirm = useCallback((nextOptions) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setOptions(nextOptions);
  }), []);
  const settle = useCallback((confirmed) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    resolve?.(confirmed);
  }, []);
  return {
    requestConfirm,
    confirmModal: options ? (
      <ConfirmModal {...options} onCancel={() => settle(false)} onConfirm={() => settle(true)} />
    ) : null,
  };
}
