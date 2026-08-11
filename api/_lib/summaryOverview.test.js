import { describe, it, expect } from 'vitest';
import { buildAggregates } from './aggregate.js';
import { calcRetirementSimulation } from './simulation.js';
import { calcIndicators } from './indicators.js';
import {
  buildFinancialOverviewCards,
  buildFinancialOverviewDetail,
  buildIncomeDonut,
  buildExpenseDonut,
  buildAssetDonut,
  buildDebtDonut,
  buildSavingsDonut,
  buildRetirementReadiness,
} from './summaryOverview.js';

function deepMerge(base, override) {
  if (Array.isArray(override)) return override;
  if (typeof override !== 'object' || override === null) return override;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base?.[key], override[key]);
  }
  return result;
}

const FULL_INPUT = {
  basic: { birthYear: 1985, retirementAge: 65, lifeExpectancy: 90, assumedReturnRate: 3 },
  income: {
    business: { monthly: 50 },
    severance: { type: 'lumpsum', lumpsum: 5000 },
    nationalPension: { monthly: 90, months: 240 },
    personalPension: { type: 'installment', monthly: 15, months: 120 },
    otherIncomes: [],
  },
  spouse: {},
  expense: {
    retirementLivingCost: 320,
    housingCost: 10,
    healthInsurance: { monthly: 8 },
    medical: { annual: 0 },
    otherExpenses: [],
    children: [],
  },
  assets: {
    currentIncome: { monthly: 400 },
    currentLivingCost: { monthly: 180 },
    liquidAssets: { total: 2000 },
    financialAssets: { stocks: 800, funds: 200, other: 0 },
    pensionAssets: 500,
    realEstateAssets: { total: 30000 },
    debtStatus: { totalBalance: 5000, monthlyRepayment: 40 },
    insurance: { monthlyPremium: 38 },
    savingsPlan: { monthly: 150, annual: 1800, retirementMonthly: 90, retirementAnnual: 1080 },
  },
  scenarios: {},
};

function input(overrides = {}) {
  return deepMerge(FULL_INPUT, overrides);
}

function calc(inp) {
  const aggregates = buildAggregates(inp);
  const simulation = calcRetirementSimulation(inp);
  const { indicators } = calcIndicators(inp);
  return { aggregates, simulation, indicators };
}

describe('buildFinancialOverviewCards', () => {
  it('shows every value (including genuine 0) when all inputs are present', () => {
    const { aggregates } = calc(input());
    const cards = buildFinancialOverviewCards(input(), aggregates);
    const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
    expect(byKey.totalAssets.missing).toBe(false);
    expect(byKey.netWorth.missing).toBe(false);
    expect(byKey.netWorth.value).toBe(aggregates.netWorth);
    expect(byKey.totalAssets.highlight).toBe(true);
    expect(byKey.totalDebt.highlight).toBe(true);
    expect(byKey.netWorth.highlight).toBe(true);
  });

  it('marks a card missing (input 필요) when its whole section was never touched, not showing 0', () => {
    const blankPension = input({ assets: { pensionAssets: '' } });
    const { aggregates } = calc(blankPension);
    const cards = buildFinancialOverviewCards(blankPension, aggregates);
    const pensionCard = cards.find((c) => c.key === 'pensionAssets');
    expect(pensionCard.missing).toBe(true);
    expect(pensionCard.value).toBeNull();
  });

  it('shows a real entered 0 as 0, not as missing', () => {
    const zeroPension = input({ assets: { pensionAssets: 0 } });
    const { aggregates } = calc(zeroPension);
    const cards = buildFinancialOverviewCards(zeroPension, aggregates);
    const pensionCard = cards.find((c) => c.key === 'pensionAssets');
    expect(pensionCard.missing).toBe(false);
    expect(pensionCard.value).toBe(0);
  });

  it('does not mark financialAssets/totalAssets/netWorth missing when only bonds is filled in', () => {
    const bondsOnly = input({ assets: { financialAssets: { stocks: '', funds: '', other: '', bonds: 40 } } });
    const { aggregates } = calc(bondsOnly);
    const cards = buildFinancialOverviewCards(bondsOnly, aggregates);
    const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
    expect(byKey.financialAssets.missing).toBe(false);
    expect(byKey.financialAssets.value).toBe(40);
    expect(byKey.totalAssets.missing).toBe(false);
    expect(byKey.netWorth.missing).toBe(false);
  });

  it('flags negative net worth as a risk state, not hidden or clamped', () => {
    const heavyDebt = input({ assets: { debtStatus: { totalBalance: 999999, monthlyRepayment: 40 } } });
    const { aggregates } = calc(heavyDebt);
    const cards = buildFinancialOverviewCards(heavyDebt, aggregates);
    const netWorthCard = cards.find((c) => c.key === 'netWorth');
    expect(netWorthCard.value).toBeLessThan(0);
    expect(netWorthCard.risk).toBe(true);
  });
});

