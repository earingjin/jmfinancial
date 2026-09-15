import { describe, expect, it } from 'vitest';
import { initialFormData } from './initialFormData';
import {
  containsTechnicalErrorText,
  formatValidationDetailForUser,
  formatValidationDetailsForUser,
  getTrustedValidationTarget,
  toKnownUserMessage,
  toUserFacingCalculationError,
} from './userFacingErrors';

function formDataWithLumpSums() {
  return {
    ...initialFormData,
    expense: {
      ...initialFormData.expense,
      retirementLumpSumExpenses: [
        { name: '차량 교체', amount: 3000, expectedAge: 64 },
        { name: '주택 수리', amount: 2000, expectedAge: 91 },
      ],
    },
  };
}

describe('사용자용 검증 오류 변환', () => {
  const formData = formDataWithLumpSums();

  it('단일·중첩 field path를 기존 Wizard label로 변환한다', () => {
    expect(formatValidationDetailForUser('basic.birthYear 값은 정수여야 합니다.', formData))
      .toBe('출생년도는 정수여야 합니다.');
    expect(formatValidationDetailForUser('income.nationalPension.simulate.averageMonthlyIncome 값은 유효한 숫자여야 합니다.', {
      ...formData,
      income: {
        ...formData.income,
        nationalPension: { ...formData.income.nationalPension, inputMode: 'simulate' },
      },
    })).toBe('국민연금 모의계산 가입기간 중 월평균급여는 유효한 숫자여야 합니다.');
  });

  it('배열 첫 번째·두 번째 항목을 사용자 기준 순번과 실제 입력 label로 변환한다', () => {
    expect(formatValidationDetailForUser('expense.retirementLumpSumExpenses.0.name 값은 필수 입력 항목입니다.', formData))
      .toBe('목돈지출 계획 1번째 항목의 지출 용도는 필수 입력 항목입니다.');
    expect(formatValidationDetailForUser('expense.retirementLumpSumExpenses.0.amount 값은 0보다 커야 합니다.', formData))
      .toBe('목돈지출 계획 1번째 항목의 예상 금액은 0보다 커야 합니다.');
    expect(formatValidationDetailForUser('expense.retirementLumpSumExpenses.0.expectedAge 값은 은퇴 예정 연령(65세) 이상으로 입력해 주세요.', formData))
      .toBe('목돈지출 계획 1번째 항목의 예상 지출 나이는 은퇴 예정 연령(65세) 이상으로 입력해 주세요.');
    expect(formatValidationDetailForUser('expense.retirementLumpSumExpenses.1.expectedAge 값은 기대수명(90세) 이하로 입력해 주세요.', formData))
      .toBe('목돈지출 계획 2번째 항목의 예상 지출 나이는 기대수명(90세) 이하로 입력해 주세요.');
  });

  it('등록된 Wizard field와 실제 화면이 모두 확인된 path만 복구 대상으로 허용한다', () => {
    expect(getTrustedValidationTarget(
      'expense.retirementLumpSumExpenses.1.expectedAge 값은 기대수명(90세) 이하로 입력해 주세요.',
      formData,
    )).toEqual({
      path: 'expense.retirementLumpSumExpenses.1.expectedAge',
      stepIndex: 1,
      stepKey: 'expense',
      screenId: 'lump-sum',
    });
    expect(getTrustedValidationTarget('expense.unknown.0.value 값이 잘못되었습니다.', formData)).toBeNull();
  });

  it('알 수 없는 path와 기술 오류는 숨기고 자연스러운 한국어 오류는 유지한다', () => {
    expect(formatValidationDetailForUser('assets.some.internal.path 값이 잘못되었습니다.', formData))
      .toBe('입력값을 다시 확인해 주세요.');
    expect(formatValidationDetailForUser('"scenarios" 섹션이 누락되었습니다.', formData))
      .toBe('입력값을 다시 확인해 주세요.');
    expect(formatValidationDetailForUser('노후준비 월 저축액은 총 월 저축액보다 클 수 없습니다.', formData))
      .toBe('노후준비 월 저축액은 총 월 저축액보다 클 수 없습니다.');
  });

  it('중복 fallback을 합치고 사용자 렌더 문자열에 내부 흔적을 남기지 않는다', () => {
    const rendered = formatValidationDetailsForUser([
      'expense.unknown.0.value 값이 잘못되었습니다.',
      'income.unknown.1.value 값이 잘못되었습니다.',
      'TypeError: PostgREST failed',
    ], formData).join('\n');
    expect(rendered).toBe('입력값을 다시 확인해 주세요.');
    ['expense.', 'income.', 'assets.', 'basic.', 'scenarios.', '.0.', '.1.', 'Error:', 'TypeError', 'Supabase', 'PostgREST']
      .forEach((token) => expect(rendered).not.toContain(token));
  });

  it('예상하지 못한 계산·네트워크 error.message는 문맥별 fallback으로 변환한다', () => {
    expect(toUserFacingCalculationError('TypeError: Failed to fetch'))
      .toBe('계산 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    expect(toUserFacingCalculationError('로그인이 만료되었습니다. 다시 로그인해 주세요.'))
      .toBe('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    expect(containsTechnicalErrorText('Supabase PostgREST assets.table')).toBe(true);
    expect(toKnownUserMessage('로그인이 만료되었습니다.', ['로그인이 만료되었습니다.'], '처리하지 못했습니다.'))
      .toBe('로그인이 만료되었습니다.');
    expect(toKnownUserMessage('PostgREST users failed', ['로그인이 만료되었습니다.'], '처리하지 못했습니다.'))
      .toBe('처리하지 못했습니다.');
  });
});
