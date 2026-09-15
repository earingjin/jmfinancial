import { describe, expect, it } from 'vitest';
import { getPensionSourcePresentation } from './summaryPresentation';

const component = (key, inclusionStatus, amount = 0) => ({ key, inclusionStatus, amount });

describe('pension source presentation', () => {
  it('shows that no pension is being received only when the snapshot is calculable', () => {
    expect(getPensionSourcePresentation({ calculable: true, components: [component('self.nationalPension', 'beforeStart')] }).summary)
      .toBe('해당 시점에 수령 중인 연금 없음');
    expect(getPensionSourcePresentation({ calculable: false, components: [component('self.nationalPension', 'unknown')] }).summary)
      .toBeNull();
  });

  it('shows spouse national pension alone at the self retirement point', () => {
    const result = getPensionSourcePresentation({
      calculable: true,
      pensionBreakdown: { components: [
        component('self.nationalPension', 'beforeStart'),
        component('spouse.nationalPension', 'included', 123),
      ] },
    });
    expect(result.summary).toBe('배우자 국민연금 포함');
  });

  it('shows only the self pensions actually being paid at the national-pension start point', () => {
    const result = getPensionSourcePresentation({
      calculable: true,
      components: [
        component('self.nationalPension', 'included', 130),
        component('self.personalPension', 'included', 50),
        component('spouse.nationalPension', 'beforeStart'),
      ],
    });
    expect(result.summary).toBe('본인 국민연금 · 본인 개인연금 포함');
    expect(result.sources.map(({ amount }) => amount)).toEqual([130, 50]);
  });

  it('shows both spouses while excluding ended, not-started, and zero pensions', () => {
    const result = getPensionSourcePresentation({
      calculable: true,
      components: [
        component('self.nationalPension', 'included', 130),
        component('spouse.nationalPension', 'included', 90),
        component('self.personalPension', 'afterEnd', 0),
        component('spouse.personalPension', 'beforeStart', 0),
        component('self.retirementPension', 'zero', 0),
      ],
    });
    expect(result.summary).toBe('본인 국민연금 · 배우자 국민연금 포함');
  });

  it('omits the source copy for saved results that do not have components', () => {
    expect(getPensionSourcePresentation({ calculable: true }).summary).toBeNull();
  });
});
