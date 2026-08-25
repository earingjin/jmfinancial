import { describe, it, expect } from 'vitest';
import { buildPeerComparison } from './peerComparison.js';

const BASE_ARGS = { age: 41, totalAssets: 40000, totalDebt: 5000, annualIncome: 12000, financialAssetsTotal: 5000 };

describe('buildPeerComparison - wording must never assert a confident percentile without real distribution data', () => {
  it('does not return an estimated percentile rank without distribution data', () => {
    expect(buildPeerComparison(BASE_ARGS).percentileRank).toBeNull();
  });
  it('never uses a definitive "상위 N%" style claim in percentileLabel', () => {
    const result = buildPeerComparison(BASE_ARGS);
    for (const key of ['netWorth', 'householdIncome', 'financialAssets']) {
      expect(result[key].percentileLabel).not.toMatch(/상위\s*\d+%/);
    }
  });

  it('does not expose the removed financial-health composite comparison', () => {
    const result = buildPeerComparison(BASE_ARGS);
    expect(result).not.toHaveProperty('retirementScore');
    expect(result).not.toHaveProperty('retirementScoreIsPlaceholder');
  });

  it('reports "비교 데이터 부족" for NaN/Infinity input instead of doing arithmetic on it', () => {
    expect(buildPeerComparison({ ...BASE_ARGS, annualIncome: Infinity }).householdIncome.percentileLabel).toBe('비교 데이터 부족');
  });
});

// 2025년 가계금융복지조사 연동: 순자산/연소득/금융자산은 사용자 나이에 해당하는 연령구간 평균을
// 써야 한다.
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

});

