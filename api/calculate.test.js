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
    // webSummary.donuts.expense.items 쪽은 화면이 실제로 쓰므로 그대로 유지되어야 한다.
    expect(result.webSummary?.donuts?.expense?.items).toBeDefined();
  });

  it('summary 객체에서 화면 미사용 파생값을 포함하지 않는다', async () => {
    const result = await callHandler(buildMinimalValidInput());
    const removedSummaryKeys = [
      'gradeBands', 'referenceScore', 'nextGrade', 'pointsToNextGrade',
      'belowRecommendedCount', 'weakest', 'strongest', 'is65Plus',
    ];
    removedSummaryKeys.forEach((key) => {
      expect(result.summary).not.toHaveProperty(key);
    });
    // 화면이 실제로 쓰는 summary 필드는 그대로 유지되어야 한다.
    expect(result.summary).toHaveProperty('totalScore');
    expect(result.summary).toHaveProperty('grade');
    expect(result.summary).toHaveProperty('notCalculable');
    expect(result.summary).toHaveProperty('missingInputs');
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
