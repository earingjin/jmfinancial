import { formatNumber, formatWon } from '../../../utils/format';

export function getPeerAssetBarDisplay(value, chartMax, maxBarHeight) {
  const isNegative = value < 0;
  const debtExcess = Math.abs(value);
  const warningText = isNegative
    ? `부채가 자산보다 ${formatWon(debtExcess)} 많습니다.`
    : null;

  return {
    showBar: !isNegative,
    barHeight: isNegative ? null : Math.max(3, (value / chartMax) * maxBarHeight),
    // 막대 위 짧은 표시용 라벨 — 좁은 막대 폭에 맞춰 "3억 6,900" 같은 억 단위 표기 없이 숫자만 보여준다.
    valueLabel: formatNumber(value),
    warningText,
    ariaLabel: isNegative ? `순자산 마이너스. ${warningText}` : `순자산 ${formatWon(value)}`,
  };
}
