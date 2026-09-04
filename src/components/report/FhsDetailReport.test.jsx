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
    expect(html).toContain('한국형 가계재무 가이드라인 지표');
    expect(html).not.toContain('노후소득보장률');
    expect(html).toContain('재무건강지수 읽는 방법');
    expect(html).toContain('보완할 항목의 우선순위');
    expect(html).toContain('산출 불가');
    expect(html).toContain('01 / 5');
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
    expect(html).toContain('05 / 5');
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

// 지표 방향 배지(낮을수록/높을수록/적정구간 유지 - 순수 표시용, 계산 로직 무관)만 검증한다.
function buildIndicator(overrides = {}) {
  return {
    key: 'household',
    label: '가계수지지표',
    formula: '총지출 ÷ 총소득',
    unit: '%',
    value: 50,
    displayValue: 50,
    rawValue: 50,
    score: 12,
    maxScore: 15,
    status: '양호',
    ratioClass: 'good',
    notCalculable: false,
    notApplicable: false,
    reason: null,
    guideline: '총 소득 대비 총 지출 70% 이하',
    benchmark: { withinRecommended: true, gap: 20, gapText: '참고 범위(70% 이하) 대비 20%p 여유가 있습니다' },
    gauge: { valuePct: 50, benchType: 'atMost', benchValuePct: 70, gaugeMax: 100 },
    table: [
      { rangeLabel: '50% 이하', score: 12, status: '양호', reason: '테스트 사유 1', isCurrent: true },
      { rangeLabel: '50% 초과', score: 0, status: '위험', reason: '테스트 사유 2', isCurrent: false },
    ],
    ...overrides,
  };
}

function renderWithIndicators(indicators) {
  return renderToStaticMarkup(
    <FhsDetailReport
      result={{ generatedAt: '2026-08-25T00:00:00.000Z', indicators, financialHealthInterpretation: { categories: [] } }}
      onRestart={() => {}}
      onBack={() => {}}
      onHome={() => {}}
      clientName="테스트"
    />
  );
}

describe('IndicatorDetailCard - 방향 배지', () => {
  const DIRECTION_EXPECTATIONS = {
    household: '▼ 낮을수록 좋아요',
    emergency: '▲ 높을수록 좋아요',
    dsr: '▼ 낮을수록 좋아요',
    debtBurden: '▼ 낮을수록 좋아요',
    insurance: '◆ 적정 구간을 유지하는 게 좋아요',
    savingsRate: '▲ 높을수록 좋아요',
    retirementSavings: '▲ 높을수록 좋아요',
    financialAssetRatio: '▲ 높을수록 좋아요',
  };

  Object.entries(DIRECTION_EXPECTATIONS).forEach(([key, expectedBadge]) => {
    it(`${key}는 "${expectedBadge}" 배지를 보여준다`, () => {
      const html = renderWithIndicators([buildIndicator({ key, label: key })]);
      expect(html).toContain(expectedBadge);
    });
  });

  // 회귀 방지: financialAssetRatio는 api/_lib/indicators.js의 실제 배점 구간표(⑧ 금융자산비중지표)
  // 기준으로 atLeast(40) 이상이 최고점이고 그 위로 감점 구간이 없는 단조증가형이라 "높을수록
  // 좋음"으로 분류했다(between이 아님).
  it('financialAssetRatio는 between이 아니라 higher로 분류된다(실제 배점표 기준)', () => {
    const html = renderWithIndicators([buildIndicator({ key: 'financialAssetRatio', label: '금융자산비중지표' })]);
    expect(html).toContain('▲ 높을수록 좋아요');
    expect(html).not.toContain('◆ 적정 구간을 유지하는 게 좋아요');
  });

  it('notCalculable 카드에도 방향 배지를 보여준다', () => {
    const html = renderWithIndicators([buildIndicator({ notCalculable: true, reason: '소득이 0원이어서 산출할 수 없습니다.' })]);
    expect(html).toContain('▼ 낮을수록 좋아요');
  });
});

