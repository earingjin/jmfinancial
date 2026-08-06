import { describe, it, expect } from 'vitest';
import { buildSavingsBreakdown } from './reportBreakdowns.js';

describe('buildSavingsBreakdown - all savingsPlan.breakdown categories are covered', () => {
  // Step3Savings.jsx's SAVINGS_CATEGORIES lists 8 breakdown keys (installment, isa,
  // variableAnnuity, pensionSavings, irp, subscription, stocks, parkingAccount) and
  // SavingsBreakdownField sums ALL of them into assets.savingsPlan.monthly (and thus
  // aggregates.monthlySavings). If a category is missing from this file's label map,
  // a user who only filled that one category gets monthlySavings > 0 but an empty
  // breakdown - the summary donut then wrongly shows the "no detail entered" placeholder.
  it('includes 변액연금(variableAnnuity) even when it is the only category filled in', () => {
    const items = buildSavingsBreakdown({
      assets: { savingsPlan: { breakdown: { variableAnnuity: 40 }, customItems: [] } },
    });
    expect(items.reduce((s, it) => s + it.value, 0)).toBe(40);
  });

  it('includes 연금저축(pensionSavings) even when it is the only category filled in', () => {
    const items = buildSavingsBreakdown({
      assets: { savingsPlan: { breakdown: { pensionSavings: 25 }, customItems: [] } },
    });
    expect(items.reduce((s, it) => s + it.value, 0)).toBe(25);
  });
});

function makeInput(savingsPlanOverrides = {}) {
  return {
    assets: {
      savingsPlan: {
        breakdown: { installment: 50 },
        customItems: [],
        retirementMonthly: 30,
        ...savingsPlanOverrides,
      },
    },
  };
}

describe('buildSavingsBreakdown - custom items use the correct amount field', () => {
  // SavingsBreakdownField.jsx's addCustomItem() creates items shaped
  // { name, monthly, remainingMonths, interestRate, accumulated } - the amount lives in
  // `monthly`, not `amount` (that's DebtBreakdownField's shape, which uses `principal`).
  // A custom savings item ("기타 저축", e.g. 저축보험) with no matching preset category
  // must still show up here, or a user who only used custom items sees an empty breakdown
  // despite aggregates.monthlySavings being > 0.
  it('reads the amount from item.monthly, not item.amount', () => {
    const items = buildSavingsBreakdown({
      assets: {
        savingsPlan: {
          breakdown: {},
          customItems: [{ name: '저축보험', monthly: 35, remainingMonths: 60, interestRate: 2, accumulated: 500 }],
        },
      },
    });
    expect(items).toEqual([{ key: 'custom-0', label: '저축보험', value: 35 }]);
  });

  it('omits a custom item with monthly=0', () => {
    const items = buildSavingsBreakdown({
      assets: {
        savingsPlan: { breakdown: {}, customItems: [{ name: '저축보험', monthly: 0 }] },
      },
    });
    expect(items).toEqual([]);
  });
});

describe('buildSavingsBreakdown - retirementIncludedInTotal consistency', () => {
  it('included (default): does not add a separate retirement slice (retirement is already inside the general breakdown)', () => {
    const items = buildSavingsBreakdown(makeInput());
    const sum = items.reduce((s, it) => s + it.value, 0);
    expect(sum).toBe(50);
  });

  it('included=true: same as default, no separate retirement slice', () => {
    const items = buildSavingsBreakdown(makeInput({ retirementIncludedInTotal: true }));
    const sum = items.reduce((s, it) => s + it.value, 0);
    expect(sum).toBe(50);
  });

  it('included=false: adds a retirement slice so the breakdown sum matches aggregates.monthlySavings (general + retirement)', () => {
    const items = buildSavingsBreakdown(makeInput({ retirementIncludedInTotal: false }));
    const sum = items.reduce((s, it) => s + it.value, 0);
    expect(sum).toBe(80);
  });

  it('included=false with retirementMonthly=0: no zero-value slice is added', () => {
    const items = buildSavingsBreakdown(makeInput({ retirementIncludedInTotal: false, retirementMonthly: 0 }));
    expect(items.find((it) => it.key === 'retirement')).toBeUndefined();
  });
});
