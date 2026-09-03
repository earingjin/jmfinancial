import { describe, expect, it } from 'vitest';
import { formatNumericText, normalizeNumericText } from './numericInputText.js';

describe('FormattedNumberInput decimal editing', () => {
  it('preserves a trailing decimal point while the user is still typing', () => {
    expect(normalizeNumericText('2.')).toBe('2.');
    expect(formatNumericText('2.')).toBe('2.');
  });

  it('accepts a decimal amount such as 2.5만원', () => {
    expect(normalizeNumericText('2.5')).toBe('2.5');
    expect(formatNumericText('2.5')).toBe('2.5');
  });

  it('normalizes complete integer-only values without accepting decimal text', () => {
    expect(normalizeNumericText('24', { integerOnly: true })).toBe('24');
  });

  it('keeps grouping separators without losing the decimal part', () => {
    expect(formatNumericText('12345.6')).toBe('12,345.6');
  });
});
