import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/supabaseClient', () => ({ supabase: {} }));

import { FormContext } from '../../../state/formState';
import { initialFormData } from '../../../state/initialFormData';
import Step4Assets from './Step4Assets';

globalThis.React = React;

describe('Step4Assets input mode selectors', () => {
  it('renders an independent total/detail selector for every asset category', () => {
    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData: structuredClone(initialFormData), setField: vi.fn() }}>
        <Step4Assets />
      </FormContext.Provider>
    );

    expect(html.match(/총액으로 한 번에 입력/g)).toHaveLength(5);
    expect(html.match(/항목별로 자세히 입력/g)).toHaveLength(5);
  });

  it('shows only the total input for a category in simple mode', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.otherAssets.inputMode = 'simple';
    formData.assets.otherAssets.total = 2000;
    formData.assets.otherAssets.simpleTotal = 2000;
    formData.assets.otherAssets.simpleInputStored = true;

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step4Assets />
      </FormContext.Provider>
    );

    expect(html).toContain('기타 자산 총액');
    expect(html).not.toContain('+ 기타 자산 추가');
  });

  it('does not render 0 as the initial value of an empty simple total input', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.otherAssets.inputMode = 'simple';
    formData.assets.otherAssets.total = '';
    formData.assets.otherAssets.simpleTotal = '';

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step4Assets />
      </FormContext.Provider>
    );

    const otherAssetsSection = html.slice(html.indexOf('기타 자산</h3>'));
    expect(otherAssetsSection).toContain('value=""');
  });
});

// A12 회귀 테스트: "기타 ○○자산" 반복입력의 금액 필드에 min=0이 적용되어 음수를 막는지 확인한다.
// "금액"이라는 동일한 라벨이 금융자산·연금자산 두 곳에 있어, n번째 등장 위치를 지정해 구분한다.
describe('Step4Assets - 반복입력 금액 필드의 음수 방어 (A12)', () => {
  function nthFieldWindow(html, exactLabel, occurrence) {
    const anchor = `>${exactLabel}<`;
    let idx = -1;
    for (let i = 0; i < occurrence; i++) {
      idx = html.indexOf(anchor, idx + 1);
    }
    expect(idx, `${exactLabel}의 ${occurrence}번째 등장을 찾지 못함`).toBeGreaterThanOrEqual(0);
    const end = html.indexOf('</label>', idx);
    expect(end).toBeGreaterThan(idx);
    return html.slice(idx, end);
  }

  function renderWithOtherItems() {
    const formData = structuredClone(initialFormData);
    formData.assets.financialAssets.otherItems = [{ name: '가상자산', amount: 100 }];
    // pensionAssetsBreakdown.other(합계 스칼라)가 있어야 "기타" 패널이 열린다(openPensionKeys
    // 초기화 로직 - otherItems 배열 길이가 아니라 합계 값으로 판단함).
    formData.assets.pensionAssetsBreakdown.other = 200;
    formData.assets.pensionAssetsBreakdown.otherItems = [{ name: '개인형 IRP', amount: 200 }];
    formData.assets.realEstateAssets.otherItems = [{ type: '상가', amount: 300 }];
    formData.assets.otherAssets.items = [{ name: '귀금속', amount: 400 }];
    return renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step4Assets />
      </FormContext.Provider>
    );
  }

  // "금액"이라는 정확히 같은 라벨이 현금성자산의 커스텀 항목·자산 합계 표 헤더(다른 컴포넌트/표,
  // 이번 수정 대상 아님)에도 있어 실제로는 2번째(금융자산)·3번째(연금자산) 등장이다 - 렌더링
  // 순서를 직접 확인해 정했다.
  it('기타 금융자산 금액에는 min=0이 적용된다', () => {
    const html = renderWithOtherItems();
    expect(nthFieldWindow(html, '금액', 2)).toContain('data-min="0"');
  });

  it('기타 연금자산 금액에는 min=0이 적용된다', () => {
    const html = renderWithOtherItems();
    expect(nthFieldWindow(html, '금액', 3)).toContain('data-min="0"');
  });

  it('기타 부동산 시세에는 min=0이 적용된다', () => {
    const html = renderWithOtherItems();
    expect(nthFieldWindow(html, '시세', 1)).toContain('data-min="0"');
  });

  it('기타 자산 현재 가치에는 min=0이 적용된다', () => {
    const html = renderWithOtherItems();
    expect(nthFieldWindow(html, '현재 가치', 1)).toContain('data-min="0"');
  });
});
