import React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FhsDetailReport from './FhsDetailReport.jsx';
import { calcIndicators } from '../../../api/_lib/indicators.js';
import { buildFinancialHealthInterpretation, enrichIndicators } from '../../../api/_lib/reportEnrichment.js';
import { buildCanonicalInput } from '../../../api/_lib/canonicalInput.js';
import { initialFormData } from '../../state/initialFormData.js';

const previousReactGlobal = globalThis.React;
beforeAll(() => { globalThis.React = React; });
afterAll(() => { globalThis.React = previousReactGlobal; });

// api/calculate.js와 동일한 경로(calcIndicators → enrichIndicators)로 실제 지표를 만들어서,
// 손으로 만든 가짜 데이터가 실제 응답 구조와 어긋날 위험 없이 컴포넌트를 검증한다.
function buildReportData({ withIncome }) {
  const raw = JSON.parse(JSON.stringify(initialFormData));
  raw.basic.birthYear = '1975';
  raw.basic.retirementAge = 65;
  raw.basic.lifeExpectancy = 90;
  raw.basic.serviceYears = 20;
  raw.expense.retirementLivingCost = 300;
  raw.income.personalPension.startAge = 65;

  if (withIncome) {
    raw.income.salary.hasSalary = true;
    raw.income.salary.monthly = 500;
    raw.assets.currentLivingCost.monthly = 250;
    raw.assets.liquidAssets.hasAssets = true;
    raw.assets.liquidAssets.breakdown.emergencyFund = 1500;
    raw.assets.savingsPlan.breakdown.installment.monthly = 100;
    raw.assets.savingsPlan.retirementMonthly = 50;
  }

  // buildCanonicalInput은 각 합계 필드를 세부 입력으로부터 다시 계산하므로, 세부값을 전부 채운
  // 뒤에 마지막으로 한 번만 호출해야 한다(api/calculate.js와 동일한 순서).
  const input = buildCanonicalInput(raw);
  const { indicators, weakest, strongest, aggregates, currentAge } = calcIndicators(input);
  const retirementLivingCost = 300;
  const enrichedIndicators = enrichIndicators({ indicators, weakest, strongest, aggregates, retirementLivingCost, age: currentAge }).indicators;
  return {
    indicators: enrichedIndicators,
    financialHealthInterpretation: buildFinancialHealthInterpretation(enrichedIndicators),
  };
}

