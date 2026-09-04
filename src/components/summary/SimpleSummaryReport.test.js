import { describe, it, expect } from 'vitest';
import { formatAssetProjectionOutlook, formatAssetProjectionReason, formatPensionIncomeAtRetirement, formatRetirementLivingCostBasis, getFinancialHealthStatus } from './summaryPresentation';

// getFinancialHealthStatus는 새 재무점수·임계값을 만들지 않고, 서버가 이미 계산한
// ratioClass(good/caution/risk)만 세어 화면 문구를 고르는 순수 표시 헬퍼다.
// FHS 점수·등급 산출 자체는 api/_lib/indicators.test.js가 검증한다.
describe('getFinancialHealthStatus', () => {
  const good = { ratioClass: 'good', notCalculable: false };
  const caution = { ratioClass: 'caution', notCalculable: false };
  const risk = { ratioClass: 'risk', notCalculable: false };
  const na = { ratioClass: 'na', notCalculable: true };

  it('모든 대표지표가 good이면 안정 문구를 반환한다', () => {
    expect(getFinancialHealthStatus([good, good, good]).icon).toBe('😊');
  });

  it('caution이 하나라도 있으면 일부 점검 문구를 반환한다', () => {
    expect(getFinancialHealthStatus([good, caution, good]).icon).toBe('🙂');
  });

  it('risk가 1개면 일부 점검 문구(🙂)로 처리한다', () => {
    expect(getFinancialHealthStatus([good, risk, good]).icon).toBe('🙂');
  });

  it('risk가 2개 이상이면 우선 점검 문구(😥)를 반환한다', () => {
    expect(getFinancialHealthStatus([risk, risk, good]).icon).toBe('😥');
  });

  it('대표지표가 모두 notCalculable(N/A)이면 정보 부족 문구를 반환하고 크래시하지 않는다', () => {
    expect(getFinancialHealthStatus([na, na, na]).icon).toBe('🤔');
  });

  it('빈 배열이나 undefined가 들어와도 안전하게 정보 부족 문구를 반환한다(과거 저장 결과 호환)', () => {
    expect(getFinancialHealthStatus([]).icon).toBe('🤔');
    expect(getFinancialHealthStatus(undefined).icon).toBe('🤔');
  });

  it('notCalculable 지표는 카운트에서 제외하고 나머지 known 지표만으로 판정한다', () => {
    // na 1개 + good 2개 → known은 good만 2개 → 안정 문구
    expect(getFinancialHealthStatus([na, good, good]).icon).toBe('😊');
  });
});

describe('formatAssetProjectionReason', () => {
  it('explains a declining balance as spending the prepared assets', () => {
    const text = formatAssetProjectionReason({
      points: [{ startingBalance: 1000, endingBalance: 900 }, { startingBalance: 900, endingBalance: 700 }],
    });
    expect(text).toContain('준비자산에서 꺼내 쓰기 때문에');
  });

  it('explains a growing balance as income and returns exceeding spending', () => {
    const text = formatAssetProjectionReason({
      points: [{ startingBalance: 1000, endingBalance: 1100 }, { startingBalance: 1100, endingBalance: 1200 }],
    });
    expect(text).toContain('남는 금액이 자산에 더해지기 때문에');
  });

  it('includes amounts, change rate, and assumptions when detailed totals are available', () => {
    const text = formatAssetProjectionReason({
      assumedReturnRate: 4,
      inflationRate: 2,
      points: [{ startingBalance: 10000, endingBalance: 9000 }, { startingBalance: 9000, endingBalance: 8000 }],
      explanation: {
        endingAssets: 8000,
        assetChange: -2000,
        assetChangeRate: -20,
        totalIncome: 5000,
        totalInvestmentReturn: 1000,
        totalLivingExpense: 7500,
        totalLumpSumExpense: 500,
        totalInflow: 6000,
        totalOutflow: 8000,
      },
    });
    expect(text).toContain('20%');
    expect(text).toContain('소득');
    expect(text).toContain('운용수익');
    expect(text).toContain('생활비');
    expect(text).toContain('연 수익률 4%');
    expect(text).toContain('물가상승률 2%');
  });
});

describe('formatAssetProjectionOutlook', () => {
  it('rounds floating-point age differences to one decimal place for display', () => {
    const text = formatAssetProjectionOutlook({
      assetsRemainAtLifeExpectancy: false,
      recoveredAfterDepletion: false,
      lifeExpectancy: 84.6,
      depletionAge: 84.00000000000001,
      lumpSumExpenseIncluded: false,
    });
    expect(text).toContain('약 0.6년 먼저');
    expect(text).not.toContain('0.599999');
  });
});

describe('formatPensionIncomeAtRetirement', () => {
  it('은퇴 시점에 받는 연금은 금액으로 표시한다', () => {
    expect(formatPensionIncomeAtRetirement(100, 'amount')).toBe('100만원');
  });

  it('수령 전·일시금·산출 불가 상태를 금액과 구분한다', () => {
    expect(formatPensionIncomeAtRetirement(0, 'beforeStart', [{ startAge: 65, monthly: 90 }])).toBe('수령 전 · 65세부터 월 90만원');
    expect(formatPensionIncomeAtRetirement(0, 'lumpSum')).toBe('일시금 수령 예정');
    expect(formatPensionIncomeAtRetirement(null, 'notCalculable')).toBe('산출 불가');
  });

  it('실제 0원은 0만원으로 유지한다', () => {
    expect(formatPensionIncomeAtRetirement(0, 'zero')).toBe('0만원');
  });
});

describe('formatRetirementLivingCostBasis', () => {
  it('현재가치 생활비와 물가 반영 은퇴 시점 생활비의 관계를 설명한다', () => {
    expect(formatRetirementLivingCostBasis({
      livingCostMonthly: 200,
      retirementLivingCostAtRetirement: 431.3,
      inflationRate: 3,
    })).toBe('현재 입력한 월 필요생활비 200만원을 기준으로, 은퇴까지 연 3% 물가상승률을 반영하면 은퇴 시점에는 월 431.3만원이 필요하다고 계산했습니다.');
  });
});
