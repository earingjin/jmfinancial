import { getIn } from '../../../state/pathUtils';

const n = (value) => Number(value) || 0;
const won = (value) => `${n(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`;

export function livingDetailedTotal(formData, basePath, categories) {
  const breakdown = getIn(formData, basePath) || {};
  const otherItems = breakdown.otherItems || [];
  return categories.reduce((sum, category) => (
    sum + (category.key === 'other'
      ? otherItems.reduce((itemSum, item) => itemSum + n(item.amount), 0)
      : n(breakdown[category.key]))
  ), 0);
}

const debtBurden = (item) => (
  item?.repaymentType === 'equalPrincipal' ? n(item.monthlyRepayment) : n(item?.monthlyInterest)
);

export function debtDetailedTotals(formData, basePath, customPath, categories) {
  const breakdown = getIn(formData, basePath) || {};
  const items = [
    ...categories.map((category) => breakdown[category.key] || {}),
    ...(getIn(formData, customPath) || []),
  ];
  return {
    balance: items.reduce((sum, item) => sum + n(item.principal), 0),
    repayment: items.reduce((sum, item) => sum + debtBurden(item), 0),
  };
}

export function changeLivingInputMode({
  formData, setField, nextMode, basePath, totalPath, annualPath, modePath,
  simpleTotalPath, simpleAnnualPath, simpleStoredPath, categories, confirmChange,
}) {
  const currentMode = getIn(formData, modePath) || 'simple';
  if (currentMode === nextMode) return true;
  const current = n(getIn(formData, totalPath));
  const detailed = livingDetailedTotal(formData, basePath, categories);
  const stored = getIn(formData, simpleStoredPath) === true;
  const simple = stored ? getIn(formData, simpleTotalPath) : getIn(formData, totalPath);
  const next = nextMode === 'detailed' ? detailed : (stored ? simple : detailed);
  if (current !== n(next) && !confirmChange(
    `현재 월 생활비가 ${won(current)}에서 ${won(next)}으로 변경됩니다.\n` +
    (nextMode === 'detailed'
      ? `상세 입력 합계는 ${won(detailed)}입니다. 간편 입력한 ${won(simple)}은 보관되며, 상세 입력에서는 항목별 금액을 기준으로 계산합니다.`
      : '간편 입력에 보관된 총액을 기준으로 계산합니다.')
  )) return false;

  if (currentMode === 'simple') {
    setField(simpleTotalPath, getIn(formData, totalPath));
    setField(simpleAnnualPath, getIn(formData, annualPath));
    setField(simpleStoredPath, true);
  } else if (!stored) {
    setField(simpleTotalPath, detailed);
    setField(simpleAnnualPath, Math.round(detailed * 12));
    setField(simpleStoredPath, true);
  }
  setField(totalPath, next);
  setField(annualPath, nextMode === 'simple' && stored
    ? getIn(formData, simpleAnnualPath)
    : Math.round(n(next) * 12));
  setField(modePath, nextMode);
  return true;
}

export function changeDebtInputMode({
  formData, setField, nextMode, basePath, customPath, balanceTotalPath, repaymentTotalPath,
  modePath, simpleBalancePath, simpleRepaymentPath, simpleStoredPath, categories, confirmChange,
}) {
  const currentMode = getIn(formData, modePath) || 'simple';
  if (currentMode === nextMode) return true;
  const current = { balance: n(getIn(formData, balanceTotalPath)), repayment: n(getIn(formData, repaymentTotalPath)) };
  const detailed = debtDetailedTotals(formData, basePath, customPath, categories);
  const stored = getIn(formData, simpleStoredPath) === true;
  const simple = stored
    ? { balance: getIn(formData, simpleBalancePath), repayment: getIn(formData, simpleRepaymentPath) }
    : current;
  const next = nextMode === 'detailed' ? detailed : (stored ? simple : detailed);
  const differs = current.balance !== n(next.balance) || current.repayment !== n(next.repayment);
  if (differs && !confirmChange(
    `총부채가 ${won(current.balance)}에서 ${won(next.balance)}으로, 월 상환액이 ${won(current.repayment)}에서 ${won(next.repayment)}으로 변경됩니다.\n` +
    (nextMode === 'detailed'
      ? `상세 입력 합계는 원금 ${won(detailed.balance)}, 월 상환액 ${won(detailed.repayment)}입니다. 간편 입력값은 보관됩니다.`
      : '간편 입력에 보관된 총액과 월 상환액을 기준으로 계산합니다.')
  )) return false;

  if (currentMode === 'simple') {
    setField(simpleBalancePath, getIn(formData, balanceTotalPath));
    setField(simpleRepaymentPath, getIn(formData, repaymentTotalPath));
    setField(simpleStoredPath, true);
  } else if (!stored) {
    setField(simpleBalancePath, detailed.balance);
    setField(simpleRepaymentPath, detailed.repayment);
    setField(simpleStoredPath, true);
  }
  setField(balanceTotalPath, next.balance);
  setField(repaymentTotalPath, next.repayment);
  setField(modePath, nextMode);
  return true;
}
