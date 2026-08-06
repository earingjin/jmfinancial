// 원본 입력값(input)에서 지표 계산에 필요한 집계값을 만든다.
// 이 파일이 곧 "현재 시점 가계 재무 스냅샷"을 만드는 핵심 로직이며, 서버에서만 실행된다.

const n = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v) || 0);

// annual 필드가 실제로 입력되지 않은 경우(빈 값/undefined/null)에만 monthly×12로 대체한다.
// annual이 명시적으로 0이어도(예: 올해는 저축을 전혀 안 함) 그 값을 그대로 존중한다 -
// 기존에는 `n(annual) || monthly*12` 형태라 명시적 0이 무시되고 monthly*12로 덮어써지는 문제가 있었다.
const pickAnnual = (annualRaw, monthlyRaw) => {
  const hasAnnual = annualRaw !== '' && annualRaw !== null && annualRaw !== undefined;
  return hasAnnual ? n(annualRaw) : n(monthlyRaw) * 12;
};

export function buildAggregates(input) {
  const assets = input.assets || {};
  const expense = input.expense || {};
  const income = input.income || {};

  // ---- 현재 월 소득/연 소득 (사업소득 포함) ----
  // salaryMonthly(assets.currentIncome.monthly)는 급여(본인+배우자)만을 뜻하고, 사업소득(본인+배우자
  // 합산)은 businessMonthly로 별도 합산한다. annualIncome은 반드시 monthlyIncome×12로 계산해야
  // 사업소득이 두 번 반영되거나 누락되지 않는다(currentIncome.annual을 직접 쓰면 안 됨).
  const salaryMonthly = n(assets.currentIncome?.monthly);
  const businessMonthly = n(income.business?.monthly);
  const monthlyIncome = salaryMonthly + businessMonthly;
  const annualIncome = Math.round(monthlyIncome * 12);

  // ---- 현재 고정지출 (저축 제외) ----
  // 건강보험료는 매달 고정적으로 나가는 비용이라 "보장성 보험"과 함께 고정지출로 분류한다
  // (이전에는 변동지출(이벤트성) 쪽에 들어가 있어 화면상 보험료와 나란히 입력받는 항목인데도
  // 계산상 카테고리가 어긋나 있었다). 총지출 합계 자체는 동일하고, 고정/변동 구성비 표시만 바뀐다.
  const monthlyLivingCost = n(assets.currentLivingCost?.monthly);
  const monthlyHousingCost = n(expense.housingCost);
  const monthlyInsurancePremium = n(assets.insurance?.monthlyPremium);
  const monthlyHealthInsurance = n(expense.healthInsurance?.monthly);
  const monthlyDebtRepayment = n(assets.debtStatus?.monthlyRepayment);
  // 노후준비 저축액이 위 일반 저축액에 이미 포함되어 있으면(retirementIncludedInTotal !== false,
  // 기본값 포함) 더하지 않고, 사용자가 별도로 하고 있다고 명시하면(false) 겹치지 않는 별개 금액이므로
  // 더한다(사용자 승인된 계산 방식 변경).
  const generalSavingsMonthly = n(assets.savingsPlan?.monthly);
  const retirementSavingsMonthlyRaw = n(assets.savingsPlan?.retirementMonthly);
  const retirementIncludedInSavings = assets.savingsPlan?.retirementIncludedInTotal !== false;
  const monthlySavings = retirementIncludedInSavings
    ? generalSavingsMonthly
    : generalSavingsMonthly + retirementSavingsMonthlyRaw;

  const fixedExpenseMonthly =
    monthlyLivingCost + monthlyHousingCost + monthlyInsurancePremium + monthlyHealthInsurance + monthlyDebtRepayment;

  // ---- 변동지출(이벤트성)의 월평균 환산 ----
  const variableAnnual =
    n(expense.medical?.annual) +
    (expense.otherExpenses || []).reduce((sum, item) => sum + n(item.annual), 0);
  const variableMonthly = variableAnnual / 12;

  // 가계수지지표용 총지출(저축 제외, 고정+변동)
  const totalExpenseMonthlyExSavings = fixedExpenseMonthly + variableMonthly;

  // ---- 자산 ----
  // 예금·적금·CMA는 현금성자산(liquidAssets)으로 집계되므로 financialAssetsTotal(투자자산)에는
  // 포함하지 않는다 - 주식·펀드·채권·기타처럼 즉시 인출이 어려운 투자자산만 남긴다.
  const fa = assets.financialAssets || {};
  const financialAssetsTotal = n(fa.stocks) + n(fa.funds) + n(fa.bonds) + n(fa.other);
  const pensionAssets = n(assets.pensionAssets);
  const realEstateTotal = n(assets.realEstateAssets?.total);
  // 현금성자산(예금·적금·비상금 등, 비상예비금지표에도 쓰이는 값)은 총자산에도 포함된다.
  const liquidAssets = n(assets.liquidAssets?.total);
  const totalAssets = financialAssetsTotal + liquidAssets + pensionAssets + realEstateTotal;

  // ---- 부채 ----
  const totalDebt = n(assets.debtStatus?.totalBalance);

  // ---- 저축 ----
  const retirementSavingsAnnual = pickAnnual(assets.savingsPlan?.retirementAnnual, retirementSavingsMonthlyRaw);
  const generalSavingsAnnual = pickAnnual(assets.savingsPlan?.annual, generalSavingsMonthly);
  const totalSavingsAnnual = retirementIncludedInSavings
    ? generalSavingsAnnual
    : generalSavingsAnnual + retirementSavingsAnnual;

  // ---- 노후 예상 월소득 (본인 + 배우자 연금 합산, 항목별 분해) ----
  const retirementIncomeByCategory = calcRetirementIncomeByCategory(input);
  // 주택연금 시나리오(scenarios.js)가 적용된 입력에서만 존재하는 파생값. 실제 퇴직연금(severance)과
  // 절대 혼합하지 않도록 완전히 별도 네임스페이스(scenarioAdjustments)에 둔다 - 원본 위저드 입력에는
  // 이 경로 자체가 존재하지 않는다.
  const reverseMortgageMonthly = n(input.scenarioAdjustments?.reverseMortgageMonthly);
  const monthlyRetirementIncome = retirementIncomeByCategory.total + reverseMortgageMonthly;

  // ---- 리포트 3페이지(수입·지출·자산부채 세부 현황) 표시 전용 집계 ----
  // 아래 값들은 어떤 지표 계산에도 쓰이지 않는다. FHS ①·⑥ 지표의 "총소득" 분모는
  // 그대로 monthlyIncome/annualIncome(급여+사업소득)을 사용한다.
  const otherIncomeMonthly = (income.otherIncomes || []).reduce((sum, item) => sum + n(item.annual), 0) / 12;
  const householdMonthlyIncomeTotal = monthlyIncome + monthlyRetirementIncome + otherIncomeMonthly;
  const netWorth = totalAssets - totalDebt;

  // 리포트 "부족한 자산 채우기" 페이지 전용 - 본인/배우자로 분리 입력된 항목만 개별 집계한다.
  const retirementIncomeByPerson = calcRetirementIncomeByPerson(input);

  return {
    monthlyIncome,
    annualIncome,
    salaryMonthly,
    businessMonthly,
    monthlyLivingCost,
    monthlyHousingCost,
    monthlyInsurancePremium,
    monthlyHealthInsurance,
    fixedExpenseMonthly,
    variableAnnual,
    variableMonthly,
    totalExpenseMonthlyExSavings,
    financialAssetsTotal,
    pensionAssets,
    realEstateTotal,
    totalAssets,
    totalDebt,
    netWorth,
    monthlyDebtRepayment,
    monthlySavings,
    totalSavingsAnnual,
    retirementSavingsAnnual,
    retirementIncludedInSavings,
    liquidAssets,
    monthlyRetirementIncome,
    nationalPensionMonthly: retirementIncomeByCategory.nationalPension,
    severancePensionMonthly: retirementIncomeByCategory.severancePension,
    personalPensionMonthly: retirementIncomeByCategory.personalPension,
    reverseMortgageMonthly,
    otherIncomeMonthly,
    householdMonthlyIncomeTotal,
    retirementIncomeByPerson,
  };
}

