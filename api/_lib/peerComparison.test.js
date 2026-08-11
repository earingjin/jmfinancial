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

  it('marks only retirementScore as placeholder data (netWorth/householdIncome/financialAssets are now official 2025 statistics)', () => {
    const result = buildPeerComparison(BASE_ARGS);
    expect(result.retirementScoreIsPlaceholder).toBe(true);
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

// 2025년 가계금융복지조사 연동: 순자산/연소득/금융자산은 사용자 나이에 해당하는 연령구간 평균을
// 써야 한다(재무건강 총점은 연령대별 데이터가 없어 이번 갱신에서 제외 - 사용자 확인됨).
describe('buildPeerComparison - age-bracket-based peer averages (2025 가계금융복지조사)', () => {
  it('40~49세 구간(age=41)에서는 해당 구간의 순자산/연소득/금융자산 평균을 사용한다', () => {
    const result = buildPeerComparison({ age: 41, totalAssets: 40000, totalDebt: 5000, annualIncome: 12000, financialAssetsTotal: 5000, retirementScore: 75 });
    expect(result.userAge).toBe(41);
    expect(result.userBracketLabel).toBe('40~49세');
    expect(result.netWorth.average).toBe(48389);
    expect(result.householdIncome.average).toBe(9333);
    expect(result.financialAssets.average).toBe(16401);
  });

  it('연령구간 경계값(39/40, 49/50)에서 평균이 올바른 구간으로 전환된다', () => {
    const at39 = buildPeerComparison({ age: 39, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal: 0, retirementScore: null });
    const at40 = buildPeerComparison({ age: 40, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal: 0, retirementScore: null });
    expect(at39.netWorth.average).toBe(25060);
    expect(at40.netWorth.average).toBe(48389);

    const at49 = buildPeerComparison({ age: 49, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal: 0, retirementScore: null });
    const at50 = buildPeerComparison({ age: 50, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal: 0, retirementScore: null });
    expect(at49.netWorth.average).toBe(48389);
    expect(at50.netWorth.average).toBe(55161);
  });

  it('재무건강 총점(retirementScore)은 이번 갱신 대상이 아니므로 나이와 무관하게 기존 고정 평균(69.9)을 유지한다', () => {
    const young = buildPeerComparison({ age: 25, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal: 0, retirementScore: 50 });
    const old = buildPeerComparison({ age: 65, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal: 0, retirementScore: 50 });
    expect(young.retirementScore.average).toBe(69.9);
    expect(old.retirementScore.average).toBe(69.9);
  });
});

// 비교율 부호(양수→높음, 음수→낮음)는 화면 표시용으로 반올림한 diffPercent가 아니라
// 반올림 전 원시 비율로 판정해야 한다(rawValue로 판정, displayValue로 재판정하지 않음).
describe('buildPeerComparison - 비교 라벨은 반올림 전 원시값 기준 양수/음수 이분법으로 판정한다', () => {
  const argsWithFinancialAssets = (financialAssetsTotal) => ({
    age: 41, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal, retirementScore: null,
  });
  const AVG = 16401; // 40~49세 금융자산 평균

  it('평균보다 낮으면(T-0.01%) "또래 평균보다 낮음"으로 판정한다', () => {
    const result = buildPeerComparison(argsWithFinancialAssets(AVG * (1 - 0.0001)));
    expect(result.financialAssets.percentileLabel).toBe('또래 평균보다 낮음');
  });

  it('평균과 정확히 같으면(T) "또래 평균보다 높음"으로 판정한다(0 이상은 높음으로 처리, 구간은 상호배타적)', () => {
    const result = buildPeerComparison(argsWithFinancialAssets(AVG));
    expect(result.financialAssets.percentileLabel).toBe('또래 평균보다 높음');
  });

  it('평균보다 높으면(T+0.01%) "또래 평균보다 높음"으로 판정한다', () => {
    const result = buildPeerComparison(argsWithFinancialAssets(AVG * (1 + 0.0001)));
    expect(result.financialAssets.percentileLabel).toBe('또래 평균보다 높음');
  });

  it('반올림하면 0.0%로 표시되는 경계 근처에서도 원시 부호로 정확히 갈린다("또래 평균과 비슷함" 밴드는 존재하지 않는다)', () => {
    const belowRoundsToZero = buildPeerComparison(argsWithFinancialAssets(AVG * (1 - 0.0001)));
    const aboveRoundsToZero = buildPeerComparison(argsWithFinancialAssets(AVG * (1 + 0.0001)));
    expect(belowRoundsToZero.financialAssets.diffPercent).toBe(0);
    expect(aboveRoundsToZero.financialAssets.diffPercent).toBe(0);
    expect(belowRoundsToZero.financialAssets.percentileLabel).toBe('또래 평균보다 낮음');
    expect(aboveRoundsToZero.financialAssets.percentileLabel).toBe('또래 평균보다 높음');
  });
});

// 실제 입력값 0과 "미입력이라 계산 불가"는 서로 다르다 - 미입력이면 diffPercent=-100%가 아니라
// "비교 데이터 부족"으로 처리해야 한다.
describe('buildPeerComparison - 미입력과 실제 0원을 구분한다', () => {
  const BASE = { age: 41, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal: 0, retirementScore: null };

  it('순자산이 미입력(netWorthMissing)이면 0원이어도 "비교 데이터 부족"으로 처리하고 -100%를 노출하지 않는다', () => {
    const result = buildPeerComparison({ ...BASE, netWorthMissing: true });
    expect(result.netWorth.value).toBeNull();
    expect(result.netWorth.diffPercent).toBeNull();
    expect(result.netWorth.percentileLabel).toBe('비교 데이터 부족');
  });

  it('순자산을 실제로 0원이라고 입력한 경우(미입력 아님)에는 정상적으로 -100%를 계산한다', () => {
    const result = buildPeerComparison({ ...BASE, netWorthMissing: false });
    expect(result.netWorth.value).toBe(0);
    expect(result.netWorth.diffPercent).toBe(-100);
    expect(result.netWorth.percentileLabel).toBe('또래 평균보다 낮음');
  });

  it('연소득이 미입력(annualIncomeMissing)이면 "비교 데이터 부족"으로 처리한다', () => {
    const result = buildPeerComparison({ ...BASE, annualIncomeMissing: true });
    expect(result.householdIncome.value).toBeNull();
    expect(result.householdIncome.percentileLabel).toBe('비교 데이터 부족');
  });

  it('금융자산이 미입력(financialAssetsMissing)이면 "비교 데이터 부족"으로 처리한다', () => {
    const result = buildPeerComparison({ ...BASE, financialAssetsMissing: true });
    expect(result.financialAssets.value).toBeNull();
    expect(result.financialAssets.percentileLabel).toBe('비교 데이터 부족');
  });

  it('미입력 플래그를 주지 않으면(기존 호출부 하위호환) 기존처럼 finite 여부만으로 판정한다', () => {
    const result = buildPeerComparison(BASE);
    expect(result.netWorth.value).toBe(0);
    expect(result.householdIncome.value).toBe(0);
    expect(result.financialAssets.value).toBe(0);
  });
});

// PDF 리포트 3페이지(자산현황 세부내역 하단, PeerComparisonPage.jsx)의 연령대별 순자산 차트도
// 같은 2025년 공식 데이터로 갱신한다(사용자 확인됨) - 기존 60세 이상 53,951은 오차값이었다.
describe('buildPeerComparison - ageBrackets(PDF 리포트 3페이지 차트)도 2025년 공식 데이터를 반영한다', () => {
  it('구간 라벨과 순자산 평균이 2025년 가계금융복지조사 수치와 일치한다', () => {
    const result = buildPeerComparison({ age: 41, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal: 0, retirementScore: null });
    const byKey = Object.fromEntries(result.ageBrackets.map((b) => [b.key, b]));
    expect(byKey.under29).toMatchObject({ label: '29세 이하', average: 10796 });
    expect(byKey['30to39']).toMatchObject({ label: '30~39세', average: 25060 });
    expect(byKey['40to49']).toMatchObject({ label: '40~49세', average: 48389 });
    expect(byKey['50to59']).toMatchObject({ label: '50~59세', average: 55161 });
    expect(byKey['60plus']).toMatchObject({ label: '60세 이상', average: 53591 });
  });

  it('focusCompare.referenceAverage(60세 기준선)도 갱신된 53,591을 사용한다', () => {
    const result = buildPeerComparison({ age: 41, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal: 0, retirementScore: null });
    expect(result.focusCompare.referenceAverage).toBe(53591);
  });
});
