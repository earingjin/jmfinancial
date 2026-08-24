import { describe, expect, it } from 'vitest';
import { buildCashFlowOutlookFeedback, buildExecutiveFinancialPositionFeedback, buildExecutiveRetirementFeedback, buildFinancialCashFlowFeedback, buildPeerComparisonFeedback, buildSavingsInvestmentFeedback } from './executiveSummary.js';

const indicator = (key, status, notCalculable = false) => ({
  key,
  status,
  notCalculable,
  rawValue: key === 'household' ? 50 : 30,
});
const aggregates = (overrides = {}) => ({
  householdMonthlyIncomeTotal: 500,
  totalExpenseMonthlyExSavings: 200,
  monthlySavings: 150,
  ...overrides,
});
const feedback = ({ expenseStatus, savingsStatus, expenseNA = false, savingsNA = false, aggregateOverrides } = {}) => (
  buildFinancialCashFlowFeedback({
    indicators: [
      indicator('household', expenseStatus, expenseNA),
      indicator('savingsRate', savingsStatus, savingsNA),
    ],
    aggregates: aggregates(aggregateOverrides),
  })
);

describe('buildFinancialCashFlowFeedback', () => {
  it('explains stable spending with strong savings', () => {
    const text = feedback({ expenseStatus: '양호', savingsStatus: '우수' });
    expect(text).toContain('소득 중 지출 50% · 저축 30%');
    expect(text).toContain('지출을 안정적으로 관리');
    expect(text).toContain('저축도 꾸준히');
  });

  it('encourages regular saving when spending is stable but savings are low', () => {
    const text = feedback({ expenseStatus: '우수', savingsStatus: '주의' });
    expect(text).toContain('지출은 소득 범위 안');
    expect(text).toContain('꾸준한 저축으로 연결');
  });

  it('prioritizes recurring-cost review when spending is high and savings are low', () => {
    const text = feedback({ expenseStatus: '주의', savingsStatus: '위험' });
    expect(text).toContain('생활비와 고정비');
    expect(text).toContain('반복적으로 나가는 비용');
  });

  it('does not give unconditional praise when spending and savings are both high', () => {
    const text = feedback({ expenseStatus: '위험', savingsStatus: '매우 우수' });
    expect(text).toContain('지출과 저축이 모두');
    expect(text).toContain('반복 가능한 현금흐름');
    expect(text).not.toContain('안정적으로 관리');
  });

  it('prioritizes the displayed cash-flow inconsistency when spending plus savings exceeds income', () => {
    const text = feedback({
      expenseStatus: '양호',
      savingsStatus: '매우 우수',
      aggregateOverrides: { householdMonthlyIncomeTotal: 355, totalExpenseMonthlyExSavings: 228.3, monthlySavings: 170 },
    });
    expect(text).toContain('지출과 저축을 합하면 현재 월소득보다 많습니다');
    expect(text).toContain('전체 자산은 줄어들 수 있습니다');
  });

  it('treats zero-income N/A results as unavailable instead of zero', () => {
    const text = feedback({
      expenseStatus: undefined,
      savingsStatus: undefined,
      expenseNA: true,
      savingsNA: true,
      aggregateOverrides: { householdMonthlyIncomeTotal: 0 },
    });
    expect(text).toContain('판단하기 어렵습니다');
    expect(text).toContain('소득 정보를 확인');
  });

  it('uses only the calculable side when one result is unavailable', () => {
    const text = feedback({ expenseStatus: undefined, savingsStatus: '우수', expenseNA: true });
    expect(text).toContain('지출이 어느 정도인지 판단하기 어렵습니다');
    expect(text).toContain('저축은 꾸준히');
  });

  it('never exposes internal metric terminology', () => {
    const messages = [
      feedback({ expenseStatus: '양호', savingsStatus: '우수' }),
      feedback({ expenseStatus: '주의', savingsStatus: '위험' }),
    ];
    for (const text of messages) {
      expect(text).not.toMatch(/가계수지지표|총저축성향지표|FHS|rawValue|score|배점|FP학회/);
    }
  });
});

describe('buildExecutiveRetirementFeedback', () => {
  it('interprets a retirement shortfall with the existing preparation rate', () => {
    const result = buildExecutiveRetirementFeedback({
      simulation: { shortfall: 2450, preparationRate: 74.56 },
      retirementAssetProjection: { assetsRemainAtLifeExpectancy: true },
    });
    expect(result.cashFlow).toContain('약 74.6%');
    expect(result.cashFlow).toContain('2,450만원이 부족');
    expect(result.cashFlow).toContain('추가 저축 계획');
  });

  it('explains what it means when assets remain through life expectancy', () => {
    const result = buildExecutiveRetirementFeedback({
      simulation: { shortfall: 0, preparationRate: 100 },
      retirementAssetProjection: { assetsRemainAtLifeExpectancy: true },
    });
    expect(result.assetGoal).toContain('기대수명까지 준비자산이 남을 전망');
    expect(result.assetGoal).toContain('정기적으로 점검');
  });

  it('turns a depletion age into an actionable interpretation', () => {
    const result = buildExecutiveRetirementFeedback({
      simulation: { shortfall: 100, preparationRate: 90 },
      retirementAssetProjection: { assetsRemainAtLifeExpectancy: false, depletionAge: 79 },
    });
    expect(result.assetGoal).toContain('79세 무렵 소진');
    expect(result.assetGoal).toContain('조정 가능한 항목');
  });

  it('does not guess when the projection cannot be calculated', () => {
    const result = buildExecutiveRetirementFeedback({
      simulation: {},
      retirementAssetProjection: { notCalculable: true },
    });
    expect(result.cashFlow).toContain('판단하기 어렵습니다');
    expect(result.assetGoal).toContain('판단하기 어렵습니다');
  });
});

