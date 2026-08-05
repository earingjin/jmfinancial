import { describe, it, expect } from 'vitest';
import { buildPeerComparison } from './peerComparison.js';

const BASE_ARGS = { age: 41, totalAssets: 40000, totalDebt: 5000, annualIncome: 12000, financialAssetsTotal: 5000, retirementScore: 75 };

describe('buildPeerComparison - wording must never assert a confident percentile without real distribution data', () => {
  it('never uses a definitive "상위 N%" style claim in percentileLabel', () => {
    const result = buildPeerComparison(BASE_ARGS);
    for (const key of ['netWorth', 'householdIncome', 'financialAssets', 'retirementScore']) {
      expect(result[key].percentileLabel).not.toMatch(/상위\s*\d+%/);
    }
  });

  it('still marks the response as placeholder data', () => {
    const result = buildPeerComparison(BASE_ARGS);
    expect(result.isPlaceholderData).toBe(true);
  });

  it('reports "비교 데이터 부족" instead of a bogus diff when retirementScore is null (notCalculable)', () => {
    const result = buildPeerComparison({ ...BASE_ARGS, retirementScore: null });
    expect(result.retirementScore.value).toBeNull();
    expect(result.retirementScore.diffPercent).toBeNull();
    expect(result.retirementScore.percentileLabel).toBe('비교 데이터 부족');
  });

  it('reports "비교 데이터 부족" for NaN/Infinity input instead of doing arithmetic on it', () => {
    expect(buildPeerComparison({ ...BASE_ARGS, retirementScore: NaN }).retirementScore.percentileLabel).toBe('비교 데이터 부족');
    expect(buildPeerComparison({ ...BASE_ARGS, annualIncome: Infinity }).householdIncome.percentileLabel).toBe('비교 데이터 부족');
  });

  it('still computes a normal comparison label for a finite value', () => {
    const result = buildPeerComparison(BASE_ARGS);
    expect(['또래 평균보다 높음', '또래 평균과 비슷함', '또래 평균보다 낮음']).toContain(result.retirementScore.percentileLabel);
  });
});
