// 한국형 가계재무비율 참고 8개 지표와 별도 노후분석 지표를 산출한다. 클라이언트에는 계산식이 전달되지 않고,
// /api/calculate 응답에는 "계산된 결과값"만 담겨 나간다.
//
// 계산 정밀도 원칙(CLAUDE.md 참고): 채점에는 rawValue(미반올림)를 쓰고, displayValue만 화면 표시용으로
// 소수점 첫째 자리로 반올림한다. 분모가 0이라 비율이 성립하지 않는 경우는 0%(최고/최저점)로 위장하지
// 않고 notCalculable:true + reason으로 명시한다. 배점·커트라인 숫자는 원본 기준표와 동일하게 유지하고,
// 판정구간만 실수 전체를 빈틈없이 덮도록 재구성한다.

import { evaluateBands, pctOrNA, divOrNA, notCalculableResult, round1 } from './grading.js';
import { buildAggregates, getCurrentAge, n } from './aggregate.js';

const atMost = (max) => (v) => v <= max;
const atLeast = (min) => (v) => v >= min;

// 노후소득보장률은 재무건강 8개 지표의 총점·등급과 분리된 별도 노후분석 값이다.
const RETIREMENT_INCOME_BANDS = [
  { test: atLeast(120), rangeLabel: '120% 이상', status: '여유로운 노후 가능', reason: '필요생활비를 넘어서는 소득이 확보되어 여가·의료비 등에도 대응 가능' },
  { test: atLeast(100), rangeLabel: '100% 이상~120% 미만', status: '기본 생활비 충당 가능', reason: '필요생활비를 충당할 소득이 확보되어 기본적인 노후생활이 가능함' },
  { test: atLeast(80), rangeLabel: '80% 이상~100% 미만', status: '일부 자산 인출 필요', reason: '소득만으로는 부족해 보유자산을 일부 헐어 생활비를 보충해야 함' },
  { test: atLeast(60), rangeLabel: '60% 이상~80% 미만', status: '추가 준비 필요', reason: '소득 공백이 커서 자산 인출 외에 추가적인 소득원 마련이 필요함' },
  { test: atLeast(40), rangeLabel: '40% 이상~60% 미만', status: '적극적인 보완 필요', reason: '노후소득이 필요생활비의 절반 수준에 그쳐 근로소득 연장 등 적극적 대응이 요구됨' },
  { test: atLeast(0), rangeLabel: '40% 미만', status: '은퇴계획 재검토 필요', reason: '노후소득이 크게 부족해 은퇴 시기·생활수준 전반의 재검토가 불가피함' },
];
const RETIREMENT_INCOME_SCORES_STANDARD = [15, 12, 9, 6, 3, 0];
const FINANCIAL_HEALTH_KEYS = new Set([
  'household',
  'emergency',
  'dsr',
  'debtBurden',
  'insurance',
  'savingsRate',
  'retirementSavings',
  'financialAssetRatio',
]);

function buildRetirementIncomeBands(scores) {
  return RETIREMENT_INCOME_BANDS.map((band, i) => ({ ...band, score: scores[i] }));
}

