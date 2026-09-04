// 서버 측 입력 검증. 클라이언트 검증은 UX용이고, 이게 실제 방어선이다.
//
// 필드별 명시 스키마 기반 검증(재귀적 전수 탐색이 아님). 각 필드는 kind(amount/count/rate/year/
// returnRate)로 분류되어 동일한 규칙을 일관되게 적용받는다. 새로운 재무정책 기준이나 임의의 금액
// 상한은 만들지 않는다 - amount/count는 하한(0)만 강제하고 상한은 두지 않는다.

function getPath(input, path) {
  return path.split('.').reduce((acc, k) => acc?.[k], input);
}

// value가 빈 값(''/null/undefined)이면 아직 입력하지 않은 것으로 보고 통과시킨다(기존 동작 유지) -
// 실제로 값이 채워졌을 때만 타입·부호를 검사한다.
function isBlank(value) {
  return value === '' || value === null || value === undefined
    || (typeof value === 'string' && value.trim() === '');
}

function isValidItemName(value) {
  return typeof value === 'string' && value.trim() !== '' && /[\p{L}\p{N}]/u.test(value);
}

// JSON 숫자 또는 부호가 있는 10진 숫자 문자열만 허용한다. 공백, 지수/16진수 표기,
// boolean·배열·객체가 Number()에 의해 암묵적으로 숫자가 되는 것을 금지한다.
const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function parseNumericInput(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && DECIMAL_NUMBER_PATTERN.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const KIND_RULES = {
  amount: { min: 0, allowDecimal: true, label: '금액' }, // 만원 단위 금액 - 음수·NaN·Infinity 거부, 상한 없음
  count: { min: 0, allowDecimal: false, label: '개월/기간' }, // 개월·년 등 정수 카운트
  age: { min: 0, max: 120, allowDecimal: false, label: '나이' }, // 나이류 필드 전용 - 개월/기간(count)과 분리
  // 기대수명 전용 - 통계청 평균수명 참고값(예: 84.6세)의 소수 입력은 유지하면서 상한(120)만 추가한다.
  ageDecimal: { min: 0, max: 120, allowDecimal: true, label: '나이(소수 허용)' },
  rate: { min: 0, max: 100, allowDecimal: true, label: '비율(%)' }, // 절감률 등 0~100% 비율
  // 복리의 밑(1 + r)이 양수여야 하므로 -100%는 허용하지 않는다.
  // 정책상 별도 하한이 승인되지 않았으므로 -100%보다 큰 유한값은 허용한다.
  returnRate: { exclusiveMin: -100, allowDecimal: true, label: '수익률' },
};

function checkKindField(errors, input, path, kind) {
  const value = getPath(input, path);
  // A whitespace-only number is not an omitted numeric value. It must be
  // rejected instead of being silently treated as zero or absent.
  if (value === '' || value === null || value === undefined) return;

  const rule = KIND_RULES[kind];
  const num = parseNumericInput(value);

  if (num === null) {
    errors.push(`${path} 값은 유효한 숫자여야 합니다.`);
    return;
  }
  if (rule.min !== undefined && num < rule.min) {
    errors.push(`${path} 값은 ${rule.min} 이상이어야 합니다.`);
  }
  if (rule.exclusiveMin !== undefined && num <= rule.exclusiveMin) {
    errors.push(`${path} 값은 ${rule.exclusiveMin}보다 커야 합니다.`);
  }
  if (rule.max !== undefined && num > rule.max) {
    errors.push(`${path} 값은 ${rule.max} 이하여야 합니다.`);
  }
  if (rule.allowDecimal === false && !Number.isInteger(num)) {
    errors.push(`${path} 값은 정수여야 합니다.`);
  }
}

// 출생년도 범위 검증 - kind 체계(amount/count/age/rate/returnRate)는 "연도 범위" 규칙에 맞지
// 않으므로 basic.birthYear와 같은 규칙(1900~올해)을 쓰는 곳(자녀 출생년도 등)에서 공용으로 쓴다.
function checkBirthYearField(errors, value, path) {
  if (isBlank(value)) return;
  const year = parseNumericInput(value);
  if (year === null || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) {
    errors.push(`${path} 출생년도가 유효하지 않습니다.`);
  }
}

const MAX_ARRAY_LENGTH = 50; // 정기수입/기타수입/자녀/커스텀항목 등 반복 입력 목록의 최대 개수

// 배열 필드(자녀별 항목, 반복 입력 목록 등)의 각 원소에 동일한 스키마를 적용한다.
function checkArrayField(errors, input, arrayPath, itemFields) {
  const list = getPath(input, arrayPath);
  if (list === undefined || list === null) return;
  if (!Array.isArray(list)) {
    errors.push(`${arrayPath} 값은 배열이어야 합니다.`);
    return;
  }
  if (list.length > MAX_ARRAY_LENGTH) {
    errors.push(`${arrayPath} 항목은 최대 ${MAX_ARRAY_LENGTH}개까지 입력할 수 있습니다.`);
    return;
  }
  list.forEach((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${arrayPath}.${index} 항목은 객체여야 합니다.`);
      return;
    }
    itemFields.forEach(({ key, kind }) => checkKindField(errors, input, `${arrayPath}.${index}.${key}`, kind));
  });
}

// 필드별 검증 스키마 - 금액성 입력 전체(음수/NaN/Infinity 거부)를 명시적으로 나열한다.
const AMOUNT_FIELDS = [
  'assets.currentIncome.monthly',
  'assets.currentIncome.annual',
  'assets.currentLivingCost.monthly',
  'assets.currentLivingCost.annual',
  // carLoan(차량할부)·debtRepayment(원리금상환)은 assets.debtStatus가 단일 기준값이라 여기 없다.
  ...['rent', 'maintenance', 'utilities', 'fuel', 'carInsurance', 'clothing', 'fourInsurances', 'food', 'communication', 'medical', 'subscription', 'other'].map(
    (k) => `assets.currentLivingCost.breakdown.${k}`
  ),
  'assets.liquidAssets.total',
  'assets.liquidAssets.simpleTotal',
  'assets.liquidAssets.breakdown.deposit',
  'assets.liquidAssets.breakdown.savings',
  'assets.liquidAssets.breakdown.cma',
  'assets.liquidAssets.breakdown.subscription',
  'assets.liquidAssets.breakdown.emergencyFund',
  'assets.financialAssets.stocks',
  'assets.financialAssets.total',
  'assets.financialAssets.simpleTotal',
  'assets.financialAssets.funds',
  'assets.financialAssets.bonds',
  'assets.financialAssets.other',
  'assets.pensionAssets',
  'assets.pensionAssetsSimpleTotal',
  'assets.pensionAssetsBreakdown.variableAnnuity',
  'assets.pensionAssetsBreakdown.pensionSavingsAccount',
  'assets.pensionAssetsBreakdown.irp',
  'assets.pensionAssetsBreakdown.other',
  'assets.realEstateAssets.total',
  'assets.realEstateAssets.simpleTotal',
  'assets.realEstateAssets.mainProperty',
  'assets.realEstateAssets.reverseMortgageHouse',
  'assets.otherAssets.total',
  'assets.otherAssets.simpleTotal',
  'assets.debtStatus.totalBalance',
  'assets.debtStatus.monthlyRepayment',
  'assets.insurance.monthlyPremium',
  'assets.insurance.coverageAmount',
  'assets.savingsPlan.monthly',
  'assets.savingsPlan.simpleMonthly',
  'assets.savingsPlan.simpleAnnual',
  'assets.savingsPlan.annual',
  'assets.savingsPlan.retirementMonthly',
  'assets.savingsPlan.retirementAnnual',
  'assets.savingsPlan.additionalRetirementMonthly',
  'assets.savingsPlan.additionalRetirementAnnual',
  'income.salary.annual',
  'income.salary.monthly',
  'income.business.annual',
  'income.business.monthly',
  'income.severance.lumpsum',
  'income.severance.pensionMonthly',
  'income.severance.calc.threeMonthSalary',
  'income.severance.calc.annualBonus',
  'income.severance.calc.annualLeavePay',
  'income.nationalPension.monthly',
  'income.nationalPension.simulate.averageMonthlyIncome',
  'income.personalPension.lumpsum',
  'income.personalPension.monthly',
  'spouse.salary.annual',
  'spouse.salary.monthly',
  'spouse.severance.lumpsum',
  'spouse.severance.pensionMonthly',
  'spouse.severance.calc.threeMonthSalary',
  'spouse.severance.calc.annualBonus',
  'spouse.severance.calc.annualLeavePay',
  'spouse.nationalPension.monthly',
  'spouse.nationalPension.simulate.averageMonthlyIncome',
  'spouse.personalPension.lumpsum',
  'spouse.personalPension.monthly',
  'expense.retirementLivingCost',
  'expense.housingCost',
  'expense.medical.annual',
  'expense.healthInsurance.monthly',
  'scenarios.reverseMortgage.housePrice',
  'scenarios.realEstateConversion.cashOutAmount',
  'scenarios.additionalIncome.monthlySalary',
  // 근속년수도 소수(예: 7.5년)를 허용해야 하므로 같은 이유로 COUNT_FIELDS가 아니라 여기에 둔다.
  'basic.serviceYears',
  'spouse.severance.serviceYears',
  // 국민연금 납입기간·가입기간(년)도 소수를 허용한다(같은 이유).
  'income.nationalPension.paymentYears',
  'income.nationalPension.simulate.years',
  'spouse.nationalPension.paymentYears',
  'spouse.nationalPension.simulate.years',
  // 퇴직연금 수령 기간(년)도 소수를 허용한다. 실제 개월수(pensionMonths)는 이 값을 정수로 반올림해
  // 자동 계산하므로 COUNT_FIELDS 쪽 정수 제약과 충돌하지 않는다.
  'income.severance.pensionYears',
  'spouse.severance.pensionYears',
];

const COUNT_FIELDS = [
  'income.salary.months',
  'income.severance.pensionMonths',
  'income.severance.lumpsumAge',
  'income.nationalPension.months',
  'income.nationalPension.paymentMonths',
  'income.nationalPension.simulate.contributionMonths',
  'income.nationalPension.expectedAdditionalContributionMonths',
  'income.personalPension.months',
  'income.personalPension.lumpsumAge',
  'spouse.salary.months',
  'spouse.severance.pensionMonths',
  'spouse.severance.lumpsumAge',
  'spouse.nationalPension.months',
  'spouse.nationalPension.paymentMonths',
  'spouse.nationalPension.simulate.contributionMonths',
  'spouse.nationalPension.expectedAdditionalContributionMonths',
  'spouse.personalPension.months',
  'spouse.personalPension.lumpsumAge',
  'expense.medical.years',
  'expense.healthInsurance.years',
  'scenarios.additionalIncome.months',
];

const AGE_FIELDS = [
  'basic.retirementAge',
  'spouse.retirementAge',
  'income.severance.pensionStartAge',
  'spouse.severance.pensionStartAge',
  'income.personalPension.startAge',
  'spouse.personalPension.startAge',
  'scenarios.reverseMortgage.ageAtStart',
  'scenarios.realEstateConversion.ageAtConversion',
];

const AGE_DECIMAL_FIELDS = [
  'basic.lifeExpectancy',
  'spouse.lifeExpectancy',
  // simulation.js의 `lifeExpectancy || retirementEndAge` 폴백에서만 쓰이는 레거시 호환 별칭.
  // 초기 폼 데이터/입력 UI에는 없지만 같은 나이 필드이므로 lifeExpectancy와 동일한 규칙을 적용한다.
  'basic.retirementEndAge',
];

const ARRAY_FIELDS = [
  { path: 'income.regularIncomes', fields: [{ key: 'annual', kind: 'amount' }, { key: 'years', kind: 'count' }] },
  { path: 'income.otherIncomes', fields: [{ key: 'annual', kind: 'amount' }, { key: 'years', kind: 'count' }] },
  { path: 'expense.debts', fields: [{ key: 'principal', kind: 'amount' }, { key: 'monthlyInterest', kind: 'amount' }, { key: 'monthlyRepayment', kind: 'amount' }, { key: 'months', kind: 'count' }] },
  { path: 'expense.children', fields: [{ key: 'educationCost', kind: 'amount' }, { key: 'marriageSupport', kind: 'amount' }, { key: 'otherCost', kind: 'amount' }] },
  { path: 'expense.otherExpenses', fields: [{ key: 'annual', kind: 'amount' }, { key: 'years', kind: 'count' }] },
  { path: 'expense.healthInsurance.items', fields: [{ key: 'monthly', kind: 'amount' }] },
  { path: 'assets.liquidAssets.customItems', fields: [{ key: 'amount', kind: 'amount' }] },
  { path: 'assets.currentLivingCost.breakdown.otherItems', fields: [{ key: 'amount', kind: 'amount' }] },
  { path: 'assets.financialAssets.otherItems', fields: [{ key: 'amount', kind: 'amount' }] },
  { path: 'assets.pensionAssetsBreakdown.otherItems', fields: [{ key: 'amount', kind: 'amount' }] },
  { path: 'assets.realEstateAssets.otherItems', fields: [{ key: 'amount', kind: 'amount' }] },
  { path: 'assets.otherAssets.items', fields: [{ key: 'amount', kind: 'amount' }] },
  {
    path: 'assets.savingsPlan.customItems',
    fields: [
      { key: 'monthly', kind: 'amount' },
      { key: 'remainingMonths', kind: 'count' },
      { key: 'interestRate', kind: 'returnRate' },
      { key: 'accumulated', kind: 'amount' },
    ],
  },
  {
    path: 'assets.debtStatus.customItems',
    fields: [{ key: 'principal', kind: 'amount' }, { key: 'monthlyInterest', kind: 'amount' }, { key: 'monthlyRepayment', kind: 'amount' }, { key: 'months', kind: 'count' }],
  },
  // 은퇴 후 예상 목돈지출 - expense.children(교육비 등, 시점 불명·은퇴 전에도 발생 가능)과는
  // 의도적으로 분리된 별도 입력이다. amount/expectedAge의 기본 범위(0 이상, 0~120세 정수)는
  // 여기서 checkArrayField로 검사하고, "은퇴나이~기대수명 이내"라는 교차 필드 규칙과 지출 용도
  // 문자열 검사는 validateInput 본문에서 별도로 확인한다(checkArrayField는 숫자 kind만 다룬다).
  { path: 'expense.retirementLumpSumExpenses', fields: [{ key: 'amount', kind: 'amount' }, { key: 'expectedAge', kind: 'age' }] },
];

const DEBT_BREAKDOWN_CATEGORIES = ['mortgage', 'depositLoan', 'businessLoan', 'buildingLoan', 'carLoan', 'studentLoan', 'otherLoan'];
const SAVINGS_BREAKDOWN_CATEGORIES = ['installment', 'isa', 'variableAnnuity', 'pensionSavings', 'irp', 'subscription', 'stocks', 'parkingAccount'];
const NAMED_ARRAY_PATHS = [
  'income.regularIncomes', 'income.otherIncomes', 'expense.debts', 'expense.otherExpenses',
  'expense.healthInsurance.items', 'assets.liquidAssets.customItems', 'assets.currentLivingCost.breakdown.otherItems',
  'assets.financialAssets.otherItems', 'assets.pensionAssetsBreakdown.otherItems', 'assets.realEstateAssets.otherItems',
  'assets.otherAssets.items', 'assets.savingsPlan.customItems', 'assets.debtStatus.customItems',
  'expense.retirementLumpSumExpenses',
];

export function validateInput(input) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['요청 본문이 비어있거나 형식이 올바르지 않습니다.'] };
  }

  const requiredSections = ['basic', 'income', 'spouse', 'expense', 'assets', 'scenarios'];
  for (const key of requiredSections) {
    if (!(key in input)) errors.push(`"${key}" 섹션이 누락되었습니다.`);
  }

  const requiredBasicFields = [
    ['birthYear', '출생년도'],
    ['retirementAge', '은퇴(예정) 연령'],
    ['lifeExpectancy', '기대수명'],
    ['serviceYears', '근속년수'],
  ];
  requiredBasicFields.forEach(([key, label]) => {
    if (isBlank(input.basic?.[key])) errors.push(`${label}은(는) 필수 입력 항목입니다.`);
  });
  if (input.basic?.hasSpouse === true && isBlank(input.spouse?.birthYear)) {
    errors.push('배우자 출생년도는 필수 입력 항목입니다.');
  }
  if (input.basic?.hasSpouse === true && isBlank(input.spouse?.retirementAge)) {
    errors.push('배우자 은퇴(예정) 연령은 필수 입력 항목입니다.');
  }
  if (input.basic?.hasSpouse === true && isBlank(input.spouse?.lifeExpectancy)) {
    errors.push('배우자 기대여명은 필수 입력 항목입니다.');
  }

  [
    ['income.severance', input.income?.severance?.type === 'pension', 'pensionStartAge'],
    ['income.personalPension', input.income?.personalPension?.type === 'installment', 'startAge'],
    ['spouse.severance', input.basic?.hasSpouse === true && input.spouse?.severance?.type === 'pension', 'pensionStartAge'],
    ['spouse.personalPension', input.basic?.hasSpouse === true && input.spouse?.personalPension?.type === 'installment', 'startAge'],
  ].forEach(([path, required, field]) => {
    if (required && isBlank(getPath(input, `${path}.${field}`))) {
      errors.push(`${path}.${field} 값은 월 연금 수령 방식에서 필수입니다.`);
    }
  });

  // 노후 월 평균 생활비는 은퇴자산 시뮬레이션(필요자금 산출)의 핵심 입력값이라 필수로 강제한다.
  // 명시적으로 입력한 0(노후 생활비를 가정하지 않음)은 유효한 값으로 그대로 허용한다.
  if (isBlank(input.expense?.retirementLivingCost)) {
    errors.push('노후 월 평균 생활비는 필수 입력 항목입니다.');
  }

  checkBirthYearField(errors, input.basic?.birthYear, 'basic.birthYear');
  checkBirthYearField(errors, input.spouse?.birthYear, 'spouse.birthYear');

  AMOUNT_FIELDS.forEach((path) => checkKindField(errors, input, path, 'amount'));
  COUNT_FIELDS.forEach((path) => checkKindField(errors, input, path, 'count'));
  AGE_FIELDS.forEach((path) => checkKindField(errors, input, path, 'age'));
  AGE_DECIMAL_FIELDS.forEach((path) => checkKindField(errors, input, path, 'ageDecimal'));
  checkKindField(errors, input, 'basic.assumedReturnRate', 'returnRate');
  checkKindField(errors, input, 'scenarios.expenseReduction.reductionRate', 'rate');

  ['income.nationalPension.futureContributionPlan', 'spouse.nationalPension.futureContributionPlan'].forEach((path) => {
    const value = getPath(input, path);
    if (!isBlank(value) && !['continue', 'stop', 'unknown'].includes(value)) {
      errors.push(`${path} 값이 유효하지 않습니다.`);
    }
  });
  [
    ['income.nationalPension', true],
    ['spouse.nationalPension', input.basic?.hasSpouse === true],
  ].forEach(([basePath, active]) => {
    if (active && getPath(input, `${basePath}.futureContributionPlan`) === 'continue'
      && isBlank(getPath(input, `${basePath}.expectedAdditionalContributionMonths`))) {
      errors.push(`${basePath}.expectedAdditionalContributionMonths 값이 필요합니다.`);
    }
  });

  ARRAY_FIELDS.forEach(({ path, fields }) => checkArrayField(errors, input, path, fields));

  NAMED_ARRAY_PATHS.forEach((arrayPath) => {
    const list = getPath(input, arrayPath);
    if (!Array.isArray(list) || list.length > MAX_ARRAY_LENGTH) return;
    list.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || isBlank(item.name)) return;
      if (!isValidItemName(item.name)) errors.push(`${arrayPath}.${index}.name 값은 문자 또는 숫자를 포함해야 합니다.`);
    });
  });

  // 체크박스 그룹은 객체 목록이 아니라 승인된 문자열 키 목록이다.
  const expenseReductionTargets = getPath(input, 'scenarios.expenseReduction.targets');
  if (expenseReductionTargets !== undefined && expenseReductionTargets !== null) {
    if (!Array.isArray(expenseReductionTargets)) {
      errors.push('scenarios.expenseReduction.targets 값은 배열이어야 합니다.');
    } else if (expenseReductionTargets.some((target) => !['living', 'medical', 'other'].includes(target))) {
      errors.push('scenarios.expenseReduction.targets 값이 유효하지 않습니다.');
    }
  }

  // 자녀 출생년도 - checkArrayField(kind 기반)와 별도로 basic.birthYear와 동일한 연도 범위 규칙을 적용한다.
  // MAX_ARRAY_LENGTH 초과 시에는 위 checkArrayField가 이미 별도 에러를 push했으므로 여기서는 건너뛴다.
  const children = getPath(input, 'expense.children');
  if (Array.isArray(children) && children.length <= MAX_ARRAY_LENGTH) {
    children.forEach((child, index) => checkBirthYearField(errors, child?.birthYear, `expense.children.${index}.birthYear`));
  }

  // 은퇴 후 예상 목돈지출 - 지출 용도(문자열)와 "은퇴나이~기대수명 이내"라는 교차 필드 규칙은
  // checkArrayField(숫자 kind 전용)가 다루지 않으므로 여기서 별도로 확인한다. 시점을 임의로
  // 추정하지 않는다는 원칙에 따라, 은퇴 전이거나 기대수명 이후인 나이는 그대로 반려한다.
  const lumpSumExpenses = getPath(input, 'expense.retirementLumpSumExpenses');
  if (Array.isArray(lumpSumExpenses) && lumpSumExpenses.length <= MAX_ARRAY_LENGTH) {
    const lumpSumRetirementAge = input.basic?.retirementAge;
    const lumpSumLifeExpectancy = input.basic?.lifeExpectancy;
    lumpSumExpenses.forEach((item, index) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) return;
      const path = `expense.retirementLumpSumExpenses.${index}`;
      const isInUse = !isBlank(item.amount) || !isBlank(item.expectedAge) || !isBlank(item.name);

      if (typeof item.name === 'string' && item.name.length > 40) {
        errors.push(`${path}.name 값은 40자 이하로 입력해 주세요.`);
      }
      if (isInUse && isBlank(item.name)) {
        errors.push(`${path}.name 값은 필수 입력 항목입니다.`);
      }

      if (!isBlank(item.expectedAge) && !isBlank(lumpSumRetirementAge) && Number(item.expectedAge) < Number(lumpSumRetirementAge)) {
        errors.push(`${path}.expectedAge 값은 은퇴(예정) 연령(${lumpSumRetirementAge}세) 이후로 입력해 주세요.`);
      }
      if (!isBlank(item.expectedAge) && !isBlank(lumpSumLifeExpectancy) && Number(item.expectedAge) > Number(lumpSumLifeExpectancy)) {
        errors.push(`${path}.expectedAge 값은 기대수명(${lumpSumLifeExpectancy}세) 이내로 입력해 주세요.`);
      }
    });
  }

  DEBT_BREAKDOWN_CATEGORIES.forEach((cat) => {
    checkKindField(errors, input, `assets.debtStatus.breakdown.${cat}.principal`, 'amount');
    checkKindField(errors, input, `assets.debtStatus.breakdown.${cat}.monthlyInterest`, 'amount');
    checkKindField(errors, input, `assets.debtStatus.breakdown.${cat}.monthlyRepayment`, 'amount');
    checkKindField(errors, input, `assets.debtStatus.breakdown.${cat}.months`, 'count');
  });

  SAVINGS_BREAKDOWN_CATEGORIES.forEach((cat) => {
    checkKindField(errors, input, `assets.savingsPlan.breakdown.${cat}.monthly`, 'amount');
    checkKindField(errors, input, `assets.savingsPlan.breakdown.${cat}.remainingMonths`, 'count');
    checkKindField(errors, input, `assets.savingsPlan.breakdown.${cat}.interestRate`, 'returnRate');
  });

  // ---- 필드 간 관계 검증 ----

  // 아래 두 관계 검증은 v1(레거시) retirementMonthly/retirementAnnual 직접입력 방식에서만
  // 의미가 있다. v2(retirementSavingsInputVersion === 2)는 이 필드들을 계산에 전혀 쓰지 않으므로
  // (연금저축·IRP 자동합산 + additionalRetirementMonthly만 사용), v2 데이터에 레거시 값이 남아
  // 있어도(예: v1→v2 전환 전 입력 잔재) 이 관계 검증으로 요청을 거부하지 않는다.
  const isLegacyRetirementSavingsInput = input.assets?.savingsPlan?.retirementSavingsInputVersion !== 2;

  // 노후준비 저축액(월/연)이 총 저축액에 이미 포함되어 있는 경우(retirementIncludedInTotal !== false,
  // 기본값 포함)에만 총 저축액의 일부여야 하므로 총 저축액보다 클 수 없다. 노후준비를 총 저축액과
  // 별도로 하고 있다고 명시한 경우(false)는 서로 겹치지 않는 별개 금액이라 이 제약을 적용하지 않는다.
  const retirementIncludedInTotal = input.assets?.savingsPlan?.retirementIncludedInTotal !== false;
  const savingsMonthly = input.assets?.savingsPlan?.monthly;
  const retirementMonthly = input.assets?.savingsPlan?.retirementMonthly;
  if (
    isLegacyRetirementSavingsInput &&
    retirementIncludedInTotal &&
    !isBlank(savingsMonthly) &&
    !isBlank(retirementMonthly) &&
    Number(retirementMonthly) > Number(savingsMonthly)
  ) {
    errors.push('노후준비 월 저축액은 총 월 저축액보다 클 수 없습니다.');
  }

  const savingsAnnual = input.assets?.savingsPlan?.annual;
  const retirementAnnual = input.assets?.savingsPlan?.retirementAnnual;
  if (
    isLegacyRetirementSavingsInput &&
    retirementIncludedInTotal &&
    !isBlank(savingsAnnual) &&
    !isBlank(retirementAnnual) &&
    Number(retirementAnnual) > Number(savingsAnnual)
  ) {
    errors.push('노후준비 연 저축액은 총 연 저축액보다 클 수 없습니다.');
  }

  // 부동산 전환금액은 보유 부동산자산을 초과할 수 없다 (활성화된 시나리오에 한해 검증).
  if (input.scenarios?.realEstateConversion?.enabled) {
    const cashOutAmount = input.scenarios.realEstateConversion.cashOutAmount;
    const realEstateTotal = input.assets?.realEstateAssets?.total;
    if (!isBlank(cashOutAmount) && !isBlank(realEstateTotal) && Number(cashOutAmount) > Number(realEstateTotal)) {
      errors.push('부동산 전환금액은 현재 부동산자산을 초과할 수 없습니다.');
    }
  }

  // 은퇴 종료 연령(기대수명)은 은퇴 시작 연령보다 앞설 수 없다.
  const retirementAge = input.basic?.retirementAge;
  const lifeExpectancy = input.basic?.lifeExpectancy;
  if (!isBlank(retirementAge) && !isBlank(lifeExpectancy) && Number(lifeExpectancy) < Number(retirementAge)) {
    errors.push('기대수명(은퇴 종료 연령)은 은퇴 시작 연령보다 작을 수 없습니다.');
  }
  const spouseRetirementAge = input.spouse?.retirementAge;
  const spouseLifeExpectancy = input.spouse?.lifeExpectancy;
  if (input.basic?.hasSpouse === true && !isBlank(spouseRetirementAge) && !isBlank(spouseLifeExpectancy)
    && Number(spouseLifeExpectancy) < Number(spouseRetirementAge)) {
    errors.push('배우자 기대여명은 배우자 은퇴(예정) 연령보다 작을 수 없습니다.');
  }

  return { ok: errors.length === 0, errors };
}