describe('buildIncomeDonut', () => {
  it('splits monthly income into expense/savings/unassigned categories that sum back to income', () => {
    const { aggregates } = calc(input());
    const donut = buildIncomeDonut(input(), aggregates);
    const sum = donut.items.reduce((s, it) => s + it.value, 0);
    expect(sum).toBeCloseTo(donut.total, 6);
    expect(donut.isOverspending).toBe(false);
  });

  it('flags overspending instead of a negative donut slice when expenses+savings exceed income', () => {
    const overspend = input({ assets: { currentIncome: { monthly: 10 }, currentLivingCost: { monthly: 500 } } });
    const { aggregates } = calc(overspend);
    const donut = buildIncomeDonut(overspend, aggregates);
    expect(donut.isOverspending).toBe(true);
    expect(donut.overspendAmount).toBeGreaterThan(0);
    // no negative values ever reach the chart data
    donut.items.forEach((it) => expect(it.value).toBeGreaterThanOrEqual(0));
  });

  it('centers the total on the actual chart-item sum (not raw income) when overspending, so the pie never implies 100% = income', () => {
    const overspend = input({ assets: { currentIncome: { monthly: 10 }, currentLivingCost: { monthly: 500 } } });
    const { aggregates } = calc(overspend);
    const donut = buildIncomeDonut(overspend, aggregates);
    const itemSum = donut.items.reduce((s, it) => s + it.value, 0);
    expect(donut.total).toBeCloseTo(itemSum, 6);
    expect(donut.total).toBeGreaterThan(aggregates.monthlyIncome);
  });

  it('never passes NaN/Infinity to chart items', () => {
    const weird = input({ assets: { currentIncome: { monthly: 'not-a-number' } } });
    const { aggregates } = calc(weird);
    const donut = buildIncomeDonut(weird, aggregates);
    donut.items.forEach((it) => expect(Number.isFinite(it.value)).toBe(true));
    expect(Number.isFinite(donut.total)).toBe(true);
  });
});

describe('buildExpenseDonut', () => {
  it('splits total expense (savings excluded) into its component categories, summing back to the total', () => {
    const { aggregates } = calc(input());
    const donut = buildExpenseDonut(aggregates);
    const sum = donut.items.reduce((s, it) => s + it.value, 0);
    expect(sum).toBeCloseTo(donut.total, 6);
    expect(donut.total).toBeCloseTo(aggregates.totalExpenseMonthlyExSavings, 6);
  });

  it('does not include savings in the total (distinct from buildIncomeDonut, which does)', () => {
    const { aggregates } = calc(input());
    const donut = buildExpenseDonut(aggregates);
    expect(donut.items.find((it) => it.key === 'savings')).toBeUndefined();
    expect(donut.total).toBeLessThan(aggregates.monthlyIncome);
  });

  it('never passes NaN/Infinity to chart items', () => {
    const weird = input({ assets: { currentLivingCost: { monthly: 'not-a-number' } } });
    const { aggregates } = calc(weird);
    const donut = buildExpenseDonut(aggregates);
    donut.items.forEach((it) => expect(Number.isFinite(it.value)).toBe(true));
    expect(Number.isFinite(donut.total)).toBe(true);
  });

  it('with no otherLivingExpenseItems (default []), keeps the plain "생활비" label - backward compatible', () => {
    const { aggregates } = calc(input());
    const donut = buildExpenseDonut(aggregates);
    expect(donut.items.find((it) => it.key === 'living').label).toBe('생활비');
  });

  it('splits named 기타지출 items out of the 생활비 slice without changing the total (already counted in monthlyLivingCost)', () => {
    const { aggregates } = calc(input({ assets: { currentLivingCost: { monthly: 180 } } }));
    const otherLivingExpenseItems = [{ key: 'other-living-0', label: '반려동물 비용', value: 10 }];
    const donut = buildExpenseDonut(aggregates, otherLivingExpenseItems);

    const livingItem = donut.items.find((it) => it.key === 'living');
    expect(livingItem.label).toBe('생활비(기타지출 제외)');
    expect(livingItem.value).toBe(170); // 180(monthlyLivingCost) - 10(기타지출)

    expect(donut.items.find((it) => it.key === 'other-living-0')).toEqual({
      key: 'other-living-0', label: '반려동물 비용', value: 10,
    });

    const sum = donut.items.reduce((s, it) => s + it.value, 0);
    expect(sum).toBeCloseTo(donut.total, 6);
    expect(donut.total).toBeCloseTo(aggregates.totalExpenseMonthlyExSavings, 6);
  });
});

