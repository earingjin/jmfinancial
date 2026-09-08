import { getIn } from './pathUtils';

const isFilled = (value) => value !== '' && value !== null && value !== undefined
  && (typeof value !== 'string' || value.trim() !== '');

// api/_lib/validate.js와 동일한 조건으로 판정한다 - 여기서 걸러지지 않으면 서버가 400으로 거부하는데,
// 그 원인(details)은 화면에 노출되지 않아 사용자가 이유를 알 수 없는 채로 반복 실패하게 된다(연금
// 수령방식을 "월지급/분할 수령"으로 선택하면 수령 시작 나이가 서버 필수값). Wizard.jsx는 DOM API·
// 컴포넌트 트리에 의존해 렌더링 없이 테스트하기 어려우므로, 이 판정만 밖으로 분리해 formData만으로
// 단위 테스트할 수 있게 한다(App.jsx의 formSessionPolicy.js와 동일한 이유).
export function getWizardRequiredFieldDefinitions(formData) {
  const hasSpouse = !!getIn(formData, 'basic.hasSpouse');
  const incomeRequiredFields = [
    ['basic.birthYear', '출생년도', true],
    ['basic.retirementAge', '은퇴(예정) 연령', true],
    ['basic.lifeExpectancy', '기대수명', true],
    ['basic.serviceYears', '근속년수', true],
    ['spouse.birthYear', '배우자 출생년도', hasSpouse],
    ['spouse.retirementAge', '배우자 은퇴(예정) 연령', hasSpouse],
    ['spouse.lifeExpectancy', '배우자 기대여명', hasSpouse],
    ['income.severance.lumpsum', '퇴직 시 예상 퇴직급여 일시금', getIn(formData, 'income.severance.type') === 'lumpsum'],
    ['income.severance.lumpsumAge', '퇴직 시 예상 퇴직급여 일시금 수령 나이', getIn(formData, 'income.severance.type') === 'lumpsum'],
    ['income.severance.pensionStartAge', '퇴직연금 수령 시작 나이', getIn(formData, 'income.severance.type') === 'pension'],
    ['income.personalPension.startAge', '개인연금 수령 시작 나이', getIn(formData, 'income.personalPension.type') === 'installment'],
    ['spouse.severance.lumpsum', '배우자 퇴직 시 예상 퇴직급여 일시금', hasSpouse && getIn(formData, 'spouse.severance.type') === 'lumpsum'],
    ['spouse.severance.lumpsumAge', '배우자 퇴직 시 예상 퇴직급여 일시금 수령 나이', hasSpouse && getIn(formData, 'spouse.severance.type') === 'lumpsum'],
    ['spouse.severance.pensionStartAge', '배우자 퇴직연금 수령 시작 나이', hasSpouse && getIn(formData, 'spouse.severance.type') === 'pension'],
    ['spouse.personalPension.startAge', '배우자 개인연금 수령 시작 나이', hasSpouse && getIn(formData, 'spouse.personalPension.type') === 'installment'],
    ['income.nationalPension.expectedAdditionalContributionMonths', '국민연금 추가 납부 예정 개월 수', getIn(formData, 'income.nationalPension.futureContributionPlan') === 'continue'],
    ['spouse.nationalPension.expectedAdditionalContributionMonths', '배우자 국민연금 추가 납부 예정 개월 수', hasSpouse && getIn(formData, 'spouse.nationalPension.futureContributionPlan') === 'continue'],
    // 이 두 필드는 assets 섹션 데이터지만, Step1Income.jsx가 income.severance.type(또는 배우자)이
    // "pension"일 때 바로 이 조건 그대로 "1. 수입" 화면에 렌더링한다 - 그래서 여기서도 "1. 수입"
    // 안내 문구를 그대로 쓸 수 있다(화면과 필수값 판정이 정확히 같은 조건을 공유한다).
    ['assets.pensionAssetsBreakdown.selfRetirementPension', '본인 퇴직연금 적립금', getIn(formData, 'income.severance.type') === 'pension'],
    ['assets.pensionAssetsBreakdown.spouseRetirementPension', '배우자 퇴직연금 적립금', hasSpouse && getIn(formData, 'spouse.severance.type') === 'pension'],
  ];
  // 나이·금액 중 하나라도 입력된 목돈지출 항목은 지출 용도(name)가 서버 필수값이다(validate.js의 isInUse와 동일 기준).
  const retirementLumpSumExpenses = getIn(formData, 'expense.retirementLumpSumExpenses') || [];
  const missingLumpSumNameFields = retirementLumpSumExpenses
    .flatMap((item, index) => (
      (isFilled(item?.expectedAge) || isFilled(item?.amount) || isFilled(item?.name)) && !isFilled(item?.name)
        ? [[`expense.retirementLumpSumExpenses.${index}.name`, `목돈지출 계획 ${index + 1}번째 항목의 지출 용도`, true]]
        : []
    ));
  const expenseRequiredFields = [
    ['expense.retirementLivingCost', '노후 월 평균 생활비', true],
    ...missingLumpSumNameFields,
  ];

  return { incomeRequiredFields, expenseRequiredFields };
}

export function computeWizardRequiredFields(formData) {
  const { incomeRequiredFields, expenseRequiredFields } = getWizardRequiredFieldDefinitions(formData);
  const missingIncomeFields = incomeRequiredFields.filter(([path, , active]) => active && !isFilled(getIn(formData, path)));
  const basicInfoMissing = missingIncomeFields.length > 0;
  const missingExpenseFields = expenseRequiredFields.filter(([path, , active = true]) => active && !isFilled(getIn(formData, path)));
  const retirementLivingCostMissing = missingExpenseFields.length > 0;

  const requiredErrorMessage = basicInfoMissing
    ? `"1. 수입"에서 다음 항목을 입력해 주세요: ${missingIncomeFields.map(([, label]) => label).join(', ')}`
    : `"2. 지출"에서 다음 항목을 입력해 주세요: ${missingExpenseFields.map(([, label]) => label).join(', ')}`;

  return { missingIncomeFields, missingExpenseFields, basicInfoMissing, retirementLivingCostMissing, requiredErrorMessage };
}
