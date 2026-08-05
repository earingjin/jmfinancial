// 간편 요약 화면의 "저축/부채 항목별 구성" 파이차트 전용 표시값.
// 저축·부채는 카테고리별 세부 입력값이 aggregates에 집계 형태로만 남고 항목별로는 없으므로,
// 원본 입력(input)에서 항목명·금액만 그대로 뽑아 재구성한다. 판정 기준·임계값 등 새로운
// 판단 로직은 전혀 추가하지 않는다 - 사용자가 입력한 값을 그대로 라벨링해서 돌려줄 뿐이다.

const SAVINGS_CATEGORY_LABELS = {
  installment: '적금',
  isa: 'ISA',
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

const n = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number(v) || 0);

// 총 월 저축액(assets.savingsPlan.monthly)과 동일한 범위(기본 항목 + 추가 항목)만 포함한다.
// 노후준비저축(retirementMonthly)은 별도로 집계되는 값이라 여기 합계에 넣지 않는다.
export function buildSavingsBreakdown(input) {
  const sp = input.assets?.savingsPlan || {};
  const breakdown = sp.breakdown || {};
  const items = Object.entries(SAVINGS_CATEGORY_LABELS)
    .map(([key, label]) => ({ key, label, value: n(breakdown[key]) }))
    .filter((item) => item.value > 0);

  (sp.customItems || []).forEach((item, i) => {
    const value = n(item.amount);
    if (value > 0) items.push({ key: `custom-${i}`, label: item.name || '기타 저축', value });
  });

  return items;
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
