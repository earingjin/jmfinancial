import { getIn } from './pathUtils';

const isFilled = (value) => value !== '' && value !== null && value !== undefined
  && (typeof value !== 'string' || value.trim() !== '');
const isNonNegativeNumber = (value) => isFilled(value) && Number.isFinite(Number(value)) && Number(value) >= 0;
const isPositiveNumber = (value) => isFilled(value) && Number.isFinite(Number(value)) && Number(value) > 0;
const isPositiveInteger = (value) => isPositiveNumber(value) && Number.isInteger(Number(value));
const sum = (values) => values.reduce((total, value) => total + (Number(value) || 0), 0);
const itemAmounts = (items, key) => (Array.isArray(items) ? items : []).map((item) => item?.[key]);

const LIVING_COST_KEYS = ['rent', 'maintenance', 'utilities', 'fuel', 'carInsurance', 'clothing', 'fourInsurances', 'food', 'communication', 'medical', 'subscription'];
const SAVINGS_KEYS = ['installment', 'isa', 'variableAnnuity', 'pensionSavings', 'irp', 'subscription', 'stocks', 'parkingAccount'];
const LIQUID_ASSET_KEYS = ['deposit', 'savings', 'cma', 'subscription', 'emergencyFund'];
const DEBT_KEYS = ['mortgage', 'depositLoan', 'businessLoan', 'buildingLoan', 'carLoan', 'studentLoan', 'otherLoan'];

const hasDetailedLivingCost = (formData) => {
  const breakdown = getIn(formData, 'assets.currentLivingCost.breakdown') || {};
  return [...LIVING_COST_KEYS.map((key) => breakdown[key]), ...itemAmounts(breakdown.otherItems, 'amount')]
    .some(isNonNegativeNumber);
};

const detailedSavingsTotal = (formData) => {
  const breakdown = getIn(formData, 'assets.savingsPlan.breakdown') || {};
  return sum([...SAVINGS_KEYS.map((key) => breakdown[key]?.monthly), ...itemAmounts(getIn(formData, 'assets.savingsPlan.customItems'), 'monthly')]);
};

const SAVINGS_CATEGORY_LABELS = {
  installment: '적금', isa: 'ISA', variableAnnuity: '변액연금', pensionSavings: '연금저축',
  irp: 'IRP', subscription: '청약', stocks: '주식', parkingAccount: '파킹통장',
};

// 저축 카테고리 버튼(적금·ISA 등) 선택 상태 - assets.savingsPlan.selectedCategories(formData)에
// 명시적으로 배열이 있으면(빈 배열 포함) 그것만 신뢰하고, 배열이 아니면(이 필드 자체가 없던 과거
// 저장 데이터) 월 저축액이 양수인 항목만 선택된 것으로 복원한다. api/_lib/validate.js와
// SavingsBreakdownField.jsx도 동일한 판정을 각자 독립적으로 구현한다(서버가 프론트 로컬 상태인
// openKeys에 의존하지 않게 하기 위함).
const isSavingsCategorySelected = (formData, key) => {
  const explicit = getIn(formData, 'assets.savingsPlan.selectedCategories');
  if (Array.isArray(explicit)) return explicit.includes(key);
  return isPositiveNumber(getIn(formData, `assets.savingsPlan.breakdown.${key}.monthly`));
};

// 선택된 저축 항목은 전체 합계(detailedSavingsTotal)가 양수라는 이유로 마스킹되면 안 된다 -
// 항목마다 독립적으로 월 저축액을 요구한다. remainingMonths·interestRate·누적금액은 계산에
// 쓰이지 않는 참고값이라 여기서 필수화하지 않는다.
const buildSavingsCategoryRowFields = (formData) => {
  if (getIn(formData, 'assets.savingsPlan.hasSavings') !== true
    || getIn(formData, 'assets.savingsPlan.inputMode') !== 'detailed') return [];
  return SAVINGS_KEYS.filter((key) => isSavingsCategorySelected(formData, key)).map((key) => (
    [`assets.savingsPlan.breakdown.${key}.monthly`, `${SAVINGS_CATEGORY_LABELS[key]} 월 저축액`, true, isPositiveNumber]
  ));
};

