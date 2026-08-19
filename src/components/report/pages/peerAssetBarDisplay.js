import { formatNumber } from '../../../utils/format';

export function getPeerAssetBarDisplay(value, chartMax, maxBarHeight) {
  const isNegative = value < 0;
  const debtExcess = Math.abs(value);
  const warningText = isNegative
    ? `부채가 자산보다 ${formatNumber(debtExcess)}만원 많습니다.`
    : null;

  return {
    showBar: !isNegative,
    barHeight: isNegative ? null : Math.max(3, (value / chartMax) * maxBarHeight),
    valueLabel: formatNumber(value),
    warningText,
    ariaLabel: isNegative ? `순자산 마이너스. ${warningText}` : `순자산 ${formatNumber(value)}만원`,
  };
}
