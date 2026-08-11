import { describe, it, expect } from 'vitest';
import { buildSavingsBreakdown, buildLivingExpenseItems, buildOtherLivingExpenseItems, buildOtherLiquidAssetItems } from './reportBreakdowns.js';

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

  it('reads monthly from the current object-shaped preset savings data', () => {
    const items = buildSavingsBreakdown({
      assets: {
        savingsPlan: {
          breakdown: {
            installment: { monthly: 100, remainingMonths: 24, interestRate: 1 },
          },
          customItems: [],
        },
      },
    });

    expect(items).toContainEqual({ key: 'installment', label: '적금', value: 100 });
  });

  it('continues to support legacy number-shaped preset savings data', () => {
    const items = buildSavingsBreakdown({
      assets: { savingsPlan: { breakdown: { installment: 100 }, customItems: [] } },
    });

    expect(items).toContainEqual({ key: 'installment', label: '적금', value: 100 });
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

describe('buildOtherLivingExpenseItems - "현재 생활비 상세"의 기타지출 종류별 항목을 표시용으로 뽑아낸다', () => {
  it('returns an empty array when no otherItems exist', () => {
    expect(buildOtherLivingExpenseItems({ assets: { currentLivingCost: { breakdown: {} } } })).toEqual([]);
  });

  it('returns an empty array when currentLivingCost is entirely absent', () => {
    expect(buildOtherLivingExpenseItems({ assets: {} })).toEqual([]);
  });

  it('lists a named item with its amount', () => {
    const items = buildOtherLivingExpenseItems({
      assets: { currentLivingCost: { breakdown: { otherItems: [{ name: '반려동물 비용', amount: 10 }] } } },
    });
    expect(items).toEqual([{ key: 'other-living-0', label: '반려동물 비용', value: 10 }]);
  });

  it('falls back to "기타지출" when name is blank', () => {
    const items = buildOtherLivingExpenseItems({
      assets: { currentLivingCost: { breakdown: { otherItems: [{ name: '', amount: 5 }] } } },
    });
    expect(items).toEqual([{ key: 'other-living-0', label: '기타지출', value: 5 }]);
  });

  it('omits an item with amount=0', () => {
    const items = buildOtherLivingExpenseItems({
      assets: { currentLivingCost: { breakdown: { otherItems: [{ name: '반려동물 비용', amount: 0 }] } } },
    });
    expect(items).toEqual([]);
  });

  it('lists multiple items and never double-counts against the same total (values only, no aggregation here)', () => {
    const items = buildOtherLivingExpenseItems({
      assets: {
        currentLivingCost: {
          breakdown: { otherItems: [{ name: '반려동물 비용', amount: 10 }, { name: '구독료', amount: 3 }] },
        },
      },
    });
    expect(items).toEqual([
      { key: 'other-living-0', label: '반려동물 비용', value: 10 },
      { key: 'other-living-1', label: '구독료', value: 3 },
    ]);
  });
});

describe('buildLivingExpenseItems', () => {
  it('returns every entered living-expense category and named other item', () => {
    const items = buildLivingExpenseItems({
      assets: {
        currentLivingCost: {
          breakdown: {
            rent: 50,
            food: 40,
            communication: 10,
            other: 5,
            otherItems: [{ name: '반려동물 비용', amount: 5 }],
          },
        },
      },
    });

    expect(items).toEqual([
      { key: 'living-rent', label: '월세', value: 50 },
      { key: 'living-food', label: '식비', value: 40 },
      { key: 'living-communication', label: '통신비', value: 10 },
      { key: 'other-living-0', label: '반려동물 비용', value: 5 },
    ]);
  });
});

describe('buildOtherLiquidAssetItems - "현금성 자산"의 기본 항목 외 추가(customItems)를 표시용으로 뽑아낸다', () => {
  it('returns an empty array when no customItems exist', () => {
    expect(buildOtherLiquidAssetItems({ assets: { liquidAssets: {} } })).toEqual([]);
  });

  it('returns an empty array when liquidAssets is entirely absent', () => {
    expect(buildOtherLiquidAssetItems({ assets: {} })).toEqual([]);
  });

  it('lists a named item with its amount', () => {
    const items = buildOtherLiquidAssetItems({
      assets: { liquidAssets: { customItems: [{ name: '외화예금', amount: 300 }] } },
    });
    expect(items).toEqual([{ key: 'other-liquid-0', label: '외화예금', value: 300 }]);
  });

  it('falls back to "기타 현금성자산" when name is blank', () => {
    const items = buildOtherLiquidAssetItems({
      assets: { liquidAssets: { customItems: [{ name: '', amount: 50 }] } },
    });
    expect(items).toEqual([{ key: 'other-liquid-0', label: '기타 현금성자산', value: 50 }]);
  });

  it('omits an item with amount=0', () => {
    const items = buildOtherLiquidAssetItems({
      assets: { liquidAssets: { customItems: [{ name: '외화예금', amount: 0 }] } },
    });
    expect(items).toEqual([]);
  });

  it('lists multiple items in order', () => {
    const items = buildOtherLiquidAssetItems({
      assets: { liquidAssets: { customItems: [{ name: 'ISA', amount: 100 }, { name: '파킹통장', amount: 20 }] } },
    });
    expect(items).toEqual([
      { key: 'other-liquid-0', label: 'ISA', value: 100 },
      { key: 'other-liquid-1', label: '파킹통장', value: 20 },
    ]);
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
