import React from 'react';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import OnePageSummaryReportPage from './OnePageSummaryReportPage';

globalThis.React = React;

function buildResult() {
  return {
    generatedAt: '2026-09-08T00:00:00.000Z',
    aggregates: {
      totalAssets: 50000,
      totalDebt: 10000,
      netWorth: 40000,
      retirementIncomeByPerson: {
        self: { severanceLumpsum: 5000 },
        spouse: { severanceLumpsum: 0 },
      },
    },
    indicators: [
      { key: 'household', ratioClass: 'good', notCalculable: false },
      { key: 'emergency', ratioClass: 'good', notCalculable: false },
      { key: 'dsr', ratioClass: 'good', notCalculable: false },
    ],
    financialHealthInterpretation: { conclusion: '서버가 계산한 재무건강 종합결론' },
    aiFeedback: { executiveSummary: { retirement: { cashFlow: '서버가 계산한 은퇴 준비 종합결론' } } },
    webSummary: {
      donuts: {
        assets: { items: [
          { key: 'liquid', label: '현금성자산', value: 12000 },
          { key: 'financial', label: '금융자산', value: 18000 },
          { key: 'pension', label: '연금자산', value: 5000 },
          { key: 'realEstate', label: '부동산자산', value: 15000 },
          { key: 'otherAssets', label: '기타 자산', value: 0 },
        ] },
        debt: { items: [
          { key: 'mortgage', label: '주택담보대출', value: 8000 },
          { key: 'carLoan', label: '차량대출', value: 2000 },
          { key: 'otherLoan', label: '기타 대출', value: 0 },
        ] },
      },
      retirementReadiness: {
        retirementAge: 65,
        requiredAtRetirement: 90000,
        readyAssetsAtRetirement: 70000,
        shortfall: 20000,
        retirementIncomeIndicator: { value: 42.4, notCalculable: false },
      },
      futureFinance: {
        targets: [
          { age: 70, pensionIncome: 350, coverageRate: 76.1 },
          { age: 80, pensionIncome: 480, coverageRate: 78.7 },
        ],
        fiveYearOutlook: [
          { age: 65, livingExpense: 400, totalIncome: 330, coverageRate: 82.5, balance: -70 },
          { age: 70, livingExpense: 460, totalIncome: 350, coverageRate: 76.1, balance: -110 },
          { age: 75, livingExpense: 530, totalIncome: 430, coverageRate: 81.1, balance: -100 },
          { age: 80, livingExpense: 610, totalIncome: 480, coverageRate: 78.7, balance: -130 },
        ],
      },
    },
    peerComparison: {
      userBracketLabel: '50대',
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

  it('기존 재무상태 판정과 기존 부족자금으로 결론형 종합 결과를 표시한다', () => {
    const html = render();
    expect(html).toContain('>양호</strong>');
    expect(html).toContain('>보완 필요</strong>');
    expect(html).toContain('예상 준비자산이 필요자금보다 2억원 부족합니다.');
    expect(html).toContain('총자산');
    expect(html).toContain('총부채');
    expect(html).toContain('순자산');
    expect(html).toContain('현금성자산');
    expect(html).toContain('주택담보대출');
    expect(html).not.toContain('기타 자산');
    expect(html).not.toContain('기타 대출');
  });

  it('필요자금·준비자산·부족자금과 존재하는 예정 일시금만 표시한다', () => {
    const html = render();
    expect(html).toContain('one-summary-retirement-diagram');
    expect(html).toContain('은퇴 시점 필요자금');
    expect(html).toContain('예상 준비자산');
    expect(html).toContain('예상 부족자금');
    expect(html).toContain('본인 5,000만원');
    expect(html).not.toContain('배우자 0만원');
  });

  it('또래 비교는 기존 비교 상태를 핵심 3개 항목에만 표시한다', () => {
    const html = render();
    expect(html).toContain('또래 비교');
    expect(html).toContain('<th>나</th><th>또래 기준</th><th>비교</th>');
    expect(html).toContain('또래 평균 이상');
    expect(html).toContain('또래 평균 미만');
  });

  it('기존 연금소득 충당률과 5년 전망 중 서버 핵심연령만 표시한다', () => {
    const html = render();
    expect(html).toContain('42.4%');
    expect(html).toContain('70세');
    expect(html).toContain('80세');
    expect(html).toContain('연금소득');
    expect(html).toContain('350만원');
    expect(html).toContain('76.1%');
    expect(html).not.toContain('65세</b>');
    expect(html).not.toContain('75세</b>');
  });

  it('제외 대상으로 지정된 섹션을 표시하지 않는다', () => {
    const html = render();
    expect(html).not.toContain('나의 재무 구성');
    expect(html).not.toContain('현재 노후소득보장률');
    expect(html).not.toContain('은퇴 시점 월소득 비교');
    expect(html).not.toContain('예상 자산 유지기간');
  });

  it('과거 저장 결과의 선택 필드가 없어도 안전하게 안내한다', () => {
    const html = render({ generatedAt: null, aggregates: {}, webSummary: {}, peerComparison: {} });
    expect(html).toContain('산출 불가');
    expect(html).toContain('기존 저장 결과에서는 5년 단위 전망을 표시할 수 없습니다.');
  });

  it('0원과 0%를 산출 불가로 바꾸지 않는다', () => {
    const result = buildResult();
    result.aggregates.totalDebt = 0;
    result.webSummary.retirementReadiness.retirementIncomeIndicator.value = 0;
    const html = render(result);
    expect(html).toContain('0만원');
    expect(html).toContain('0%');
  });

  it('은퇴 시점 충당률과 같은 연령·값의 전망은 중복 표시하지 않는다', () => {
    const result = buildResult();
    result.webSummary.futureFinance.targets = [{ age: 65, pensionIncome: 170, coverageRate: 42.4 }];
    result.webSummary.futureFinance.fiveYearOutlook = [{ age: 65, livingExpense: 400, totalIncome: 170, coverageRate: 42.4, balance: -230 }];
    const html = render(result);
    expect((html.match(/42\.4%/g) || [])).toHaveLength(1);
    expect(html).toContain('생활비의 42.4% 충당');
  });

  it('상세리포트의 제목·설명·표 디자인 문법을 재사용한다', () => {
    const html = render();
    expect(html).toContain('<h2 class="section-title">재무진단 요약 리포트</h2>');
    expect((html.match(/class="subsection-head"/g) || [])).toHaveLength(4);
    expect((html.match(/one-summary-section-description/g) || [])).toHaveLength(4);
    expect(html).toContain('class="one-summary-statement-group"');
    expect(html).toContain('class="one-summary-peer-table"');
  });
});
