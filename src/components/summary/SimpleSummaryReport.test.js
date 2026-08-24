import { describe, it, expect } from 'vitest';
import { getFinancialHealthStatus } from './summaryPresentation';

// getFinancialHealthStatus는 새 재무점수·임계값을 만들지 않고, 서버가 이미 계산한
// ratioClass(good/caution/risk)만 세어 화면 문구를 고르는 순수 표시 헬퍼다.
// FHS 점수·등급 산출 자체는 api/_lib/indicators.test.js가 검증한다.
describe('getFinancialHealthStatus', () => {
  const good = { ratioClass: 'good', notCalculable: false };
  const caution = { ratioClass: 'caution', notCalculable: false };
  const risk = { ratioClass: 'risk', notCalculable: false };
  const na = { ratioClass: 'na', notCalculable: true };

  it('모든 대표지표가 good이면 안정 문구를 반환한다', () => {
    expect(getFinancialHealthStatus([good, good, good]).icon).toBe('😊');
  });

  it('caution이 하나라도 있으면 일부 점검 문구를 반환한다', () => {
    expect(getFinancialHealthStatus([good, caution, good]).icon).toBe('🙂');
  });

  it('risk가 1개면 일부 점검 문구(🙂)로 처리한다', () => {
    expect(getFinancialHealthStatus([good, risk, good]).icon).toBe('🙂');
  });

  it('risk가 2개 이상이면 우선 점검 문구(😥)를 반환한다', () => {
    expect(getFinancialHealthStatus([risk, risk, good]).icon).toBe('😥');
  });

  it('대표지표가 모두 notCalculable(N/A)이면 정보 부족 문구를 반환하고 크래시하지 않는다', () => {
    expect(getFinancialHealthStatus([na, na, na]).icon).toBe('🤔');
  });

  it('빈 배열이나 undefined가 들어와도 안전하게 정보 부족 문구를 반환한다(과거 저장 결과 호환)', () => {
    expect(getFinancialHealthStatus([]).icon).toBe('🤔');
    expect(getFinancialHealthStatus(undefined).icon).toBe('🤔');
  });

  it('notCalculable 지표는 카운트에서 제외하고 나머지 known 지표만으로 판정한다', () => {
    // na 1개 + good 2개 → known은 good만 2개 → 안정 문구
    expect(getFinancialHealthStatus([na, good, good]).icon).toBe('😊');
  });
});
