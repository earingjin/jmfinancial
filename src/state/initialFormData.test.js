import { describe, expect, it } from 'vitest';
import { initialFormData } from './initialFormData.js';

describe('initialFormData pension start ages', () => {
  it('stores personal pension start ages on the paths used by input and calculation code', () => {
    expect(initialFormData.income.nationalPension).not.toHaveProperty('startAge');
    expect(initialFormData.income.personalPension.startAge).toBe('');
    expect(initialFormData.spouse.nationalPension).not.toHaveProperty('startAge');
    expect(initialFormData.spouse.personalPension.startAge).toBe('');
  });
});

describe('initialFormData total input modes', () => {
  it('defaults savings and every asset category to entering a total amount', () => {
    expect(initialFormData.assets.savingsPlan.inputMode).toBe('simple');
    expect(initialFormData.assets.liquidAssets.inputMode).toBe('simple');
    expect(initialFormData.assets.financialAssets.inputMode).toBe('simple');
    expect(initialFormData.assets.pensionAssetsInputMode).toBe('simple');
    expect(initialFormData.assets.realEstateAssets.inputMode).toBe('simple');
    expect(initialFormData.assets.otherAssets.inputMode).toBe('simple');
  });
});
