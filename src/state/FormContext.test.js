import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));

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

  it('preserves only supported nested keys and remains idempotent across repeated merges', () => {
    const saved = structuredClone(initialFormData);
    saved.assets.debtStatus.breakdown.mortgage = {
      repaymentType: 'equalPrincipal', principal: 5000, monthlyInterest: 0,
      monthlyRepayment: 50, months: 120, unsupported: 'drop-me',
    };
    saved.assets.currentLivingCost.breakdown.food = 300;
    saved.assets.savingsPlan.breakdown.irp.monthly = 20;
    saved.assets.pensionAssetsBreakdown.irp = 2000;

    const once = mergeDraft(initialFormData, saved);
    const twice = mergeDraft(initialFormData, once);

    expect(once.assets.debtStatus.breakdown.mortgage).toEqual({
      repaymentType: 'equalPrincipal', principal: 5000, monthlyInterest: 0, monthlyRepayment: 50, months: 120,
    });
    expect(twice).toEqual(once);
    expect(once.assets.currentLivingCost.breakdown.food).toBe(300);
    expect(once.assets.savingsPlan.breakdown.irp.monthly).toBe(20);
    expect(once.assets.pensionAssetsBreakdown.irp).toBe(2000);
  });
});
