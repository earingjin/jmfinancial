import { getIn } from './pathUtils';

const isFilled = (value) => value !== '' && value !== null && value !== undefined;

// api/_lib/validate.js와 동일한 조건으로 판정한다 - 여기서 걸러지지 않으면 서버가 400으로 거부하는데,
// 그 원인(details)은 화면에 노출되지 않아 사용자가 이유를 알 수 없는 채로 반복 실패하게 된다(연금
// 수령방식을 "월지급/분할 수령"으로 선택하면 수령 시작 나이가 서버 필수값). Wizard.jsx는 DOM API·
// 컴포넌트 트리에 의존해 렌더링 없이 테스트하기 어려우므로, 이 판정만 밖으로 분리해 formData만으로
// 단위 테스트할 수 있게 한다(App.jsx의 formSessionPolicy.js와 동일한 이유).
export function computeWizardRequiredFields(formData) {
  const hasSpouse = !!getIn(formData, 'basic.hasSpouse');
  const incomeRequiredFields = [
    ['basic.birthYear', '출생년도', true],
    ['basic.retirementAge', '은퇴(예정) 연령', true],
    ['basic.lifeExpectancy', '기대수명', true],
    ['basic.serviceYears', '근속년수', true],
    ['spouse.birthYear', '배우자 출생년도', hasSpouse],
    ['spouse.retirementAge', '배우자 은퇴(예정) 연령', hasSpouse],
    ['spouse.lifeExpectancy', '배우자 기대여명', hasSpouse],
    ['income.severance.pensionStartAge', '퇴직연금 수령 시작 나이', getIn(formData, 'income.severance.type') === 'pension'],
    ['income.personalPension.startAge', '개인연금 수령 시작 나이', getIn(formData, 'income.personalPension.type') === 'installment'],
    ['spouse.severance.pensionStartAge', '배우자 퇴직연금 수령 시작 나이', hasSpouse && getIn(formData, 'spouse.severance.type') === 'pension'],
    ['spouse.personalPension.startAge', '배우자 개인연금 수령 시작 나이', hasSpouse && getIn(formData, 'spouse.personalPension.type') === 'installment'],
  ];
  const missingIncomeFields = incomeRequiredFields.filter(([path, , active]) => active && !isFilled(getIn(formData, path)));
  const basicInfoMissing = missingIncomeFields.length > 0;

  // 나이·금액 중 하나라도 입력된 목돈지출 항목은 지출 용도(name)가 서버 필수값이다(validate.js의 isInUse와 동일 기준).
  const retirementLumpSumExpenses = getIn(formData, 'expense.retirementLumpSumExpenses') || [];
  const missingLumpSumNameFields = retirementLumpSumExpenses
    .map((item, index) => [`expense.retirementLumpSumExpenses.${index}.name`, `목돈지출 계획 ${index + 1}번째 항목의 지출 용도`, item])
    .filter(([, , item]) => (isFilled(item?.expectedAge) || isFilled(item?.amount) || isFilled(item?.name)) && !isFilled(item?.name));
  const missingExpenseFields = [
    ...(isFilled(getIn(formData, 'expense.retirementLivingCost')) ? [] : [['expense.retirementLivingCost', '노후 월 평균 생활비']]),
    ...missingLumpSumNameFields,
  ];
  const retirementLivingCostMissing = missingExpenseFields.length > 0;

  const requiredErrorMessage = basicInfoMissing
    ? `"1. 수입"에서 다음 항목을 입력해 주세요: ${missingIncomeFields.map(([, label]) => label).join(', ')}`
    : `"2. 지출"에서 다음 항목을 입력해 주세요: ${missingExpenseFields.map(([, label]) => label).join(', ')}`;

  return { missingIncomeFields, missingExpenseFields, basicInfoMissing, retirementLivingCostMissing, requiredErrorMessage };
}