describe('buildAssetDonut', () => {
  it('reuses aggregates directly with total assets at the center', () => {
    const { aggregates } = calc(input());
    const donut = buildAssetDonut(aggregates);
    expect(donut.total).toBe(aggregates.totalAssets);
    const sum = donut.items.reduce((s, it) => s + it.value, 0);
    expect(sum).toBeCloseTo(aggregates.totalAssets, 6);
  });

  it('with no otherLiquidAssetItems (default []), keeps the plain "현금성자산" label - backward compatible', () => {
    const { aggregates } = calc(input());
    const donut = buildAssetDonut(aggregates);
    expect(donut.items.find((it) => it.key === 'liquid').label).toBe('현금성자산');
  });

  it('splits named 기타 현금성자산 items out of the 현금성자산 slice without changing the total (already counted in aggregates.liquidAssets)', () => {
    const { aggregates } = calc(input({ assets: { liquidAssets: { total: 2000 } } }));
    const otherLiquidAssetItems = [{ key: 'other-liquid-0', label: '외화예금', value: 300 }];
    const donut = buildAssetDonut(aggregates, otherLiquidAssetItems);

    const liquidItem = donut.items.find((it) => it.key === 'liquid');
    expect(liquidItem.label).toBe('현금성자산(기타 제외)');
    expect(liquidItem.value).toBe(1700); // 2000(liquidAssets) - 300(기타 현금성자산)

    expect(donut.items.find((it) => it.key === 'other-liquid-0')).toEqual({
      key: 'other-liquid-0', label: '외화예금', value: 300,
    });

    const sum = donut.items.reduce((s, it) => s + it.value, 0);
    expect(sum).toBeCloseTo(donut.total, 6);
    expect(donut.total).toBeCloseTo(aggregates.totalAssets, 6);
  });
});

describe('buildDebtDonut / buildSavingsDonut', () => {
  it('shows a prompt (not a fabricated split) when total debt exists but no breakdown was entered', () => {
    const donut = buildDebtDonut([], 5000);
    expect(donut.hasBreakdown).toBe(false);
    expect(donut.isEmpty).toBe(false);
    expect(donut.items).toEqual([]);
  });

  it('shows the empty (no debt) state when total debt is genuinely 0', () => {
    const donut = buildDebtDonut([], 0);
    expect(donut.isEmpty).toBe(true);
  });

  it('uses the real breakdown items when present', () => {
    const items = [{ key: 'mortgage', label: '주담대', value: 3000 }];
    const donut = buildSavingsDonut(items, 3000);
    expect(donut.hasBreakdown).toBe(true);
    expect(donut.items).toEqual(items);
  });
});

