import { describe, expect, it } from 'vitest';
import { assertFiniteCalculationResult } from './finite.js';

describe('assertFiniteCalculationResult', () => {
  it('accepts finite numbers and non-number result metadata', () => {
    expect(() => assertFiniteCalculationResult({ value: 1e308, state: 'ok', missing: null })).not.toThrow();
  });

  it.each([NaN, Infinity, -Infinity])('rejects a non-finite nested calculation result: %s', (value) => {
    expect(() => assertFiniteCalculationResult({ summary: { value } })).toThrow(/CALCULATION_NON_FINITE/);
  });
});
