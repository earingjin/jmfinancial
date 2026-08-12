import { describe, it, expect } from 'vitest';
import { findNationalPensionCohort, getNationalPensionStartAge, NATIONAL_PENSION_COHORTS } from './pensionEligibility.js';

describe('pensionEligibility - shared official cohort table', () => {
  it('exposes all birth-year cohorts used by the form and report', () => {
    expect(NATIONAL_PENSION_COHORTS).toEqual([
      { range: '1953~1956년', from: 1953, to: 1956, retireAge: 60, pensionAge: 61, gapYears: 1 },
      { range: '1957~1960년', from: 1957, to: 1960, retireAge: 60, pensionAge: 62, gapYears: 2 },
      { range: '1961~1964년', from: 1961, to: 1964, retireAge: 60, pensionAge: 63, gapYears: 3 },
      { range: '1965~1968년', from: 1965, to: 1968, retireAge: 60, pensionAge: 64, gapYears: 4 },
      { range: '1969년 이후', from: 1969, to: Infinity, retireAge: 60, pensionAge: 65, gapYears: 5 },
    ]);
  });

  it.each([
    [1953, 61], [1956, 61],
    [1957, 62], [1960, 62],
    [1961, 63], [1964, 63],
    [1965, 64], [1968, 64],
    [1969, 65], [2000, 65],
  ])('birthYear %s -> national pension start age %s', (birthYear, expected) => {
    expect(getNationalPensionStartAge(birthYear)).toBe(expected);
  });

  it('returns null for a birth year outside every known cohort (no invented assumption)', () => {
    expect(findNationalPensionCohort(1950)).toBeNull();
    expect(getNationalPensionStartAge(1950)).toBeNull();
  });

  it('returns null for non-finite / blank input instead of guessing', () => {
    expect(getNationalPensionStartAge(NaN)).toBeNull();
    expect(getNationalPensionStartAge(undefined)).toBeNull();
  });
});
