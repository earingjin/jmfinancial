import { describe, expect, it } from 'vitest';
import { assertFiniteCalculationResult } from './finite.js';
import { buildLifestyleTrack, LIFESTYLE_TIERS } from './lifestyleTiers.js';

describe('buildLifestyleTrack', () => {
  it('returns no NaN or Infinity anywhere in the API response value', () => {
    expect(() => assertFiniteCalculationResult(buildLifestyleTrack(300))).not.toThrow();
  });

  it('returns null for the unbounded affluent segment max', () => {
    const track = buildLifestyleTrack(300);
    expect(track.segments.find((tier) => tier.key === 'affluent')?.max).toBeNull();
  });

  it('returns null for currentTier.max when the affluent tier is selected', () => {
    expect(buildLifestyleTrack(700).currentTier).toMatchObject({ key: 'affluent', max: null });
  });

  it.each([
    [699.99, 'affluent'],
    [700, 'affluent'],
    [700.01, 'affluent'],
  ])('preserves the tier at %s만원', (amount, expectedKey) => {
    expect(buildLifestyleTrack(amount).currentTier.key).toBe(expectedKey);
  });

  it('keeps Infinity only in the internal affluent tier definition', () => {
    expect(LIFESTYLE_TIERS.find((tier) => tier.key === 'affluent')?.max).toBe(Infinity);
  });
});
