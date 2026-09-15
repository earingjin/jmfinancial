import { getIn } from './pathUtils';

const isComparableNumber = (value) => value !== '' && value != null && Number.isFinite(Number(value));

// 서버 validateInput의 경계 조건과 동일한 클라이언트 UX 검증이다.
// 계산이나 저장값을 바꾸지 않고, 사용자가 입력을 마친 뒤 안내·이동 차단에만 사용한다.
export function getRetirementLumpSumAgeErrors(formData) {
  const items = getIn(formData, 'expense.retirementLumpSumExpenses');
  if (!Array.isArray(items)) return [];

  const retirementAge = getIn(formData, 'basic.retirementAge');
  const lifeExpectancy = getIn(formData, 'basic.lifeExpectancy');

  return items.flatMap((item, index) => {
    const expectedAge = item?.expectedAge;
    if (!isComparableNumber(expectedAge)) return [];

    const path = `expense.retirementLumpSumExpenses.${index}.expectedAge`;
    if (isComparableNumber(retirementAge) && Number(expectedAge) < Number(retirementAge)) {
      return [{ path, message: `은퇴 예정 연령(${retirementAge}세) 이상으로 입력해 주세요.` }];
    }
    if (isComparableNumber(lifeExpectancy) && Number(expectedAge) > Number(lifeExpectancy)) {
      return [{ path, message: `기대수명(${lifeExpectancy}세) 이하로 입력해 주세요.` }];
    }
    return [];
  });
}
