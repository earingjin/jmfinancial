import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormContext } from '../../../state/formState';
import { initialFormData } from '../../../state/initialFormData';
import Step3Savings from './Step3Savings';

globalThis.React = React;

describe('Step3Savings retirement savings input (retirementSavingsInputVersion: 1, legacy)', () => {
  it('keeps the retirement monthly amount enabled when it is included in general savings', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.retirementSavingsInputVersion = 1;
    formData.assets.savingsPlan.retirementIncludedInTotal = true;

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step3Savings />
      </FormContext.Provider>
    );
    const fieldStart = html.indexOf('노후준비 월 저축액');
    const fieldEnd = html.indexOf('</label>', fieldStart);
    const retirementField = html.slice(fieldStart, fieldEnd);

    expect(fieldStart).toBeGreaterThan(-1);
    expect(retirementField).toContain('<input');
    expect(retirementField).not.toContain('disabled');
  });

  it('still shows the legacy "이미 포함되어 있어요" checkbox for v1 data', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.retirementSavingsInputVersion = 1;

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step3Savings />
      </FormContext.Provider>
    );

    expect(html).toContain('위 노후준비 저축액은 일반 저축액에 이미 포함되어 있어요');
    expect(html).not.toContain('추가 노후준비 저축');
  });
});

describe('Step3Savings retirement savings input (retirementSavingsInputVersion: 2, default for new diagnoses)', () => {
  it('defaults to v2 for a brand-new form (initialFormData as-is)', () => {
    const formData = structuredClone(initialFormData);

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step3Savings />
      </FormContext.Provider>
    );

    expect(html).toContain('추가 노후준비 저축');
    expect(html).toContain('입력한 연금저축과 IRP는 노후준비 저축으로 자동 포함됩니다.');
    expect(html).not.toContain('노후준비 월 저축액');
    expect(html).not.toContain('위 노후준비 저축액은 일반 저축액에 이미 포함되어 있어요');
  });

  it('shows 연금저축/IRP monthly amounts and the retirement savings total', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.breakdown.pensionSavings.monthly = 20;
    formData.assets.savingsPlan.breakdown.irp.monthly = 30;
    formData.assets.savingsPlan.additionalRetirementMonthly = 10;
    formData.assets.savingsPlan.monthly = 100;

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step3Savings />
      </FormContext.Provider>
    );

    expect(html).toContain('연금저축');
    expect(html).toContain('IRP');
    expect(html).toContain('추가 노후준비 저축');
    expect(html).toContain('노후준비 저축 합계');
  });
});

// Case E(코드리뷰 후속): "저축 없음" 선택 시 setHasSavings(false)가 additionalRetirementMonthly/
// Annual까지 0으로 초기화하는지(레거시 retirementMonthly/Annual과 동일한 패턴), 그리고 "저축
// 있음"으로 되돌아왔을 때도 v2 모드(retirementSavingsInputVersion)와 그 초기화된 값이 그대로
// 정상 렌더링되는지 확인한다. 이 저장소에는 jsdom/testing-library가 없어 실제 클릭 이벤트를
// 시뮬레이션할 수는 없으므로, "저축 없음" 전/후 각 상태를 정적으로 렌더링해 결과를 검증한다
// (초기화 로직 자체는 setHasSavings의 setField 호출 목록으로 코드상 확인됨).
describe('Step3Savings - 저축 없음 → 저축 있음 전환(retirementSavingsInputVersion: 2)', () => {
  it('저축 없음 상태에서는 v2 노후저축 입력 UI가 보이지 않는다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.hasSavings = false;

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step3Savings />
      </FormContext.Provider>
    );

    expect(html).toContain('저축 없음으로 선택했습니다');
    expect(html).not.toContain('추가 노후준비 저축');
  });

  it('저축 있음으로 되돌아오면(추가 노후저축이 0으로 초기화된 상태) v2 UI가 정상 값으로 다시 보인다', () => {
    // setHasSavings(false)가 additionalRetirementMonthly/Annual을 0으로 만들어 둔 뒤,
    // 사용자가 다시 "저축 있음"을 선택한 직후의 상태를 재현한다.
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.hasSavings = true;
    formData.assets.savingsPlan.additionalRetirementMonthly = 0;
    formData.assets.savingsPlan.additionalRetirementAnnual = 0;

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step3Savings />
      </FormContext.Provider>
    );

    // v2 유지: 레거시 체크박스가 아니라 v2 전용 UI가 보여야 한다.
    expect(html).toContain('추가 노후준비 저축');
    expect(html).not.toContain('위 노후준비 저축액은 일반 저축액에 이미 포함되어 있어요');
    // 초기화된 값(0)이 정상적으로(에러 없이) 표시된다.
    expect(html).toContain('0만원');
  });

  it('setHasSavings(false) 초기화 목록에 additionalRetirementMonthly/Annual이 레거시 retirementMonthly/Annual과 함께 포함되어 있다(회귀 방지용 소스 검증)', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('./Step3Savings.jsx', import.meta.url), 'utf8')
    );
    const resetBlockStart = source.indexOf('if (!value) {');
    const resetBlockEnd = source.indexOf('\n    }', resetBlockStart);
    const resetBlock = source.slice(resetBlockStart, resetBlockEnd);

    expect(resetBlock).toContain("setField('assets.savingsPlan.retirementMonthly', 0)");
    expect(resetBlock).toContain("setField('assets.savingsPlan.retirementAnnual', 0)");
    expect(resetBlock).toContain("setField('assets.savingsPlan.additionalRetirementMonthly', 0)");
    expect(resetBlock).toContain("setField('assets.savingsPlan.additionalRetirementAnnual', 0)");
  });
});