describe('FhsDetailReport', () => {
  it('산출 불가 상태에서도 평가 항목을 인쇄 높이에 맞춰 5개 상세 페이지로 렌더링한다', () => {
    const { indicators, financialHealthInterpretation } = buildReportData({ withIncome: false });
    const legacyInterpretation = {
      ...financialHealthInterpretation,
      categories: financialHealthInterpretation.categories.map((category) => ({
        ...category,
        summary: '입력 정보가 부족해 현재 상태를 해석하기 어렵습니다.',
        action: '관련 입력값을 확인한 뒤 다시 진단해 주세요.',
      })),
    };
    const html = renderToStaticMarkup(
      <FhsDetailReport
        result={{ generatedAt: '2026-08-25T00:00:00.000Z', indicators, financialHealthInterpretation: legacyInterpretation }}
        onRestart={() => {}}
        onBack={() => {}}
        onHome={() => {}}
        clientName="테스트"
      />
    );

    ['소비 · 유동성', '부채', '저축 · 자산', '보장 · 노후준비'].forEach((label) => {
      expect(html).toContain(label);
    });
    // 소득 정보가 없으면 가계수지 등은 notCalculable=true - 게이지 대신 산출 불가 사유를 보여준다.
    const household = indicators.find((ind) => ind.key === 'household');
    expect(household.notCalculable).toBe(true);
    expect(html).toContain('재무건강지수 평가 항목 요약');
    expect(html).toContain('한국형 가계재무비율을 참고한 8개 지표');
    expect(html).not.toContain('노후소득보장률');
    expect(html).toContain('재무건강지수란?');
    expect(html).toContain('보완할 항목의 우선순위');
    expect(html).toContain('산출 불가');
    expect(html).toContain('01 / 6');
    expect(html).toContain('저축 · 자산 (계속)');
    expect(html).toContain('소득으로 생활을 감당하고 비상상황에 버틸 수 있는가?');
    expect(html).toContain('예상치 못한 위험과 노후생활에 잘 대비하고 있는가?');
    expect(html).toContain('fhs-summary-feedback');
    expect(html).toContain('위 사유를 확인한 뒤 다시 진단해 주세요.');
    expect(html).toContain('8개 지표 종합결론');
    expect(html).toContain(`가계수지지표: ${household.reason}`);
    expect(html).not.toContain('입력 정보가 부족해 현재 상태를 해석하기 어렵습니다.');
    expect(html).toContain('overview-card-missing');
    expect(html).toContain(household.reason);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });

  it('산출 가능한 지표는 게이지·구간표·참고 범위 문구를 함께 보여준다', () => {
    const { indicators, financialHealthInterpretation } = buildReportData({ withIncome: true });
    const { scoreSummary: serverScoreSummary, ...interpretationWithoutScoreSummary } = financialHealthInterpretation;
    const household = indicators.find((ind) => ind.key === 'household');
    const retirementIncome = indicators.find((ind) => ind.key === 'retirementIncome');
    expect(household.notCalculable).toBe(false);

    const html = renderToStaticMarkup(
      <FhsDetailReport
        result={{ generatedAt: '2026-08-25T00:00:00.000Z', indicators, financialHealthInterpretation: interpretationWithoutScoreSummary }}
        onRestart={() => {}}
        onBack={() => {}}
        onHome={() => {}}
        clientName="테스트"
      />
    );

    expect(html).toContain('gauge-track');
    expect(html).toContain(`${household.score} / ${household.maxScore}점`);
    expect(html).toContain('06 / 6');
    expect(html).toContain('gauge-fill');
    expect(html).toContain('indicator-benchmark-table');
    expect(html).toContain('이 지표는');
    expect(html).toContain('현재 소득 가운데 생활과 각종 지출에 사용하는 비중');
    expect(html).toContain('참고 범위:');
    expect(household.guideline).toContain('총 소득 대비 총 지출 90% 이하');
    expect(html).toContain(household.guideline);
    expect(html).toContain('월 총지출 대비 유동성자산 5개월분 이상');
    expect(html).toContain('총 소득 대비 총 저축 10% 이상');
    const tableReasons = indicators.flatMap((indicator) => indicator.table?.map((band) => band.reason) || []);
    expect(tableReasons.every((reason) => !reason.includes('JMFinancial 참고 범위'))).toBe(true);
    const fhsKeys = new Set(['household', 'emergency', 'dsr', 'debtBurden', 'savingsRate', 'retirementSavings', 'financialAssetRatio', 'insurance']);
    const applicable = indicators.filter((indicator) => fhsKeys.has(indicator.key) && !indicator.notCalculable && !indicator.notApplicable);
    const priorities = [
      ...applicable.filter((indicator) => indicator.ratioClass === 'risk'),
      ...applicable.filter((indicator) => indicator.ratioClass === 'caution'),
    ];
    const stable = applicable.filter((indicator) => indicator.ratioClass === 'good');

    expect(html).toContain('fhs-overall-conclusion-hero');
    const totalScore = applicable.reduce((total, indicator) => total + indicator.score, 0);
    const maxScore = indicators
      .filter((indicator) => fhsKeys.has(indicator.key))
      .reduce((total, indicator) => total + indicator.maxScore, 0);
    expect(serverScoreSummary).toEqual({ score: totalScore, maxScore, notCalculable: false });
    expect(html).toContain(`총점</span><strong>${totalScore}<small> / ${maxScore}</small>`);
    expect(html).toContain(`현재는 <strong>${priorities.length}개 항목</strong>을 먼저 점검하는 것이 좋습니다.`);
    expect(html).toContain(`점검 우선</span><strong>${priorities.length}개</strong>`);
    expect(html).toContain(`안정적</span><strong>${stable.length}개</strong>`);
    expect(html).not.toContain('한눈에 보기');
    expect(html).not.toContain('fhs-overall-priority');
    expect(html).toContain('총저축성향지표');
    expect(html).toContain('보장성보험준비지표');
    expect(html).toContain('가계수지지표');
    expect(html).toContain('비상예비금지표');
    expect(retirementIncome.formula).toBe('월예상 노후소득 ÷ 은퇴후 월필요생활비 × 100');
    expect(retirementIncome.label).toBe('노후소득보장률');
    expect(html).not.toContain(retirementIncome.label);
    expect(html).not.toContain(retirementIncome.formula);
    expect(html).toContain('다시 입력하기');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });

  it('과거 저장 결과의 구간표에 남은 JMFinancial 참고 범위 문구를 중립 문구로 표시한다', () => {
    const { indicators, financialHealthInterpretation } = buildReportData({ withIncome: true });
    const household = indicators.find((indicator) => indicator.key === 'household');
    const legacyReason = 'JMFinancial 참고 범위(70% 이하) 안으로, 가계수지가 비교적 안정적인 수준';
    household.table.find((band) => band.rangeLabel === '60% 초과~70% 이하').reason = legacyReason;

    const html = renderToStaticMarkup(
      <FhsDetailReport
        result={{ generatedAt: '2026-08-25T00:00:00.000Z', indicators, financialHealthInterpretation }}
        onRestart={() => {}}
        onBack={() => {}}
        onHome={() => {}}
        clientName="테스트"
      />
    );

    expect(html).not.toContain(legacyReason);
    expect(html).toContain('가계수지가 비교적 안정적인 수준');
  });
});
