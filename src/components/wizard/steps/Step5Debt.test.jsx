import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormContext } from '../../../state/formState';
import { initialFormData } from '../../../state/initialFormData';
import Step5Debt from './Step5Debt';

globalThis.React = React;

describe('Step5Debt - 부채 합계 반응형 표시', () => {
  it('데스크톱 표와 동일 값을 사용하는 모바일 부채 목록을 함께 렌더링한다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.debtStatus.inputMode = 'detailed';
    formData.assets.debtStatus.totalBalance = 1000;
    formData.assets.debtStatus.monthlyRepayment = 10;
    formData.assets.debtStatus.breakdown.mortgage = {
      repaymentType: 'interestOnly', principal: 1000, monthlyInterest: 10, months: 120,
    };

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step5Debt />
      </FormContext.Provider>
    );

    expect(html).toContain('grade-table compact finance-summary-desktop');
    expect(html).toContain('finance-summary-mobile');
    expect(html).toContain('총 부채');
    expect(html).toContain('총 월 상환액');
    expect(html).toContain('월 상환부담');
  });
});
