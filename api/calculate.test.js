import { describe, expect, it, vi } from 'vitest';

vi.mock('./_lib/auth.js', () => ({
  requireUser: async () => ({ ok: true, user: { id: 'test-user' } }),
}));

const { default: handler } = await import('./calculate.js');
const { deobfuscate } = await import('../src/utils/obfuscate.js');
const { initialFormData } = await import('../src/state/initialFormData.js');

// 어떤 화면도 참조하지 않아 api/calculate.js 응답 조립 단계에서 제외한 필드(comprehensiveIssues,
// 최상위 livingExpenseItems, summary의 일부 파생값, indicators[].composition)가 최종 응답(payload)에
// 없다는 것과, 화면이 실제 쓰는 필드(ratioClass, 그리고 FHS 심화 리포트가 쓰는 gauge/benchmark/
// recommendedLabel/guideline)는 남아있다는 것을 확인한다. 계산 자체(enrichIndicators 등)는 그대로
// 두고 마지막 조립 단계에서만 걸러낸다.
function buildMinimalValidInput() {
  const input = JSON.parse(JSON.stringify(initialFormData));
  input.basic.birthYear = '1975';
  input.basic.retirementAge = '65';
  input.basic.lifeExpectancy = '90';
  input.basic.serviceYears = '20';
  input.expense.retirementLivingCost = '300';
  // personalPension.type 기본값(installment)은 startAge가 필수라 채워준다(validate.js 참고).
  input.income.personalPension.startAge = '65';
  return input;
}

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

async function callHandler(input) {
  const req = { method: 'POST', headers: { authorization: 'Bearer test-token' }, body: input };
  const res = makeRes();
  await handler(req, res);
  expect(res.statusCode).toBe(200);
  return deobfuscate(res.body.payload);
}

describe('POST /api/calculate 응답에서 화면 미사용 필드 제외', () => {
  it('최상위 comprehensiveIssues / livingExpenseItems를 포함하지 않는다', async () => {
    const result = await callHandler(buildMinimalValidInput());
    expect(result).not.toHaveProperty('comprehensiveIssues');
    expect(result).not.toHaveProperty('livingExpenseItems');
    expect(result).not.toHaveProperty('scenarioComparison');
    // webSummary.donuts.expense.items 쪽은 화면이 실제로 쓰므로 그대로 유지되어야 한다.
    expect(result.webSummary?.donuts?.expense?.items).toBeDefined();
  });

  it('summary 객체에서 화면 미사용 파생값을 포함하지 않는다', async () => {
    const result = await callHandler(buildMinimalValidInput());
    const removedSummaryKeys = [
      'gradeBands', 'referenceScore', 'nextGrade', 'pointsToNextGrade',
      'belowRecommendedCount', 'weakest', 'strongest', 'is65Plus', 'totalScore', 'grade',
    ];
    removedSummaryKeys.forEach((key) => {
      expect(result.summary).not.toHaveProperty(key);
    });
    expect(result.summary).toHaveProperty('notCalculable');
    expect(result.summary).toHaveProperty('missingInputs');
    expect(result.peerComparison).not.toHaveProperty('retirementScore');
    expect(result.peerComparison).not.toHaveProperty('retirementScoreIsPlaceholder');
    expect(result.financialHealthInterpretation.categories).toHaveLength(4);
    expect(result.financialHealthInterpretation.conclusion).toBeTruthy();
  });

  it('indicators[] 각 원소에서 composition은 제외하고, FHS 심화 리포트가 쓰는 gauge/benchmark/recommendedLabel/guideline/ratioClass는 유지한다', async () => {
    const result = await callHandler(buildMinimalValidInput());
    expect(result.indicators.length).toBeGreaterThan(0);
    result.indicators.forEach((indicator) => {
      expect(indicator).not.toHaveProperty('composition');
      expect(indicator).toHaveProperty('gauge');
      expect(indicator).toHaveProperty('benchmark');
      expect(indicator).toHaveProperty('recommendedLabel');
      expect(indicator).toHaveProperty('guideline');
      expect(indicator).toHaveProperty('ratioClass');
    });
  });
});

// Case D(코드리뷰 후속): validate → canonicalInput → aggregate → indicators로 이어지는 실제 API
// 흐름 전체(핸들러 그대로 호출)를 통해 retirementSavingsInputVersion: 2의 노후대비저축지표
// 계산을 확인한다. initialFormData 기본값이 이미 버전 2이므로 별도 지정 없이도 v2 경로를 탄다.
describe('retirementSavingsInputVersion: 2 - 전체 API 흐름(validate → canonicalInput → aggregate → indicators)', () => {
  it('breakdown 총저축 100(연금저축 20 + IRP 30 포함) + 추가 노후저축 10 → 총저축 110 / 노후저축 60 / 지표 약 54.5%', async () => {
    const input = buildMinimalValidInput();
    input.assets.savingsPlan.breakdown.installment.monthly = '50';
    input.assets.savingsPlan.breakdown.pensionSavings.monthly = '20';
    input.assets.savingsPlan.breakdown.irp.monthly = '30';
    input.assets.savingsPlan.additionalRetirementMonthly = '10';

    const result = await callHandler(input);
    const indicator = result.indicators.find((i) => i.key === 'retirementSavings');

    expect(indicator.rawValue).toBeCloseTo((60 / 110) * 100, 5);
    expect(indicator.displayValue).toBeCloseTo(54.5, 5);
  });
});

describe('POST /api/calculate liquid asset subscription input', () => {
  it('does not classify detailed liquid assets as missing when only subscription is entered', async () => {
    const input = buildMinimalValidInput();
    input.assets.liquidAssets.inputMode = 'detailed';
    input.assets.liquidAssets.breakdown.subscription = '1000';

    const result = await callHandler(input);

    expect(result.aggregates.liquidAssets).toBe(1000);
    expect(result.aggregates.totalAssets).toBe(1000);
    expect(result.aggregates.netWorth).toBe(1000);
    expect(result.peerComparison.netWorth.value).toBe(1000);
    expect(result.peerComparison.financialAssets.value).toBe(1000);
  });
});
