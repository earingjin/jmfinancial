import { describe, expect, it } from 'vitest';
import { isValidLoginId, normalizeLoginId, toAuthEmail } from './authIdentifier.js';

describe('auth identifier helpers', () => {
  it('converts a new login id to the internal auth email', () => {
    expect(toAuthEmail('minsu123')).toBe('minsu123@jmfinancial.local');
  });

  it('keeps an existing email login compatible', () => {
    expect(toAuthEmail('olduser@gmail.com')).toBe('olduser@gmail.com');
  });

  it('trims and lowercases login ids', () => {
    expect(normalizeLoginId('  MINSU123  ')).toBe('minsu123');
    expect(isValidLoginId('  MINSU123  ')).toBe(true);
  });

  it('accepts login ids at the inclusive length boundaries', () => {
    expect(isValidLoginId('abcd')).toBe(true);
    expect(isValidLoginId('a'.repeat(20))).toBe(true);
  });

  it.each([
    'abc',
    'a'.repeat(21),
    '김민수',
    'min su',
    'abc@naver.com',
    'abc!',
  ])('rejects an invalid new login id: %s', (loginId) => {
    expect(isValidLoginId(loginId)).toBe(false);
  });
});