// IndicatorBreakdownTable(구분/금액/비율 표) - breakdown 유무에 따른 표시만 검증한다.
describe('IndicatorDetailCard - breakdown 표(구분/금액/비율)', () => {
  it('breakdown이 있으면 분자·분모 금액과 현재 비율 값을 formatWon으로 보여준다', () => {
    const html = renderWithIndicators([buildIndicator({
      value: 45.5,
      breakdown: {
        numerator: { label: '총지출(저축 제외)', amount: 12974 },
        denominator: { label: '총소득', amount: 28514 },
      },
    })]);
    expect(html).toContain('indicator-breakdown-table');
    expect(html).toContain('총지출(저축 제외)');
    expect(html).toContain('총소득');
    // formatWon(12974) === '1억 2,974만원', formatWon(28514) === '2억 8,514만원'
    expect(html).toContain('1억 2,974만원');
    expect(html).toContain('2억 8,514만원');
    expect(html).toContain('45.5%');
  });

  it('emergency는 비율 컬럼을 퍼센트가 아니라 "N배"로 보여준다', () => {
    const html = renderWithIndicators([buildIndicator({
      key: 'emergency',
      label: '비상예비금지표',
      unit: '배',
      value: 5.2,
      breakdown: {
        numerator: { label: '유동성자산', amount: 1200 },
        denominator: { label: '월지출(저축 제외)', amount: 230 },
      },
    })]);
    expect(html).toContain('5.2배');
    expect(html).not.toContain('5.2%');
  });

  it('breakdown이 없으면(과거 저장 결과 - 하위호환) 표를 렌더링하지 않고 게이지만 보여준다', () => {
    const html = renderWithIndicators([buildIndicator()]); // buildIndicator 기본값에는 breakdown이 없음
    expect(html).not.toContain('indicator-breakdown-table');
    expect(html).toContain('gauge-track');
  });

  // 게이지+표 한 줄 배치(indicator-gauge-breakdown-row) 회귀 확인. 실제 가로 배치 여부는
  // CSS(app.css)가 결정하므로 여기서는 "감싸는 클래스가 올바른 조건으로 붙는지"만 검증한다.
  it('breakdown이 있으면 게이지와 표가 같은 indicator-gauge-breakdown-row 안에 함께 들어간다', () => {
    const html = renderWithIndicators([buildIndicator({
      breakdown: {
        numerator: { label: '총지출(저축 제외)', amount: 12974 },
        denominator: { label: '총소득', amount: 28514 },
      },
    })]);
    const rowStart = html.indexOf('indicator-gauge-breakdown-row');
    const rowTagEnd = html.indexOf('>', rowStart);
    const rowOpenTag = html.slice(html.lastIndexOf('<div', rowStart), rowTagEnd + 1);
    expect(rowOpenTag).not.toContain('indicator-gauge-breakdown-row--gauge-only');
    const afterRow = html.slice(rowTagEnd);
    // 같은 래퍼 안에서 게이지(gauge-track)가 표(indicator-breakdown-table)보다 먼저 나온다.
    expect(afterRow.indexOf('gauge-track')).toBeLessThan(afterRow.indexOf('indicator-breakdown-table'));
  });
});

