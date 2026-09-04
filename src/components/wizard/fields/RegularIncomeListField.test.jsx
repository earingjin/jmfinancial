import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormContext } from '../../../state/formState';
import RegularIncomeListField from './RegularIncomeListField';

globalThis.React = React;

// A12 회귀 테스트: "연간 수입 금액"(금액)에는 min=0이 적용되고, "유지예상 기간"(기간, 금액 아님)은
// 이번 수정 대상이 아니므로 그대로 유지되는지 실제 렌더링 결과로 확인한다.
function fieldWindow(html, exactLabel) {
  const anchor = `>${exactLabel}<`;
  const idx = html.indexOf(anchor);
  expect(idx, `label not found: ${exactLabel}`).toBeGreaterThanOrEqual(0);
  const end = html.indexOf('</label>', idx);
  expect(end).toBeGreaterThan(idx);
  return html.slice(idx, end);
}

function renderField() {
  const formData = { income: { regularIncomes: [{ type: 'other', name: '임대수입', annual: 100, years: 5 }] } };
  return renderToStaticMarkup(
    <FormContext.Provider value={{ formData, setField: vi.fn() }}>
      <RegularIncomeListField
        path="income.regularIncomes"
        businessMonthlyPath="income.business.monthly"
        businessAnnualPath="income.business.annual"
        otherIncomesPath="income.otherIncomes"
      />
    </FormContext.Provider>
  );
}

describe('RegularIncomeListField - 반복입력 금액 필드의 음수 방어 (A12)', () => {
  const html = renderField();

  it('연간 수입 금액에는 min=0이 적용되어 음수를 막는다', () => {
    expect(fieldWindow(html, '연간 수입 금액')).toContain('data-min="0"');
  });

  it('월수입 흐름 향후 유지예상 기간은 금액이 아니므로 이번 수정에서 제외했다', () => {
    expect(fieldWindow(html, '월수입 흐름 향후 유지예상 기간')).not.toContain('data-min="0"');
  });
});
