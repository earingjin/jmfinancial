import React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PART1FinancialStatusPage from './PART1FinancialStatusPage.jsx';

const previousReactGlobal = globalThis.React;
beforeAll(() => { globalThis.React = React; });
afterAll(() => { globalThis.React = previousReactGlobal; });

function render(aggregates) {
  return renderToStaticMarkup(
    <PART1FinancialStatusPage
      aggregates={{
        salaryMonthly: 750,
        businessMonthly: 0,
        otherIncomeMonthly: 0,
        monthlyIncome: 750,
        annualIncome: 9000,
        monthlyRetirementIncome: 240,
        householdMonthlyIncomeTotal: 990,
        nationalPensionEligibility: { self: 'eligible', spouse: 'none' },
        monthlySavings: 0,
        retirementSavingsAnnual: 0,
        ...aggregates,
      }}
      pageNumber={3}
      totalPages={10}
    />,
  );
}

describe('PART1FinancialStatusPage income status', () => {
  it('shows current income separately from future pension income and never renders the mixed total', () => {
    const html = render();

    expect(html).toContain('현재 월 소득</td><td class="num">750만원</td>');
    expect(html).toContain('현재 연 소득</td><td class="num">9,000만원</td>');
    expect(html).toContain('예상 연금소득(참고)</td><td class="num">240만원');
    expect(html).not.toContain('입력 소득 합계');
    expect(html).not.toContain('990만원');
    expect(html).toContain('현재 받고 있는 소득을 기준으로 재무상태를 진단하며, 향후 연금은 은퇴 전망에 별도로 반영합니다.');
  });

  it('includes other regular income in current income and does not change it when pension income changes', () => {
    const withOtherIncome = render({
      salaryMonthly: 650,
      otherIncomeMonthly: 100,
      monthlyIncome: 750,
      annualIncome: 9000,
      monthlyRetirementIncome: 900,
      householdMonthlyIncomeTotal: 1650,
    });

    expect(withOtherIncome).toContain('기타(임대소득 · 배당금 등)</td><td class="num">100만원</td>');
    expect(withOtherIncome).toContain('현재 월 소득</td><td class="num">750만원</td>');
    expect(withOtherIncome).toContain('예상 연금소득(참고)</td><td class="num">900만원');
    expect(withOtherIncome).not.toContain('1,650만원');
  });
});