// 비교율 부호(양수→높음, 음수→낮음)는 화면 표시용으로 반올림한 diffPercent가 아니라
// 반올림 전 원시 비율로 판정해야 한다(rawValue로 판정, displayValue로 재판정하지 않음).
describe('buildPeerComparison - 비교 라벨은 반올림 전 원시값 기준 양수/음수 이분법으로 판정한다', () => {
  const argsWithFinancialAssets = (financialAssetsTotal) => ({
    age: 41, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal, retirementScore: null,
  });
  const AVG = 16401; // 40~49세 금융자산 평균

  it('평균보다 낮으면(T-0.01%) "또래 가구 평균보다 낮음"으로 판정한다', () => {
    const result = buildPeerComparison(argsWithFinancialAssets(AVG * (1 - 0.0001)));
    expect(result.financialAssets.percentileLabel).toBe('또래 가구 평균보다 낮음');
  });

  it('평균과 정확히 같으면(T) "또래 가구 평균보다 높음"으로 판정한다(0 이상은 높음으로 처리, 구간은 상호배타적)', () => {
    const result = buildPeerComparison(argsWithFinancialAssets(AVG));
    expect(result.financialAssets.percentileLabel).toBe('또래 가구 평균보다 높음');
  });

  it('평균보다 높으면(T+0.01%) "또래 가구 평균보다 높음"으로 판정한다', () => {
    const result = buildPeerComparison(argsWithFinancialAssets(AVG * (1 + 0.0001)));
    expect(result.financialAssets.percentileLabel).toBe('또래 가구 평균보다 높음');
  });

  it('반올림하면 0.0%로 표시되는 경계 근처에서도 원시 부호로 정확히 갈린다("또래 가구 평균과 비슷함" 밴드는 존재하지 않는다)', () => {
    const belowRoundsToZero = buildPeerComparison(argsWithFinancialAssets(AVG * (1 - 0.0001)));
    const aboveRoundsToZero = buildPeerComparison(argsWithFinancialAssets(AVG * (1 + 0.0001)));
    expect(belowRoundsToZero.financialAssets.diffPercent).toBe(0);
    expect(aboveRoundsToZero.financialAssets.diffPercent).toBe(0);
    expect(belowRoundsToZero.financialAssets.percentileLabel).toBe('또래 가구 평균보다 낮음');
    expect(aboveRoundsToZero.financialAssets.percentileLabel).toBe('또래 가구 평균보다 높음');
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
    expect(result.netWorth.percentileLabel).toBe('또래 가구 평균보다 낮음');
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

describe('buildPeerComparison - 음수 순자산을 모든 출력 경로에서 보존한다', () => {
  it('카드·차트·집중비교가 같은 음수 원시값을 사용한다', () => {
    const result = buildPeerComparison({
      ...BASE_ARGS,
      totalAssets: 1000,
      totalDebt: 1500,
    });
    const currentBracket = result.ageBrackets.find((item) => item.isUserBracket);

    expect(result.netWorth.value).toBe(-500);
    expect(result.userNetWorth).toBe(-500);
    expect(result.focusCompare.userNetWorth).toBe(-500);
    expect(currentBracket.netWorth).toBe(-500);
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

  it('does not mix placeholder household values into non-user age brackets', () => {
    const result = buildPeerComparison(BASE_ARGS);
    expect(result.ageBrackets.filter((item) => !item.isUserBracket).every((item) => item.netWorth == null)).toBe(true);
  });
});

// 리포트의 또래자산비교 페이지에 연소득/금융자산도 순자산처럼 전 연령대 비교 차트를 넣기 위해
// incomeAgeBrackets/financialAssetsAgeBrackets를 추가한다 - 이미 승인된 2025년 공식 통계를
// 사용자 구간 하나가 아니라 전 연령대로 노출할 뿐, 새 계산이나 기준은 만들지 않는다.
describe('buildPeerComparison - incomeAgeBrackets/financialAssetsAgeBrackets(연소득·금융자산 전 연령대 비교)', () => {
  it('구간 라벨과 연소득/금융자산 평균이 2025년 가계금융복지조사 수치와 일치한다', () => {
    const result = buildPeerComparison({ age: 41, totalAssets: 0, totalDebt: 0, annualIncome: 0, financialAssetsTotal: 0, retirementScore: null });
    const incomeByKey = Object.fromEntries(result.incomeAgeBrackets.map((b) => [b.key, b]));
    const financialByKey = Object.fromEntries(result.financialAssetsAgeBrackets.map((b) => [b.key, b]));

    expect(incomeByKey.under29).toMatchObject({ label: '29세 이하', average: 4509 });
    expect(incomeByKey['30to39']).toMatchObject({ label: '30~39세', average: 7386 });
    expect(incomeByKey['40to49']).toMatchObject({ label: '40~49세', average: 9333 });
    expect(incomeByKey['50to59']).toMatchObject({ label: '50~59세', average: 9416 });
    expect(incomeByKey['60plus']).toMatchObject({ label: '60세 이상', average: 5767 });

    expect(financialByKey.under29).toMatchObject({ label: '29세 이하', average: 8843 });
    expect(financialByKey['30to39']).toMatchObject({ label: '30~39세', average: 14104 });
    expect(financialByKey['40to49']).toMatchObject({ label: '40~49세', average: 16401 });
    expect(financialByKey['50to59']).toMatchObject({ label: '50~59세', average: 16507 });
    expect(financialByKey['60plus']).toMatchObject({ label: '60세 이상', average: 11236 });
  });

  it('사용자 값은 본인 연령구간에만 채워지고, 다른 구간은 null이다', () => {
    const result = buildPeerComparison(BASE_ARGS);
    const userIncomeBracket = result.incomeAgeBrackets.find((b) => b.isUserBracket);
    const userFinancialBracket = result.financialAssetsAgeBrackets.find((b) => b.isUserBracket);

    expect(userIncomeBracket.annualIncome).toBe(BASE_ARGS.annualIncome);
    expect(userFinancialBracket.financialAssets).toBe(BASE_ARGS.financialAssetsTotal);
    expect(result.incomeAgeBrackets.filter((b) => !b.isUserBracket).every((b) => b.annualIncome == null)).toBe(true);
    expect(result.financialAssetsAgeBrackets.filter((b) => !b.isUserBracket).every((b) => b.financialAssets == null)).toBe(true);
  });

  it('연소득·금융자산이 미입력이면 본인 구간 값도 null로 남는다(0원으로 오인되지 않음)', () => {
    const result = buildPeerComparison({ ...BASE_ARGS, annualIncomeMissing: true, financialAssetsMissing: true });
    const userIncomeBracket = result.incomeAgeBrackets.find((b) => b.isUserBracket);
    const userFinancialBracket = result.financialAssetsAgeBrackets.find((b) => b.isUserBracket);

    expect(userIncomeBracket.annualIncome).toBeNull();
    expect(userFinancialBracket.financialAssets).toBeNull();
  });
});
