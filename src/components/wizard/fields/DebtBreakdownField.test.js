import { describe, expect, it } from 'vitest';
import { applyLoanFieldChange } from './DebtBreakdownField.jsx';

// repaymentType 전환 시 이전 방식에서만 쓰던 부담액 필드(monthlyInterest/monthlyRepayment)가
// formData에 stale 값으로 남아 있다가, 되돌릴 때 재확인 없이 부활하던 문제의 회귀 방지 테스트.
// principal·months·(custom의) name처럼 상환방식과 무관한 공통 필드는 그대로 유지되어야 한다.
describe('applyLoanFieldChange - repaymentType 전환 시 이전 방식 필드 초기화', () => {
  it('interestOnly에서 equalPrincipal로 바꾸면 monthlyInterest가 비워진다', () => {
    const item = { repaymentType: 'interestOnly', principal: 5000, monthlyInterest: 30, months: 120 };
    const { next, clearedField } = applyLoanFieldChange(item, 'repaymentType', 'equalPrincipal');
    expect(next.repaymentType).toBe('equalPrincipal');
    expect(next.monthlyInterest).toBe('');
    expect(clearedField).toBe('monthlyInterest');
    // 상환방식과 무관한 공통 필드는 그대로 유지된다.
    expect(next.principal).toBe(5000);
    expect(next.months).toBe(120);
  });

  it('equalPrincipal에서 interestOnly로 바꾸면 monthlyRepayment가 비워진다', () => {
    const item = { repaymentType: 'equalPrincipal', principal: 3000, monthlyRepayment: 50, months: 60 };
    const { next, clearedField } = applyLoanFieldChange(item, 'repaymentType', 'interestOnly');
    expect(next.repaymentType).toBe('interestOnly');
    expect(next.monthlyRepayment).toBe('');
    expect(clearedField).toBe('monthlyRepayment');
    expect(next.principal).toBe(3000);
    expect(next.months).toBe(60);
  });

  it('interestOnly -> equalPrincipal -> interestOnly로 되돌려도 과거 monthlyInterest가 자동 복구되지 않는다', () => {
    let item = { repaymentType: 'interestOnly', principal: 5000, monthlyInterest: 30, months: 120 };
    item = applyLoanFieldChange(item, 'repaymentType', 'equalPrincipal').next;
    expect(item.monthlyInterest).toBe('');
    item = applyLoanFieldChange(item, 'monthlyRepayment', 80).next;
    item = applyLoanFieldChange(item, 'repaymentType', 'interestOnly').next;
    // equalPrincipal 값(80)이 이제 stale이 되어 비워지고, 예전 30은 되살아나지 않는다.
    expect(item.monthlyRepayment).toBe('');
    expect(item.monthlyInterest).toBe('');
  });

  it('repaymentType이 아닌 필드 변경은 다른 필드를 건드리지 않는다', () => {
    const item = { repaymentType: 'interestOnly', principal: 5000, monthlyInterest: 30, months: 120 };
    const { next, clearedField } = applyLoanFieldChange(item, 'principal', 6000);
    expect(next.principal).toBe(6000);
    expect(next.monthlyInterest).toBe(30);
    expect(next.months).toBe(120);
    expect(clearedField).toBeNull();
  });

  it('새 방식으로 정상 입력한 값은 그대로 유지된다(기존 계산에 정상 반영)', () => {
    let item = { repaymentType: 'interestOnly', principal: 5000, monthlyInterest: 30, months: 120 };
    item = applyLoanFieldChange(item, 'repaymentType', 'equalPrincipal').next;
    item = applyLoanFieldChange(item, 'monthlyRepayment', 45).next;
    expect(item).toMatchObject({ repaymentType: 'equalPrincipal', principal: 5000, monthlyInterest: '', monthlyRepayment: 45, months: 120 });
  });

  it('item이 없을 때(신규 항목)도 안전하게 기본 repaymentType을 적용한다', () => {
    const { next } = applyLoanFieldChange(undefined, 'principal', 1000);
    expect(next).toMatchObject({ repaymentType: 'interestOnly', principal: 1000 });
  });

  it('커스텀 대출의 name은 repaymentType 전환과 무관하게 유지된다', () => {
    const item = { name: '신용대출', repaymentType: 'interestOnly', principal: 1000, monthlyInterest: 10, months: 24 };
    const { next } = applyLoanFieldChange(item, 'repaymentType', 'equalPrincipal');
    expect(next.name).toBe('신용대출');
  });
});