export function calcIndicators(input) {
  const agg = buildAggregates(input);
  const currentAge = getCurrentAge(input);
  const is65Plus = currentAge >= 65;

  // ① 가계수지지표 = 총지출(저축 제외) ÷ 총소득
  const householdRaw = pctOrNA(agg.totalExpenseMonthlyExSavings, agg.monthlyIncome);
  // breakdown: 화면(FhsDetailReport)에 비율의 근거가 된 실제 금액을 함께 보여주기 위한 표시용
  // 데이터. 판정에 쓰인 agg 값을 그대로 재사용할 뿐 새로 계산하지 않고, 분모 0(notCalculable)이면
  // null로 둔다.
  const householdBreakdown = householdRaw === null ? null : {
    numerator: { label: '총지출(저축 제외)', amount: agg.totalExpenseMonthlyExSavings },
    denominator: { label: '총소득', amount: agg.monthlyIncome },
  };
  const indicator1 = householdRaw === null
    ? notCalculableResult(15, '소득이 0원이어서 가계수지지표를 산출할 수 없습니다.')
    : evaluateBands(
        householdRaw,
        [
          { test: atMost(50), score: 15, status: '매우 우수', rangeLabel: '50% 이하', reason: '소득의 절반 이상을 저축·투자로 돌릴 여력이 있어 자산 형성 속도가 매우 빠름' },
          { test: atMost(60), score: 14, status: '우수', rangeLabel: '50% 초과~60% 이하', reason: '지출 관리가 잘 되고 있어 여유자금이 충분히 확보됨' },
          { test: atMost(70), score: 11, status: '양호', rangeLabel: '60% 초과~70% 이하', reason: '가계수지가 비교적 안정적인 수준' },
          { test: atMost(80), score: 8, status: '보통', rangeLabel: '70% 초과~80% 이하', reason: '지출 비중이 다소 높지만 지출 구조를 점검해볼 수 있는 수준' },
          { test: atMost(90), score: 4, status: '주의', rangeLabel: '80% 초과~90% 이하', reason: '소득 대부분이 지출로 소진되어 저축 여력이 크게 부족함' },
          { test: atLeast(0), score: 0, status: '위험', rangeLabel: '90% 초과', reason: '소득으로 지출을 감당하기 어려운 수준, 지출 구조조정이 시급함' },
        ],
        15
      );

  // ② 비상예비금지표 = 유동성자산 ÷ 월지출(저축 제외)
  const emergencyRaw = divOrNA(agg.liquidAssets, agg.totalExpenseMonthlyExSavings);
  const emergencyBreakdown = emergencyRaw === null ? null : {
    numerator: { label: '유동성자산', amount: agg.liquidAssets },
    denominator: { label: '월지출(저축 제외)', amount: agg.totalExpenseMonthlyExSavings },
  };
  const indicator2 = emergencyRaw === null
    ? notCalculableResult(10, '월지출이 0원이어서 비상예비금 배수를 산출할 수 없습니다.')
    : evaluateBands(
        emergencyRaw,
        [
          { test: atLeast(6), score: 10, status: '매우 우수', rangeLabel: '6배 이상', reason: '장기 실직·질병 등 예기치 못한 소득 중단에도 충분히 대응 가능' },
          { test: atLeast(5), score: 8, status: '우수', rangeLabel: '5배 이상~6배 미만', reason: '예비자금이 넉넉한 편' },
          { test: atLeast(4), score: 6, status: '양호', rangeLabel: '4배 이상~5배 미만', reason: '비상 상황에 대응할 유동성을 확보한 상태' },
          { test: atLeast(3), score: 4, status: '보통', rangeLabel: '3배 이상~4배 미만', reason: '비상 상황에 대비할 자금은 있으나 여유는 크지 않은 편' },
          { test: atLeast(2), score: 2, status: '주의', rangeLabel: '2배 이상~3배 미만', reason: '예비자금이 부족해 비상 상황 대응력을 점검할 필요가 있음' },
          { test: atLeast(0), score: 0, status: '위험', rangeLabel: '2배 미만', reason: '소득 중단 시 단기간 내 생활자금이 고갈될 위험이 큼' },
        ],
        10
      );

  // ③ 총부채상환지표(DSR) = 연간원리금상환액 ÷ 연소득
  const dsrAnnualRepayment = agg.monthlyDebtRepayment * 12;
  const dsrRaw = pctOrNA(dsrAnnualRepayment, agg.annualIncome);
  const dsrBreakdown = dsrRaw === null ? null : {
    numerator: { label: '연간원리금상환액', amount: dsrAnnualRepayment },
    denominator: { label: '연소득', amount: agg.annualIncome },
  };
  const indicator3 = dsrRaw === null
    ? notCalculableResult(15, '소득이 0원이어서 총부채상환지표(DSR)를 산출할 수 없습니다.')
    : evaluateBands(
        dsrRaw,
        [
          { test: atMost(10), score: 15, status: '매우 우수', rangeLabel: '10% 이하', reason: '부채 상환 부담이 거의 없어 소득 대부분을 자산형성에 활용 가능' },
          { test: atMost(20), score: 14, status: '우수', rangeLabel: '10% 초과~20% 이하', reason: '원리금 상환 부담이 낮아 여유가 있는 수준' },
          { test: atMost(30), score: 11, status: '양호', rangeLabel: '20% 초과~30% 이하', reason: '원리금 상환 부담을 함께 살펴볼 필요가 있는 수준' },
          { test: atMost(40), score: 8, status: '보통', rangeLabel: '30% 초과~40% 이하', reason: '원리금 상환이 가계에 부담으로 작용할 수 있음' },
          { test: atMost(50), score: 4, status: '주의', rangeLabel: '40% 초과~50% 이하', reason: '소득 대비 상환 부담이 커서 다른 재무목표 실행이 어려움' },
          { test: atLeast(0), score: 0, status: '위험', rangeLabel: '50% 초과', reason: '소득의 절반 이상이 빚 갚는 데 쓰여 재무 건전성이 크게 훼손됨' },
        ],
        15
      );

  // ④ 총부채부담지표 = 총부채 ÷ 총자산
  const debtBurdenRaw = pctOrNA(agg.totalDebt, agg.totalAssets);
  const debtBurdenBreakdown = debtBurdenRaw === null ? null : {
    numerator: { label: '총부채', amount: agg.totalDebt },
    denominator: { label: '총자산', amount: agg.totalAssets },
  };
  const indicator4 = debtBurdenRaw === null
    ? notCalculableResult(10, '총자산이 0원이어서 총부채부담지표를 산출할 수 없습니다.')
    : evaluateBands(
        debtBurdenRaw,
        [
          { test: atMost(10), score: 10, status: '매우 우수', rangeLabel: '10% 이하', reason: '자산 대비 부채가 미미해 재무구조가 매우 안정적임' },
          { test: atMost(20), score: 9, status: '우수', rangeLabel: '10% 초과~20% 이하', reason: '자산 대비 부채 부담이 낮아 여유가 있는 수준' },
          { test: atMost(30), score: 7, status: '양호', rangeLabel: '20% 초과~30% 이하', reason: '부채가 비교적 안정적으로 관리되는 상태' },
          { test: atMost(40), score: 5, status: '보통', rangeLabel: '30% 초과~40% 이하', reason: '자산 대비 부채 비중을 살펴볼 필요가 있음' },
          { test: atMost(50), score: 3, status: '주의', rangeLabel: '40% 초과~50% 이하', reason: '자산 대비 부채 부담이 큰 편' },
          { test: atLeast(0), score: 0, status: '위험', rangeLabel: '50% 초과', reason: '자산의 절반 이상이 부채로 구성되어 있어 순자산 훼손 위험이 큼' },
        ],
        10
      );

  // ⑤ 보장성보험준비지표 = 보장성보험료 ÷ 소득 (적정구간 8~10%를 중심으로 좌우 감점, 연속 7단계)
  const insuranceRaw = pctOrNA(agg.monthlyInsurancePremium, agg.monthlyIncome);
  const insuranceBreakdown = insuranceRaw === null ? null : {
    numerator: { label: '보장성보험료(월)', amount: agg.monthlyInsurancePremium },
    denominator: { label: '월소득', amount: agg.monthlyIncome },
  };
  const indicator5 = insuranceRaw === null
    ? notCalculableResult(10, '소득이 0원이어서 보장성보험준비지표를 산출할 수 없습니다.')
    : evaluateBands(
        insuranceRaw,
        [
          { test: (v) => v < 3, score: 0, status: '위험', rangeLabel: '3% 미만', reason: '보장 부족 가능성이 있어 예상치 못한 위험에 대비한 보장 내용을 확인해 보세요.' },
          { test: (v) => v < 5, score: 5, status: '보통(과소·과다)', rangeLabel: '3% 이상~5% 미만', reason: '보장이 부족해 위험 노출이 크거나, 보험료가 과다해 저축 여력을 잠식함' },
          { test: (v) => v < 8, score: 8, status: '양호', rangeLabel: '5% 이상~8% 미만', reason: '적정구간에서 소폭 벗어났으나 보장 공백이나 과잉 지출이 크지 않음' },
          { test: atMost(10), score: 10, status: '적정', rangeLabel: '8% 이상~10% 이하', reason: '위험 대비와 저축 여력의 균형을 함께 점검한 상태' },
          { test: atMost(13), score: 8, status: '양호', rangeLabel: '10% 초과~13% 이하', reason: '적정구간에서 소폭 벗어났으나 보장 공백이나 과잉 지출이 크지 않음' },
          { test: atMost(16), score: 5, status: '보통(과소·과다)', rangeLabel: '13% 초과~16% 이하', reason: '보장이 부족해 위험 노출이 크거나, 보험료가 과다해 저축 여력을 잠식함' },
          { test: atLeast(0), score: 0, status: '위험', rangeLabel: '16% 초과', reason: '보험료 과다로 인한 현금흐름 부담이 있을 수 있어 보험료와 보장 내용을 함께 점검해 보세요.' },
        ],
        10
      );

  // ⑥ 총저축성향지표 = 총저축액 ÷ 총소득
  const savingsRateRaw = pctOrNA(agg.totalSavingsAnnual, agg.annualIncome);
  const savingsRateBreakdown = savingsRateRaw === null ? null : {
    numerator: { label: '총저축액(연)', amount: agg.totalSavingsAnnual },
    denominator: { label: '총소득(연)', amount: agg.annualIncome },
  };
  const indicator6 = savingsRateRaw === null
    ? notCalculableResult(5, '소득이 0원이어서 총저축성향지표를 산출할 수 없습니다.')
    : evaluateBands(
        savingsRateRaw,
        [
          { test: atLeast(40), score: 5, status: '매우 우수', rangeLabel: '40% 이상', reason: '저축 비중이 높아 자산을 쌓을 여력이 큰 편' },
          { test: atLeast(30), score: 4, status: '우수', rangeLabel: '30% 이상~40% 미만', reason: '장기 자산 형성을 이어갈 수 있는 수준' },
          { test: atLeast(20), score: 3, status: '보통', rangeLabel: '20% 이상~30% 미만', reason: '저축 비중이 낮아 저축 여력을 점검해볼 수 있는 수준' },
          { test: atLeast(10), score: 1, status: '주의', rangeLabel: '10% 이상~20% 미만', reason: '저축 여력이 낮아 목돈 마련이나 노후준비에 제약이 있음' },
          { test: atLeast(0), score: 0, status: '위험', rangeLabel: '10% 미만', reason: '저축이 거의 이루어지지 않아 재무목표 달성이 어려움' },
        ],
        5
      );

  // ⑦ 노후대비저축지표 = 노후대비저축액 ÷ 총저축액 (65세 이상은 적립 단계가 아니므로 해당 없음)
  const retirementSavingsRaw = pctOrNA(agg.retirementSavingsAnnual, agg.totalSavingsAnnual);
  // 65세 이상(notApplicable)이거나 분모 0(notCalculable)이면 breakdown도 null로 둔다.
  const retirementSavingsBreakdown = is65Plus || retirementSavingsRaw === null ? null : {
    numerator: { label: '노후대비저축액(연)', amount: agg.retirementSavingsAnnual },
    denominator: { label: '총저축액(연)', amount: agg.totalSavingsAnnual },
  };
  const indicator7 = is65Plus
    ? {
        rawValue: retirementSavingsRaw,
        displayValue: retirementSavingsRaw === null ? null : round1(retirementSavingsRaw),
        value: retirementSavingsRaw === null ? null : round1(retirementSavingsRaw),
        score: 0,
        maxScore: 0,
        status: '해당 없음',
        notCalculable: false,
        notApplicable: true,
        reason: null,
        table: [
          {
            rangeLabel: '전 구간',
            score: 0,
            status: '해당 없음',
            reason:
              '65세 이상은 자산을 적립하기보다 인출하는 단계로 보아 이 지표를 적용하지 않습니다.',
            isCurrent: true,
          },
        ],
      }
    : retirementSavingsRaw === null
      ? notCalculableResult(15, '총저축액이 0원이어서 노후대비저축지표를 산출할 수 없습니다.')
      : evaluateBands(
          retirementSavingsRaw,
          [
            { test: atLeast(80), score: 15, status: '매우 우수', rangeLabel: '80% 이상', reason: '저축의 대부분이 노후 목적으로 배정되어 은퇴 준비가 매우 체계적임' },
            { test: atLeast(70), score: 13, status: '우수', rangeLabel: '70% 이상~80% 미만', reason: '노후 목적 저축 비중이 높은 편' },
            { test: atLeast(60), score: 11, status: '양호', rangeLabel: '60% 이상~70% 미만', reason: '저축의 상당 부분이 노후 목적으로 관리되고 있음' },
            { test: atLeast(50), score: 9, status: '보통', rangeLabel: '50% 이상~60% 미만', reason: '노후 목적 저축을 일정 수준 유지하고 있음' },
            { test: atLeast(40), score: 6, status: '주의', rangeLabel: '40% 이상~50% 미만', reason: '노후 목적 저축 비중을 점검할 필요가 있음' },
            { test: atLeast(30), score: 3, status: '미흡', rangeLabel: '30% 이상~40% 미만', reason: '저축의 대부분이 다른 목적(주택·교육 등)에 쓰여 노후 준비가 후순위로 밀림' },
            { test: atLeast(0), score: 0, status: '위험', rangeLabel: '30% 미만', reason: '노후 목적 저축이 거의 없어 은퇴 후 소득 공백에 취약함' },
          ],
          15
        );

  // ⑧ 금융자산비중지표 = (투자자산+현금성자산) ÷ 총자산
  const financialAssetsWithLiquid = agg.financialAssetsTotal + agg.liquidAssets;
  const financialAssetRatioRaw = pctOrNA(financialAssetsWithLiquid, agg.totalAssets);
  const financialAssetRatioBreakdown = financialAssetRatioRaw === null ? null : {
    numerator: { label: '금융자산(투자+현금성)', amount: financialAssetsWithLiquid },
    denominator: { label: '총자산', amount: agg.totalAssets },
  };
  const indicator8 = financialAssetRatioRaw === null
    ? notCalculableResult(5, '총자산이 0원이어서 금융자산비중지표를 산출할 수 없습니다.')
    : evaluateBands(
        financialAssetRatioRaw,
        [
          { test: atLeast(40), score: 5, status: '매우 우수', rangeLabel: '40% 이상', reason: '활용하기 쉬운 자산 비중이 높은 편' },
          { test: atLeast(30), score: 4, status: '우수', rangeLabel: '30% 이상~40% 미만', reason: '자산구조가 비교적 균형적인 편' },
          { test: atLeast(20), score: 3, status: '보통', rangeLabel: '20% 이상~30% 미만', reason: '부동산 등 실물자산 비중이 높아 유동성이 다소 제한적임' },
          { test: atLeast(10), score: 2, status: '주의', rangeLabel: '10% 이상~20% 미만', reason: '자산 대부분이 부동산에 묶여 있어 현금흐름 대응력이 낮음' },
          { test: atLeast(0), score: 0, status: '위험', rangeLabel: '10% 미만', reason: "자산이 실물자산에 극단적으로 편중되어 '자산은 있으나 현금은 없는' 상태" },
        ],
        5
      );

  // 별도 노후분석: 노후소득보장률 = 월예상 노후소득 ÷ 은퇴후 월필요생활비
  // 재무건강 총점·등급에는 포함하지 않는다. 연차별 추이는 은퇴자산 시뮬레이션에서 별도 계산한다.
  const retirementLivingCost = n(input.expense?.retirementLivingCost);
  const retirementIncomeRaw = pctOrNA(agg.monthlyRetirementIncome, retirementLivingCost);
  const indicator9 = retirementIncomeRaw === null
    ? notCalculableResult(15, '노후 월 필요생활비가 입력되지 않아 노후소득보장률을 산출할 수 없습니다.')
    : evaluateBands(
        retirementIncomeRaw,
        buildRetirementIncomeBands(RETIREMENT_INCOME_SCORES_STANDARD),
        15
      );

  const list = [
    { key: 'household', label: '가계수지지표', formula: '총지출 ÷ 총소득', breakdown: householdBreakdown, ...indicator1 },
    { key: 'emergency', label: '비상예비금지표', formula: '유동성자산 ÷ 월지출', unit: '배', breakdown: emergencyBreakdown, ...indicator2 },
    { key: 'dsr', label: '총부채상환지표(DSR)', formula: '연간원리금상환액 ÷ 연소득', breakdown: dsrBreakdown, ...indicator3 },
    { key: 'debtBurden', label: '총부채부담지표', formula: '총부채 ÷ 총자산', breakdown: debtBurdenBreakdown, ...indicator4 },
    { key: 'insurance', label: '보장성보험준비지표', formula: '보장성보험료 ÷ 소득', breakdown: insuranceBreakdown, ...indicator5 },
    { key: 'savingsRate', label: '총저축성향지표', formula: '총저축액 ÷ 총소득', breakdown: savingsRateBreakdown, ...indicator6 },
    { key: 'retirementSavings', label: '노후대비저축지표', formula: '노후대비저축액 ÷ 총저축액 × 100', breakdown: retirementSavingsBreakdown, ...indicator7 },
    { key: 'financialAssetRatio', label: '금융자산비중지표', formula: '금융자산 ÷ 총자산', breakdown: financialAssetRatioBreakdown, ...indicator8 },
    { key: 'retirementIncome', label: '노후소득보장률', formula: '월예상 노후소득 ÷ 은퇴후 월필요생활비 × 100', ...indicator9 },
  ];

  const financialHealthIndicators = list.filter((indicator) => FINANCIAL_HEALTH_KEYS.has(indicator.key));
  const anyNotCalculable = financialHealthIndicators.some((i) => i.notCalculable);
  const missingInputs = financialHealthIndicators.filter((i) => i.notCalculable).map((i) => i.reason);

  // notCalculable(분모 0) 지표는 순위 산정에서 제외한다. maxScore=0(65세 이상 지표⑦)도 기존과 동일하게 제외.
  const rankable = financialHealthIndicators.filter((i) => i.maxScore > 0 && !i.notCalculable);
  const weakest = rankable.length ? [...rankable].sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)[0] : null;
  const strongest = rankable.length ? [...rankable].sort((a, b) => b.score / b.maxScore - a.score / a.maxScore)[0] : null;

  return {
    indicators: list,
    notCalculable: anyNotCalculable,
    missingInputs,
    weakest,
    strongest,
    aggregates: agg,
    currentAge,
    is65Plus,
  };
}
