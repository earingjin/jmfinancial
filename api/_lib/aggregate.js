import { assessNationalPensionEligibility, nationalPensionMonthlyEligible } from './pensionEligibility.js';

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

// 노후저축 입력 버전(v1/v2)에 따라 monthlySavings·retirementSavingsAnnual·totalSavingsAnnual을
// 만든다. 노후대비저축지표 공식(retirementSavingsAnnual ÷ totalSavingsAnnual)은 절대 바꾸지 않고,
// 지표 계산기에 들어가기 전 이 집계값 자체만 버전에 맞게 만든다(사용자 승인된 계산 방식 추가).
//
// v1(레거시, retirementSavingsInputVersion !== 2): 기존 계산 그대로 - 노후준비 저축액을 하나의
// 합계로 직접 입력받는 retirementMonthly/retirementAnnual과, 그 금액이 위 일반 저축액에 이미
// 포함되어 있는지를 나타내는 retirementIncludedInTotal(기본값 true=포함) 조합으로 계산한다.
// 저장된 v1 결과의 숫자를 바꾸지 않기 위해 이 분기는 한 글자도 건드리지 않는다.
//
// v2(신규): 연금저축·IRP는 이미 savingsPlan.breakdown 총저축액(=monthly)에 포함되어 자동
// 인식되므로, 사용자는 그 외에 추가로 하고 있는 노후저축(additionalRetirementMonthly/Annual)만
// 입력한다. 그래서 총저축은 breakdown 총액 + additionalRetirementMonthly(한 번만 추가)이고,
// 노후저축(지표 분자)은 연금저축+IRP(자동) + additionalRetirementMonthly다.
function buildRetirementSavingsAggregate(savingsPlan) {
  const generalSavingsMonthly = n(savingsPlan?.monthly);
  const generalSavingsAnnual = pickAnnual(savingsPlan?.annual, generalSavingsMonthly);

  if (savingsPlan?.inputMode === 'simple') {
    return {
      monthlySavings: generalSavingsMonthly,
      retirementSavingsAnnual: 0,
      totalSavingsAnnual: generalSavingsAnnual,
      retirementIncludedInSavings: true,
    };
  }

  if (savingsPlan?.retirementSavingsInputVersion === 2) {
    const breakdown = savingsPlan?.breakdown || {};
    const autoRetirementMonthly = n(breakdown.pensionSavings?.monthly) + n(breakdown.irp?.monthly);
    const additionalRetirementMonthly = n(savingsPlan?.additionalRetirementMonthly);
    const additionalRetirementAnnual = pickAnnual(savingsPlan?.additionalRetirementAnnual, additionalRetirementMonthly);
    return {
      monthlySavings: generalSavingsMonthly + additionalRetirementMonthly,
      retirementSavingsAnnual: autoRetirementMonthly * 12 + additionalRetirementAnnual,
      totalSavingsAnnual: generalSavingsAnnual + additionalRetirementAnnual,
      // 연금저축·IRP(자동)와 추가 노후저축 전액이 이미 총저축 합계 안에 포함되어 있어 중복이 없다.
      retirementIncludedInSavings: true,
    };
  }

  // 노후준비 저축액이 위 일반 저축액에 이미 포함되어 있으면(retirementIncludedInTotal !== false,
  // 기본값 포함) 더하지 않고, 사용자가 별도로 하고 있다고 명시하면(false) 겹치지 않는 별개 금액이므로
  // 더한다(사용자 승인된 계산 방식 변경).
  const retirementSavingsMonthlyRaw = n(savingsPlan?.retirementMonthly);
  const retirementIncludedInSavings = savingsPlan?.retirementIncludedInTotal !== false;
  const retirementSavingsAnnual = pickAnnual(savingsPlan?.retirementAnnual, retirementSavingsMonthlyRaw);
  return {
    monthlySavings: retirementIncludedInSavings
      ? generalSavingsMonthly
      : generalSavingsMonthly + retirementSavingsMonthlyRaw,
    retirementSavingsAnnual,
    totalSavingsAnnual: retirementIncludedInSavings
      ? generalSavingsAnnual
      : generalSavingsAnnual + retirementSavingsAnnual,
    retirementIncludedInSavings,
  };
}

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
  const {
    monthlySavings,
    retirementSavingsAnnual,
    totalSavingsAnnual,
    retirementIncludedInSavings,
  } = buildRetirementSavingsAggregate(assets.savingsPlan);

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
  const financialAssetsTotal = fa.inputMode === 'simple' ? n(fa.total) : n(fa.stocks) + n(fa.funds) + n(fa.bonds) + n(fa.other);
  const pensionAssets = n(assets.pensionAssets);
  const realEstateTotal = n(assets.realEstateAssets?.total);
  // 현금성자산(예금·적금·비상금 등, 비상예비금지표에도 쓰이는 값)은 총자산에도 포함된다.
  const liquidAssets = n(assets.liquidAssets?.total);
  const otherAssetsTotal = n(assets.otherAssets?.total);
  const totalAssets = financialAssetsTotal + liquidAssets + pensionAssets + realEstateTotal + otherAssetsTotal;

  // ---- 부채 ----
  const totalDebt = n(assets.debtStatus?.totalBalance);

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
    otherAssetsTotal,
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
    nationalPensionEligibility: retirementIncomeByCategory.nationalPensionEligibility,
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

  const pickNationalPension = (pension) => {
    const p = pension || {};
    const eligibility = assessNationalPensionEligibility({ pension: p });
    if (!nationalPensionMonthlyEligible(eligibility)) return 0;
    return pick(p.monthly, p.months);
  };

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
    pickNationalPension(income.nationalPension) + pickNationalPension(spouse.nationalPension);

  const nationalPensionEligibility = {
    self: assessNationalPensionEligibility({ pension: income.nationalPension || {} }).status,
    spouse: input.basic?.hasSpouse
      ? assessNationalPensionEligibility({ pension: spouse.nationalPension || {} }).status
      : 'none',
  };

  const severancePension = pickSeverancePension(income.severance) + pickSeverancePension(spouse.severance);

  const personalPension = pickPersonalPension(income.personalPension) + pickPersonalPension(spouse.personalPension);

  return {
    nationalPension,
    nationalPensionEligibility,
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
  const pickNationalPension = (pension) => {
    const p = pension || {};
    const eligibility = assessNationalPensionEligibility({ pension: p });
    if (!nationalPensionMonthlyEligible(eligibility)) return 0;
    return pick(p.monthly, p.months);
  };
  const nationalPensionStatus = (pension) => assessNationalPensionEligibility({ pension: pension || {} }).status;

  const personalPensionMonthly = (personalPension) => {
    const p = personalPension || {};
    if ('type' in p && p.type !== 'installment') return 0; // 일시금 선택 시 제외(월 수령액이 아님)
    return pick(p.monthly, p.months);
  };

  // 표시용 퇴직금(일시금)은 type이 'lumpsum'일 때만 사용한다. 'pension'·'none'으로 바꾼 뒤에도
  // 이전에 입력했던 lumpsum이 폼에 남아있을 수 있어(프론트 초기화 누락·과거 저장 데이터 모두 포함),
  // type을 확인하지 않고 그대로 읽으면 실제로는 해당 없는 금액이 화면에 노출된다. type 필드 자체가
  // 없는 오래된 데이터(레거시)는 이 필드가 생기기 전 항상 lumpsum을 그대로 보여주던 기존 결과를
  // 그대로 유지한다.
  const severanceLumpsum = (severance) => {
    const s = severance || {};
    if ('type' in s && s.type !== 'lumpsum') return 0;
    return n(s.lumpsum);
  };

  return {
    self: {
      nationalPensionMonthly: pickNationalPension(income.nationalPension),
      nationalPensionEligibilityStatus: nationalPensionStatus(income.nationalPension),
      severancePensionMonthly: income.severance?.type === 'pension'
        ? pick(income.severance?.pensionMonthly, income.severance?.pensionMonths)
        : 0,
      severanceLumpsum: severanceLumpsum(income.severance),
      personalPensionMonthly: personalPensionMonthly(income.personalPension),
    },
    spouse: {
      nationalPensionMonthly: pickNationalPension(spouse.nationalPension),
      nationalPensionEligibilityStatus: input.basic?.hasSpouse ? nationalPensionStatus(spouse.nationalPension) : 'none',
      severancePensionMonthly: spouse.severance?.type === 'pension'
        ? pick(spouse.severance?.pensionMonthly, spouse.severance?.pensionMonths)
        : 0,
      severanceLumpsum: severanceLumpsum(spouse.severance),
      personalPensionMonthly: personalPensionMonthly(spouse.personalPension),
    },
  };
}

// 만 나이(현재 시점 기준, 출생년도 기반 간이 계산)
export function getCurrentAge(input, currentYear = new Date().getFullYear()) {
  const birthYear = n(input.basic?.birthYear);
  return birthYear ? currentYear - birthYear : 0;
}

// 리포트 2페이지 가족구성원 표 전용.
export function buildFamilyAges(input, currentYear = new Date().getFullYear()) {
  const spouseBirthYear = n(input.spouse?.birthYear);
  const children = (input.expense?.children || []).map((c) => {
    const birthYear = n(c.birthYear);
    return { age: birthYear ? currentYear - birthYear : null };
  });

  return {
    self: { age: getCurrentAge(input, currentYear) },
    spouse: spouseBirthYear ? {
      age: currentYear - spouseBirthYear,
      retirementAge: n(input.spouse?.retirementAge) || null,
      lifeExpectancy: n(input.spouse?.lifeExpectancy) || null,
    } : null,
    children,
  };
}

export { n, pickAnnual };
