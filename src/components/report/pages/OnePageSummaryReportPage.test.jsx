import React from 'react';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import OnePageSummaryReportPage from './OnePageSummaryReportPage';
import { RetirementSummaryCard } from '../../summary/SimpleSummaryReport';
import { getFinancialHealthExplanation, getFinancialHealthStatus, getFinancialIndicatorInterpretation } from '../../summary/summaryPresentation';

globalThis.React = React;

function buildResult() {
  return {
    generatedAt: '2026-09-08T00:00:00.000Z',
    aggregates: {
      monthlyLivingCost: 280,
      totalAssets: 50000,
      totalDebt: 10000,
      netWorth: 40000,
    },
    indicators: [
      { key: 'household', value: 62.5, status: '양호', ratioClass: 'good', notCalculable: false },
      { key: 'emergency', value: 4.2, status: '양호', ratioClass: 'good', notCalculable: false },
      { key: 'dsr', value: 18.4, status: '우수', ratioClass: 'good', notCalculable: false },
    ],
    webSummary: {
      overviewDetail: {
        income: { monthlyTotal: 800 },
        expense: { fixedTotal: 500, incomeMinusExpense: 300 },
        balance: { totalDebt: 10000, totalDebtNone: false },
      },
      retirementReadiness: {
        retirementAge: 65,
        yearsToRetirement: 10,
        retirementYears: 20,
        retirementLivingCostAtRetirement: 420,
        requiredAtRetirement: 90000,
        readyAssetsAtRetirement: 70000,
        shortfall: 20000,
        monthlyIncomeCompare: {
          livingCostMonthly: 430,
          nationalPensionMonthly: 300,
          severancePensionMonthly: 50,
          personalPensionMonthly: 0,
          shortfallMonthly: 80,
          calculable: true,
          nationalPensionUnknown: false,
        },
      },
      futureFinance: {
        nationalPensionStartAge: 65,
        nationalPensionStartSnapshot: {
          calculable: true,
          reason: null,
          age: 65,
          pensionIncomeMonthly: 350,
          nationalPensionMonthly: 300,
          severancePensionMonthly: 50,
          personalPensionMonthly: 0,
        },
        retirementCashFlowOutlook: [{
          age: 65,
          pensionIncome: 350,
          calculable: true,
          calculationReason: null,
        }],
        retirementAssetProjection: {
          assetsRemainAtLifeExpectancy: true,
          recoveredAfterDepletion: false,
          depletionAge: null,
        },
      },
    },
    peerComparison: {
      userBracketLabel: '50대',
      benchmarkMeta: {
        source: '가계금융복지조사',
        agency: '통계청',
        ageBasis: '50대',
        assetAndDebtAsOf: '2025년 3월',
        incomeYear: 2024,
      },
      netWorth: { value: 40000, average: 35000, percentileLabel: '또래 평균 이상' },
      householdIncome: { value: 6000, average: 5500, percentileLabel: '또래 평균 이상' },
      financialAssets: { value: 12000, average: 15000, percentileLabel: '또래 평균 미만' },
    },
  };
}

const input = {
  basic: { hasSpouse: false },
  income: { severance: { type: 'lumpsum', lumpsum: 5000, lumpsumAge: 65 } },
};

function render(result = buildResult(), sourceInput = input) {
  return renderToStaticMarkup(
    <OnePageSummaryReportPage result={result} input={sourceInput} clientName="홍길동" />,
  );
}

function renderMobileRetirement(result = buildResult()) {
  return renderToStaticMarkup(
    <RetirementSummaryCard
      rr={result.webSummary.retirementReadiness}
      futureFinance={result.webSummary.futureFinance}
    />,
  );
}