describe('buildRetirementReadiness', () => {
  it('computes the standard fields when retirement age and living cost are present', () => {
    const scoped = input();
    const { aggregates, simulation, indicators } = calc(scoped);
    const readiness = buildRetirementReadiness({ input: scoped, simulation, indicators, aggregates });
    expect(readiness.notCalculable).toBe(false);
    expect(readiness.requiredAtRetirement).toBe(simulation.requiredAtRetirement);
    expect(readiness.readyAssetsAtRetirement).toBe(simulation.readyAssetsAtRetirement);
    expect(readiness.shortfall).toBe(simulation.shortfall);
  });

  it('gates the whole readiness block instead of showing a false 100% when retirementAge is missing', () => {
    const noRetireAge = input({ basic: { retirementAge: '' } });
    const { aggregates, simulation, indicators } = calc(noRetireAge);
    const readiness = buildRetirementReadiness({ input: noRetireAge, simulation, indicators, aggregates });
    expect(readiness.notCalculable).toBe(true);
    expect(readiness.preparationRate).toBeNull();
    expect(readiness.requiredAtRetirement).toBeNull();
    expect(readiness.reason).toMatch(/입력/);
  });

  it('gates when retirementLivingCost is missing', () => {
    const noLivingCost = input({ expense: { retirementLivingCost: '' } });
    const { aggregates, simulation, indicators } = calc(noLivingCost);
    const readiness = buildRetirementReadiness({ input: noLivingCost, simulation, indicators, aggregates });
    expect(readiness.notCalculable).toBe(true);
  });

  it('computes the national pension income-gap from the official birth-year cohort, not an invented age', () => {
    const scoped = input({ basic: { birthYear: 1985, retirementAge: 60 } });
    const { aggregates, simulation, indicators } = calc(scoped);
    const readiness = buildRetirementReadiness({ input: scoped, simulation, indicators, aggregates });
    // birthYear 1985 -> cohort '1969년 이후' -> pensionAge 65; retirementAge 60 -> gap 5
    expect(readiness.incomeGap.notCalculable).toBe(false);
    expect(readiness.incomeGap.nationalPensionStartAge).toBe(65);
    expect(readiness.incomeGap.gapYears).toBe(5);
    expect(readiness.incomeGap.hasGap).toBe(true);
  });

  it('reports no gap (not negative) when retirement age is already past the national pension start age', () => {
    const scoped = input({ basic: { birthYear: 1985, retirementAge: 70 } });
    const { aggregates, simulation, indicators } = calc(scoped);
    const readiness = buildRetirementReadiness({ input: scoped, simulation, indicators, aggregates });
    expect(readiness.incomeGap.gapYears).toBe(0);
    expect(readiness.incomeGap.hasGap).toBe(false);
  });

  it('marks the income gap as not calculable (not a guessed age) when birthYear is missing', () => {
    const noBirthYear = input({ basic: { birthYear: '' } });
    const { aggregates, simulation, indicators } = calc(noBirthYear);
    const readiness = buildRetirementReadiness({ input: noBirthYear, simulation, indicators, aggregates });
    expect(readiness.incomeGap.notCalculable).toBe(true);
    expect(readiness.incomeGap.nationalPensionStartAge).toBeNull();
    expect(readiness.incomeGap.gapYears).toBeNull();
  });

  it('floors the monthly income shortfall at 0 (never negative)', () => {
    const richPension = input({ income: { nationalPension: { monthly: 1000, months: 240 } }, expense: { retirementLivingCost: 100 } });
    const { aggregates, simulation, indicators } = calc(richPension);
    const readiness = buildRetirementReadiness({ input: richPension, simulation, indicators, aggregates });
    expect(readiness.monthlyIncomeCompare.shortfallMonthly).toBe(0);
  });

  it('passes through the existing notCalculable retirementIncome indicator unchanged (no duplicate formula)', () => {
    const noLivingCost = input({ expense: { retirementLivingCost: 0 } });
    const { aggregates, simulation, indicators } = calc(noLivingCost);
    const readiness = buildRetirementReadiness({ input: noLivingCost, simulation, indicators, aggregates });
    expect(readiness.retirementIncomeIndicator.notCalculable).toBe(true);
  });

  it('computes the total funding needed to bridge the income gap (annual living cost x gap years)', () => {
    const scoped = input({ basic: { birthYear: 1985, retirementAge: 60 }, expense: { retirementLivingCost: 200 } });
    const { aggregates, simulation, indicators } = calc(scoped);
    const readiness = buildRetirementReadiness({ input: scoped, simulation, indicators, aggregates });
    // gapYears=5 (60 -> 65), living cost 200/월 -> 2400/년 -> 12000(1억2000) over 5 years
    expect(readiness.incomeGap.gapYears).toBe(5);
    expect(readiness.incomeGap.annualGapCost).toBe(2400);
    expect(readiness.incomeGap.totalGapFundingNeeded).toBe(12000);
  });

  it('does not fabricate a funding total when the gap itself is not calculable', () => {
    const noBirthYear = input({ basic: { birthYear: '' } });
    const { aggregates, simulation, indicators } = calc(noBirthYear);
    const readiness = buildRetirementReadiness({ input: noBirthYear, simulation, indicators, aggregates });
    expect(readiness.incomeGap.annualGapCost).toBeNull();
    expect(readiness.incomeGap.totalGapFundingNeeded).toBeNull();
  });
});