// "+ 저축 항목 추가"로 만든 행은 기본값으로 자동 생성되는 법이 없어(항상 사용자의 명시적 클릭)
// 존재 자체가 곧 활성 상태다 - 다른 반복행(부채·기타수입 등)과 달리 "값이 하나라도 채워졌을 때만
// 활성"으로 보지 않는다. remainingMonths·interestRate는 여기서도 필수화하지 않는다.
const buildSavingsCustomItemFields = (formData) => {
  if (getIn(formData, 'assets.savingsPlan.hasSavings') !== true
    || getIn(formData, 'assets.savingsPlan.inputMode') !== 'detailed') return [];
  const items = getIn(formData, 'assets.savingsPlan.customItems');
  if (!Array.isArray(items)) return [];
  return items.flatMap((_item, index) => ([
    [`assets.savingsPlan.customItems.${index}.name`, `기본 항목 외 추가 저축 ${index + 1} 이름`, true],
    [`assets.savingsPlan.customItems.${index}.monthly`, `기본 항목 외 추가 저축 ${index + 1} 월 저축액`, true, isPositiveNumber],
  ]));
};

const detailedAssetTotal = (formData, type) => {
  if (type === 'liquid') {
    const breakdown = getIn(formData, 'assets.liquidAssets.breakdown') || {};
    return sum([...LIQUID_ASSET_KEYS.map((key) => breakdown[key]), ...itemAmounts(getIn(formData, 'assets.liquidAssets.customItems'), 'amount')]);
  }
  if (type === 'financial') {
    return sum([
      getIn(formData, 'assets.financialAssets.stocks'), getIn(formData, 'assets.financialAssets.funds'),
      getIn(formData, 'assets.financialAssets.bonds'), ...itemAmounts(getIn(formData, 'assets.financialAssets.otherItems'), 'amount'),
    ]);
  }
  if (type === 'pension') {
    const breakdown = getIn(formData, 'assets.pensionAssetsBreakdown') || {};
    return sum([
      breakdown.variableAnnuity,
      breakdown.pensionSavingsAccount,
      breakdown.irp,
      breakdown.selfRetirementPension,
      getIn(formData, 'basic.hasSpouse') === true ? breakdown.spouseRetirementPension : 0,
      ...itemAmounts(breakdown.otherItems, 'amount'),
    ]);
  }
  if (type === 'realEstate') {
    return sum([getIn(formData, 'assets.realEstateAssets.mainProperty'), ...itemAmounts(getIn(formData, 'assets.realEstateAssets.otherItems'), 'amount')]);
  }
  return sum(itemAmounts(getIn(formData, 'assets.otherAssets.items'), 'amount'));
};

const detailedDebtItems = (formData) => {
  const breakdown = getIn(formData, 'assets.debtStatus.breakdown') || {};
  const customItems = getIn(formData, 'assets.debtStatus.customItems');
  return [...DEBT_KEYS.map((key) => breakdown[key] || {}), ...(Array.isArray(customItems) ? customItems : [])];
};
const detailedDebtBalance = (formData) => sum(detailedDebtItems(formData).map((item) => item.principal));
const hasDetailedDebtBurden = (formData) => detailedDebtItems(formData).some((item) => (
  isPositiveNumber(item.principal)
  && isNonNegativeNumber(item.repaymentType === 'equalPrincipal' ? item.monthlyRepayment : item.monthlyInterest)
));

