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
  return value === '' || value === null || value === undefined;
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
  if (isBlank(value)) return;

  const rule = KIND_RULES[kind];
  const num = Number(value);

  if (!Number.isFinite(num)) {
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
  const year = Number(value);
  if (Number.isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
    errors.push(`${path} 출생년도가 유효하지 않습니다.`);
  }
}

const MAX_ARRAY_LENGTH = 50; // 정기수입/기타수입/자녀/커스텀항목 등 반복 입력 목록의 최대 개수

// 배열 필드(자녀별 항목, 반복 입력 목록 등)의 각 원소에 동일한 스키마를 적용한다.
function checkArrayField(errors, input, arrayPath, itemFields) {
  const list = getPath(input, arrayPath);
  if (!Array.isArray(list)) return;
  if (list.length > MAX_ARRAY_LENGTH) {
    errors.push(`${arrayPath} 항목은 최대 ${MAX_ARRAY_LENGTH}개까지 입력할 수 있습니다.`);
    return;
  }
  list.forEach((_, index) => {
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
  'assets.liquidAssets.breakdown.deposit',
  'assets.liquidAssets.breakdown.savings',
  'assets.liquidAssets.breakdown.cma',
  'assets.liquidAssets.breakdown.emergencyFund',
  'assets.financialAssets.stocks',
  'assets.financialAssets.funds',
  'assets.financialAssets.bonds',
  'assets.financialAssets.other',
  'assets.pensionAssets',
  'assets.pensionAssetsBreakdown.variableAnnuity',
  'assets.pensionAssetsBreakdown.pensionSavingsAccount',
  'assets.pensionAssetsBreakdown.irp',
  'assets.pensionAssetsBreakdown.other',
  'assets.realEstateAssets.total',
  'assets.realEstateAssets.mainProperty',
  'assets.realEstateAssets.reverseMortgageHouse',
  'assets.debtStatus.totalBalance',
  'assets.debtStatus.monthlyRepayment',
  'assets.insurance.monthlyPremium',
  'assets.insurance.coverageAmount',
  'assets.savingsPlan.monthly',
  'assets.savingsPlan.annual',
  'assets.savingsPlan.retirementMonthly',
  'assets.savingsPlan.retirementAnnual',
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
  'income.personalPension.months',
  'income.personalPension.lumpsumAge',
  'spouse.salary.months',
  'spouse.severance.pensionMonths',
  'spouse.severance.lumpsumAge',
  'spouse.nationalPension.months',
  'spouse.nationalPension.paymentMonths',
  'spouse.nationalPension.simulate.contributionMonths',
  'spouse.personalPension.months',
  'spouse.personalPension.lumpsumAge',
  'expense.medical.years',
  'expense.healthInsurance.years',
  'scenarios.additionalIncome.months',
];

const AGE_FIELDS = [
  'basic.retirementAge',
  'scenarios.reverseMortgage.ageAtStart',
  'scenarios.realEstateConversion.ageAtConversion',
];

const AGE_DECIMAL_FIELDS = [
  'basic.lifeExpectancy',
  // simulation.js의 `lifeExpectancy || retirementEndAge` 폴백에서만 쓰이는 레거시 호환 별칭.
  // 초기 폼 데이터/입력 UI에는 없지만 같은 나이 필드이므로 lifeExpectancy와 동일한 규칙을 적용한다.
  'basic.retirementEndAge',
];

const ARRAY_FIELDS = [
  { path: 'income.regularIncomes', fields: [{ key: 'annual', kind: 'amount' }, { key: 'years', kind: 'count' }] },
  { path: 'income.otherIncomes', fields: [{ key: 'annual', kind: 'amount' }, { key: 'years', kind: 'count' }] },
  { path: 'expense.children', fields: [{ key: 'educationCost', kind: 'amount' }, { key: 'marriageSupport', kind: 'amount' }, { key: 'otherCost', kind: 'amount' }] },
  { path: 'expense.otherExpenses', fields: [{ key: 'annual', kind: 'amount' }, { key: 'years', kind: 'count' }] },
  { path: 'expense.healthInsurance.items', fields: [{ key: 'monthly', kind: 'amount' }] },
  { path: 'assets.liquidAssets.customItems', fields: [{ key: 'amount', kind: 'amount' }] },
  { path: 'assets.currentLivingCost.breakdown.otherItems', fields: [{ key: 'amount', kind: 'amount' }] },
  { path: 'assets.financialAssets.otherItems', fields: [{ key: 'amount', kind: 'amount' }] },
  { path: 'assets.pensionAssetsBreakdown.otherItems', fields: [{ key: 'amount', kind: 'amount' }] },
  { path: 'assets.realEstateAssets.otherItems', fields: [{ key: 'amount', kind: 'amount' }] },
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
];

const DEBT_BREAKDOWN_CATEGORIES = ['mortgage', 'depositLoan', 'businessLoan', 'buildingLoan', 'carLoan', 'studentLoan', 'otherLoan'];
const SAVINGS_BREAKDOWN_CATEGORIES = ['installment', 'isa', 'variableAnnuity', 'pensionSavings', 'irp', 'subscription', 'stocks', 'parkingAccount'];

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

  // 노후 월 평균 생활비는 은퇴자산 시뮬레이션(필요자금 산출)의 핵심 입력값이라 필수로 강제한다.
  // 명시적으로 입력한 0(노후 생활비를 가정하지 않음)은 유효한 값으로 그대로 허용한다.
  if (isBlank(input.expense?.retirementLivingCost)) {
    errors.push('노후 월 평균 생활비는 필수 입력 항목입니다.');
  }

  const birthYear = Number(input.basic?.birthYear);
  if (input.basic?.birthYear !== '' && (Number.isNaN(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear())) {
    errors.push('출생년도가 유효하지 않습니다.');
  }

  const spouseBirthYear = Number(input.spouse?.birthYear);
  if (input.spouse?.birthYear !== '' && input.spouse?.birthYear !== undefined && (Number.isNaN(spouseBirthYear) || spouseBirthYear < 1900 || spouseBirthYear > new Date().getFullYear())) {
    errors.push('배우자 출생년도가 유효하지 않습니다.');
  }

  AMOUNT_FIELDS.forEach((path) => checkKindField(errors, input, path, 'amount'));
  COUNT_FIELDS.forEach((path) => checkKindField(errors, input, path, 'count'));
  AGE_FIELDS.forEach((path) => checkKindField(errors, input, path, 'age'));
  AGE_DECIMAL_FIELDS.forEach((path) => checkKindField(errors, input, path, 'ageDecimal'));
  checkKindField(errors, input, 'basic.assumedReturnRate', 'returnRate');
  checkKindField(errors, input, 'scenarios.expenseReduction.reductionRate', 'rate');

  [
    ['income.nationalPension.paymentMonths', input.income?.nationalPension?.inputMode],
    ['income.nationalPension.simulate.contributionMonths', input.income?.nationalPension?.inputMode],
    ['spouse.nationalPension.paymentMonths', input.spouse?.nationalPension?.inputMode],
    ['spouse.nationalPension.simulate.contributionMonths', input.spouse?.nationalPension?.inputMode],
  ].forEach(([path, mode]) => {
    const value = getPath(input, path);
    const isActivePath = (mode === 'simulate') === path.includes('.simulate.');
    if (mode !== 'none' && isActivePath && !isBlank(value) && Number(value) > 0 && Number(value) < 120) {
      errors.push(`${path} 값은 노령연금 수급을 위해 최소 120개월 이상이어야 합니다.`);
    }
  });

  ARRAY_FIELDS.forEach(({ path, fields }) => checkArrayField(errors, input, path, fields));

  // 자녀 출생년도 - checkArrayField(kind 기반)와 별도로 basic.birthYear와 동일한 연도 범위 규칙을 적용한다.
  // MAX_ARRAY_LENGTH 초과 시에는 위 checkArrayField가 이미 별도 에러를 push했으므로 여기서는 건너뛴다.
  const children = getPath(input, 'expense.children');
  if (Array.isArray(children) && children.length <= MAX_ARRAY_LENGTH) {
    children.forEach((child, index) => checkBirthYearField(errors, child?.birthYear, `expense.children.${index}.birthYear`));
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

  // 노후준비 저축액(월/연)이 총 저축액에 이미 포함되어 있는 경우(retirementIncludedInTotal !== false,
  // 기본값 포함)에만 총 저축액의 일부여야 하므로 총 저축액보다 클 수 없다. 노후준비를 총 저축액과
  // 별도로 하고 있다고 명시한 경우(false)는 서로 겹치지 않는 별개 금액이라 이 제약을 적용하지 않는다.
  const retirementIncludedInTotal = input.assets?.savingsPlan?.retirementIncludedInTotal !== false;
  const savingsMonthly = input.assets?.savingsPlan?.monthly;
  const retirementMonthly = input.assets?.savingsPlan?.retirementMonthly;
  if (
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

  return { ok: errors.length === 0, errors };
}
