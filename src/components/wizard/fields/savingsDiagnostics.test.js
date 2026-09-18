import { describe, expect, it, vi } from 'vitest';
import {
  createSavingsDiagnosticItemId,
  logSavingsDiagnostic,
  sanitizeSavingsDiagnosticDetail,
  savingsDiagnosticsEnabled,
} from './savingsDiagnostics';

describe('additional savings development diagnostics', () => {
  it('removes names, amounts, formData and authentication values from diagnostic details', () => {
    expect(sanitizeSavingsDiagnosticDetail({
      itemId: 'custom-savings-1', field: 'monthly', edited: true, assetMatchCount: 1,
      name: 'private name', value: 1234, amount: 5678, formData: { secret: true }, userId: 'user-1', token: 'secret',
    })).toEqual({ itemId: 'custom-savings-1', field: 'monthly', edited: true, assetMatchCount: 1 });
  });

  it('uses temporary identifiers instead of array indexes as item identity', () => {
    const first = createSavingsDiagnosticItemId();
    const second = createSavingsDiagnosticItemId();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^custom-savings-\d+$/);
    expect(second).toMatch(/^custom-savings-\d+$/);
  });

  it('does not write to the console unless the explicit development flag is enabled', () => {
    expect(savingsDiagnosticsEnabled).toBe(false);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    logSavingsDiagnostic('render', { itemId: 'custom-savings-1' });
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
