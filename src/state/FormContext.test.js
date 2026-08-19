import { describe, expect, it } from 'vitest';
import { mergeDraft } from './draftStorage.js';
import { initialFormData } from './initialFormData.js';

describe('draft restoration', () => {
  it('restores saved values while filling newly added fields from current defaults', () => {
    const restored = mergeDraft(initialFormData, {
      basic: { birthYear: '1980' },
      income: {},
      spouse: {},
      expense: {},
      assets: { liquidAssets: { total: '5000' } },
    });
    expect(restored.basic.birthYear).toBe('1980');
    expect(restored.assets.liquidAssets.total).toBe('5000');
    expect(restored.basic.assumedReturnRate).toBe(initialFormData.basic.assumedReturnRate);
  });
});
