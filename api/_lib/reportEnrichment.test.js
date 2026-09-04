import { describe, expect, it } from 'vitest';
import { enrichIndicators } from './reportEnrichment.js';

// A7 회귀 테스트: notCalculable이 아니어도 value가 null인 지표(예: 65세 이상 + 총저축액 0원인
// 노후대비저축지표)는 게이지·벤치마크·구성분석을 만들지 않아야 한다. 값이 null인 채로 pct()/
// describeBenchmark()에 들어가면 null이 산술 연산에서 0으로 취급돼("게이지 0%", "참고 범위 대비
// 50%p 부족합니다") 산출 불가 상태가 정상 숫자처럼 보이게 된다.
function baseIndicator(overrides = {}) {
  return {
    key: 'retirementSavings',
    label: '노후대비저축지표',
    formula: '노후대비저축액 ÷ 총저축액 × 100',
    rawValue: null,
    displayValue: null,
    value: null,
    score: 0,
    maxScore: 0,
    status: '해당 없음',
    notCalculable: false,
    notApplicable: true,
    reason: '65세 이상이며 총저축액이 0원이어서 노후대비저축지표를 산출할 수 없습니다.',
    table: [],
    ...overrides,
  };
}

describe('enrichIndicators - value가 null인 지표는 게이지/벤치마크를 만들지 않는다(A7)', () => {
  it('notApplicable + value=null 이면 gauge/benchmark/composition이 모두 null이다', () => {
    const { indicators } = enrichIndicators({
      indicators: [baseIndicator()],
      weakest: null,
      strongest: null,
      aggregates: {},
      retirementLivingCost: 200,
      age: 66,
    });
    const [ind] = indicators;
    expect(ind.gauge).toBeNull();
    expect(ind.benchmark).toBeNull();
    expect(ind.composition).toBeNull();
    expect(ind.ratioClass).toBe('na');
    // 참고용 가이드라인 문구는 값과 무관하므로 계속 제공된다.
    expect(ind.guideline).toBeTruthy();
  });

  it('notApplicable이어도 value가 실제 숫자면 기존처럼 gauge/benchmark를 만든다(회귀 방지)', () => {
    const { indicators } = enrichIndicators({
      indicators: [baseIndicator({ rawValue: 75, displayValue: 75, value: 75, reason: null })],
      weakest: null,
      strongest: null,
      aggregates: {},
      retirementLivingCost: 200,
      age: 66,
    });
    const [ind] = indicators;
    expect(ind.gauge).not.toBeNull();
    expect(ind.gauge.valuePct).toBeGreaterThan(0);
    expect(ind.benchmark).not.toBeNull();
  });

  it('notCalculable인 일반 지표는 기존처럼 gauge/benchmark가 null이다(회귀 방지)', () => {
    const { indicators } = enrichIndicators({
      indicators: [{
        key: 'household', label: '가계수지지표', formula: '총지출 ÷ 총소득',
        rawValue: null, displayValue: null, value: null, score: null, maxScore: 15,
        status: null, notCalculable: true, notApplicable: false,
        reason: '소득이 0원이어서 가계수지지표를 산출할 수 없습니다.', table: null,
      }],
      weakest: null,
      strongest: null,
      aggregates: {},
      retirementLivingCost: 200,
      age: 40,
    });
    expect(indicators[0].gauge).toBeNull();
    expect(indicators[0].benchmark).toBeNull();
  });

  it('정상 지표(분모>0, 실제 결과 0)는 여전히 0을 0으로 정확히 보여준다(회귀 방지)', () => {
    const { indicators } = enrichIndicators({
      indicators: [{
        key: 'insurance', label: '보장성보험준비지표', formula: '보장성보험료 ÷ 소득',
        rawValue: 0, displayValue: 0, value: 0, score: 0, maxScore: 10,
        status: '위험', notCalculable: false, notApplicable: false,
        reason: null, table: [],
      }],
      weakest: null,
      strongest: null,
      aggregates: {},
      retirementLivingCost: 200,
      age: 40,
    });
    const [ind] = indicators;
    expect(ind.gauge).not.toBeNull();
    expect(ind.gauge.valuePct).toBe(0);
    expect(ind.benchmark).not.toBeNull();
  });
});
