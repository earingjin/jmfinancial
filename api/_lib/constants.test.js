import { describe, expect, it } from 'vitest';
import { GENERAL_INFLATION_RATE, FUTURE_FINANCE_ASSUMPTIONS } from './constants.js';

// 사용자 승인(2026-08-20)에 따라 일반 물가상승률을 3%로 통일했다. 은퇴자산 시뮬레이션과
// 미래재무 전망이 다시 서로 다른 값을 쓰게 되는 회귀를 막기 위한 가드.
describe('GENERAL_INFLATION_RATE', () => {
  it('is 3% and shared as the single source for future finance assumptions', () => {
    expect(GENERAL_INFLATION_RATE).toBe(0.03);
    expect(FUTURE_FINANCE_ASSUMPTIONS.inflationRate).toBe(GENERAL_INFLATION_RATE);
  });
});
