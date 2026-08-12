// 다운로드 전 "웹 요약 화면" 전용 파생값. 9개 지표 계산(indicators.js)·은퇴 시뮬레이션(simulation.js)
// 로직에는 전혀 관여하지 않고, 이미 계산된 aggregates/simulation/indicators 값을 화면에 맞게
// 재조합하거나(카드·도넛차트) 최소한의 게이팅(입력 누락 판정)만 추가한다. 새로운 재무 기준·배점·
// 벤치마크는 만들지 않는다.

import { n } from './aggregate.js';
import { getNationalPensionStartAge } from './pensionEligibility.js';
import { buildFutureFinanceProjection } from './futureFinance.js';

function isBlank(v) {
  return v === '' || v === null || v === undefined;
}

function getPath(input, path) {
  return path.split('.').reduce((acc, k) => acc?.[k], input);
}

// 지정한 경로들이 전부 빈 값이면(=해당 입력 구획 자체를 건드리지 않았으면) true.
// 하나라도 채워졌다면 나머지가 비어 있어도(합산 시 n()이 0으로 처리) "입력함"으로 간주한다.
export function allBlank(input, paths) {
  return paths.every((p) => isBlank(getPath(input, p)));
}

// allBlank의 확장판 - "합계/총액" 자동계산 필드(예: assets.liquidAssets.total)는 위저드가
// 해당 스텝을 화면에 띄우기만 해도 각 스텝 컴포넌트의 useEffect가 0으로 채워 넣기 때문에,
// 이 값만으로는 "실제로 입력했는지"를 구분할 수 없다(0을 입력한 것과 동일하게 보임). 그래서
// "미입력 여부" 판정은 사용자가 실제로 타이핑하는 세부 입력 칸(leaf 필드)과, 항목을 추가하면
// 생기는 배열(customItems 등)만 기준으로 삼는다. leafPaths·arrayPaths가 전부 비어 있을 때만
// true(=미입력)를 반환한다.
export function allBlankLeaf(input, leafPaths, arrayPaths = []) {
  const leafBlank = leafPaths.every((p) => isBlank(getPath(input, p)));
  const arraysBlank = arrayPaths.every((p) => {
    const list = getPath(input, p);
    return !Array.isArray(list) || list.length === 0;
  });
  return leafBlank && arraysBlank;
}

