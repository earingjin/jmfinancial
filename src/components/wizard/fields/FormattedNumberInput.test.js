import { describe, expect, it } from 'vitest';
import { formatNumericText, getNumericInputUpdate, normalizeNumericText } from './numericInputText.js';

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

  it('keeps valid negative decimal text for fields that allow negatives', () => {
    expect(getNumericInputUpdate('-2.5', { allowsNegative: true })).toEqual({
      shouldCommit: true,
      value: '-2.5',
    });
  });

  it('keeps an empty value as a valid clear action', () => {
    expect(getNumericInputUpdate('')).toEqual({ shouldCommit: true, value: '' });
  });

  it('does not turn a disallowed negative number into a positive form value', () => {
    const update = getNumericInputUpdate('-100', { allowsNegative: false });

    expect(update).toEqual({ shouldCommit: false, error: 'negative' });
    expect(normalizeNumericText('-100', { allowsNegative: false })).toBe('-100');
  });

  it.each(['1O0', '12a3'])('does not strip invalid text %s into a form value', (input) => {
    const update = getNumericInputUpdate(input);

    expect(update).toEqual({ shouldCommit: false, error: 'numeric' });
    expect(normalizeNumericText(input)).toBe(input);
  });

  it.each([
    ['-100', { allowsNegative: false }],
    ['1O0', {}],
    ['12a3', {}],
  ])('keeps the existing form value when %s is invalid', (input, options) => {
    const formData = { amount: 250 };
    const update = getNumericInputUpdate(input, options);

    if (update.shouldCommit) formData.amount = Number(update.value);

    expect(formData.amount).toBe(250);
  });

  it('continues to reject decimal text for integer-only fields without a form update', () => {
    expect(getNumericInputUpdate('24.5', { integerOnly: true })).toEqual({
      shouldCommit: false,
      error: 'integer',
    });
  });
});
