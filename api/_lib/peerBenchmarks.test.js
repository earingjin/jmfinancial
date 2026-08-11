import { describe, it, expect } from 'vitest';
import { PEER_AGE_BRACKETS, getPeerBracket } from './peerBenchmarks.js';

describe('getPeerBracket - age bracket boundaries must be continuous and mutually exclusive', () => {
  it('29세는 29세이하 구간, 30세는 30~39세 구간으로 판정한다 (T, T+1)', () => {
    expect(getPeerBracket(29).key).toBe('under29');
    expect(getPeerBracket(30).key).toBe('30to39');
  });

  it('39세는 30~39세 구간, 40세는 40~49세 구간으로 판정한다 (T, T+1)', () => {
    expect(getPeerBracket(39).key).toBe('30to39');
    expect(getPeerBracket(40).key).toBe('40to49');
  });

  it('49세는 40~49세 구간, 50세는 50~59세 구간으로 판정한다 (T, T+1)', () => {
    expect(getPeerBracket(49).key).toBe('40to49');
    expect(getPeerBracket(50).key).toBe('50to59');
  });

  it('59세는 50~59세 구간, 60세는 60세 이상 구간으로 판정한다 (T, T+1)', () => {
    expect(getPeerBracket(59).key).toBe('50to59');
    expect(getPeerBracket(60).key).toBe('60plus');
  });

  it('아주 높은 나이도 60세 이상 구간에 속한다(마지막 구간 자동 처리가 아니라 실제 상한 없는 구간)', () => {
    expect(getPeerBracket(120).key).toBe('60plus');
  });

  it('나이가 없거나(NaN) 유효하지 않으면 가장 낮은 연령구간으로 처리한다(기존 aggregate.js age=0 규약과 동일)', () => {
    expect(getPeerBracket(NaN).key).toBe('under29');
    expect(getPeerBracket(0).key).toBe('under29');
  });

  it('모든 구간은 사용자 제공 2025년 가계금융복지조사 수치와 정확히 일치한다', () => {
    const byKey = Object.fromEntries(PEER_AGE_BRACKETS.map((b) => [b.key, b]));
    expect(byKey.under29).toMatchObject({ totalAssets: 15500, financialAssets: 8843, totalDebt: 4703, netWorth: 10796, annualIncome: 4509 });
    expect(byKey['30to39']).toMatchObject({ totalAssets: 35958, financialAssets: 14104, totalDebt: 10899, netWorth: 25060, annualIncome: 7386 });
    expect(byKey['40to49']).toMatchObject({ totalAssets: 62714, financialAssets: 16401, totalDebt: 14325, netWorth: 48389, annualIncome: 9333 });
    expect(byKey['50to59']).toMatchObject({ totalAssets: 66205, financialAssets: 16507, totalDebt: 11044, netWorth: 55161, annualIncome: 9416 });
    expect(byKey['60plus']).toMatchObject({ totalAssets: 60095, financialAssets: 11236, totalDebt: 6504, netWorth: 53591, annualIncome: 5767 });
  });
});
