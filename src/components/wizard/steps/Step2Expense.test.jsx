import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormContext } from '../../../state/formState';
import { initialFormData } from '../../../state/initialFormData';
import Step2Expense from './Step2Expense';

globalThis.React = React;

// A12 회귀 테스트: 반복입력 "금액" 필드에만 min={0}이 붙어 있고, 나이·기간처럼 금액이 아닌
// 필드는 그대로 유지되는지 실제 렌더링 결과(FormattedNumberInput이 만드는 data-min 속성)로
// 확인한다. 라벨 텍스트로 정확히 경계를 맞춰 찾아, 부분 문자열이 겹치는 다른 라벨(예: "월
// 보험료" vs "보장성보험 월 보험료")과 혼동되지 않게 한다.
function fieldWindow(html, exactLabel) {
  const anchor = `>${exactLabel}<`;
  const idx = html.indexOf(anchor);
  expect(idx, `label not found in rendered html: ${exactLabel}`).toBeGreaterThanOrEqual(0);
  const end = html.indexOf('</label>', idx);
  expect(end, `no closing </label> after: ${exactLabel}`).toBeGreaterThan(idx);
  return html.slice(idx, end);
}

function renderStep() {
  const formData = structuredClone(initialFormData);
  formData.expense.retirementLumpSumExpenses = [{ name: '여행', expectedAge: 70, amount: 500 }];
  formData.expense.healthInsurance.items = [{ name: '건강보험', monthly: 10 }];
  formData.expense.children = [{ educationCost: 100, marriageSupport: 200, otherCost: 50 }];
  formData.expense.otherExpenses = [{ name: '경조사', annual: 50, years: 5 }];

  return renderToStaticMarkup(
    <FormContext.Provider value={{
      formData, setField: vi.fn(), addListItem: vi.fn(), removeListItem: vi.fn(), updateListItem: vi.fn(),
    }}>
      <Step2Expense />
    </FormContext.Provider>
  );
}

describe('Step2Expense - 반복입력 금액 필드의 음수 방어 (A12)', () => {
  const html = renderStep();

  it.each([
    ['예상 금액', 'expense.retirementLumpSumExpenses[].amount'],
    ['월 보험료', 'expense.healthInsurance.items[].monthly'],
    ['학자금', 'expense.children[].educationCost'],
    ['결혼지원비', 'expense.children[].marriageSupport'],
    ['기타', 'expense.children[].otherCost'],
    ['연간 지출 금액', 'expense.otherExpenses[].annual'],
  ])('%s(%s)에는 min=0이 적용되어 음수를 막는다', (label) => {
    expect(fieldWindow(html, label)).toContain('data-min="0"');
  });

  it.each([
    ['예상 지출 나이', 'expense.retirementLumpSumExpenses[].expectedAge - 나이 필드, 이번 수정 대상 아님'],
    ['지출 기간', 'expense.otherExpenses[].years - 기간 필드, 이번 수정 대상 아님'],
  ])('%s는 금액이 아니므로 이번 수정에서 제외했다(%s)', (label) => {
    expect(fieldWindow(html, label)).not.toContain('data-min="0"');
  });
});
