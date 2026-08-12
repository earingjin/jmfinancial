import { n } from './aggregate.js';
import { getNationalPensionStartAge } from './pensionEligibility.js';

const isBlank = (value) => value === '' || value === null || value === undefined;
const getPath = (input, path) => path.split('.').reduce((value, key) => value?.[key], input);
const allBlank = (input, paths) => paths.every((path) => isBlank(getPath(input, path)));
const allBlankLeaf = (input, leafPaths, arrayPaths = []) => (
  leafPaths.every((path) => isBlank(getPath(input, path)))
  && arrayPaths.every((path) => !Array.isArray(getPath(input, path)) || getPath(input, path).length === 0)
);

export const FUTURE_FINANCE_ASSUMPTIONS = Object.freeze({
  inflationRate: 0.03,
  nationalPensionGrowthRate: 0.021,
  privatePensionGrowthRate: 0,
  retirementPensionGrowthRate: 0,
});

export const FUTURE_FINANCE_TARGET_AGES = Object.freeze([60, 70, 80]);

export function calculateFutureValue(value, annualRate, years) {
  const result = Number(value) * Math.pow(1 + Number(annualRate), Math.max(0, Number(years)));
  return Number.isFinite(result) ? result : null;
}

export function calculateFutureLivingExpense(currentMonthlyExpense, years) {
  return calculateFutureValue(currentMonthlyExpense, FUTURE_FINANCE_ASSUMPTIONS.inflationRate, years);
}

export function calculatePurchasingPowerEquivalent(currentValue, years) {
  return calculateFutureValue(currentValue, FUTURE_FINANCE_ASSUMPTIONS.inflationRate, years);
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function round1(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

export function calculateFuturePensionIncome({ national = 0, personal = 0, retirement = 0, years, targetAge, nationalPensionStartAge }) {
  const nationalEligible = nationalPensionStartAge == null || targetAge >= nationalPensionStartAge;
  const nationalPension = nationalEligible
    ? calculateFutureValue(national, FUTURE_FINANCE_ASSUMPTIONS.nationalPensionGrowthRate, years)
    : 0;
  const personalPension = calculateFutureValue(personal, FUTURE_FINANCE_ASSUMPTIONS.privatePensionGrowthRate, years);
  const retirementPension = calculateFutureValue(retirement, FUTURE_FINANCE_ASSUMPTIONS.retirementPensionGrowthRate, years);
  const total = nationalPension == null || personalPension == null || retirementPension == null
    ? null
    : nationalPension + personalPension + retirementPension;
  return { nationalPension, personalPension, retirementPension, total, nationalEligible };
}

function assetDataMissing(input) {
  return allBlankLeaf(input, [
    'assets.liquidAssets.breakdown.deposit', 'assets.liquidAssets.breakdown.savings',
    'assets.liquidAssets.breakdown.cma', 'assets.liquidAssets.breakdown.emergencyFund',
    'assets.financialAssets.stocks', 'assets.financialAssets.funds', 'assets.financialAssets.bonds',
    'assets.pensionAssetsBreakdown.variableAnnuity', 'assets.pensionAssetsBreakdown.pensionSavingsAccount',
    'assets.pensionAssetsBreakdown.irp', 'assets.realEstateAssets.mainProperty',
    'assets.debtStatus.breakdown.mortgage.principal', 'assets.debtStatus.breakdown.depositLoan.principal',
    'assets.debtStatus.breakdown.businessLoan.principal', 'assets.debtStatus.breakdown.buildingLoan.principal',
    'assets.debtStatus.breakdown.carLoan.principal', 'assets.debtStatus.breakdown.studentLoan.principal',
    'assets.debtStatus.breakdown.otherLoan.principal',
  ], [
    'assets.liquidAssets.customItems', 'assets.financialAssets.otherItems',
    'assets.pensionAssetsBreakdown.otherItems', 'assets.realEstateAssets.otherItems',
    'assets.debtStatus.customItems',
  ]);
}

export function buildFutureFinanceProjection({ input, aggregates, currentYear = new Date().getFullYear() }) {
  const birthYearRaw = input.basic?.birthYear;
  const ageMissing = birthYearRaw === '' || birthYearRaw == null;
  const currentAge = ageMissing ? null : currentYear - n(birthYearRaw);
  const livingExpenseMissing = allBlank(input, ['assets.currentLivingCost.monthly']);
  const pensionDataMissing = allBlank(input, [
    'income.nationalPension.monthly', 'income.severance.pensionMonthly', 'income.personalPension.monthly',
    'spouse.nationalPension.monthly', 'spouse.severance.pensionMonthly', 'spouse.personalPension.monthly',
  ]);
  const netWorthMissing = assetDataMissing(input);
  const nationalPensionStartAge = ageMissing ? null : getNationalPensionStartAge(n(birthYearRaw));

  const targets = ageMissing ? [] : FUTURE_FINANCE_TARGET_AGES
    .filter((targetAge) => targetAge >= currentAge)
    .map((targetAge) => {
      const years = Math.max(0, targetAge - currentAge);
      const livingExpense = livingExpenseMissing ? null : calculateFutureLivingExpense(aggregates.monthlyLivingCost, years);
      const pension = pensionDataMissing ? null : calculateFuturePensionIncome({
        national: aggregates.nationalPensionMonthly,
        personal: aggregates.personalPensionMonthly,
        retirement: aggregates.severancePensionMonthly,
        years,
        targetAge,
        nationalPensionStartAge,
      });
      const pensionIncome = pension?.total ?? null;
      const coverageRate = livingExpense > 0 && pensionIncome != null ? (pensionIncome / livingExpense) * 100 : null;
      const balance = livingExpense != null && pensionIncome != null ? pensionIncome - livingExpense : null;

      return {
        age: targetAge,
        years,
        livingExpense: round(livingExpense),
        pensionIncome: round(pensionIncome),
        pensionBreakdown: pension && {
          nationalPension: round(pension.nationalPension),
          personalPension: round(pension.personalPension),
          retirementPension: round(pension.retirementPension),
          nationalEligible: pension.nationalEligible,
        },
        coverageRate: round1(coverageRate),
        balance: round(balance),
        status: coverageRate == null ? 'unknown' : coverageRate >= 100 ? 'good' : coverageRate >= 80 ? 'warning' : 'risk',
      };
    });

  const purchasingPower = netWorthMissing ? null : [0, 10, 20].map((years) => ({
    years,
    requiredAmount: round(calculatePurchasingPowerEquivalent(aggregates.netWorth, years)),
  }));

  const diagnosticTarget = targets.find((item) => item.age === 80) || targets.at(-1);
  let diagnosis = null;
  if (diagnosticTarget?.coverageRate != null) {
    diagnosis = diagnosticTarget.coverageRate >= 100
      ? '현재 준비 수준을 유지한다면 장기적인 생활비 충당 여력이 양호합니다.'
      : diagnosticTarget.coverageRate >= 80
        ? '장기적으로 생활비와 연금소득 사이에 일부 차이가 발생할 수 있습니다.'
        : '70세 이후 생활비 대비 연금소득 부족폭이 커질 가능성이 있습니다.';
  }

  return {
    assumptions: FUTURE_FINANCE_ASSUMPTIONS,
    currentAge,
    nationalPensionStartAge,
    missing: { age: ageMissing, livingExpense: livingExpenseMissing, pension: pensionDataMissing, netWorth: netWorthMissing },
    targets,
    purchasingPower,
    diagnosis,
  };
}
