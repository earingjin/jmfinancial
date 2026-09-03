const n = (value) => Number(value) || 0;
const sum = (items, pick) => (items || []).reduce((total, item) => total + n(pick(item)), 0);

const LIVING_KEYS = ['rent', 'maintenance', 'utilities', 'fuel', 'carInsurance', 'clothing', 'fourInsurances', 'food', 'communication', 'medical', 'subscription'];
const LIQUID_KEYS = ['deposit', 'savings', 'cma', 'subscription', 'emergencyFund'];
const SAVINGS_KEYS = ['installment', 'isa', 'variableAnnuity', 'pensionSavings', 'irp', 'subscription', 'stocks', 'parkingAccount'];
const DEBT_KEYS = ['mortgage', 'depositLoan', 'businessLoan', 'buildingLoan', 'carLoan', 'studentLoan', 'otherLoan'];

const debtMonthly = (item = {}) => item.repaymentType === 'equalPrincipal' ? n(item.monthlyRepayment) : n(item.monthlyInterest);

export function buildCanonicalInput(input) {
  const result = structuredClone(input);
  const hasSpouse = result.basic?.hasSpouse === true;
  const selfSalary = n(result.income?.salary?.monthly) + n(result.income?.salary?.annualBonus) / 12;
  const spouseSalary = hasSpouse ? n(result.spouse?.salary?.monthly) + n(result.spouse?.salary?.annualBonus) / 12 : 0;
  const salaryMonthly = selfSalary + spouseSalary;

  const regular = result.income?.regularIncomes || [];
  const businessAnnual = sum(regular.filter((item) => item.type === 'business'), (item) => item.annual);
  const otherIncomes = regular.filter((item) => item.type !== 'business').map((item) => ({ ...item }));

  result.assets.currentIncome.monthly = salaryMonthly;
  result.assets.currentIncome.annual = Math.round(salaryMonthly * 12);
  result.income.business.annual = businessAnnual;
  result.income.business.monthly = Math.round(businessAnnual / 12);
  result.income.otherIncomes = otherIncomes;

  const living = result.assets.currentLivingCost.breakdown;
  if (result.assets.currentLivingCost.inputMode === 'detailed') {
    living.other = sum(living.otherItems, (item) => item.amount);
    result.assets.currentLivingCost.monthly = LIVING_KEYS.reduce((total, key) => total + n(living[key]), 0) + living.other;
    result.assets.currentLivingCost.annual = Math.round(result.assets.currentLivingCost.monthly * 12);
  }
  result.expense.healthInsurance.monthly = sum(result.expense.healthInsurance.items, (item) => item.monthly);

  const liquid = result.assets.liquidAssets;
  // 과거 저장 데이터에서는 청약이 기본 항목이 아니라 customItems의 이름 기반 항목이었다.
  // 신규 기본 필드로 한 번만 옮겨 합계 중복을 막고, 이후 화면과 서버가 같은 구조를 사용하게 한다.
  const legacySubscription = (liquid.customItems || []).find((item) => item.name === '청약');
  if (!n(liquid.breakdown.subscription) && legacySubscription) {
    liquid.breakdown.subscription = n(legacySubscription.amount);
  }
  liquid.customItems = (liquid.customItems || []).filter((item) => item.name !== '청약');
  if (liquid.inputMode !== 'simple') liquid.total = LIQUID_KEYS.reduce((total, key) => total + n(liquid.breakdown[key]), 0) + sum(liquid.customItems, (item) => item.amount);

  const financial = result.assets.financialAssets;
  if (financial.inputMode !== 'simple') {
    financial.other = sum(financial.otherItems, (item) => item.amount);
    financial.total = n(financial.stocks) + n(financial.funds) + n(financial.bonds) + n(financial.other);
  }

  const pension = result.assets.pensionAssetsBreakdown;
  if (result.assets.pensionAssetsInputMode !== 'simple') {
    pension.other = sum(pension.otherItems, (item) => item.amount);
    result.assets.pensionAssets = n(pension.variableAnnuity) + n(pension.pensionSavingsAccount) + n(pension.irp) + pension.other;
  }

  const realEstate = result.assets.realEstateAssets;
  if (realEstate.inputMode !== 'simple') realEstate.total = n(realEstate.mainProperty) + sum(realEstate.otherItems, (item) => item.amount);

  const otherAssets = result.assets.otherAssets;
  if (otherAssets?.inputMode !== 'simple') otherAssets.total = sum(otherAssets.items, (item) => item.amount);

  const debt = result.assets.debtStatus;
  if (debt.inputMode === 'detailed') {
    const items = [...DEBT_KEYS.map((key) => debt.breakdown[key] || {}), ...(debt.customItems || [])];
    debt.totalBalance = sum(items, (item) => item.principal);
    debt.monthlyRepayment = sum(items, debtMonthly);
  }

  const savings = result.assets.savingsPlan;
  if (savings.inputMode !== 'simple') {
    savings.monthly = SAVINGS_KEYS.reduce((total, key) => total + n(savings.breakdown[key]?.monthly), 0)
      + sum(savings.customItems, (item) => item.monthly);
    savings.annual = Math.round(savings.monthly * 12);
  }
  savings.retirementAnnual = Math.round(n(savings.retirementMonthly) * 12);
  savings.additionalRetirementAnnual = Math.round(n(savings.additionalRetirementMonthly) * 12);

  return result;
}
