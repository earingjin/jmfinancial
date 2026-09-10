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
    return sum([breakdown.variableAnnuity, breakdown.pensionSavingsAccount, breakdown.irp, ...itemAmounts(breakdown.otherItems, 'amount')]);
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

const fieldIsValid = (formData, [path, , active, validate]) => (
  !active || (validate ? validate(getIn(formData, path), formData) : isFilled(getIn(formData, path)))
);

// api/_lib/validate.js와 같은 조건으로 판정한다. 네 번째 값은 공란 여부보다 강한 조건
// (양수 또는 상세입력 합계)을 검사할 때만 사용한다.
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
    ['income.salary.monthly', '본인 월급', getIn(formData, 'income.salary.hasSalary') === true, isPositiveNumber],
    ['spouse.salary.monthly', '배우자 월급', hasSpouse && getIn(formData, 'spouse.salary.hasSalary') === true, isPositiveNumber],
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
  ];

  const savingsDetailed = getIn(formData, 'assets.savingsPlan.inputMode') === 'detailed';
  const savingsRequiredFields = [[
    'assets.savingsPlan.monthly', '현재 월 저축액', getIn(formData, 'assets.savingsPlan.hasSavings') === true,
    savingsDetailed ? (_value, data) => detailedSavingsTotal(data) > 0 : isPositiveNumber,
  ]];

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
