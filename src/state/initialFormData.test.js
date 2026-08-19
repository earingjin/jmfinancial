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
