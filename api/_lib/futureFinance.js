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

export function buildFiveYearOutlookAges(currentAge, lifeExpectancy) {
  if (!Number.isFinite(currentAge) || !Number.isFinite(lifeExpectancy) || lifeExpectancy < currentAge) return [];

  const ages = [currentAge];
  for (let age = Math.ceil(currentAge / 5) * 5; age < lifeExpectancy; age += 5) {
    ages.push(age);
  }
  ages.push(lifeExpectancy);
  return [...new Set(ages)].sort((a, b) => a - b);
}

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

export function calculateNonPensionIncomeAtTarget({ input, aggregates, currentAge, currentYear = new Date().getFullYear(), years }) {
  const selfSalary = input.income?.salary || {};
  const spouseSalary = input.spouse?.salary || {};
  const monthlySalary = (salary) => n(salary.monthly) + n(salary.annualBonus) / 12;
  const activeFor = (monthly, durationYears) => monthly > 0 && (years === 0 || (durationYears > 0 && years < durationYears));
  const retirementAge = Number(input.basic?.retirementAge);
  const spouseBirthYear = Number(input.spouse?.birthYear);
  const spouseRetirementAge = Number(input.spouse?.retirementAge);
  const selfIncomeYears = present(selfSalary.months)
    ? Math.max(0, n(selfSalary.months) / 12)
    : Number.isFinite(retirementAge) ? Math.max(0, retirementAge - currentAge) : 0;
  const spouseCurrentAge = Number.isFinite(spouseBirthYear) ? currentYear - spouseBirthYear : null;
  const spouseIncomeYears = present(spouseSalary.months)
    ? Math.max(0, n(spouseSalary.months) / 12)
    : spouseCurrentAge != null && Number.isFinite(spouseRetirementAge)
      ? Math.max(0, spouseRetirementAge - spouseCurrentAge)
      : 0;
  const selfSalaryMonthly = monthlySalary(selfSalary);
  const spouseSalaryMonthly = input.basic?.hasSpouse ? monthlySalary(spouseSalary) : 0;
  const salaryIncome = (activeFor(selfSalaryMonthly, selfIncomeYears) ? selfSalaryMonthly : 0)
    + (activeFor(spouseSalaryMonthly, spouseIncomeYears) ? spouseSalaryMonthly : 0);
  const businessIncome = activeFor(aggregates.businessMonthly, selfIncomeYears) ? aggregates.businessMonthly : 0;
  const otherIncome = (input.income?.otherIncomes || []).reduce((sum, item) => {
    const monthly = n(item.annual) / 12;
    return sum + (activeFor(monthly, n(item.years)) ? monthly : 0);
  }, 0);

  return salaryIncome + businessIncome + otherIncome;
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

  const buildTargets = (targetAges, includeAllIncome = false) => targetAges.map((targetAge) => {
      const years = Math.max(0, targetAge - currentAge);
      const livingExpense = livingExpenseMissing ? null : calculateFutureLivingExpense(aggregates.monthlyLivingCost, years);
      const pension = pensionDataMissing ? null : calculatePensionIncomeAtTarget({ input, currentYear, years });
      const pensionIncome = pension?.total ?? null;
      const nonPensionIncome = includeAllIncome
        ? calculateNonPensionIncomeAtTarget({ input, aggregates, currentAge, currentYear, years })
        : 0;
      const totalIncome = pensionIncome == null ? null : pensionIncome + nonPensionIncome;
      const incomeForComparison = includeAllIncome ? totalIncome : pensionIncome;
      const coverageRate = livingExpense > 0 && incomeForComparison != null ? (incomeForComparison / livingExpense) * 100 : null;
      const balance = livingExpense != null && incomeForComparison != null ? incomeForComparison - livingExpense : null;

      return {
        age: targetAge,
        years,
        livingExpense: round(livingExpense),
        pensionIncome: round(pensionIncome),
        ...(includeAllIncome ? {
          nonPensionIncome: round(nonPensionIncome),
          totalIncome: round(totalIncome),
          incomeLabel: nonPensionIncome > 0 ? '월급·연금 등' : pensionIncome > 0 ? '연금소득' : '소득 없음',
        } : {}),
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

  const targets = ageMissing ? [] : buildTargets(
    FUTURE_FINANCE_TARGET_AGES.filter((targetAge) => targetAge >= currentAge),
  );
  const lifeExpectancyRaw = input.basic?.lifeExpectancy || input.basic?.retirementEndAge;
  const lifeExpectancy = isBlank(lifeExpectancyRaw) ? null : Number(lifeExpectancyRaw);
  const fiveYearOutlook = ageMissing ? [] : buildTargets(
    buildFiveYearOutlookAges(currentAge, lifeExpectancy),
    true,
  );
  const retirementAge = Number(input.basic?.retirementAge);
  const retirementCashFlowOutlook = Number.isFinite(retirementAge)
    && retirementAge >= currentAge
    && Number.isFinite(lifeExpectancy)
    && retirementAge <= lifeExpectancy
    ? buildTargets([
      retirementAge,
      ...fiveYearOutlook.map((item) => item.age).filter((age) => age > retirementAge),
    ], true)
    : [];

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
    fiveYearOutlook,
    retirementCashFlowOutlook,
    purchasingPower,
    diagnosis,
  };
}

// expense.children(자녀 학자금·결혼지원비·기타)은 발생 시점(나이) 정보가 없고 은퇴 전에도
// 발생할 수 있어, 이번 자산잔액 시뮬레이션에는 자동으로 연결하지 않는다(항상 0). 은퇴 후
// 목돈지출은 별도 입력(expense.retirementLumpSumExpenses = [{ name, expectedAge, amount }])만
// 반영한다 - 두 데이터가 섞이지 않도록 의도적으로 분리했다.
const LUMP_SUM_EXPENSE_NOTE_EXCLUDED = '자녀 학자금·결혼지원비 등 목돈지출은 발생 시점(나이) 정보가 없어 이번 자산잔액 전망에는 포함되지 않았습니다.';
const LUMP_SUM_EXPENSE_NOTE_INCLUDED = '입력하신 은퇴 후 예상 목돈지출(발생 나이·금액)을 반영했습니다. 자녀 학자금 등 발생 시점이 불명확한 목돈지출은 포함되지 않습니다.';

// input.expense.retirementLumpSumExpenses에서 은퇴나이~기대수명 범위 안의 유효한 항목만 골라
// 나이별로 합산한다. validate.js가 제출 시점에 이미 이 범위를 검증하지만, 이 함수를 직접 호출하는
// 테스트나 과거 데이터를 대비해 여기서도 방어적으로 다시 확인한다 - 은퇴 전 지출이나 금액 0 이하
// 항목은 절대 섞지 않는다(시점을 임의로 추정하지 않는다는 원칙과 동일한 이유).
function buildLumpSumByAge(retirementLumpSumExpenses, retirementAge, lifeExpectancy) {
  const byAge = new Map();
  (retirementLumpSumExpenses || []).forEach((item) => {
    const amount = Number(item?.amount);
    const expectedAge = Number(item?.expectedAge);
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!name || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(expectedAge)) return;
    if (expectedAge < retirementAge || expectedAge > lifeExpectancy) return;
    const bucket = byAge.get(expectedAge) || { total: 0, events: [] };
    bucket.total += amount;
    bucket.events.push({ name, amount: round(amount) });
    byAge.set(expectedAge, bucket);
  });
  return byAge;
}

function retirementAssetProjectionNotCalculable(reason) {
  return {
    notCalculable: true,
    reason,
    startingAssets: null,
    retirementAge: null,
    lifeExpectancy: null,
    assumedReturnRate: null,
    inflationRate: null,
    depletionAge: null,
    assetsRemainAtLifeExpectancy: null,
    recoveredAfterDepletion: null,
    lumpSumExpenseIncluded: false,
    lumpSumExpenseNote: LUMP_SUM_EXPENSE_NOTE_EXCLUDED,
    points: [],
  };
}

/**
 * 은퇴 후 "자산잔액이 몇 살까지 유지되는가"를 연 단위로 시뮬레이션한다. 새 재무 가정을 추가하지
 * 않고 이미 계산된 값만 재사용한다:
 *  - 시작자산: simulation.readyAssetsAtRetirement (simulation.js의 기존 은퇴 준비자산 정의)
 *  - 연도별 생활비: calculateFutureLivingExpense() + simulation.retirementLivingCostNow
 *    (simulation.js의 requiredAtRetirement와 동일한 기준 생활비·물가상승률)
 *  - 연도별 소득: calculatePensionIncomeAtTarget() + calculateNonPensionIncomeAtTarget()
 *    (연금 개시·종료 나이, 국민연금 증가율 등 기존 futureFinance 로직을 그대로 적용)
 *  - 자산수익률: simulation.assumedReturnRate (새 수익률 가정 없음)
 *
 * 계산 순서(매년 동일): 연초 잔액 → (1+수익률) 적용 → 그 해 소득 유입 → 그 해 생활비 차감 →
 * 그 해 목돈지출(expense.retirementLumpSumExpenses) 차감 → 연말 잔액. 은퇴 전 자산축적
 * (simulation.js: 저축을 매년 말에 더한 뒤 남은 기간만큼 복리로 불림)과 동일하게 "연초 잔액을
 * 먼저 그 해만큼 불린 뒤 그 해 현금흐름을 반영"하는 순서를 그대로 이어간다.
 *
 * 목돈지출은 expense.children(자녀 학자금 등, 시점 불명)과 별도인 expense.retirementLumpSumExpenses
 * (사용자가 나이·금액을 직접 입력)만 반영한다 - 두 데이터를 자동으로 연결하지 않는다. 같은 나이에
 * 여러 항목이 있으면 합산해 그 해의 lumpSumExpense로 반영하고, 개별 항목은 points[].lumpSumEvents에
 * 그대로 남긴다.
 *
 * 연말 잔액이 음수가 되면(자산으로 그 해 생활비를 다 감당하지 못하면) 화면에 음수 자산으로
 * 보여주지 않고 0으로 고정하며, 감당하지 못한 금액은 unfundedExpense로 따로 기록한다(지표 11.
 * "음수 자산 처리" 참고).
 *
 * depletionAge = "최초 자산 소진 예상 나이"(unfundedExpense가 처음 발생한 나이)다. 자산을 그
 * 이후 영구히 0으로 고정하지 않는다 - 이후 연도에 소득이 생활비보다 많아지면(예: 국민연금 개시)
 * 잉여금을 자산에 다시 더하는 지표 7의 규칙을 소진 이후에도 동일하게 적용해, 잔액이 0에서 다시
 * 쌓일 수 있다. recoveredAfterDepletion은 depletionAge 이후 실제로 잔액이 0보다 커진 해가
 * 있었는지를 별도로 알려준다 - "84세에 최초로 부족이 발생했지만 이후 회복됨" 같은 문구를 만들 때
 * depletionAge 값 자체는 바꾸지 않고 이 필드로 구분한다.
 */
export function buildRetirementAssetProjection({ input, aggregates, simulation, currentYear = new Date().getFullYear() }) {
  const basic = input.basic || {};
  const retirementAgeBlank = isBlank(basic.retirementAge);
  const livingCostBlank = isBlank(input.expense?.retirementLivingCost);
  const birthYearBlank = isBlank(basic.birthYear);
  // simulation.js와 동일한 기대수명 필드 대체 규칙(lifeExpectancy 우선, 없으면 legacy
  // retirementEndAge)을 그대로 따른다 - 둘 다 비어 있을 때만 "입력 안 됨"으로 본다.
  // requiredAtRetirement>0 여부로 판단하지 않는다 - 기대수명이 은퇴나이와 같아 은퇴기간이
  // 0년이 되는 정상적인 경우(단일 연도 전망)까지 산출 불가로 잘못 묶이기 때문이다.
  const lifeExpectancyBlank = isBlank(basic.lifeExpectancy) && isBlank(basic.retirementEndAge);

  if (retirementAgeBlank || livingCostBlank || lifeExpectancyBlank) {
    return retirementAssetProjectionNotCalculable(
      '은퇴 나이, 노후 생활비, 기대수명을 모두 입력하면 자산잔액 전망을 계산할 수 있습니다.'
    );
  }
  if (birthYearBlank) {
    return retirementAssetProjectionNotCalculable(
      '생년월일을 입력하면 연금 개시 시점을 반영한 자산잔액 전망을 계산할 수 있습니다.'
    );
  }

  const retirementAge = simulation.currentAge + simulation.yearsToRetirement;
  const lifeExpectancy = retirementAge + simulation.retirementYears;
  const returnRate = simulation.assumedReturnRate / 100;
  const livingCostNow = simulation.retirementLivingCostNow;
  const lumpSumByAge = buildLumpSumByAge(input.expense?.retirementLumpSumExpenses, retirementAge, lifeExpectancy);
  const lumpSumExpenseIncluded = lumpSumByAge.size > 0;

  const points = [];
  let balance = simulation.readyAssetsAtRetirement;
  let depletionAge = null;

  for (let age = retirementAge; age <= lifeExpectancy; age++) {
    const years = age - simulation.currentAge;
    const pension = calculatePensionIncomeAtTarget({ input, currentYear, years });
    if (!pension.calculable) {
      return retirementAssetProjectionNotCalculable(
        `연금 개시·종료 정보가 불명확해 자산잔액 전망을 계산할 수 없습니다 (${pension.reason}).`
      );
    }
    const nonPensionIncome = calculateNonPensionIncomeAtTarget({
      input, aggregates, currentAge: simulation.currentAge, currentYear, years,
    });
    const income = (pension.total + nonPensionIncome) * 12;
    const livingExpense = calculateFutureLivingExpense(livingCostNow, years) * 12;
    const lumpSumBucket = lumpSumByAge.get(age);
    const lumpSumExpense = lumpSumBucket ? lumpSumBucket.total : 0;

    const startingBalance = balance;
    const investmentReturn = startingBalance * returnRate;
    const rawEndingBalance = startingBalance + investmentReturn + income - livingExpense - lumpSumExpense;
    const endingBalance = Math.max(0, rawEndingBalance);
    const unfundedExpense = Math.max(0, -rawEndingBalance);
    if (unfundedExpense > 0 && depletionAge === null) depletionAge = age;

    points.push({
      age,
      startingBalance: round(startingBalance),
      investmentReturn: round(investmentReturn),
      income: round(income),
      livingExpense: round(livingExpense),
      lumpSumExpense: round(lumpSumExpense),
      lumpSumEvents: lumpSumBucket ? lumpSumBucket.events : [],
      unfundedExpense: round(unfundedExpense),
      endingBalance: round(endingBalance),
    });

    balance = endingBalance;
  }

  const recoveredAfterDepletion = depletionAge !== null
    && points.some((p) => p.age > depletionAge && p.endingBalance > 0);
  const endingAssets = points[points.length - 1]?.endingBalance ?? simulation.readyAssetsAtRetirement;
  const totalIncome = points.reduce((sum, point) => sum + point.income, 0);
  const totalInvestmentReturn = points.reduce((sum, point) => sum + point.investmentReturn, 0);
  const totalLivingExpense = points.reduce((sum, point) => sum + point.livingExpense, 0);
  const totalLumpSumExpense = points.reduce((sum, point) => sum + point.lumpSumExpense, 0);
  const startingAssets = round(simulation.readyAssetsAtRetirement);
  const assetChange = round(endingAssets - startingAssets);
  const assetChangeRate = startingAssets > 0 ? round((assetChange / startingAssets) * 100) : null;

  return {
    notCalculable: false,
    reason: null,
    startingAssets: round(simulation.readyAssetsAtRetirement),
    retirementAge,
    lifeExpectancy,
    assumedReturnRate: simulation.assumedReturnRate,
    inflationRate: simulation.inflationRate,
    depletionAge,
    assetsRemainAtLifeExpectancy: depletionAge === null,
    recoveredAfterDepletion,
    lumpSumExpenseIncluded,
    lumpSumExpenseNote: lumpSumExpenseIncluded ? LUMP_SUM_EXPENSE_NOTE_INCLUDED : LUMP_SUM_EXPENSE_NOTE_EXCLUDED,
    explanation: {
      endingAssets: round(endingAssets),
      assetChange,
      assetChangeRate,
      totalIncome: round(totalIncome),
      totalInvestmentReturn: round(totalInvestmentReturn),
      totalLivingExpense: round(totalLivingExpense),
      totalLumpSumExpense: round(totalLumpSumExpense),
      totalInflow: round(totalIncome + totalInvestmentReturn),
      totalOutflow: round(totalLivingExpense + totalLumpSumExpense),
    },
    points,
  };
}
