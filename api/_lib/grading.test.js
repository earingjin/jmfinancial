import { describe, it, expect } from 'vitest';
import { evaluateBands, pctOrNA, divOrNA, notCalculableResult } from './grading.js';

const atMost = (max) => (v) => v <= max;
const atLeast = (min) => (v) => v >= min;

describe('evaluateBands', () => {
  const bands = [
    { test: atMost(50), score: 15, status: 'A', rangeLabel: '50% 이하', reason: 'r1' },
    { test: atMost(60), score: 14, status: 'B', rangeLabel: '50% 초과~60% 이하', reason: 'r2' },
    { test: atLeast(0), score: 0, status: 'F', rangeLabel: '60% 초과', reason: 'r3' },
  ];

  it('uses rawValue (unrounded) for scoring, not a pre-rounded value', () => {
    // 60.04 rounds to 60.0 for display, and 60.0 WOULD satisfy atMost(60) - but the
    // raw value is 60.04, which must NOT satisfy atMost(60). Scoring must use rawValue.
    const result = evaluateBands(60.04, bands, 15);
    expect(result.rawValue).toBe(60.04);
    expect(result.displayValue).toBe(60);
    expect(result.score).toBe(0); // not 14 - proves scoring is not done on the rounded value
  });

  it('rounds only displayValue to 1 decimal, never rawValue', () => {
    const result = evaluateBands(50.549, bands, 15);
    expect(result.rawValue).toBe(50.549);
    expect(result.displayValue).toBe(50.5);
  });

  it('does not fall through to the last band for values that used to sit in a decimal gap (T-0.01/T/T+0.01 at 50)', () => {
    const below = evaluateBands(49.99, bands, 15);
    const at = evaluateBands(50, bands, 15);
    const above = evaluateBands(50.01, bands, 15);
    expect(below.score).toBe(15);
    expect(at.score).toBe(15);
    expect(above.score).toBe(14); // must NOT silently drop to the worst band (0)
  });

  it('T-0.01/T/T+0.01 at the second boundary (60)', () => {
    expect(evaluateBands(59.99, bands, 15).score).toBe(14);
    expect(evaluateBands(60, bands, 15).score).toBe(14);
    expect(evaluateBands(60.01, bands, 15).score).toBe(0);
  });

  it('throws (does not silently default) when no band matches', () => {
    const gappyBands = [
      { test: atMost(50), score: 15, status: 'A', rangeLabel: '50% 이하', reason: 'r' },
      { test: (v) => v >= 51, score: 14, status: 'B', rangeLabel: '51% 이상', reason: 'r' },
    ];
    expect(() => evaluateBands(50.3, gappyBands, 15)).toThrow();
  });

  it('throws for NaN input instead of returning the last band', () => {
    expect(() => evaluateBands(NaN, bands, 15)).toThrow();
  });

  it('every value in a dense sweep resolves to a defined band (no gaps) via priority order', () => {
    // Bands are a cascading-priority list (first match wins), so predicates may overlap -
    // the real invariant is that evaluateBands always finds a match and never throws.
    for (let v = 0; v <= 100; v += 0.13) {
      expect(() => evaluateBands(v, bands, 15)).not.toThrow();
    }
  });
});

describe('pctOrNA / divOrNA', () => {
  it('returns null when denominator is 0 (percentage ratio)', () => {
    expect(pctOrNA(100, 0)).toBeNull();
  });

  it('returns null when both numerator and denominator are 0', () => {
    expect(pctOrNA(0, 0)).toBeNull();
  });

  it('returns null when denominator is an empty string / null / undefined', () => {
    expect(pctOrNA(100, '')).toBeNull();
    expect(pctOrNA(100, null)).toBeNull();
    expect(pctOrNA(100, undefined)).toBeNull();
  });

  it('returns a real percentage when denominator is nonzero', () => {
    expect(pctOrNA(50, 200)).toBe(25);
  });

  it('divOrNA returns a plain ratio (not multiplied by 100)', () => {
    expect(divOrNA(600, 100)).toBe(6);
    expect(divOrNA(600, 0)).toBeNull();
  });
});

describe('notCalculableResult', () => {
  it('returns the required N/A shape', () => {
    const r = notCalculableResult(15, '소득이 0원이어서 산출할 수 없습니다.');
    expect(r).toMatchObject({
      rawValue: null,
      displayValue: null,
      score: null,
      maxScore: 15,
      notCalculable: true,
      reason: '소득이 0원이어서 산출할 수 없습니다.',
    });
  });
});
