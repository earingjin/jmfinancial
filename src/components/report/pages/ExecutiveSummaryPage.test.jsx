import React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ExecutiveSummaryPage from './ExecutiveSummaryPage.jsx';

const previousReactGlobal = globalThis.React;
beforeAll(() => { globalThis.React = React; });
afterAll(() => { globalThis.React = previousReactGlobal; });

describe('ExecutiveSummaryPage', () => {
  it('renders server-provided cash-flow feedback and the shared asset sustainability judgment', () => {
    const html = renderToStaticMarkup(
      <ExecutiveSummaryPage
        simulation={{
          currentAge: 40,
          yearsToRetirement: 20,
          retirementYears: 30,
          shortfall: 100,
          retirementLivingCostNow: 250,
        }}
        aggregates={{
          totalAssets: 10000,
          totalDebt: 2000,
          netWorth: 8000,
          monthlyIncome: 500,
          householdMonthlyIncomeTotal: 500,
          totalExpenseMonthlyExSavings: 250,
          monthlySavings: 100,
        }}
        familyAges={{ self: { age: 40 }, spouse: null, children: [] }}
        retirementReadiness={null}
        retirementAssetProjection={{
          assetsRemainAtLifeExpectancy: true,
          recoveredAfterDepletion: false,
          depletionAge: null,
        }}
        feedback={{
          financialStatus: '현재 지출과 저축의 균형을 확인한 서버 피드백입니다.',
          financialPosition: '현재 자산과 부채의 관계를 확인한 서버 피드백입니다.',
          retirement: {
            cashFlow: '서버에서 해석한 은퇴생활비 준비 상태입니다.',
            assetGoal: '서버에서 해석한 은퇴자산 유지 전망입니다.',
          },
        }}
        pageNumber={1}
        totalPages={10}
      />,
    );

    expect(html).toContain('재무상태표');
    expect(html).toContain('자산</td><td class="num">1억원');
    expect(html).toContain('부채</td><td class="num">2,000만원');
    expect(html).toContain('순자산</td><td class="num">8,000만원');
    expect(html).toContain('현금흐름표');
    expect(html).toContain('수입</td><td class="num">500만원');
    expect(html).toContain('지출</td><td class="num">250만원');
    expect(html).toContain('월저축액</td><td class="num">100만원');
    expect(html).toContain('현재 지출과 저축의 균형을 확인한 서버 피드백입니다.');
    expect(html).toContain('현재 자산과 부채의 관계를 확인한 서버 피드백입니다.');
    expect(html).not.toContain('서버에서 해석한 은퇴생활비 준비 상태입니다.');
    expect(html).toContain('은퇴 시점 단순 비교');
    expect(html).toContain('참고 차이');
    expect(html).toContain('최종 자산 유지 전망과는 다를 수 있습니다.');
    expect(html).toContain('최종 은퇴 전망');
    expect(html).toContain('기대수명까지 유지');
    expect(html).toContain('기대수명까지 준비자산이 유지될 것으로 예상됩니다.');
    expect(html).not.toContain('서버에서 해석한 은퇴자산 유지 전망입니다.');
    expect(html).not.toContain('부족할 것으로 예상됩니다.');
  });
});