// 은퇴 후 예상 월소득 = 본인 국민연금·퇴직연금·개인연금 + 배우자 국민연금·퇴직연금·개인연금
// (수령 개월수가 0 이하인 항목은 이미 종료된 것으로 보고 0 처리)
//
// 퇴직연금·개인연금은 수령방식이 "일시금"이면 월 소득에 포함하지 않는다 - 일시금은 자산으로
// 잡히는 별개 항목이라, 이걸 빼먹으면 예전에 '연금(월지급)'을 눌러보다 '일시금'으로 바꾼 뒤에도
// 남아있는 월 수령액이 계속 노후소득에 합산되는 문제가 있었다(pensionProjection.js의 연차별
// 추이 계산과 동일한 기준으로 맞춤).
export function calcRetirementIncomeByCategory(input) {
  const income = input.income || {};
  const spouse = input.spouse || {};

  const pick = (monthly, months) => (n(months) > 0 ? n(monthly) : 0);

  const pickSeverancePension = (severance) => {
    const s = severance || {};
    if ('type' in s && s.type !== 'pension') return 0; // 일시금 선택 시 제외
    return pick(s.pensionMonthly, s.pensionMonths);
  };

  const pickPersonalPension = (personalPension) => {
    const p = personalPension || {};
    if ('type' in p && p.type !== 'installment') return 0; // 일시금 선택 시 제외
    return pick(p.monthly, p.months);
  };

  const nationalPension =
    pick(income.nationalPension?.monthly, income.nationalPension?.months) +
    pick(spouse.nationalPension?.monthly, spouse.nationalPension?.months);

  const severancePension = pickSeverancePension(income.severance) + pickSeverancePension(spouse.severance);

  const personalPension = pickPersonalPension(income.personalPension) + pickPersonalPension(spouse.personalPension);

  return {
    nationalPension,
    severancePension,
    personalPension,
    total: nationalPension + severancePension + personalPension,
  };
}

