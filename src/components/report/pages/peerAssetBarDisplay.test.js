import { describe, expect, it } from 'vitest';
import { getPeerAssetBarDisplay } from './peerAssetBarDisplay.js';

describe('getPeerAssetBarDisplay', () => {
  it('양수 순자산은 기존 높이의 막대를 표시하고 경고하지 않는다', () => {
    const display = getPeerAssetBarDisplay(5000, 10000, 150);

    expect(display.showBar).toBe(true);
    expect(display.barHeight).toBe(75);
    expect(display.valueLabel).toBe('5,000');
    expect(display.warningText).toBeNull();
  });

  it('0원은 기존 최소 높이를 유지하되 음수 경고를 표시하지 않는다', () => {
    const display = getPeerAssetBarDisplay(0, 10000, 150);

    expect(display.showBar).toBe(true);
    expect(display.barHeight).toBe(3);
    expect(display.valueLabel).toBe('0');
    expect(display.warningText).toBeNull();
  });

  it('음수 순자산은 막대를 숨기고 정확한 부채 초과액과 접근성 문구를 제공한다', () => {
    const display = getPeerAssetBarDisplay(-5000, 10000, 150);

    expect(display.showBar).toBe(false);
    expect(display.barHeight).toBeNull();
    expect(display.valueLabel).toBe('-5,000');
    expect(display.warningText).toBe('부채가 자산보다 5,000만원 많습니다.');
    expect(display.ariaLabel).toContain('순자산 마이너스');
    expect(display.ariaLabel).toContain('5,000만원');
  });
});