const buildDetailedDebtRowFields = (formData) => {
  if (getIn(formData, 'assets.debtStatus.hasDebt') !== true
    || getIn(formData, 'assets.debtStatus.inputMode') !== 'detailed') return [];
  const breakdown = getIn(formData, 'assets.debtStatus.breakdown') || {};
  const customItems = getIn(formData, 'assets.debtStatus.customItems');
  const rows = [
    ...DEBT_KEYS.map((key) => ({ basePath: `assets.debtStatus.breakdown.${key}`, item: breakdown[key] || {}, custom: false })),
    ...(Array.isArray(customItems) ? customItems : []).map((item, index) => ({ basePath: `assets.debtStatus.customItems.${index}`, item, custom: true })),
  ];
  return rows.flatMap(({ basePath, item, custom }, index) => {
    const burdenKey = item?.repaymentType === 'equalPrincipal' ? 'monthlyRepayment' : 'monthlyInterest';
    const active = isFilled(item?.principal) || isFilled(item?.[burdenKey]) || (custom && isFilled(item?.name));
    if (!active) return [];
    const labelIndex = custom ? index - DEBT_KEYS.length + 1 : index + 1;
    return [
      [`${basePath}.principal`, `대출 ${labelIndex} 원금`, true, isPositiveNumber],
      [`${basePath}.${burdenKey}`, `대출 ${labelIndex} 월 부담액`, true, isNonNegativeNumber],
      ...(custom ? [[`${basePath}.name`, `추가 대출 ${labelIndex} 이름`, true]] : []),
    ];
  });
};

const buildOtherIncomeRowFields = (formData) => {
  const items = getIn(formData, 'income.regularIncomes');
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, index) => {
    if (item?.type === 'business') return [];
    const active = isFilled(item?.name) || isFilled(item?.annual) || isFilled(item?.years);
    if (!active) return [];
    return [
      [`income.regularIncomes.${index}.name`, `기타 정기수입 ${index + 1} 항목 이름`, true],
      [`income.regularIncomes.${index}.annual`, `기타 정기수입 ${index + 1} 연간 금액`, true, isPositiveNumber],
      [`income.regularIncomes.${index}.years`, `기타 정기수입 ${index + 1} 유지기간`, true, isPositiveInteger],
    ];
  });
};

const buildLumpSumExpenseRowFields = (formData) => {
  const items = getIn(formData, 'expense.retirementLumpSumExpenses');
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, index) => {
    const active = isFilled(item?.name) || isFilled(item?.amount) || isFilled(item?.expectedAge);
    if (!active) return [];
    return [
      [`expense.retirementLumpSumExpenses.${index}.name`, `목돈지출 계획 ${index + 1}번째 항목의 지출 용도`, true],
      [`expense.retirementLumpSumExpenses.${index}.amount`, `목돈지출 계획 ${index + 1}번째 항목의 금액`, true, isPositiveNumber],
      [`expense.retirementLumpSumExpenses.${index}.expectedAge`, `목돈지출 계획 ${index + 1}번째 항목의 발생 나이`, true],
    ];
  });
};

// income.regularIncomes(기타 정기수입)의 완결성 판정과 동일한 원칙: 완전히 빈 행은 무시하고,
// 하나라도 채워진 행만 전체 필드를 요구한다. 전체 합계가 양수라는 이유로 이 행이 마스킹되지 않는다.
const buildOtherExpenseRowFields = (formData) => {
  const items = getIn(formData, 'expense.otherExpenses');
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, index) => {
    const active = isFilled(item?.name) || isFilled(item?.annual) || isFilled(item?.years);
    if (!active) return [];
    return [
      [`expense.otherExpenses.${index}.name`, `기타 지출 ${index + 1} 항목 이름`, true],
      [`expense.otherExpenses.${index}.annual`, `기타 지출 ${index + 1} 연간 금액`, true, isPositiveNumber],
      [`expense.otherExpenses.${index}.years`, `기타 지출 ${index + 1} 유지기간`, true, isPositiveInteger],
    ];
  });
};

// 월 보험료는 assets.insurance.monthlyPremium과 동일하게 명시적 0을 허용한다(isNonNegativeNumber).
const buildHealthInsuranceRowFields = (formData) => {
  const items = getIn(formData, 'expense.healthInsurance.items');
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, index) => {
    const active = isFilled(item?.name) || isFilled(item?.monthly);
    if (!active) return [];
    return [
      [`expense.healthInsurance.items.${index}.name`, `기타 보험료 ${index + 1} 항목 이름`, true],
      [`expense.healthInsurance.items.${index}.monthly`, `기타 보험료 ${index + 1} 월 보험료`, true, isNonNegativeNumber],
    ];
  });
};

