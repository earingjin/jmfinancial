// 간편 요약 화면의 "저축/부채 항목별 구성" 파이차트 전용 표시값.
// 저축·부채는 카테고리별 세부 입력값이 aggregates에 집계 형태로만 남고 항목별로는 없으므로,
// 원본 입력(input)에서 항목명·금액만 그대로 뽑아 재구성한다. 판정 기준·임계값 등 새로운
// 판단 로직은 전혀 추가하지 않는다 - 사용자가 입력한 값을 그대로 라벨링해서 돌려줄 뿐이다.

// Step3Savings.jsx의 SAVINGS_CATEGORIES(assets.savingsPlan.breakdown) 8개 항목과 반드시 동일한
// 키 목록을 유지한다 - 여기 없는 항목만 입력한 경우 monthlySavings는 0이 아닌데 이 목록이 비어
// 도넛차트가 "저축 상세 내역을 입력하면..." 안내문구를 잘못 보여주는 문제가 있었다.
const SAVINGS_CATEGORY_LABELS = {
  installment: '적금',
  isa: 'ISA',
  variableAnnuity: '변액연금',
  pensionSavings: '연금저축',
  irp: 'IRP',
  subscription: '청약',
  stocks: '주식',
  parkingAccount: '파킹통장',
};

const DEBT_CATEGORY_LABELS = {
  mortgage: '주담대',
  depositLoan: '보증금대출',
  businessLoan: '사업자대출',
  buildingLoan: '빌딩대출',
  carLoan: '차량대출',
  studentLoan: '학자금대출',
  otherLoan: '기타대출',
};

const LIVING_EXPENSE_CATEGORY_LABELS = {
  rent: '월세',
  maintenance: '관리비',
  utilities: '공과금',
  fuel: '유류비',
  carInsurance: '차 보험료',
  clothing: '의류비',
  fourInsurances: '4대보험',
  food: '식비',
  communication: '통신비',
  medical: '의료비',
  subscription: '각종 구독료',
};

const n = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v) || 0);
const savingsMonthly = (item) => (
  item && typeof item === 'object' ? n(item.monthly) : n(item)
);

// aggregate.js의 monthlySavings와 동일한 범위로 맞춘다: 노후준비저축(retirementMonthly)이 총
// 저축액에 이미 포함되어 있으면(retirementIncludedInTotal !== false, 기본값 포함) 여기 합계에
// 넣지 않고, 별도로 하고 있다고 명시한 경우(false)는 겹치지 않는 별개 금액이라 슬라이스로 추가한다
// - 그래야 이 합계가 monthlySavings와 어긋나지 않는다.
export function buildSavingsBreakdown(input) {
  const sp = input.assets?.savingsPlan || {};
  const breakdown = sp.breakdown || {};
  const items = Object.entries(SAVINGS_CATEGORY_LABELS)
    .map(([key, label]) => ({ key, label, value: savingsMonthly(breakdown[key]) }))
    .filter((item) => item.value > 0);

  // SavingsBreakdownField.jsx의 addCustomItem()이 만드는 항목 모양은
  // { name, monthly, remainingMonths, interestRate, accumulated }이다 - 금액은 monthly에 있다
  // (amount는 DebtBreakdownField 쪽 커스텀 항목의 필드명이라 여기선 항상 undefined였다).
  (sp.customItems || []).forEach((item, i) => {
    const value = n(item.monthly);
    if (value > 0) items.push({ key: `custom-${i}`, label: item.name || '기타 저축', value });
  });

  const retirementIncludedInTotal = sp.retirementIncludedInTotal !== false;
  if (!retirementIncludedInTotal) {
    const retirementValue = n(sp.retirementMonthly);
    if (retirementValue > 0) items.push({ key: 'retirement', label: '노후준비저축', value: retirementValue });
  }

  return items;
}

// "현재 생활비 상세"의 "기타지출" 카테고리 - 종류별(name)로 입력한 항목만 그대로 라벨링해서
// 돌려준다. 이 값은 이미 assets.currentLivingCost.breakdown.other(→ monthlyLivingCost 합계)에
// 포함되어 있으므로 여기서 다시 더하지 않는다 - 화면에 항목명을 보여주기 위한 표시용 목록일 뿐이다.
export function buildOtherLivingExpenseItems(input) {
  const otherItems = input.assets?.currentLivingCost?.breakdown?.otherItems || [];
  return otherItems
    .map((item, i) => ({ key: `other-living-${i}`, label: item.name || '기타지출', value: n(item.amount) }))
    .filter((item) => item.value > 0);
}

export function buildLivingExpenseItems(input) {
  const breakdown = input.assets?.currentLivingCost?.breakdown || {};
  const items = Object.entries(LIVING_EXPENSE_CATEGORY_LABELS)
    .map(([key, label]) => ({ key: `living-${key}`, label, value: n(breakdown[key]) }))
    .filter((item) => item.value > 0);

  return [...items, ...buildOtherLivingExpenseItems(input)];
}

// "현금성 자산"의 "기본 항목 외 추가" 커스텀 항목(CategoryBreakdownField의 customItems) - 종류별
// (name)로 입력한 항목만 그대로 라벨링해서 돌려준다. 이 값은 이미 assets.liquidAssets.total
// 합계에 포함되어 있으므로 여기서 다시 더하지 않는다 - 화면에 항목명을 보여주기 위한 표시용
// 목록일 뿐이다(buildOtherLivingExpenseItems와 동일한 패턴).
export function buildOtherLiquidAssetItems(input) {
  const customItems = input.assets?.liquidAssets?.customItems || [];
  return customItems
    .map((item, i) => ({ key: `other-liquid-${i}`, label: item.name || '기타 현금성자산', value: n(item.amount) }))
    .filter((item) => item.value > 0);
}

// 총 부채잔액(assets.debtStatus.totalBalance)과 동일한 범위(대출 원금 기준)만 포함한다.
export function buildDebtBreakdown(input) {
  const ds = input.assets?.debtStatus || {};
  const breakdown = ds.breakdown || {};
  const items = Object.entries(DEBT_CATEGORY_LABELS)
    .map(([key, label]) => ({ key, label, value: n(breakdown[key]?.principal) }))
    .filter((item) => item.value > 0);

  (ds.customItems || []).forEach((item, i) => {
    const value = n(item.principal);
    if (value > 0) items.push({ key: `custom-${i}`, label: item.name || '기타 대출', value });
  });

  return items;
}
