// 화면 이동 전용 정의. 입력 데이터와 저장 스키마에는 소화면 위치를 추가하지 않는다.
const screen = (id, label, prefixes = [], spouseOnly = false) => ({ id, label, prefixes, spouseOnly });

export const WIZARD_SCREENS = {
  income: [
    screen('basic-self', '본인 기본 정보', ['basic.']),
    screen('basic-spouse', '배우자 선택 · 기본 정보', ['spouse.birthYear', 'spouse.retirementAge', 'spouse.lifeExpectancy']),
    screen('salary-self', '본인 급여', ['income.salary.']),
    screen('salary-spouse', '배우자 급여', ['spouse.salary.'], true),
    screen('salary-total', '가구 급여 확인'),
    screen('severance-self', '본인 퇴직금 · 퇴직연금', ['income.severance.', 'assets.pensionAssetsBreakdown.selfRetirementPension']),
    screen('severance-spouse', '배우자 퇴직금 · 퇴직연금', ['spouse.severance.', 'assets.pensionAssetsBreakdown.spouseRetirementPension'], true),
    screen('severance-total', '퇴직금 · 퇴직연금 합계 확인'),
    screen('national-self', '본인 국민연금', ['income.nationalPension.']),
    screen('national-spouse', '배우자 국민연금', ['spouse.nationalPension.'], true),
    screen('national-total', '국민연금 합계 확인'),
    screen('personal-self', '본인 개인연금', ['income.personalPension.']),
    screen('personal-spouse', '배우자 개인연금', ['spouse.personalPension.'], true),
    screen('personal-total', '개인연금 합계 확인'),
    screen('regular', '기타 정기수입', ['income.regularIncomes.']),
    screen('income-total', '전체 수입 확인'),
  ],
  expense: [
    screen('living-current', '현재 생활비', ['assets.currentLivingCost.']),
    screen('living-retirement', '노후 생활비', ['expense.retirementLivingCost']),
    screen('lump-sum', '은퇴 후 목돈지출', ['expense.retirementLumpSumExpenses.']),
    screen('insurance', '보험', ['assets.insurance.', 'expense.healthInsurance.']),
    screen('other-expense', '기타 지출', ['expense.otherExpenses.']),
    screen('expense-total', '지출 합계'),
  ],
  savings: [screen('current', '현재 저축'), screen('retirement', '노후준비 저축 · 합계 확인')],
  assets: [
    screen('liquid', '현금성 자산'), screen('financial', '금융자산'),
    screen('pension', '연금자산'), screen('real-estate', '부동산'),
    screen('other-assets', '기타자산'), screen('assets-total', '총자산 확인'),
  ],
  debt: [screen('debt', '부채')],
  netWorth: [screen('net-worth', '순자산 확인')],
  scenarios: [screen('scenarios', '대응방안')],
};

export function getWizardScreens(stepKey, hasSpouse = false) {
  return WIZARD_SCREENS[stepKey].filter((item) => hasSpouse || !item.spouseOnly);
}

export function resolveWizardScreenIndex(stepKey, id, hasSpouse = false) {
  const screens = getWizardScreens(stepKey, hasSpouse);
  const index = screens.findIndex((item) => item.id === id);
  if (index >= 0) return index;
  // 배우자 조건이 바뀌면 같은 묶음의 직전 유효 화면으로 이동한다.
  const all = WIZARD_SCREENS[stepKey];
  const originalIndex = all.findIndex((item) => item.id === id);
  if (originalIndex < 0) return 0;
  const previous = all.slice(0, originalIndex).reverse()
    .find((item) => screens.includes(item));
  return previous ? screens.indexOf(previous) : 0;
}

export function getRequiredScreenIndex(stepKey, path, hasSpouse = false) {
  const screens = getWizardScreens(stepKey, hasSpouse);
  const index = screens.findIndex(({ prefixes }) => prefixes.some((prefix) => path?.startsWith(prefix)));
  return Math.max(0, index);
}