describe('OnePageSummaryReportPage', () => {
  it('계산 모듈을 import하지 않고 기존 PageFrame 한 페이지만 사용한다', async () => {
    const source = await readFile(new URL('./OnePageSummaryReportPage.jsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*(api\/_lib|calculate|futureFinance|indicators|grading|summaryOverview)[^'"]*['"]/);
    const html = render();
    expect((html.match(/class="page"/g) || [])).toHaveLength(1);
    expect(html).toContain('01 / 1');
  });

  it('모바일과 같은 재무·은퇴 상태 문구와 대표 재무지표 3개를 표시한다', () => {
    const html = render();
    const mobileHtml = renderMobileRetirement();
    const indicators = buildResult().indicators;
    const financialHealth = getFinancialHealthStatus(indicators);
    expect(html).toContain('01. 종합 결과');
    expect(html).toContain('Part 1. 재무');
    expect(html).toContain('one-summary-result-card one-summary-result-card--financial');
    expect(html).toContain('현재 재무상태</span><strong>전반적으로 안정적</strong>');
    expect(html).toContain(getFinancialHealthExplanation(indicators, financialHealth.detail));
    expect(html).toContain('매달 소득 중 지출 비율');
    expect(html).toContain('62.5%');
    expect(html).toContain('비상자금으로 버틸 수 있는 기간');
    expect(html).toContain('4.2개월');
    expect(html).toContain('매달 소득 중 빚 갚는 비율');
    indicators.forEach((indicator) => {
      expect(html).toContain(getFinancialIndicatorInterpretation(indicator));
    });
    expect(html).not.toContain('>가계수지<');
    expect(html).not.toContain('>비상예비금<');
    expect(html).not.toContain('>DSR<');
    expect(html).toContain('Part 2. 은퇴');
    expect(html).toContain('예상 자산 유지 기간</span><strong>기대수명까지 유지</strong>');
    expect(html).not.toContain('현재 계획을 유지하면 기대수명까지 준비자산이 유지될 것으로 예상됩니다.');
    expect(html).toContain('월 생활비 충당 <i aria-hidden="true">·</i> 은퇴 시점 기준');
    expect(html).toContain('은퇴 목표생활비(물가 반영)</b>420만원');
    expect(html).toContain('은퇴 시점 예상 연금소득</b>350만원');
    expect(html).toContain('<strong>→ 월 70만원 부족</strong>');
    expect(html).toContain('월 생활비 충당 <i aria-hidden="true">·</i> 국민연금 수령 후 기준');
    expect(html).toContain('국민연금 수령 시점</b>65세');
    ['현재 계획을 유지하면 기대수명까지', '은퇴 목표생활비(물가 반영)', '420만원', '350만원', '월 70만원 부족', '65세'].forEach((text) => {
      expect(mobileHtml).toContain(text);
    });
    expect((html.match(/one-summary-monthly-coverage"/g) || [])).toHaveLength(2);
    expect(html).not.toContain('현재 월 생활비');
    expect(html).toContain('진단 당시의 재무상태와 은퇴 준비상태를 한 장에 담았습니다.');
  });

  it('good 지표의 사용자 해석과 기존 값을 함께 표시한다', () => {
    const result = buildResult();
    result.indicators.find((indicator) => indicator.key === 'dsr').value = 0;
    const html = render(result);

    result.indicators.forEach((indicator) => {
      expect(html).toContain(getFinancialIndicatorInterpretation(indicator));
    });
    expect(html).toContain('62.5%');
    expect(html).toContain('4.2개월');
    expect(html).toContain('0%');
    expect(html).toContain('현재 재무상태</span><strong>전반적으로 안정적</strong>');
  });

  it.each([
    ['caution', '보통'],
    ['risk', '위험'],
  ])('%s 지표도 공통 helper와 같은 해석을 표시한다', (ratioClass, status) => {
    const result = buildResult();
    const household = result.indicators.find((indicator) => indicator.key === 'household');
    household.ratioClass = ratioClass;
    household.status = status;

    const html = render(result);
    expect(html).toContain(getFinancialIndicatorInterpretation(household));
    if (ratioClass === 'caution') {
      expect(html).toContain('현재 재무상태</span><strong>일부 점검 필요</strong>');
    }
  });

  it('notCalculable 지표는 공통 fallback을 표시하고 다른 값과 기존 제목 구조를 유지한다', () => {
    const result = buildResult();
    const household = result.indicators.find((indicator) => indicator.key === 'household');
    household.notCalculable = true;
    household.value = null;
    const html = render(result);

    expect(html).toContain(getFinancialIndicatorInterpretation(household));
    expect(html).toContain('4.2개월');
    expect(html).toContain('18.4%');
    expect(html).toContain('현재 재무상태</span><strong>전반적으로 안정적</strong>');
  });

  it('기존 은퇴 상태 문구의 동적 소진 예상 나이를 핵심 결과로 표시한다', () => {
    const result = buildResult();
    result.webSummary.futureFinance.retirementAssetProjection = {
      assetsRemainAtLifeExpectancy: false,
      recoveredAfterDepletion: false,
      depletionAge: 76,
    };
    const html = render(result);
    const mobileHtml = renderMobileRetirement(result);
    expect(html).toContain('예상 자산 유지 기간</span><strong>약 76세</strong>');
    expect(mobileHtml).toContain('약 76세');
    expect(html).not.toContain('현재 계획을 유지하면 준비자산이 소진될 것으로 예상됩니다.');
    expect(html).toContain('<strong>→ 월 70만원 부족</strong>');
  });

  it('예상 연금소득이 목표 생활비보다 크면 기존 값의 표시용 차이를 여유로 보여준다', () => {
    const result = buildResult();
    result.webSummary.retirementReadiness.retirementLivingCostAtRetirement = 300;
    result.webSummary.futureFinance.retirementCashFlowOutlook = [{
      age: 65,
      pensionIncome: 350,
      calculable: true,
      calculationReason: null,
    }];
    expect(render(result)).toContain('<strong>→ 월 50만원 여유</strong>');
    expect(renderMobileRetirement(result)).toContain('→ 월 50만원 여유');
  });

  it('예상 연금소득과 목표 생활비가 같으면 충당 가능으로 표시한다', () => {
    const result = buildResult();
    result.webSummary.retirementReadiness.retirementLivingCostAtRetirement = 350;
    result.webSummary.futureFinance.retirementCashFlowOutlook = [{
      age: 65,
      pensionIncome: 350,
      calculable: true,
      calculationReason: null,
    }];
    expect(render(result)).toContain('<strong>→ 월 생활비 충당 가능</strong>');
    expect(renderMobileRetirement(result)).toContain('→ 월 생활비 충당 가능');
  });

  it('국민연금 가입기간이 불확실하면 원인을 사용자용 문구로 표시하고 0원으로 간주하지 않는다', () => {
    const result = buildResult();
    result.webSummary.futureFinance.retirementCashFlowOutlook = [{
      age: 65,
      pensionIncome: null,
      calculable: false,
      calculationReason: '국민연금 향후 가입기간을 확정할 수 없음',
    }];
    result.webSummary.futureFinance.nationalPensionStartSnapshot = {
      calculable: false,
      reason: '국민연금 향후 가입기간을 확정할 수 없음',
      age: 65,
      pensionIncomeMonthly: null,
    };
    const html = render(result);
    const mobileHtml = renderMobileRetirement(result);
    expect(html).toContain('<strong>→ 확인 필요</strong>');
    expect(html).toContain('국민연금 가입기간 확인 필요');
    expect((html.match(/국민연금 향후 가입기간을 확정할 수 없음/g) || [])).toHaveLength(1);
    expect(html).toContain('국민연금 수령 시점</b>65세');
    expect(html).not.toContain('월 0만원 부족');
    expect(mobileHtml).toContain('국민연금 가입기간 확인 필요');
    expect(mobileHtml).toContain('국민연금 수령 시점</span><b>65세</b>');
    expect(mobileHtml).toContain('→ 확인 필요');
  });

  it('확정된 연금소득 0원은 산출 불가가 아닌 정상 계산값으로 표시한다', () => {
    const result = buildResult();
    result.webSummary.futureFinance.nationalPensionStartSnapshot = {
      calculable: true,
      reason: null,
      age: 65,
      pensionIncomeMonthly: 0,
      nationalPensionMonthly: 0,
      severancePensionMonthly: 0,
      personalPensionMonthly: 0,
    };
    const html = render(result);
    const mobileHtml = renderMobileRetirement(result);
    expect(html).toContain('예상 연금소득</b>0만원');
    expect(html).toContain('<strong>→ 월 420만원 부족</strong>');
    expect(html).not.toContain('연금정보 확인 필요');
    expect(mobileHtml).toContain('예상 연금소득</span><b>0만원</b>');
    expect(mobileHtml).toContain('→ 월 420만원 부족');
  });

  it('국민연금 수령 시점이 산출 불가이면 해당 원인을 사용자용 문구로 표시한다', () => {
    const result = buildResult();
    result.webSummary.futureFinance.nationalPensionStartSnapshot = {
      calculable: false,
      reason: '국민연금 수령 시점을 확인할 수 없습니다.',
      age: null,
      pensionIncomeMonthly: null,
    };
    const html = render(result);
    const mobileHtml = renderMobileRetirement(result);
    expect(html).toContain('국민연금 수령 시점 확인 필요');
    expect(html).toContain('국민연금 수령 시점</b>확인 필요');
    expect(mobileHtml).toContain('국민연금 수령 시점 확인 필요');
    expect(mobileHtml).toContain('국민연금 수령 시점</span><b>확인 필요</b>');
  });

  it('새 스냅샷이 없는 과거 저장 결과는 최신 진단 안내를 표시한다', () => {
    const result = buildResult();
    delete result.webSummary.futureFinance.nationalPensionStartSnapshot;
    const html = render(result);
    const mobileHtml = renderMobileRetirement(result);
    expect(html).toContain('최신 기준으로 다시 진단하면 확인할 수 있습니다');
    expect(html).toContain('<strong>→ 확인 필요</strong>');
    expect(html).not.toContain('국민연금 수령 시점</b>확인 필요');
    expect(mobileHtml).toContain('최신 기준으로 다시 진단하면 확인할 수 있습니다');
    expect(mobileHtml).not.toContain('국민연금 수령 시점</span>');
  });

  it('그 밖의 산출 불가 reason은 중립적인 연금정보 안내로 표시한다', () => {
    const result = buildResult();
    result.webSummary.futureFinance.nationalPensionStartSnapshot = {
      calculable: false,
      reason: '알 수 없는 내부 사유',
      age: 65,
      pensionIncomeMonthly: null,
    };
    const html = render(result);
    expect(html).toContain('연금정보 확인 필요');
    expect(html).not.toContain('알 수 없는 내부 사유');
  });

  it('현재 재무상태는 모바일 세부내역의 핵심 총계 6개만 표시한다', () => {
    const html = render();
    expect(html).toContain('02. 현재 재무상태');
    expect(html).toContain('월 현금흐름');
    expect(html).toContain('자산 현황');
    expect(html).toContain('월 수입 합계');
    expect(html).toContain('800만원');
    expect(html).toContain('월 고정지출 합계');
    expect(html).toContain('500만원');
    expect(html).toContain('월 소득 합계 − 고정지출 합계');
    expect(html).toContain('300만원');
    expect(html).toContain('총자산');
    expect(html).toContain('총부채');
    expect(html).toContain('순자산');
    expect(html).not.toContain('현금성자산');
    expect(html).not.toContain('주택담보대출');
  });

  it('은퇴 준비 핵심 6개 값과 모바일 기준의 예정 퇴직급여 일시금을 표시한다', () => {
    const html = render();
    expect(html).toContain('03. 은퇴 준비 현황');
    expect(html).toContain('은퇴 시점');
    expect(html).toContain('은퇴자금 비교');
    expect(html).toContain('예상 은퇴 나이');
    expect(html).toContain('65세');
    expect(html).toContain('은퇴까지 남은 기간');
    expect(html).toContain('10년');
    expect(html).toContain('은퇴 후 생활 기간');
    expect(html).toContain('20년');
    expect(html).toContain('은퇴생활비 기준 필요자금');
    expect(html).toContain('9억원');
    expect(html).toContain('은퇴 시점 예상 준비자산');
    expect(html).toContain('7억원');
    expect(html).toContain('은퇴 시점 단순 비교 차이');
    expect(html).toContain('2억원');
    expect(html).toContain('참고값');
    expect(html).toContain('one-summary-record-final--secondary');
    expect(html).toContain('본인 퇴직급여 일시금 · 5,000만원 · 65세 수령 예정');
    expect(html).toContain('최종 자산 유지 전망과는 다를 수 있습니다.');
  });

  it('또래 비교는 기존 peerComparison의 3개 값과 위치를 가로 막대로 표시한다', () => {
    const html = render();
    expect(html).toContain('04. 또래와 비교');
    expect(html).toContain('one-summary-peer-comparison-list');
    expect((html.match(/one-summary-peer-row/g) || [])).toHaveLength(3);
    expect(html).toContain('one-summary-peer-bar-fill--mine" style="width:100%"');
    expect(html).toContain('one-summary-peer-bar-fill--average" style="width:87.5%"');
    expect(html).not.toContain('one-summary-peer-table');
    expect(html).toContain('또래 평균 이상');
    expect(html).toContain('또래 평균 미만');
    expect(html).toContain('가계금융복지조사(통계청)');
    expect(html).toContain('50대 평균');
  });

  it('미래 전망·그래프·상세 계산 과정은 렌더링하지 않는다', () => {
    const html = render();
    expect(html).not.toContain('5년 단위');
    expect(html).not.toContain('미래 현금흐름');
    expect(html).not.toContain('구매력');
    expect(html).not.toContain('자산 소진 전망');
    expect(html).not.toContain('내역 보기');
    expect(html).not.toContain('one-summary-retirement-diagram');
  });

  it('0원은 산출 불가로 바꾸지 않고 부채 없음 상태도 그대로 기록한다', () => {
    const result = buildResult();
    result.aggregates.totalDebt = 0;
    result.webSummary.overviewDetail.balance = { totalDebt: 0, totalDebtNone: true };
    const html = render(result);
    expect(html).toContain('부채 없음');
  });

  it('과거 저장 결과의 선택 필드가 없어도 한 페이지를 안전하게 표시한다', () => {
    const html = render({ generatedAt: null, aggregates: {}, webSummary: {}, peerComparison: {} }, null);
    expect(html).toContain('산출 불가');
    expect((html.match(/class="page"/g) || [])).toHaveLength(1);
  });

  it('페이지 하단에 기록형 진단의 안내문을 표시한다', () => {
    expect(render()).toContain('이 진단은 방향을 처방하지 않습니다. 현재의 재무상태와 은퇴 준비 정도를 이해하기 위한 진단 결과입니다.');
  });
});
