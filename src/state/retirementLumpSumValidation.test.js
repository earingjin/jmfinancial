import { describe, expect, it } from 'vitest';
import { initialFormData } from './initialFormData';
import { getRetirementLumpSumAgeErrors } from './retirementLumpSumValidation';

function makeForm(expectedAges) {
  const formData = structuredClone(initialFormData);
  formData.basic.retirementAge = 65;
  formData.basic.lifeExpectancy = 85;
  formData.expense.retirementLumpSumExpenses = expectedAges.map((expectedAge, index) => ({
    name: `계획 ${index + 1}`,
    amount: 1000,
    expectedAge,
  }));
  return formData;
}

describe('목돈지출 예상 지출 나이 교차 검증', () => {
  it.each([
    [60, '은퇴 예정 연령(65세) 이상으로 입력해 주세요.'],
    [64, '은퇴 예정 연령(65세) 이상으로 입력해 주세요.'],
    [65, null],
    [66, null],
    [85, null],
    [86, '기대수명(85세) 이하로 입력해 주세요.'],
  ])('expectedAge=%s의 서버 경계와 같은 결과를 반환한다', (expectedAge, expectedMessage) => {
    const errors = getRetirementLumpSumAgeErrors(makeForm([expectedAge]));
    expect(errors[0]?.message || null).toBe(expectedMessage);
  });

  it('여러 항목 중 잘못된 항목의 정확한 배열 path를 반환한다', () => {
    expect(getRetirementLumpSumAgeErrors(makeForm([65, 86]))).toEqual([{
      path: 'expense.retirementLumpSumExpenses.1.expectedAge',
      message: '기대수명(85세) 이하로 입력해 주세요.',
    }]);
  });

  it('빈 값과 아직 정상 숫자가 아닌 값은 기존 숫자·필수 검증에 맡긴다', () => {
    expect(getRetirementLumpSumAgeErrors(makeForm(['', '입력 중']))).toEqual([]);
  });
});
