// 화면 이동 전용 정의. 입력 데이터와 저장 스키마에는 소화면 위치를 추가하지 않는다.
const screen = (id, label, prefixes = [], spouseOnly = false) => ({ id, label, prefixes, spouseOnly });

export const WIZARD_SCREENS = {
  income: [
    screen('basic-self', '본인 기본 정보', ['basic.birthYear', 'basic.retirementAge', 'basic.lifeExpectancy']),
    screen('basic-work', '근속년수', ['basic.serviceYears']),
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
  savings: [
    screen('current', '현재 저축', ['assets.savingsPlan.monthly', 'assets.savingsPlan.breakdown.', 'assets.savingsPlan.customItems.']),
    screen('retirement', '노후준비 저축 · 합계 확인'),
  ],
  assets: [
    screen('liquid', '현금성 자산', ['assets.liquidAssets.']), screen('financial', '금융자산', ['assets.financialAssets.']),
    screen('pension', '연금자산', ['assets.pensionAssets']), screen('real-estate', '부동산', ['assets.realEstateAssets.']),
    screen('other-assets', '기타자산', ['assets.otherAssets.']), screen('assets-total', '총자산 확인'),
  ],
  debt: [screen('debt', '부채', ['assets.debtStatus.'])],
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

const WIZARD_STEP_KEYS = ['income', 'expense', 'savings', 'assets', 'debt', 'netWorth'];

export function getWizardLocationForPath(path, hasSpouse = false) {
  if (typeof path !== 'string') return null;
  for (let stepIndex = 0; stepIndex < WIZARD_STEP_KEYS.length; stepIndex += 1) {
    const stepKey = WIZARD_STEP_KEYS[stepIndex];
    const screenItem = getWizardScreens(stepKey, hasSpouse)
      .find(({ prefixes }) => prefixes.some((prefix) => path.startsWith(prefix)));
    if (screenItem) return { stepIndex, stepKey, screenId: screenItem.id };
  }
  return null;
}

const VALIDATION_PATH_TARGETS = {
  'assets.currentLivingCost.monthly': 'wizard-region-expense-current-living',
  'assets.savingsPlan.monthly': 'wizard-region-savings-current',
  'assets.liquidAssets.total': 'wizard-region-assets-liquid',
  'assets.financialAssets.total': 'wizard-region-assets-financial',
  'assets.pensionAssets': 'wizard-region-assets-pension',
  'assets.realEstateAssets.total': 'wizard-region-assets-real-estate',
  'assets.otherAssets.total': 'wizard-region-assets-other',
  'assets.debtStatus.totalBalance': 'wizard-region-debt',
  'assets.debtStatus.monthlyRepayment': 'wizard-region-debt',
};

export function getWizardIssueLocationForPath(path, hasSpouse = false) {
  const location = getWizardLocationForPath(path, hasSpouse);
  return location ? { ...location, targetId: VALIDATION_PATH_TARGETS[path] || path } : null;
}

const VALIDATION_MESSAGE_LOCATIONS = [
  ['노후 월 평균 생활비는 필수 입력 항목입니다.', 'expense', 'living-retirement', 'expense.retirementLivingCost', '노후 월 평균 생활비'],
  ['본인·배우자 퇴직연금 적립금 합계는 연금자산 총액을 초과할 수 없습니다.', 'assets', 'pension', 'wizard-region-assets-pension', '연금자산과 퇴직연금 적립금'],
  ['노후준비 월 저축액은 총 월 저축액보다 클 수 없습니다.', 'savings', 'retirement', 'wizard-region-savings-retirement', '노후준비 월 저축액'],
  ['노후준비 연 저축액은 총 연 저축액보다 클 수 없습니다.', 'savings', 'retirement', 'wizard-region-savings-retirement', '노후준비 연 저축액'],
  ['기대수명(은퇴 종료 연령)은 은퇴 시작 연령보다 작을 수 없습니다.', 'income', 'basic-self', 'wizard-region-income-basic-self', '기대수명과 은퇴 연령'],
  ['배우자 기대여명은 배우자 은퇴(예정) 연령보다 작을 수 없습니다.', 'income', 'basic-spouse', 'wizard-region-income-basic-spouse', '배우자 기대여명과 은퇴 연령'],
];

export function getWizardLocationForValidationMessage(message, formData) {
  const match = VALIDATION_MESSAGE_LOCATIONS.find(([known]) => known === message);
  if (!match) return null;
  const [, stepKey, screenId, targetId, label] = match;
  if (screenId === 'basic-spouse' && formData?.basic?.hasSpouse !== true) return null;
  const stepIndex = WIZARD_STEP_KEYS.indexOf(stepKey);
  return stepIndex >= 0 ? { stepIndex, stepKey, screenId, targetId, label } : null;
}