// 위 calcRetirementIncomeByCategory와 같은 원본 입력을 본인/배우자로 나눠서 보여주는 버전.
// 급여·현금성자산·기타수입·순자산은 애초에 가구 합산으로만 입력받으므로(본인/배우자 분리 입력값이
// 없음) 여기 포함하지 않는다 - 임의로 반씩 나누면 실제와 다른 숫자가 되기 때문이다.
export function calcRetirementIncomeByPerson(input) {
  const income = input.income || {};
  const spouse = input.spouse || {};

  const pick = (monthly, months) => (n(months) > 0 ? n(monthly) : 0);

  const personalPensionMonthly = (personalPension) => {
    const p = personalPension || {};
    if ('type' in p && p.type !== 'installment') return 0; // 일시금 선택 시 제외(월 수령액이 아님)
    return pick(p.monthly, p.months);
  };

  return {
    self: {
      nationalPensionMonthly: pick(income.nationalPension?.monthly, income.nationalPension?.months),
      severanceLumpsum: n(income.severance?.lumpsum),
      personalPensionMonthly: personalPensionMonthly(income.personalPension),
    },
    spouse: {
      nationalPensionMonthly: pick(spouse.nationalPension?.monthly, spouse.nationalPension?.months),
      severanceLumpsum: n(spouse.severance?.lumpsum),
      personalPensionMonthly: personalPensionMonthly(spouse.personalPension),
    },
  };
}

// 만 나이(현재 시점 기준, 출생년도 기반 간이 계산)
export function getCurrentAge(input, currentYear = new Date().getFullYear()) {
  const birthYear = n(input.basic?.birthYear);
  return birthYear ? currentYear - birthYear : 0;
}

// 리포트 2페이지 가족구성원 표 전용 - 배우자·자녀는 별도 은퇴연령·기대여명을 입력받지 않으므로 연령만 산출한다.
export function buildFamilyAges(input, currentYear = new Date().getFullYear()) {
  const spouseBirthYear = n(input.spouse?.birthYear);
  const children = (input.expense?.children || []).map((c) => {
    const birthYear = n(c.birthYear);
    return { age: birthYear ? currentYear - birthYear : null };
  });

  return {
    self: { age: getCurrentAge(input, currentYear) },
    spouse: spouseBirthYear ? { age: currentYear - spouseBirthYear } : null,
    children,
  };
}

export { n, pickAnnual };
