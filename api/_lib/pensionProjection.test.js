import { describe, expect, it } from 'vitest';
import { pensionIncomeSeries } from './pensionProjection.js';

describe('pensionProjection payment periods', () => {
  it('keeps national pension active after 10, 20, and 30 years despite a legacy months value', () => {
    const input = {
      income: {
        nationalPension: { monthly: 100, months: 240 },
        severance: { type: 'none' },
        personalPension: { type: 'none' },
      },
      spouse: {},
    };

    const series = pensionIncomeSeries(input, [0, 10, 20, 30]);
    series.forEach((point) => expect(point.pensionIncome).toBeGreaterThan(0));
  });

  it('still ends retirement and personal pensions after their finite receiving periods', () => {
    const input = {
      income: {
        nationalPension: { monthly: 0, months: 240 },
        severance: { type: 'pension', pensionMonthly: 100, pensionMonths: 120 },
        personalPension: { type: 'installment', monthly: 100, months: 120 },
      },
      spouse: {},
    };

    const series = pensionIncomeSeries(input, [10, 11]);
    expect(series[0].pensionIncome).toBeGreaterThan(0);
    expect(series[1].pensionIncome).toBe(0);
  });
});