const fieldIsValid = (formData, [path, , active, validate]) => (
  !active || (validate ? validate(getIn(formData, path), formData) : isFilled(getIn(formData, path)))
);

// api/_lib/validate.js와 같은 조건으로 판정한다. 네 번째 값은 공란 여부보다 강한 조건
// (양수 또는 상세입력 합계)을 검사할 때만 사용한다.
export function getWizardRequiredFieldDefinitions(formData) {
  const hasSpouse = !!getIn(formData, 'basic.hasSpouse');
  // 국민연금 입력 방식 - "direct"/"simulate"가 아닌 값(대표적으로 "none")은 비교에 실패해 아래
  // 조건들이 모두 비활성화된다. api/_lib/validate.js와 동일하게 기본값으로 되돌리지 않는다 -
  // 실제 신규 입력은 initialFormData가 항상 'direct'를 명시하므로 결과가 같다.
  const npMode = getIn(formData, 'income.nationalPension.inputMode');
  const spouseNpMode = getIn(formData, 'spouse.nationalPension.inputMode');
  const incomeRequiredFields = [
    ['basic.birthYear', '출생년도', true],
    ['basic.retirementAge', '은퇴(예정) 연령', true],
    ['basic.lifeExpectancy', '기대수명', true],
    ['basic.serviceYears', '근속년수', true],
    ['spouse.birthYear', '배우자 출생년도', hasSpouse],
    ['spouse.retirementAge', '배우자 은퇴(예정) 연령', hasSpouse],
    ['spouse.lifeExpectancy', '배우자 기대여명', hasSpouse],
    ['income.salary.monthly', '본인 월급', getIn(formData, 'income.salary.hasSalary') === true, isPositiveNumber],
    ['spouse.salary.monthly', '배우자 월급', hasSpouse && getIn(formData, 'spouse.salary.hasSalary') === true, isPositiveNumber],
    ['income.severance.lumpsum', '퇴직 시 예상 퇴직급여 일시금', getIn(formData, 'income.severance.type') === 'lumpsum'],
    ['income.severance.lumpsumAge', '퇴직 시 예상 퇴직급여 일시금 수령 나이', getIn(formData, 'income.severance.type') === 'lumpsum'],
    ['income.severance.pensionStartAge', '퇴직연금 수령 시작 나이', getIn(formData, 'income.severance.type') === 'pension'],
    ['income.severance.pensionMonthly', '퇴직연금 월 수령 금액', getIn(formData, 'income.severance.type') === 'pension'],
    ['income.severance.pensionMonths', '퇴직연금 수령 기간', getIn(formData, 'income.severance.type') === 'pension'],
    ['income.personalPension.startAge', '개인연금 수령 시작 나이', getIn(formData, 'income.personalPension.type') === 'installment'],
    ['income.personalPension.monthly', '개인연금 월 수령액', getIn(formData, 'income.personalPension.type') === 'installment'],
    ['income.personalPension.months', '개인연금 수령 개월 수', getIn(formData, 'income.personalPension.type') === 'installment'],
    ['spouse.severance.lumpsum', '배우자 퇴직 시 예상 퇴직급여 일시금', hasSpouse && getIn(formData, 'spouse.severance.type') === 'lumpsum'],
    ['spouse.severance.lumpsumAge', '배우자 퇴직 시 예상 퇴직급여 일시금 수령 나이', hasSpouse && getIn(formData, 'spouse.severance.type') === 'lumpsum'],
    ['spouse.severance.pensionStartAge', '배우자 퇴직연금 수령 시작 나이', hasSpouse && getIn(formData, 'spouse.severance.type') === 'pension'],
    ['spouse.severance.pensionMonthly', '배우자 퇴직연금 월 수령 금액', hasSpouse && getIn(formData, 'spouse.severance.type') === 'pension'],
    ['spouse.severance.pensionMonths', '배우자 퇴직연금 수령 기간', hasSpouse && getIn(formData, 'spouse.severance.type') === 'pension'],
    ['spouse.personalPension.startAge', '배우자 개인연금 수령 시작 나이', hasSpouse && getIn(formData, 'spouse.personalPension.type') === 'installment'],
    ['spouse.personalPension.monthly', '배우자 개인연금 월 수령액', hasSpouse && getIn(formData, 'spouse.personalPension.type') === 'installment'],
    ['spouse.personalPension.months', '배우자 개인연금 수령 개월 수', hasSpouse && getIn(formData, 'spouse.personalPension.type') === 'installment'],
    ['income.nationalPension.monthly', '국민연금 월 수령(예상) 금액', npMode === 'direct'],
    ['income.nationalPension.simulate.averageMonthlyIncome', '국민연금 모의계산 가입기간 중 월평균급여', npMode === 'simulate'],
    ['income.nationalPension.simulate.contributionMonths', '국민연금 모의계산 실제 보험료 납부 개월 수', npMode === 'simulate'],
    ['income.nationalPension.expectedAdditionalContributionMonths', '국민연금 추가 납부 예정 개월 수', getIn(formData, 'income.nationalPension.futureContributionPlan') === 'continue'],
    ['spouse.nationalPension.monthly', '배우자 국민연금 월 수령(예상) 금액', hasSpouse && spouseNpMode === 'direct'],
    ['spouse.nationalPension.simulate.averageMonthlyIncome', '배우자 국민연금 모의계산 가입기간 중 월평균급여', hasSpouse && spouseNpMode === 'simulate'],
    ['spouse.nationalPension.simulate.contributionMonths', '배우자 국민연금 모의계산 실제 보험료 납부 개월 수', hasSpouse && spouseNpMode === 'simulate'],
    ['spouse.nationalPension.expectedAdditionalContributionMonths', '배우자 국민연금 추가 납부 예정 개월 수', hasSpouse && getIn(formData, 'spouse.nationalPension.futureContributionPlan') === 'continue'],
    ['assets.pensionAssetsBreakdown.selfRetirementPension', '본인 퇴직연금 적립금', getIn(formData, 'income.severance.type') === 'pension'],
    ['assets.pensionAssetsBreakdown.spouseRetirementPension', '배우자 퇴직연금 적립금', hasSpouse && getIn(formData, 'spouse.severance.type') === 'pension'],
    ...buildOtherIncomeRowFields(formData),
  ];

  const currentLivingDetailed = getIn(formData, 'assets.currentLivingCost.inputMode') === 'detailed';
  const expenseRequiredFields = [
    ['assets.currentLivingCost.monthly', '현재 월 생활비', true, currentLivingDetailed ? (_value, data) => hasDetailedLivingCost(data) : isNonNegativeNumber],
    ['assets.insurance.monthlyPremium', '월 보장성 보험료', getIn(formData, 'assets.insurance.hasInsurance') === true, isNonNegativeNumber],
    ['expense.retirementLivingCost', '노후 월 평균 생활비', true],
    ...buildLumpSumExpenseRowFields(formData),
    ...buildOtherExpenseRowFields(formData),
    ...buildHealthInsuranceRowFields(formData),
  ];

  const savingsDetailed = getIn(formData, 'assets.savingsPlan.inputMode') === 'detailed';
  const savingsRequiredFields = [
    [
      'assets.savingsPlan.monthly', '현재 월 저축액', getIn(formData, 'assets.savingsPlan.hasSavings') === true,
      savingsDetailed ? (_value, data) => detailedSavingsTotal(data) > 0 : isPositiveNumber,
    ],
    ...buildSavingsCategoryRowFields(formData),
    ...buildSavingsCustomItemFields(formData),
  ];

  const assetDefinitions = [
    ['assets.liquidAssets', '현금성 자산 총액', 'liquid', 'inputMode', 'total', 'hasAssets'],
    ['assets.financialAssets', '금융자산 총액', 'financial', 'inputMode', 'total', 'hasAssets'],
    ['assets', '연금자산 총액', 'pension', 'pensionAssetsInputMode', 'pensionAssets', 'hasPensionAssets'],
    ['assets.realEstateAssets', '부동산자산 총액', 'realEstate', 'inputMode', 'total', 'hasAssets'],
    ['assets.otherAssets', '기타 자산 총액', 'other', 'inputMode', 'total', 'hasAssets'],
  ];
  const assetRequiredFields = assetDefinitions.map(([basePath, label, type, modeKey, totalKey, presenceKey]) => {
    const modePath = basePath === 'assets' ? `assets.${modeKey}` : `${basePath}.${modeKey}`;
    const totalPath = basePath === 'assets' ? `assets.${totalKey}` : `${basePath}.${totalKey}`;
    const presencePath = basePath === 'assets' ? `assets.${presenceKey}` : `${basePath}.${presenceKey}`;
    const detailed = getIn(formData, modePath) === 'detailed';
    return [totalPath, label, getIn(formData, presencePath) === true, detailed ? (_value, data) => detailedAssetTotal(data, type) > 0 : isPositiveNumber];
  });

  // 부동산 종류(mainPropertyType)를 선택했다면 그 종류의 시세(mainProperty)는 다른 부동산 항목
  // (otherItems) 합계가 양수라는 이유로 마스킹되어서는 안 된다. 명시적 0은 "보유 부동산 가격"으로
  // 유효하지 않으므로 isPositiveNumber로 판정한다(assets.pensionAssetsBreakdown.selfRetirementPension
  // 처럼 0을 허용하는 필드와는 의미가 다르다).
  assetRequiredFields.push([
    'assets.realEstateAssets.mainProperty', '주요 부동산 시세',
    isFilled(getIn(formData, 'assets.realEstateAssets.mainPropertyType')), isPositiveNumber,
  ]);

  const debtDetailed = getIn(formData, 'assets.debtStatus.inputMode') === 'detailed';
  const hasDebt = getIn(formData, 'assets.debtStatus.hasDebt') === true;
  const debtRequiredFields = [
    ['assets.debtStatus.totalBalance', '총 부채잔액', hasDebt, debtDetailed ? (_value, data) => detailedDebtBalance(data) > 0 : isPositiveNumber],
    ['assets.debtStatus.monthlyRepayment', '월 상환부담', hasDebt, debtDetailed ? (_value, data) => hasDetailedDebtBurden(data) : isNonNegativeNumber],
    ...buildDetailedDebtRowFields(formData),
  ];

  return { incomeRequiredFields, expenseRequiredFields, savingsRequiredFields, assetRequiredFields, debtRequiredFields };
}

