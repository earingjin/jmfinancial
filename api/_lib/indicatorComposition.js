// 지표 상세 페이지의 "구성 분석" 파이차트용 항목 분해. aggregates/indicators에 이미 있는 값만
// 재조합할 뿐, 새로운 계산은 하지 않는다.
// 원래 클라이언트 번들에 있었으나 서버로 옮겨, 응답에는 지표별로 이미 계산된 composition만 내려간다.

function round1(v) {
  return Math.round(v * 10) / 10;
}

const BUILDERS = {
  household: (agg) => {
    const unassigned = Math.max(0, round1(agg.monthlyIncome - agg.fixedExpenseMonthly - agg.variableMonthly - agg.monthlySavings));
    return {
      title: `월소득 ${agg.monthlyIncome}만원의 배분 구조`,
      items: [
        { key: 'fixed', label: '고정지출(생활비·주거비·보험·부채상환)', value: agg.fixedExpenseMonthly, color: 'var(--navy-700)' },
        { key: 'variable', label: '변동지출(경조사·여행 등)', value: agg.variableMonthly, color: 'var(--amber)' },
        { key: 'savings', label: '저축·투자', value: agg.monthlySavings, color: 'var(--teal)' },
        { key: 'unassigned', label: '미배정 여유자금', value: unassigned, color: 'var(--line)', labelColor: '#5B6478' },
      ],
      note: unassigned > 0
        ? `지출 관리는 양호하지만, 아직 저축으로 이어지지 않은 미배정 여유자금이 ${unassigned}만원 있습니다. 이 부분이 저축성향지표에 영향을 줍니다.`
        : '소득이 지출·저축으로 빠짐없이 배분되고 있습니다.',
    };
  },
  emergency: (agg) => {
    const base = agg.liquidAssets + agg.financialAssetsTotal;
    return {
      title: `현금성자산·투자자산 합계 ${round1(base)}만원 중 유동성 비중`,
      items: [
        { key: 'liquid', label: '현금성자산(예금·적금·CMA·비상금 등, 즉시 인출 가능)', value: agg.liquidAssets, color: 'var(--teal)' },
        { key: 'invested', label: '투자자산(주식·펀드·채권 등, 환매 필요)', value: agg.financialAssetsTotal, color: 'var(--navy-600)' },
      ],
      note: `금융자산 대부분이 ${agg.financialAssetsTotal >= agg.liquidAssets ? '즉시 현금화하기 어려운 투자자산' : '유동성자산'} 형태로 보유되어 있습니다.`,
    };
  },
  dsr: (agg) => ({
    title: `연소득 ${agg.annualIncome}만원 중 상환 비중`,
    items: [
      { key: 'repayment', label: '연간 원리금상환액', value: Math.min(agg.monthlyDebtRepayment * 12, agg.annualIncome), color: 'var(--red)' },
      { key: 'rest', label: '상환 외 가용소득', value: Math.max(0, agg.annualIncome - agg.monthlyDebtRepayment * 12), color: 'var(--teal)' },
    ],
    note: '소득 중 부채상환에 쓰이는 비중이 낮을수록 다른 재무목표(저축·투자·노후준비)에 쓸 여력이 커집니다.',
  }),
  debtBurden: (agg) => ({
    title: `총자산 ${agg.totalAssets}만원 중 부채 비중`,
    items: [
      { key: 'debt', label: '총부채', value: agg.totalDebt, color: 'var(--red)' },
      { key: 'netWorth', label: '순자산', value: agg.netWorth, color: 'var(--navy-700)' },
    ],
    note: '자산 전체를 처분한다고 가정했을 때 부채를 청산하고 남는 몫(순자산)의 비중을 보여줍니다.',
  }),
  insurance: (agg) => ({
    title: `연소득 ${agg.annualIncome}만원 중 보험료 비중`,
    items: [
      { key: 'premium', label: '보장성보험료(연)', value: Math.min(agg.monthlyInsurancePremium * 12, agg.annualIncome), color: 'var(--amber)' },
      { key: 'rest', label: '보험료 외 소득', value: Math.max(0, agg.annualIncome - agg.monthlyInsurancePremium * 12), color: 'var(--navy-600)' },
    ],
    note: '보장성보험료 비중이 너무 낮으면 위험 노출이 크고, 너무 높으면 저축 여력을 잠식합니다.',
  }),
  savingsRate: (agg) => {
    const unassigned = Math.max(0, round1(agg.monthlyIncome - agg.fixedExpenseMonthly - agg.variableMonthly - agg.monthlySavings));
    return {
      title: `월소득 ${agg.monthlyIncome}만원 중 저축 vs 미배정 여유자금`,
      items: [
        { key: 'savings', label: '현재 저축·투자', value: agg.monthlySavings, color: 'var(--teal)' },
        { key: 'unassigned', label: '미배정 여유자금(저축 전환 가능분)', value: unassigned, color: 'var(--line)', labelColor: '#5B6478' },
        { key: 'expense', label: '고정·변동지출', value: agg.fixedExpenseMonthly + agg.variableMonthly, color: 'var(--navy-700)' },
      ],
      note: unassigned > 0
        ? `미배정 여유자금 ${unassigned}만원 중 일부만 저축으로 옮겨도 저축성향지표 점수를 끌어올릴 수 있습니다.`
        : '여유자금 대부분이 이미 저축·투자로 편입되어 있습니다.',
    };
  },
  retirementSavings: (agg, indicator) => {
    const totalSavingsAssets = agg.liquidAssets + agg.financialAssetsTotal + agg.pensionAssets;
    const forRetirement = round1((totalSavingsAssets * indicator.value) / 100);
    return {
      title: `총 저축자산 ${totalSavingsAssets}만원의 용도 배분`,
      items: [
        { key: 'retirement', label: '노후 목적(연금자산 등)', value: forRetirement, color: 'var(--teal)' },
        { key: 'other', label: '기타 목적(주택·교육 등)', value: Math.max(0, round1(totalSavingsAssets - forRetirement)), color: 'var(--amber)' },
      ],
      note: '저축 총량이 많아도 노후 목적 비중이 낮으면 은퇴 후 자금이 부족할 수 있습니다.',
    };
  },
  financialAssetRatio: (agg) => ({
    title: `총자산 ${agg.totalAssets}만원 구성`,
    items: [
      { key: 'liquid', label: '현금성자산', value: agg.liquidAssets, color: 'var(--gold)' },
      { key: 'financial', label: '금융자산(투자)', value: agg.financialAssetsTotal, color: 'var(--teal)' },
      { key: 'pension', label: '연금자산', value: agg.pensionAssets, color: 'var(--navy-600)' },
      { key: 'realEstate', label: '부동산자산', value: agg.realEstateTotal, color: 'var(--amber)' },
    ],
    note: agg.realEstateTotal > agg.liquidAssets + agg.financialAssetsTotal + agg.pensionAssets
      ? '실물자산(부동산) 비중이 커서 필요할 때 현금화하기 어려운 구조입니다.'
      : '유동성 있는 현금성·금융·연금자산 비중이 실물자산보다 커 재무 유연성이 좋은 편입니다.',
  }),
  retirementIncome: (agg, indicator, retirementLivingCost) => {
    const livingCost = retirementLivingCost || 0;
    const gap = Math.max(0, round1(livingCost - agg.monthlyRetirementIncome));
    const items = [
      { key: 'national', label: '국민연금', value: agg.nationalPensionMonthly, color: 'var(--navy-700)' },
      { key: 'severance', label: '퇴직연금', value: agg.severancePensionMonthly, color: 'var(--navy-600)' },
      { key: 'personal', label: '개인연금', value: agg.personalPensionMonthly, color: 'var(--teal)' },
    ];
    // 주택연금(시나리오) 소득은 퇴직연금과 절대 합쳐 표시하지 않고 별도 항목으로만 보여준다.
    if (agg.reverseMortgageMonthly > 0) {
      items.push({ key: 'reverseMortgage', label: '주택연금(시나리오 적용 시)', value: agg.reverseMortgageMonthly, color: 'var(--gold)' });
    }
    items.push({ key: 'gap', label: '소득 공백(추가 준비 필요)', value: gap, color: 'var(--red)' });
    return {
      title: `노후 필요생활비 ${livingCost}만원의 충당 재원`,
      items,
      note: gap > 0
        ? `3층 연금(국민·퇴직·개인)이 필요생활비의 일부를 충당하지만, 나머지 ${gap}만원은 현재 소득으로 채워지지 않습니다.`
        : '3층 연금만으로 필요생활비가 충분히 충당됩니다.',
    };
  },
};

export function buildIndicatorComposition(key, aggregates, indicator, retirementLivingCost) {
  // 분모 0 등으로 산출 불가(N/A)인 지표는 구성 분석 자체가 성립하지 않는다.
  if (indicator?.notCalculable) return null;
  const builder = BUILDERS[key];
  if (!builder) return null;
  return builder(aggregates, indicator, retirementLivingCost);
}