// 차트에 절대 음수/NaN/Infinity가 들어가지 않도록 방어한다.
function safe(v) {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// ---------------------------------------------------------------------------
// 1. 재무 현황 카드 (섹션 3)
// ---------------------------------------------------------------------------

export function buildFinancialOverviewCards(input, aggregates) {
  const card = (key, label, value, missingPaths, extra = {}) => ({
    key,
    label,
    missing: allBlank(input, missingPaths),
    value: allBlank(input, missingPaths) ? null : value,
    ...extra,
  });

  const totalAssetPaths = [
    'assets.liquidAssets.total',
    'assets.financialAssets.stocks',
    'assets.financialAssets.funds',
    'assets.financialAssets.bonds',
    'assets.financialAssets.other',
    'assets.pensionAssets',
    'assets.realEstateAssets.total',
  ];

  return [
    card('monthlyIncome', '월 총소득', aggregates.householdMonthlyIncomeTotal, [
      'assets.currentIncome.monthly', 'income.business.monthly', 'income.nationalPension.monthly',
      'income.severance.pensionMonthly', 'income.severance.lumpsum',
      'income.personalPension.monthly', 'income.personalPension.lumpsum',
    ]),
    card('monthlyExpense', '월 총지출', aggregates.totalExpenseMonthlyExSavings, [
      'assets.currentLivingCost.monthly', 'expense.housingCost', 'assets.insurance.monthlyPremium',
      'expense.healthInsurance.monthly', 'assets.debtStatus.monthlyRepayment',
    ], { note: '생활비·주거비·보장성보험료·건강보험료·부채상환액·변동지출(경조사 등)을 합산한 금액입니다.' }),
    card('monthlySavings', '월 저축·투자액', aggregates.monthlySavings, ['assets.savingsPlan.monthly']),
    card('monthlyDebtRepayment', '월 원리금 상환액', aggregates.monthlyDebtRepayment, ['assets.debtStatus.monthlyRepayment']),
    card('liquidAssets', '현금성자산', aggregates.liquidAssets, ['assets.liquidAssets.total']),
    card('financialAssets', '금융자산', aggregates.financialAssetsTotal, [
      'assets.financialAssets.stocks', 'assets.financialAssets.funds', 'assets.financialAssets.bonds', 'assets.financialAssets.other',
    ]),
    card('pensionAssets', '연금자산', aggregates.pensionAssets, ['assets.pensionAssets']),
    card('realEstateAssets', '부동산자산', aggregates.realEstateTotal, ['assets.realEstateAssets.total']),
    card('totalAssets', '총자산', aggregates.totalAssets, totalAssetPaths, { highlight: true }),
    card('totalDebt', '총부채', aggregates.totalDebt, ['assets.debtStatus.totalBalance'], { highlight: true }),
    (() => {
      const missing = allBlank(input, [...totalAssetPaths, 'assets.debtStatus.totalBalance']);
      return {
        key: 'netWorth',
        label: '순자산',
        missing,
        value: missing ? null : aggregates.netWorth,
        highlight: true,
        risk: !missing && aggregates.netWorth < 0,
      };
    })(),
  ];
}

// ---------------------------------------------------------------------------
// 2. 도넛 차트 (섹션 4)
// ---------------------------------------------------------------------------

// 월 소득 배분 - "생활지출" 조각은 생활비·주거비·변동지출(경조사 등)을 하나로 묶어 보여준다
// (단순 합산일 뿐 새 항목을 만드는 것은 아니며, 미배정 여유자금 계산의 분모/차감 항목과 정확히 일치한다).
export function buildIncomeDonut(input, aggregates) {
  const monthlyIncome = aggregates.monthlyIncome;
  const living = aggregates.monthlyLivingCost + aggregates.monthlyHousingCost + aggregates.variableMonthly;
  const insurance = aggregates.monthlyInsurancePremium;
  const health = aggregates.monthlyHealthInsurance;
  const debtRepay = aggregates.monthlyDebtRepayment;
  const savings = aggregates.monthlySavings;

  const unassignedRaw = monthlyIncome - living - insurance - health - debtRepay - savings;
  const isOverspending = unassignedRaw < 0;

  const items = [
    { key: 'living', label: '생활지출', value: safe(living) },
    { key: 'insurance', label: '보장성보험료', value: safe(insurance) },
    { key: 'health', label: '건강보험료', value: safe(health) },
    { key: 'debtRepay', label: '원리금상환액', value: safe(debtRepay) },
    { key: 'savings', label: '저축·투자액', value: safe(savings) },
    { key: 'unassigned', label: '미배정 여유자금', value: safe(unassignedRaw) },
  ];

  // 도넛의 조각 비율(buildPieSegments)은 항상 items 합계를 100%로 잡는다. 초과지출 상태에서는
  // 지출 합계가 소득보다 커지므로, 중앙에 표시하는 합계도 소득이 아니라 실제 items 합계로 맞춰야
  // "생활지출 100%"처럼 소득 대비로 오해할 수 있는 표시를 막을 수 있다.
  const chartTotal = items.reduce((sum, it) => sum + it.value, 0);

  return {
    total: safe(chartTotal),
    isOverspending,
    overspendAmount: isOverspending ? safe(-unassignedRaw) : 0,
    items,
  };
}

// 지출 구성 - 저축 제외 총지출(totalExpenseMonthlyExSavings)을 구성 항목별로 그대로 쪼갠다.
// buildIncomeDonut의 "생활지출" 조각(생활비+주거비+변동지출 합산)과 달리 여기서는 각 항목을
// 분리해서 보여준다 - 새 금액을 만들지 않고 이미 있는 aggregates 필드를 그대로 재사용한다.
// otherLivingExpenseItems(현재 생활비 상세의 "기타지출" 종류별 항목)가 있으면 "생활비" 조각을
// 그 항목들만큼 떼어내 별도 조각으로 보여준다 - 이미 monthlyLivingCost에 포함된 값이므로
// 새로 더하지 않고 나눠서 표시만 한다(총합은 그대로 유지됨).
export function buildExpenseDonut(aggregates, livingExpenseItems = []) {
  const detailedLivingTotal = livingExpenseItems.reduce((s, it) => s + (Number(it.value) || 0), 0);
  const unclassifiedLiving = Math.max(0, safe(aggregates.monthlyLivingCost - detailedLivingTotal));
  const items = [
    ...(unclassifiedLiving > 0 ? [{
      key: 'living',
      label: livingExpenseItems.length > 0 ? '생활비(미분류)' : '생활비',
      value: unclassifiedLiving,
    }] : []),
    ...livingExpenseItems.map((it) => ({ key: it.key, label: it.label, value: safe(it.value) })),
    { key: 'housing', label: '주거비', value: safe(aggregates.monthlyHousingCost) },
    { key: 'insurance', label: '보장성보험료', value: safe(aggregates.monthlyInsurancePremium) },
    { key: 'health', label: '건강보험료', value: safe(aggregates.monthlyHealthInsurance) },
    { key: 'debtRepay', label: '원리금상환액', value: safe(aggregates.monthlyDebtRepayment) },
    { key: 'variable', label: '변동지출(경조사 등)', value: safe(aggregates.variableMonthly) },
  ];
  return {
    total: safe(aggregates.totalExpenseMonthlyExSavings),
    items,
  };
}

// otherLiquidAssetItems(현금성 자산의 "기본 항목 외 추가" 커스텀 항목)가 있으면 "현금성자산"
// 조각을 그 항목들만큼 떼어내 별도 조각으로 보여준다 - 이미 aggregates.liquidAssets에 포함된
// 값이므로 새로 더하지 않고 나눠서 표시만 한다(총합은 그대로 유지됨, buildExpenseDonut과 동일한 패턴).
export function buildAssetDonut(aggregates, otherLiquidAssetItems = []) {
  const otherLiquidTotal = otherLiquidAssetItems.reduce((s, it) => s + (Number(it.value) || 0), 0);
  const hasOtherLiquidItems = otherLiquidAssetItems.length > 0;
  return {
    total: safe(aggregates.totalAssets),
    items: [
      {
        key: 'liquid',
        label: hasOtherLiquidItems ? '현금성자산(기타 제외)' : '현금성자산',
        value: safe(aggregates.liquidAssets - otherLiquidTotal),
      },
      ...otherLiquidAssetItems.map((it) => ({ key: it.key, label: it.label, value: safe(it.value) })),
      { key: 'financial', label: '투자 금융자산', value: safe(aggregates.financialAssetsTotal) },
      { key: 'pension', label: '연금자산', value: safe(aggregates.pensionAssets) },
      { key: 'realEstate', label: '부동산자산', value: safe(aggregates.realEstateTotal) },
    ],
  };
}

function buildBreakdownDonut(breakdownItems, total) {
  const hasBreakdown = breakdownItems.length > 0;
  return {
    total: safe(total),
    hasBreakdown,
    isEmpty: !hasBreakdown && safe(total) <= 0,
    items: hasBreakdown ? breakdownItems.map((it) => ({ ...it, value: safe(it.value) })) : [],
  };
}

export function buildDebtDonut(debtBreakdown, totalDebt) {
  return buildBreakdownDonut(debtBreakdown, totalDebt);
}

export function buildSavingsDonut(savingsBreakdown, totalSavings) {
  return buildBreakdownDonut(savingsBreakdown, totalSavings);
}

// ---------------------------------------------------------------------------
// 3. 은퇴 준비 현황 (섹션 6)
// ---------------------------------------------------------------------------

export function buildRetirementReadiness({ input, simulation, indicators, aggregates }) {
  const retirementAgeBlank = isBlank(input.basic?.retirementAge);
  const livingCostBlank = isBlank(input.expense?.retirementLivingCost);
  const birthYearBlank = isBlank(input.basic?.birthYear);

  const notCalculable = retirementAgeBlank || livingCostBlank || !(simulation.requiredAtRetirement > 0);
  const retirementAge = simulation.currentAge + simulation.yearsToRetirement;

  const nationalPensionStartAge = birthYearBlank ? null : getNationalPensionStartAge(n(input.basic.birthYear));
  const incomeGapNotCalculable = retirementAgeBlank || birthYearBlank || nationalPensionStartAge === null;
  const gapYears = incomeGapNotCalculable ? null : Math.max(0, nationalPensionStartAge - retirementAge);
  // 공백기간 동안 순수하게 생활비만으로 필요한 자금(연금 반영 전 단순 곱셈) - 새 재무 가정을
  // 추가하는 것이 아니라 이미 있는 월 필요생활비×12×공백연수를 그대로 계산한다.
  const annualGapCost = incomeGapNotCalculable ? null : simulation.retirementLivingCostNow * 12;
  const totalGapFundingNeeded = incomeGapNotCalculable ? null : annualGapCost * gapYears;

  const pensionMonthlyTotal = aggregates.nationalPensionMonthly + aggregates.severancePensionMonthly + aggregates.personalPensionMonthly;
  const monthlyShortfall = Math.max(0, simulation.retirementLivingCostNow - pensionMonthlyTotal);
  const retirementIncomeIndicator = indicators.find((i) => i.key === 'retirementIncome') || null;
  let retirementIncomeZeroReason = null;

  if (!retirementIncomeIndicator?.notCalculable && retirementIncomeIndicator?.value === 0) {
    const pensionOwners = [input.income || {}, input.spouse || {}];
    const hasMonthlyAmountWithoutPeriod = pensionOwners.some((owner) => (
      (n(owner.nationalPension?.monthly) > 0 && n(owner.nationalPension?.months) <= 0)
      || (n(owner.severance?.pensionMonthly) > 0 && n(owner.severance?.pensionMonths) <= 0)
      || (n(owner.personalPension?.monthly) > 0 && n(owner.personalPension?.months) <= 0)
    ));
    const hasLumpSumSelection = pensionOwners.some((owner) => (
      owner.severance?.type === 'lumpsum' || owner.personalPension?.type === 'lumpsum'
    ));

    if (hasMonthlyAmountWithoutPeriod) {
      retirementIncomeZeroReason = '연금 월 수령액은 입력했지만 수령 기간이 없거나 0개월이라 예상 노후소득에 포함되지 않았습니다.';
    } else if (hasLumpSumSelection) {
      retirementIncomeZeroReason = '퇴직금 또는 개인연금을 일시금으로 선택해 월 예상 노후소득에 포함되는 연금액이 없습니다.';
    } else {
      retirementIncomeZeroReason = '월 수령 방식으로 입력된 국민연금·퇴직연금·개인연금 금액이 없어 0%입니다.';
    }
  }

  return {
    notCalculable,
    reason: notCalculable ? '은퇴 나이와 노후 생활비를 입력하면 필요자금을 계산할 수 있습니다.' : null,
    retirementAge: retirementAgeBlank ? null : retirementAge,
    yearsToRetirement: simulation.yearsToRetirement,
    retirementYears: simulation.retirementYears,
    retirementLivingCostNow: simulation.retirementLivingCostNow,
    retirementLivingCostAtRetirement: simulation.retirementLivingCostAtRetirement,
    inflationRate: simulation.inflationRate,
    assumedReturnRate: simulation.assumedReturnRate,
    currentReadyAssets: simulation.currentReadyAssets,
    currentAssetsAtRetirement: simulation.currentAssetsAtRetirement,
    annualSavings: simulation.annualSavings,
    futureSavingsAtRetirement: simulation.futureSavingsAtRetirement,
    requiredAtRetirement: notCalculable ? null : simulation.requiredAtRetirement,
    readyAssetsAtRetirement: notCalculable ? null : simulation.readyAssetsAtRetirement,
    shortfall: notCalculable ? null : simulation.shortfall,
    preparationRate: notCalculable ? null : simulation.preparationRate,
    incomeGap: {
      notCalculable: incomeGapNotCalculable,
      reason: incomeGapNotCalculable ? '연금 개시 나이를 확인할 수 없어 소득공백기간을 계산할 수 없습니다.' : null,
      nationalPensionStartAge,
      gapYears,
      hasGap: gapYears != null && gapYears > 0,
      annualGapCost,
      totalGapFundingNeeded,
    },
    monthlyIncomeCompare: {
      livingCostMonthly: simulation.retirementLivingCostNow,
      nationalPensionMonthly: aggregates.nationalPensionMonthly,
      severancePensionMonthly: aggregates.severancePensionMonthly,
      personalPensionMonthly: aggregates.personalPensionMonthly,
      shortfallMonthly: monthlyShortfall,
    },
    retirementIncomeIndicator,
    retirementIncomeZeroReason,
  };
}

// ---------------------------------------------------------------------------
// 3-2. 재무 현황 요약 카드(수입/지출/자산·부채 3그룹) - "자산현황 세부내역" 카드 전용.
// 은퇴 전 현재 시점 스냅샷이라 연금소득은 포함하지 않는다(급여·사업·기타소득만).
// balance의 세 항목은 항상 순자산과 정확히 일치하도록 구성한다(현금성 + 금융·연금 +
// (부동산-총부채) = 총자산-총부채 = 순자산 - 부채를 실물자산에서만 상계하는 단순화).
// ---------------------------------------------------------------------------

export function buildFinancialOverviewDetail(input, aggregates) {
  const salaryMissing = allBlank(input, ['assets.currentIncome.monthly']);
  const businessOtherMissing = allBlank(input, ['income.business.monthly', 'income.otherIncomes']);
  const savingsMissing = allBlank(input, ['assets.savingsPlan.monthly']);
  const expenseMissing = allBlank(input, [
    'assets.currentLivingCost.monthly', 'expense.housingCost', 'assets.insurance.monthlyPremium',
    'expense.healthInsurance.monthly', 'assets.debtStatus.monthlyRepayment',
  ]);
  const liquidMissing = allBlank(input, ['assets.liquidAssets.total']);
  const financialPensionMissing = allBlank(input, ['assets.financialAssets.stocks', 'assets.financialAssets.funds', 'assets.financialAssets.bonds', 'assets.financialAssets.other', 'assets.pensionAssets']);
  const realEstateDebtMissing = allBlank(input, ['assets.realEstateAssets.total', 'assets.debtStatus.totalBalance']);

  const salary = aggregates.salaryMonthly;
  const salaryItems = [
    { key: 'self-salary', label: '본인 월급', value: n(input.income?.salary?.monthly) },
    { key: 'self-bonus', label: '본인 상여금(월 환산)', value: n(input.income?.salary?.annualBonus) / 12 },
    { key: 'spouse-salary', label: '배우자 월급', value: n(input.spouse?.salary?.monthly) },
    { key: 'spouse-bonus', label: '배우자 상여금(월 환산)', value: n(input.spouse?.salary?.annualBonus) / 12 },
  ].filter((item) => item.value > 0);
  const explainedSalary = salaryItems.reduce((sum, item) => sum + item.value, 0);
  const unexplainedSalary = salary - explainedSalary;
  if (unexplainedSalary > 0.001) {
    salaryItems.push({ key: 'legacy-salary', label: salaryItems.length ? '기타 급여' : '급여', value: unexplainedSalary });
  }
  const businessAndOther = aggregates.businessMonthly + aggregates.otherIncomeMonthly;
  const monthlyTotal = salary + businessAndOther;

  const livingHousingInsurance = aggregates.totalExpenseMonthlyExSavings;
  const savings = aggregates.monthlySavings;

  const liquid = aggregates.liquidAssets;
  const financialAndPension = aggregates.financialAssetsTotal + aggregates.pensionAssets;
  const realEstateNetOfDebt = aggregates.realEstateTotal - aggregates.totalDebt;

  return {
    income: {
      salary, salaryItems, salaryMissing,
      businessAndOther, businessAndOtherMissing: businessOtherMissing,
      monthlyTotal, annualTotal: monthlyTotal * 12,
    },
    expense: {
      livingHousingInsurance, livingHousingInsuranceMissing: expenseMissing,
      savings, savingsMissing,
      fixedTotal: livingHousingInsurance + savings,
    },
    balance: {
      liquid, liquidMissing,
      financialAndPension, financialAndPensionMissing: financialPensionMissing,
      realEstateNetOfDebt, realEstateNetOfDebtMissing: realEstateDebtMissing,
      netWorth: aggregates.netWorth,
    },
  };
}

// ---------------------------------------------------------------------------
// 4. 전체 조립
// ---------------------------------------------------------------------------

export function buildWebSummary({
  input, aggregates, simulation, indicators, savingsBreakdown, debtBreakdown,
  livingExpenseItems, otherLiquidAssetItems,
}) {
  return {
    overviewDetail: buildFinancialOverviewDetail(input, aggregates),
    overviewCards: buildFinancialOverviewCards(input, aggregates),
    donuts: {
      income: buildIncomeDonut(input, aggregates),
      expense: buildExpenseDonut(aggregates, livingExpenseItems),
      assets: buildAssetDonut(aggregates, otherLiquidAssetItems),
      debt: buildDebtDonut(debtBreakdown, aggregates.totalDebt),
      savings: buildSavingsDonut(savingsBreakdown, aggregates.monthlySavings),
    },
    retirementReadiness: buildRetirementReadiness({ input, simulation, indicators, aggregates }),
    futureFinance: buildFutureFinanceProjection({ input, aggregates }),
  };
}