// A7 회귀 테스트: notCalculable이 아니어도 value가 null인 지표(65세 이상 + 총저축액 0원인
// 노후대비저축지표)가 게이지·구간표 없이 사유만 보여주는 카드로 표시되는지, 0%나 "50%p 부족"
// 같은 값을 지어내지 않는지 확인한다.
describe('IndicatorDetailCard - notApplicable이면서 value가 null인 경우(A7)', () => {
  it('실제 계산 파이프라인(65세 이상 + 총저축 0원)에서 게이지 대신 사유 카드를 보여준다', () => {
    const raw = JSON.parse(JSON.stringify(initialFormData));
    raw.basic.birthYear = String(new Date().getFullYear() - 66);
    raw.basic.retirementAge = 65;
    raw.basic.lifeExpectancy = 90;
    raw.basic.serviceYears = 20;
    raw.expense.retirementLivingCost = 300;
    raw.income.personalPension.startAge = 65;
    raw.income.salary.hasSalary = true;
    raw.income.salary.monthly = 500;
    raw.assets.currentLivingCost.monthly = 250;
    raw.assets.liquidAssets.hasAssets = true;
    raw.assets.liquidAssets.breakdown.emergencyFund = 1500;
    // 총저축액을 명시적으로 0원으로 둔다(65세 이상이면서도 분모 0인 조건).
    raw.assets.savingsPlan.monthly = 0;
    raw.assets.savingsPlan.annual = 0;
    raw.assets.savingsPlan.retirementMonthly = 0;
    raw.assets.savingsPlan.retirementAnnual = 0;

    const input = buildCanonicalInput(raw);
    const { indicators, weakest, strongest, aggregates, currentAge } = calcIndicators(input);
    const enrichedIndicators = enrichIndicators({
      indicators, weakest, strongest, aggregates, retirementLivingCost: 300, age: currentAge,
    }).indicators;
    const retirementSavings = enrichedIndicators.find((ind) => ind.key === 'retirementSavings');
    expect(retirementSavings.notApplicable).toBe(true);
    expect(retirementSavings.value).toBeNull();
    expect(retirementSavings.gauge).toBeNull();

    const html = renderToStaticMarkup(
      <FhsDetailReport
        result={{ generatedAt: '2026-08-25T00:00:00.000Z', indicators: enrichedIndicators, financialHealthInterpretation: { categories: [] } }}
        onRestart={() => {}}
        onBack={() => {}}
        onHome={() => {}}
        clientName="테스트"
      />
    );

    expect(html).toContain(retirementSavings.reason);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
    // 65세 이상 + 분모 0 카드에는 게이지(gauge-track)가 없어야 한다 - 다른 지표의 게이지는
    // 페이지 안에 계속 존재하므로, 이 지표 이름 바로 뒤 구간에서만 gauge-track이 없는지 확인한다.
    const cardStart = html.indexOf('노후대비저축지표');
    const nextCardStart = html.indexOf('금융자산비중지표', cardStart);
    const cardHtml = html.slice(cardStart, nextCardStart);
    expect(cardHtml).not.toContain('gauge-track');
    expect(cardHtml).not.toContain('50.0%p 부족');
  });

  it('단위 테스트: notApplicable + value=null 인디케이터는 산출 불가 카드(게이지 없음)로 렌더링된다', () => {
    const html = renderWithIndicators([buildIndicator({
      key: 'retirementSavings',
      label: '노후대비저축지표',
      value: null,
      rawValue: null,
      displayValue: null,
      score: 0,
      maxScore: 0,
      status: '해당 없음',
      notCalculable: false,
      notApplicable: true,
      reason: '65세 이상이며 총저축액이 0원이어서 노후대비저축지표를 산출할 수 없습니다.',
      gauge: null,
      benchmark: null,
      breakdown: null,
    })]);
    expect(html).toContain('65세 이상이며 총저축액이 0원이어서 노후대비저축지표를 산출할 수 없습니다.');
    expect(html).not.toContain('gauge-track');
    expect(html).not.toContain('indicator-benchmark-table');
  });

  it('breakdown이 없으면 게이지를 다시 전체 폭으로 되돌리는 --gauge-only 수정자가 붙는다', () => {
    const html = renderWithIndicators([buildIndicator()]);
    expect(html).toContain('indicator-gauge-breakdown-row indicator-gauge-breakdown-row--gauge-only');
  });

  it('실제 계산 파이프라인 결과에서도 breakdown 표가 정상적으로 보인다(회귀 확인)', () => {
    const { indicators, financialHealthInterpretation } = buildReportData({ withIncome: true });
    const html = renderToStaticMarkup(
      <FhsDetailReport
        result={{ generatedAt: '2026-08-25T00:00:00.000Z', indicators, financialHealthInterpretation }}
        onRestart={() => {}}
        onBack={() => {}}
        onHome={() => {}}
        clientName="테스트"
      />
    );
    const household = indicators.find((ind) => ind.key === 'household');
    expect(household.breakdown).toBeTruthy();
    expect(html).toContain('indicator-breakdown-table');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });

  // app.css는 CSS라 renderToStaticMarkup으로는 검증할 수 없다 - 모바일 폴백(프로젝트가 이미
  // 쓰는 640px 브레이크포인트)과 인쇄 시 세로 배치 강제 규칙이 실제로 존재하는지 소스 텍스트로
  // 회귀 확인한다(값이 조용히 삭제/변경되는 것을 방지).
  it('app.css에 모바일(640px)·인쇄 시 세로 배치 폴백 규칙이 있다(회귀 방지)', async () => {
    const fs = await import('node:fs/promises');
    const css = await fs.readFile(new URL('../../styles/app.css', import.meta.url), 'utf8');
    const rowRuleIndex = css.indexOf('.indicator-gauge-breakdown-row {');
    expect(rowRuleIndex).toBeGreaterThan(-1);

    const mobileBlockStart = css.indexOf('@media (max-width: 640px)', rowRuleIndex);
    const mobileBlockEnd = css.indexOf('\n}', mobileBlockStart);
    expect(css.slice(mobileBlockStart, mobileBlockEnd)).toContain('.indicator-gauge-breakdown-row { flex-direction: column; }');

    const printBlockStart = css.lastIndexOf('@media print');
    expect(css.slice(printBlockStart)).not.toContain('.indicator-gauge-breakdown-row { flex-direction: column; }');
  });
});