export function computeWizardRequiredFields(formData) {
  const definitions = getWizardRequiredFieldDefinitions(formData);
  const groups = [
    ['income', '1. 수입', definitions.incomeRequiredFields],
    ['expense', '2. 지출', definitions.expenseRequiredFields],
    ['savings', '3. 저축', definitions.savingsRequiredFields],
    ['assets', '4. 자산', definitions.assetRequiredFields],
    ['debt', '5. 부채', definitions.debtRequiredFields],
  ].map(([stepKey, title, fields]) => ({ stepKey, title, missingFields: fields.filter((field) => !fieldIsValid(formData, field)) }));

  const byStep = Object.fromEntries(groups.map(({ stepKey, missingFields }) => [stepKey, missingFields]));
  const firstMissingGroup = groups.find(({ missingFields }) => missingFields.length > 0) || null;
  const requiredErrorMessage = firstMissingGroup
    ? `"${firstMissingGroup.title}"에서 다음 항목을 입력해 주세요: ${firstMissingGroup.missingFields.map(([, label]) => label).join(', ')}` : '';

  return {
    missingIncomeFields: byStep.income,
    missingExpenseFields: byStep.expense,
    missingSavingsFields: byStep.savings,
    missingAssetFields: byStep.assets,
    missingDebtFields: byStep.debt,
    basicInfoMissing: byStep.income.length > 0,
    retirementLivingCostMissing: byStep.expense.length > 0,
    currentFinanceMissing: groups.some(({ missingFields }) => missingFields.length > 0),
    firstMissingGroup,
    requiredErrorMessage,
  };
}
