import React from 'react';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import OnePageSummaryReportPage from './OnePageSummaryReportPage';

globalThis.React = React;

const INDICATOR_KEYS = [
  'household', 'emergency', 'dsr', 'debtBurden', 'insurance', 'savingsRate',
  'retirementSavings', 'financialAssetRatio',
];

function buildResult() {
  return {
    generatedAt: '2026-09-08T00:00:00.000Z',
    aggregates: {
      monthlyIncome: 500,
      totalExpenseMonthlyExSavings: 300,
      monthlySavings: 100,
      totalAssets: 50000,
      totalDebt: 10000,
      netWorth: 40000,
    },
    indicators: INDICATOR_KEYS.map((key, index) => ({
      key,
      label: `테스트 지표 ${index + 1}`,
      value: Number(((index + 1) * 11.1).toFixed(1)),
      status: `서버 상태 ${index + 1}`,
      ratioClass: index % 3 === 0 ? 'good' : index % 3 === 1 ? 'caution' : 'risk',
      notCalculable: false,
      notApplicable: false,
    })),
    financialHealthInterpretation: { conclusion: '서버가 계산한 재무건강 종합결론' },
    webSummary: {
      donuts: {
        income: { total: 500 },
        expense: { total: 300 },
        assets: { total: 50000 },
        debt: { total: 10000 },
        savings: { total: 100 },
      },
      retirementReadiness: {
        retirementAge: 65,
        yearsToRetirement: 15,
        retirementYears: 25,
        requiredAtRetirement: 90000,
        readyAssetsAtRetirement: 70000,
        shortfall: 20000,
        retirementIncomeIndicator: { value: 42.4, notCalculable: false },
      },
      futureFinance: {
        targets: [
          { age: 70, livingExpense: 420, pensionIncome: 350, coverageRate: 91.2, balance: -70, calculationReason: null },
          { age: 80, livingExpense: 560, pensionIncome: 480, coverageRate: 85.7, balance: -80, calculationReason: null },
        ],
      },
    },
    peerComparison: {
      netWorth: { value: 40000, average: 35000, percentileLabel: '또래 평균 이상' },
      householdIncome: { value: 6000, average: 5500, percentileLabel: '또래 평균 이상' },
      financialAssets: { value: 12000, average: 15000, percentileLabel: '또래 평균 미만' },
    },
  };
}

function render(result = buildResult()) {
  return renderToStaticMarkup(<OnePageSummaryReportPage result={result} clientName="홍길동" />);
}

describe('OnePageSummaryReportPage', () => {
  it('계산 모듈을 import하지 않고 기존 PageFrame 한 페이지만 사용한다', async () => {
    const source = await readFile(new URL('./OnePageSummaryReportPage.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*(api\/_lib|calculate|futureFinance|indicators|grading|summaryOverview)[^'"]*['"]/);

    const html = render();
    expect((html.match(/class="page"/g) || [])).toHaveLength(1);
    expect(html).toContain('01 / 1');
  });

  it('모바일 종합 결과의 대표 3개 지표만 indicator.value와 서버 상태로 표시한다', () => {
    const html = render();
    INDICATOR_KEYS.slice(0, 3).forEach((key, index) => {
      const value = Number(((index + 1) * 11.1).toFixed(1));
      expect(html).toContain(['매달 소득 중 지출 비율', '비상자금으로 버틸 수 있는 기간', '매달 소득 중 빚 갚는 비율'][index]);
      expect(html).toContain(`서버 상태 ${index + 1}`);
      expect(html).toContain(key === 'emergency' ? `${value}개월` : `${value}%`);
    });
    INDICATOR_KEYS.slice(3).forEach((key, index) => {
      expect(html).not.toContain(`테스트 지표 ${index + 4}`);
    });
    expect(html).not.toContain('재무건강 8개 지표');
  });

  it('나의 재무 구성은 webSummary.donuts의 기존 합계만 표시한다', () => {
    const html = render();
    expect(html).toContain('나의 재무 구성');
    expect(html).toContain('월 소득 배분');
    expect(html).toContain('저축·투자 구성');
  });

  it('서버 targets에 있는 연령만 표시하고 누락된 60세를 만들지 않는다', () => {
    const html = render();
    expect(html).toContain('70세');
    expect(html).toContain('80세');
    expect(html).not.toContain('60세');
  });

  it('현재 노후소득보장률과 연령별 미래 충당률을 서로 다른 기존 값으로 표시한다', () => {
    const html = render();
    expect(html).toContain('42.4%');
    expect(html).toContain('91.2%');
    expect(html).toContain('85.7%');
  });

  it('calculationReason이 있으면 산출 불가 상태와 서버 사유를 표시한다', () => {
    const result = buildResult();
    result.webSummary.futureFinance.targets = [{
      age: 80,
      livingExpense: 560,
      pensionIncome: null,
      coverageRate: null,
      balance: null,
      calculationReason: '국민연금 향후 가입기간을 확정할 수 없음',
    }];
    const html = render(result);
    expect(html).toContain('산출 불가 사유: 국민연금 향후 가입기간을 확정할 수 없음');
    expect((html.match(/산출 불가/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it('0원과 0%를 산출 불가로 바꾸지 않는다', () => {
    const result = buildResult();
    result.aggregates.monthlyIncome = 0;
    result.indicators[0].value = 0;
    result.webSummary.retirementReadiness.retirementIncomeIndicator.value = 0;
    result.webSummary.futureFinance.targets = [{
      age: 70, livingExpense: 0, pensionIncome: 0, coverageRate: 0, balance: 0, calculationReason: null,
    }];
    const html = render(result);
    expect(html).toContain('0만원');
    expect(html).toContain('0%');
    expect(html).toContain('0만원 여유');
  });
});
