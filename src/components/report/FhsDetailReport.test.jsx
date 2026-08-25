import React from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FhsDetailReport from './FhsDetailReport.jsx';
import { calcIndicators } from '../../../api/_lib/indicators.js';
import { enrichIndicators } from '../../../api/_lib/reportEnrichment.js';
import { buildCanonicalInput } from '../../../api/_lib/canonicalInput.js';
import { initialFormData } from '../../state/initialFormData.js';

const previousReactGlobal = globalThis.React;
beforeAll(() => { globalThis.React = React; });
afterAll(() => { globalThis.React = previousReactGlobal; });

// api/calculate.js와 동일한 경로(calcIndicators → enrichIndicators)로 실제 지표를 만들어서,
// 손으로 만든 가짜 데이터가 실제 응답 구조와 어긋날 위험 없이 컴포넌트를 검증한다.
function buildIndicators({ withIncome }) {
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
  }

  // buildCanonicalInput은 각 합계 필드를 세부 입력으로부터 다시 계산하므로, 세부값을 전부 채운
  // 뒤에 마지막으로 한 번만 호출해야 한다(api/calculate.js와 동일한 순서).
  const input = buildCanonicalInput(raw);
  const { indicators, totalScore, weakest, strongest, aggregates } = calcIndicators(input);
  const retirementLivingCost = 300;
  return enrichIndicators({ indicators, totalScore, weakest, strongest, aggregates, retirementLivingCost }).indicators;
}

describe('FhsDetailReport', () => {
  it('산출 불가 상태에서도 9개 지표를 카테고리 4페이지로 렌더링한다', () => {
    const indicators = buildIndicators({ withIncome: false });
    const html = renderToStaticMarkup(
      <FhsDetailReport
        result={{ generatedAt: '2026-08-25T00:00:00.000Z', indicators }}
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
    expect(html).toContain('재무건강지수 9개 지표 요약');
    expect(html).toContain('재무건강지수란?');
    expect(html).toContain('보완할 항목의 우선순위');
    expect(html).toContain('산출 불가');
    expect(html).toContain('01 / 5');
    expect(html).toContain('overview-card-missing');
    expect(html).toContain(household.reason);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });

  it('산출 가능한 지표는 게이지·구간표·권장기준 문구를 함께 보여준다', () => {
    const indicators = buildIndicators({ withIncome: true });
    const household = indicators.find((ind) => ind.key === 'household');
    expect(household.notCalculable).toBe(false);

    const html = renderToStaticMarkup(
      <FhsDetailReport
        result={{ generatedAt: '2026-08-25T00:00:00.000Z', indicators }}
        onRestart={() => {}}
        onBack={() => {}}
        onHome={() => {}}
        clientName="테스트"
      />
    );

    expect(html).toContain('gauge-track');
    expect(html).toContain(`${household.score} / ${household.maxScore}점`);
    expect(html).toContain('05 / 5');
    expect(html).toContain('gauge-fill');
    expect(html).toContain('indicator-benchmark-table');
    expect(html).toContain(household.guideline);
    expect(html).toContain('다시 입력하기');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });
});
