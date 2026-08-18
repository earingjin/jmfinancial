import { n } from './aggregate.js';
import { getNationalPensionStartAge } from './pensionEligibility.js';
import { FUTURE_FINANCE_ASSUMPTIONS } from './constants.js';
import { NonFiniteCalculationError } from './finite.js';

export { FUTURE_FINANCE_ASSUMPTIONS } from './constants.js';

const isBlank = (value) => value === '' || value === null || value === undefined;
const getPath = (input, path) => path.split('.').reduce((value, key) => value?.[key], input);
const allBlank = (input, paths) => paths.every((path) => isBlank(getPath(input, path)));
const allBlankLeaf = (input, leafPaths, arrayPaths = []) => (
  leafPaths.every((path) => isBlank(getPath(input, path)))
  && arrayPaths.every((path) => !Array.isArray(getPath(input, path)) || getPath(input, path).length === 0)
);

export const FUTURE_FINANCE_TARGET_AGES = Object.freeze([60, 70, 80]);

export function calculateFutureValue(value, annualRate, years) {
  const result = Number(value) * Math.pow(1 + Number(annualRate), Math.max(0, Number(years)));
  if (!Number.isFinite(result)) throw new NonFiniteCalculationError('futureFinance.futureValue');
  return result;
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

const present = (value) => value !== '' && value !== null && value !== undefined;

function nationalEligible(person = {}) {
  const pension = person.nationalPension || {};
  if (pension.inputMode === 'none') return false;
  const rawMonths = pension.inputMode === 'simulate' ? pension.simulate?.contributionMonths : pension.paymentMonths;
  const legacyYears = pension.inputMode === 'simulate' ? pension.simulate?.years : pension.paymentYears;
  if (present(rawMonths)) return n(rawMonths) >= 120;
  if (present(legacyYears)) return n(legacyYears) * 12 >= 120;
  return true;
}

function pensionComponents(input, currentYear) {
  const people = [
    { key: 'self', person: input.income || {}, birthYear: input.basic?.birthYear },
    ...(input.basic?.hasSpouse ? [{ key: 'spouse', person: input.spouse || {}, birthYear: input.spouse?.birthYear }] : []),
  ];
  return people.flatMap(({ key, person, birthYear }) => {
    const currentAge = present(birthYear) ? currentYear - n(birthYear) : null;
    const national = person.nationalPension || {};
    const severance = person.severance || {};
    const personal = person.personalPension || {};
    const nationalStart = present(birthYear) ? getNationalPensionStartAge(n(birthYear)) : null;
    return [
      {
        key: `${key}.nationalPension`, category: 'nationalPension', monthly: nationalEligible(person) ? n(national.monthly) : 0,
        startAge: nationalStart, months: national.months, currentAge,
        growthRate: FUTURE_FINANCE_ASSUMPTIONS.nationalPensionGrowthRate,
      },
      {
        key: `${key}.retirementPension`, category: 'retirementPension', monthly: severance.type === 'pension' ? n(severance.pensionMonthly) : 0,
        startAge: severance.pensionStartAge, months: severance.pensionMonths, currentAge,
        growthRate: FUTURE_FINANCE_ASSUMPTIONS.retirementPensionGrowthRate,
      },
      {
        key: `${key}.personalPension`, category: 'personalPension', monthly: personal.type === 'installment' ? n(personal.monthly) : 0,
        startAge: personal.startAge, months: personal.months, currentAge,
        growthRate: FUTURE_FINANCE_ASSUMPTIONS.privatePensionGrowthRate,
      },
    ];
  });
}

export function calculatePensionIncomeAtTarget({ input, currentYear, years }) {
  const components = pensionComponents(input, currentYear).map((component) => {
    if (component.monthly <= 0) return { ...component, amount: 0, inclusionStatus: 'zero' };
    if (!present(component.startAge) || !present(component.months) || component.currentAge == null) {
      return { ...component, amount: null, inclusionStatus: 'unknown' };
    }
    const ageAtTarget = component.currentAge + years;
    const endAge = n(component.startAge) + n(component.months) / 12;
    const active = n(component.startAge) <= ageAtTarget && ageAtTarget < endAge;
    return {
      ...component,
      amount: active ? calculateFutureValue(component.monthly, component.growthRate, years) : 0,
      inclusionStatus: active ? 'included' : ageAtTarget < n(component.startAge) ? 'beforeStart' : 'afterEnd',
      endAge,
    };
  });
  const unknown = components.filter((component) => component.inclusionStatus === 'unknown');
  const byCategory = (category) => {
    const matching = components.filter((component) => component.category === category);
    return matching.some((component) => component.amount == null) ? null : matching.reduce((sum, component) => sum + component.amount, 0);
  };
  const calculable = unknown.length === 0;
  const nationalPension = byCategory('nationalPension');
  const personalPension = byCategory('personalPension');
  const retirementPension = byCategory('retirementPension');
  return {
    nationalPension, personalPension, retirementPension,
    total: calculable ? nationalPension + personalPension + retirementPension : null,
    calculable,
    reason: calculable ? null : `연금 개시·종료 정보 부족: ${unknown.map((component) => component.key).join(', ')}`,
    components,
  };
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
      const pension = pensionDataMissing ? null : calculatePensionIncomeAtTarget({ input, currentYear, years });
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
          components: pension.components,
        },
        coverageRate: round1(coverageRate),
        balance: round(balance),
        status: coverageRate == null ? 'unknown' : coverageRate >= 100 ? 'good' : coverageRate >= 80 ? 'warning' : 'risk',
        calculable: pension?.calculable ?? false,
        calculationReason: pension?.reason ?? (pensionDataMissing ? '연금 정보 부족' : null),
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
