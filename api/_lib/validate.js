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
  count: { min: 0, allowDecimal: false, label: '개월/기간' }, // 개월·년·나이 등 정수 카운트
  rate: { min: 0, max: 100, allowDecimal: true, label: '비율(%)' }, // 절감률 등 0~100% 비율
  returnRate: { allowDecimal: true, label: '수익률' }, // 예상 수익률 - 하한/상한을 두지 않음(음의 수익률도 유효한 가정)
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
  if (rule.max !== undefined && num > rule.max) {
    errors.push(`${path} 값은 ${rule.max} 이하여야 합니다.`);
  }
  if (rule.allowDecimal === false && !Number.isInteger(num)) {
    errors.push(`${path} 값은 정수여야 합니다.`);
  }
}

// 배열 필드(자녀별 항목, 반복 입력 목록 등)의 각 원소에 동일한 스키마를 적용한다.
function checkArrayField(errors, input, arrayPath, itemFields) {
  const list = getPath(input, arrayPath);
  if (!Array.isArray(list)) return;
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
  'assets.liquidAssets.breakdown.emergencyFund',
  'assets.financialAssets.stocks',
  'assets.financialAssets.funds',
  'assets.financialAssets.other',
  'assets.pensionAssets',
  'assets.realEstateAssets.total',
  'assets.realEstateAssets.reverseMortgageHouse',
  'assets.debtStatus.totalBalance',
  'assets.debtStatus.monthlyRepayment',
  'assets.insurance.monthlyPremium',
  'assets.insurance.coverageAmount',
  'assets.savingsPlan.monthly',
  'assets.savingsPlan.annual',
  'assets.savingsPlan.retirementMonthly',
  'assets.savingsPlan.retirementAnnual',
  'assets.savingsPlan.breakdown.installment',
  'assets.savingsPlan.breakdown.isa',
  'assets.savingsPlan.breakdown.irp',
  'assets.savingsPlan.breakdown.subscription',
  'assets.savingsPlan.breakdown.stocks',
  'assets.savingsPlan.breakdown.parkingAccount',
  'assets.netWorthPriorYear',
  'income.salary.annual',
  'income.salary.monthly',
  'income.business.annual',
  'income.business.monthly',
  'income.severance.lumpsum',
  'income.severance.pensionMonthly',
  'income.nationalPension.monthly',
  'income.personalPension.lumpsum',
  'income.personalPension.monthly',
  'spouse.salary.annual',
  'spouse.salary.monthly',
  'spouse.severance.lumpsum',
  'spouse.severance.pensionMonthly',
  'spouse.nationalPension.monthly',
  'spouse.personalPension.lumpsum',
  'spouse.personalPension.monthly',
  'expense.retirementLivingCost',
  'expense.housingCost',
  'expense.medical.annual',
  'expense.healthInsurance.monthly',
  'scenarios.reverseMortgage.housePrice',
  'scenarios.realEstateConversion.cashOutAmount',
  'scenarios.additionalIncome.monthlySalary',
];

const COUNT_FIELDS = [
  'income.salary.months',
  'income.severance.pensionMonths',
  'income.nationalPension.months',
  'income.personalPension.months',
  'spouse.salary.months',
  'spouse.severance.pensionMonths',
  'spouse.nationalPension.months',
  'spouse.personalPension.months',
  'expense.medical.years',
  'expense.healthInsurance.years',
  'basic.retirementAge',
  'basic.lifeExpectancy',
  'scenarios.reverseMortgage.ageAtStart',
  'scenarios.realEstateConversion.ageAtConversion',
  'scenarios.additionalIncome.months',
];

const ARRAY_FIELDS = [
  { path: 'income.regularIncomes', fields: [{ key: 'annual', kind: 'amount' }, { key: 'years', kind: 'count' }] },
  { path: 'income.otherIncomes', fields: [{ key: 'annual', kind: 'amount' }, { key: 'years', kind: 'count' }] },
  { path: 'expense.children', fields: [{ key: 'educationCost', kind: 'amount' }, { key: 'marriageSupport', kind: 'amount' }, { key: 'otherCost', kind: 'amount' }] },
  { path: 'expense.otherExpenses', fields: [{ key: 'annual', kind: 'amount' }, { key: 'years', kind: 'count' }] },
  { path: 'assets.liquidAssets.customItems', fields: [{ key: 'amount', kind: 'amount' }] },
  { path: 'assets.savingsPlan.customItems', fields: [{ key: 'amount', kind: 'amount' }] },
  {
    path: 'assets.debtStatus.customItems',
    fields: [{ key: 'principal', kind: 'amount' }, { key: 'monthlyInterest', kind: 'amount' }, { key: 'monthlyRepayment', kind: 'amount' }, { key: 'months', kind: 'count' }],
  },
];

const DEBT_BREAKDOWN_CATEGORIES = ['mortgage', 'depositLoan', 'businessLoan', 'buildingLoan', 'carLoan', 'studentLoan', 'otherLoan'];

export function validateInput(input) {
  const errors = [];

  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['요청 본문이 비어있거나 형식이 올바르지 않습니다.'] };
  }

  const requiredSections = ['basic', 'income', 'spouse', 'expense', 'assets', 'scenarios'];
  for (const key of requiredSections) {
    if (!(key in input)) errors.push(`"${key}" 섹션이 누락되었습니다.`);
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
  checkKindField(errors, input, 'basic.assumedReturnRate', 'returnRate');
  checkKindField(errors, input, 'scenarios.expenseReduction.reductionRate', 'rate');

  ARRAY_FIELDS.forEach(({ path, fields }) => checkArrayField(errors, input, path, fields));

  DEBT_BREAKDOWN_CATEGORIES.forEach((cat) => {
    checkKindField(errors, input, `assets.debtStatus.breakdown.${cat}.principal`, 'amount');
    checkKindField(errors, input, `assets.debtStatus.breakdown.${cat}.monthlyInterest`, 'amount');
    checkKindField(errors, input, `assets.debtStatus.breakdown.${cat}.monthlyRepayment`, 'amount');
    checkKindField(errors, input, `assets.debtStatus.breakdown.${cat}.months`, 'count');
  });

  // ---- 필드 간 관계 검증 ----

  // 노후준비 저축액(월/연)은 총 저축액(월/연)의 일부여야 하므로 총 저축액보다 클 수 없다.
  const savingsMonthly = input.assets?.savingsPlan?.monthly;
  const retirementMonthly = input.assets?.savingsPlan?.retirementMonthly;
  if (!isBlank(savingsMonthly) && !isBlank(retirementMonthly) && Number(retirementMonthly) > Number(savingsMonthly)) {
    errors.push('노후준비 월 저축액은 총 월 저축액보다 클 수 없습니다.');
  }

  const savingsAnnual = input.assets?.savingsPlan?.annual;
  const retirementAnnual = input.assets?.savingsPlan?.retirementAnnual;
  if (!isBlank(savingsAnnual) && !isBlank(retirementAnnual) && Number(retirementAnnual) > Number(savingsAnnual)) {
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