describe('buildFinancialOverviewDetail - grouped card (income / expense / balance)', () => {
  it('groups income into 급여 vs 사업·기타소득 and the total matches their sum (monthly and annual)', () => {
    const scoped = input();
    const { aggregates } = calc(scoped);
    const detail = buildFinancialOverviewDetail(scoped, aggregates);
    expect(detail.income.salary).toBe(aggregates.salaryMonthly);
    expect(detail.income.businessAndOther).toBeCloseTo(aggregates.businessMonthly + aggregates.otherIncomeMonthly, 6);
    expect(detail.income.monthlyTotal).toBeCloseTo(detail.income.salary + detail.income.businessAndOther, 6);
    expect(detail.income.annualTotal).toBeCloseTo(detail.income.monthlyTotal * 12, 6);
  });

  it('groups expense into living/housing/insurance vs savings, fixedTotal is their sum', () => {
    const scoped = input();
    const { aggregates } = calc(scoped);
    const detail = buildFinancialOverviewDetail(scoped, aggregates);
    expect(detail.expense.fixedTotal).toBeCloseTo(detail.expense.livingHousingInsurance + detail.expense.savings, 6);
    expect(detail.expense.savings).toBe(aggregates.monthlySavings);
  });

  it('the three balance buckets (liquid / financial+pension / realEstate-debt) always sum exactly to net worth', () => {
    const scoped = input();
    const { aggregates } = calc(scoped);
    const detail = buildFinancialOverviewDetail(scoped, aggregates);
    const sum = detail.balance.liquid + detail.balance.financialAndPension + detail.balance.realEstateNetOfDebt;
    expect(sum).toBeCloseTo(aggregates.netWorth, 6);
    expect(detail.balance.netWorth).toBeCloseTo(aggregates.netWorth, 6);
  });

  it('still sums exactly to net worth when debt exceeds real estate (negative bucket, not clamped)', () => {
    const heavyDebt = input({ assets: { realEstateAssets: { total: 1000 }, debtStatus: { totalBalance: 9000, monthlyRepayment: 40 } } });
    const { aggregates } = calc(heavyDebt);
    const detail = buildFinancialOverviewDetail(heavyDebt, aggregates);
    expect(detail.balance.realEstateNetOfDebt).toBe(1000 - 9000);
    const sum = detail.balance.liquid + detail.balance.financialAndPension + detail.balance.realEstateNetOfDebt;
    expect(sum).toBeCloseTo(aggregates.netWorth, 6);
  });

  it('marks a line missing (not 0) when every contributing raw input is blank', () => {
    const blank = input({ assets: { currentIncome: { monthly: '' } } });
    const { aggregates } = calc(blank);
    const detail = buildFinancialOverviewDetail(blank, aggregates);
    expect(detail.income.salaryMissing).toBe(true);
  });

  it('does not mark financialAndPension missing when only bonds is filled in', () => {
    const bondsOnly = input({ assets: { financialAssets: { stocks: '', funds: '', other: '', bonds: 40 }, pensionAssets: '' } });
    const { aggregates } = calc(bondsOnly);
    const detail = buildFinancialOverviewDetail(bondsOnly, aggregates);
    expect(detail.balance.financialAndPensionMissing).toBe(false);
    expect(detail.balance.financialAndPension).toBe(40);
  });
});
