import { describe, expect, it } from 'vitest';
import { isValidLoginId, normalizeLoginId, normalizeSignupLoginId, toAuthEmail } from './authIdentifier.js';

describe('auth identifier helpers', () => {
  it('converts a new login id to the internal auth email', () => {
    expect(toAuthEmail('12345678')).toBe('12345678@jmfinancial.local');
  });

  it('keeps an existing email login compatible', () => {
    expect(toAuthEmail('olduser@gmail.com')).toBe('olduser@gmail.com');
  });

  it('trims login ids and keeps only up to eight digits for signup', () => {
    expect(normalizeLoginId('  12345678  ')).toBe('12345678');
    expect(normalizeSignupLoginId('12a34-567890')).toBe('12345678');
    expect(isValidLoginId('  12345678  ')).toBe(true);
  });

  it('accepts exactly eight numeric characters', () => {
    expect(isValidLoginId('12345678')).toBe(true);
  });

  it.each([
    '1234567',
    '123456789',
    '김민수',
    '1234 5678',
    'abc@naver.com',
    '1234-5678',
  ])('rejects an invalid new login id: %s', (loginId) => {
    expect(isValidLoginId(loginId)).toBe(false);
  });
});
