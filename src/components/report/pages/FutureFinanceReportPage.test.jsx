import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import FutureFinanceReportPage from './FutureFinanceReportPage';

globalThis.React = React;

describe('FutureFinanceReportPage pension sources', () => {
  it('shows source, subject, and amount from included components only', () => {
    const html = renderToStaticMarkup(<FutureFinanceReportPage
      futureFinance={{
        targets: [{
          age: 70,
          livingExpense: 300,
          pensionIncome: 180,
          coverageRate: 60,
          balance: -120,
          calculable: true,
          pensionBreakdown: { components: [
            { key: 'self.nationalPension', inclusionStatus: 'included', amount: 130 },
            { key: 'self.personalPension', inclusionStatus: 'included', amount: 50 },
            { key: 'spouse.nationalPension', inclusionStatus: 'beforeStart', amount: 0 },
          ] },
        }],
        purchasingPower: [],
        assumptions: {},
      }}
      pageNumber={1}
      totalPages={1}
    />);

    expect(html).toContain('본인 국민연금 130만원');
    expect(html).toContain('본인 개인연금 50만원');
    expect(html).not.toContain('배우자 국민연금');
  });
});
