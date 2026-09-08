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

function renderStep(retirementLumpSumExpenses = [{ name: '여행', expectedAge: 70, amount: 500 }]) {
  const formData = structuredClone(initialFormData);
  formData.expense.retirementLumpSumExpenses = retirementLumpSumExpenses;
  formData.expense.healthInsurance.items = [{ name: '건강보험', monthly: 10 }];
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

  it('removes the separate children lump-sum input and directs examples to post-retirement lump-sum expenses', () => {
    expect(html).not.toContain('자녀별 학자금 · 결혼지원비 · 기타 목돈 지출 계획');
    expect(html).not.toContain('자녀 추가');
    expect(html).toContain('자녀 학자금·결혼지원·기타 지원처럼 예상되는 큰 지출');
    expect(html).toContain('예: 자녀 결혼지원 또는 학자금');
  });
});

describe('Step2Expense - 목돈지출 빈 상태 안내', () => {
  it('등록된 목돈지출이 없을 때 빈 상태 안내 박스를 표시하지 않는다', () => {
    expect(renderStep([])).not.toContain('현재 등록된 목돈지출 계획이 없습니다.');
  });
});

describe('Step2Expense - 총 지출 합계 반응형 표시', () => {
  it('데스크톱 표와 모바일 합계·항목 목록을 함께 렌더링한다', () => {
    const html = renderStep();
    expect(html).toContain('grade-table compact finance-summary-desktop');
    expect(html).toContain('finance-summary-mobile');
    expect(html).toContain('현재 총 월 지출');
    expect(html).toContain('현재 총 연 지출');
  });
});