// A13 회귀 테스트: notCalculable도 아니고 value도 있는데(A7 대상 아님) gauge 자체만 없는
// 과거 저장 결과/불완전 데이터를 흉내낸다. 목표는 "게이지만 표시하지 않고 크래시하지 않음" -
// 카드의 나머지(정의·구간표)는 그대로 보여야 한다.
describe('IndicatorDetailCard - gauge가 없는 경우의 방어 (A13)', () => {
  it('정상 gauge가 있으면 기존과 완전히 동일하게 게이지를 보여준다(회귀 확인)', () => {
    const html = renderWithIndicators([buildIndicator()]);
    expect(html).toContain('gauge-track');
    expect(html).toContain('gauge-fill');
  });

  it('gauge가 undefined여도 crash하지 않고 게이지만 생략한다', () => {
    expect(() => renderWithIndicators([buildIndicator({ gauge: undefined })])).not.toThrow();
    const html = renderWithIndicators([buildIndicator({ gauge: undefined })]);
    expect(html).not.toContain('gauge-track');
  });

  it('gauge가 null이어도 crash하지 않고 게이지만 생략한다', () => {
    expect(() => renderWithIndicators([buildIndicator({ gauge: null })])).not.toThrow();
    const html = renderWithIndicators([buildIndicator({ gauge: null })]);
    expect(html).not.toContain('gauge-track');
  });

  it('gauge가 없어도 카드의 나머지 영역(라벨·정의·구간표)은 정상적으로 표시된다', () => {
    const html = renderWithIndicators([buildIndicator({ gauge: null })]);
    expect(html).toContain('가계수지지표');
    expect(html).toContain('이 지표는');
    expect(html).toContain('indicator-benchmark-table');
    expect(html).toContain('테스트 사유 1');
  });

  it('breakdown은 있는데 gauge만 없는 경우에도 breakdown 표는 정상 표시된다(다른 지표 영역에 영향 없음)', () => {
    const html = renderWithIndicators([buildIndicator({
      gauge: null,
      breakdown: {
        numerator: { label: '총지출(저축 제외)', amount: 12974 },
        denominator: { label: '총소득', amount: 28514 },
      },
    })]);
    expect(html).not.toContain('gauge-track');
    expect(html).toContain('indicator-breakdown-table');
  });

  it('A7의 notApplicable+value=null 산출불가 카드와 충돌하지 않는다(그 경로는 애초에 IndicatorGauge까지 가지 않음)', () => {
    const html = renderWithIndicators([buildIndicator({
      notCalculable: false,
      notApplicable: true,
      value: null,
      rawValue: null,
      displayValue: null,
      gauge: null,
      benchmark: null,
      breakdown: null,
      reason: '65세 이상이며 총저축액이 0원이어서 노후대비저축지표를 산출할 수 없습니다.',
    })]);
    expect(html).toContain('65세 이상이며 총저축액이 0원이어서 노후대비저축지표를 산출할 수 없습니다.');
    expect(html).not.toContain('gauge-track');
    // A7 카드는 구간표(indicator-benchmark-table)도 아예 렌더링하지 않는다(카드 전체 대체) -
    // A13(게이지만 생략)과는 다른 분기임을 확인한다.
    expect(html).not.toContain('indicator-benchmark-table');
  });
});