describe('buildExecutiveFinancialPositionFeedback', () => {
  it('reuses the existing debt burden ratio and explains what the asset structure means', () => {
    const text = buildExecutiveFinancialPositionFeedback({
      aggregates: { totalAssets: 10000, totalDebt: 2500, netWorth: 7500 },
      indicators: [{ key: 'debtBurden', rawValue: 25, notCalculable: false }],
    });
    expect(text).toContain('부채가 차지하는 비중은 25%');
    expect(text).toContain('7,500만원이 내 자산으로 남습니다');
    expect(text).toContain('이자 부담이 큰 부채부터');
  });

  it('formats amounts of 100 million won or more in 억 and 만원 units', () => {
    const text = buildExecutiveFinancialPositionFeedback({
      aggregates: { totalAssets: 48800, totalDebt: 5000, netWorth: 43800 },
      indicators: [{ key: 'debtBurden', rawValue: 10.2459, notCalculable: false }],
    });
    expect(text).toContain('10.2%');
    expect(text).toContain('4억 3,800만원');
    expect(text).not.toContain('43,800만원');
  });

  it('prioritizes debt repayment when net worth is negative', () => {
    const text = buildExecutiveFinancialPositionFeedback({
      aggregates: { totalAssets: 3000, totalDebt: 5000, netWorth: -2000 },
    });
    expect(text).toContain('부채가 자산보다 2,000만원 많아');
    expect(text).toContain('상환 순서');
  });
});

describe('buildSavingsInvestmentFeedback', () => {
  it('uses the existing savings-rate result and explains a strong result plainly', () => {
    const text = buildSavingsInvestmentFeedback({
      indicators: [{ key: 'savingsRate', status: '우수', rawValue: 34.56, notCalculable: false }],
      age: 35,
    });
    expect(text).toContain('소득의 34.6%');
    expect(text).toContain('같은 연령대의 권장 수준(30%)보다 4.6%p 높습니다');
    expect(text).toContain('저축 습관을 유지');
  });

  it('suggests a practical next step when the savings share is low', () => {
    const text = buildSavingsInvestmentFeedback({
      indicators: [{ key: 'savingsRate', status: '주의', rawValue: 12, notCalculable: false }],
      age: 45,
    });
    expect(text).toContain('소득의 12%');
    expect(text).toContain('같은 연령대의 권장 수준(20%)보다 8%p 낮습니다');
    expect(text).toContain('반복적으로 나가는 비용');
  });

  it('describes an exact match without implying an actual peer average', () => {
    const text = buildSavingsInvestmentFeedback({
      indicators: [{ key: 'savingsRate', status: '우수', rawValue: 30, notCalculable: false }],
      age: 35,
    });
    expect(text).toContain('같은 연령대의 권장 수준(30%)과 같습니다');
    expect(text).not.toContain('또래 평균');
  });

  it('does not treat an unavailable ratio as zero', () => {
    const text = buildSavingsInvestmentFeedback({
      indicators: [{ key: 'savingsRate', notCalculable: true, rawValue: null }],
    });
    expect(text).toContain('판단하기 어렵습니다');
    expect(text).not.toContain('0%');
  });
});

describe('buildCashFlowOutlookFeedback', () => {
  const build = ({ income = 530, expense = 205, savings = 153, retirementExpense = 250 } = {}) => (
    buildCashFlowOutlookFeedback({
      indicators: [
        { key: 'household', rawValue: 38.7, notCalculable: false },
        { key: 'savingsRate', rawValue: 28.9, notCalculable: false },
      ],
      aggregates: { monthlyIncome: income, totalExpenseMonthlyExSavings: expense, monthlySavings: savings },
      simulation: { retirementLivingCostNow: retirementExpense },
    })
  );

  it('interprets current saving capacity together with a higher retirement-living-cost target', () => {
    const text = build();
    expect(text).toContain('월소득의 28.9%');
    expect(text).toContain('매월 약 172만원이 남습니다');
    expect(text).toContain('현재보다 45만원(22%) 높으므로');
    expect(text).toContain('노후 준비로 꾸준히 연결');
  });

  it('prioritizes an inconsistent cash flow over a positive interpretation', () => {
    const text = build({ income: 300, expense: 205, savings: 153 });
    expect(text).toContain('월소득보다 58만원 많습니다');
    expect(text).toContain('먼저 확인');
    expect(text).not.toContain('여유금액 일부');
  });
});

describe('buildPeerComparisonFeedback', () => {
  const metric = (percentileLabel) => ({ value: 100, average: 90, percentileLabel });

  it('summarizes all available peer comparisons in plain language', () => {
    const text = buildPeerComparisonFeedback({
      peerComparison: {
        netWorth: metric('또래 가구 평균보다 높음'),
        householdIncome: metric('또래 가구 평균보다 낮음'),
        financialAssets: metric('또래 가구 평균보다 높음'),
      },
    });
    expect(text).toContain('순자산은 또래 평균보다 높은 편');
    expect(text).toContain('연소득은 또래 평균보다 낮은 편');
    expect(text).toContain('금융자산은 또래 평균보다 높은 편');
  });

  it('gives a practical suggestion when financial assets are below average', () => {
    const text = buildPeerComparisonFeedback({
      peerComparison: {
        netWorth: metric('또래 가구 평균보다 높음'),
        householdIncome: metric('또래 가구 평균보다 높음'),
        financialAssets: metric('또래 가구 평균보다 낮음'),
      },
    });
    expect(text).toContain('활용하기 쉬운 자산');
  });

  it('handles missing comparison data without guessing', () => {
    const text = buildPeerComparisonFeedback({ peerComparison: {} });
    expect(text).toContain('비교하기 어렵습니다');
  });
});
