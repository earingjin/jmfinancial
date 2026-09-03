import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormContext } from '../../../state/formState';
import { initialFormData } from '../../../state/initialFormData';
import { setIn } from '../../../state/pathUtils';
import { buildCanonicalInput } from '../../../../api/_lib/canonicalInput';
import { DRAFT_SCHEMA_VERSION, validateDraft } from '../../../state/draftStorage';
import Step3Savings, { updateSavingsPresence } from './Step3Savings';

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

describe('Step3Savings - 저축 없음 → 저축 있음 전환(retirementSavingsInputVersion: 2)', () => {
  it('저축 없음 상태에서는 v2 노후저축 입력 UI가 보이지 않는다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.savingsPlan.hasSavings = false;

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step3Savings />
      </FormContext.Provider>
    );

    expect(html).toContain('현재 납입하는 저축액은 0원으로 반영됩니다. 기존 보유자산은 유지됩니다.');
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

  it('월 납입액만 0으로 만들고 연결 자산과 사용자 추가 항목을 보존한다', () => {
    let formData = structuredClone(initialFormData);
    Object.assign(formData.assets.savingsPlan.breakdown.stocks, { monthly: 50, remainingMonths: 24, interestRate: 5 });
    Object.assign(formData.assets.savingsPlan.breakdown.irp, { monthly: 30, remainingMonths: 120, interestRate: 3 });
    formData.assets.savingsPlan.customItems = [{ name: '여행저축', monthly: 10, remainingMonths: 12, interestRate: 2 }];
    formData.assets.savingsPlan.monthly = 90;
    formData.assets.savingsPlan.annual = 1080;
    formData.assets.savingsPlan.additionalRetirementMonthly = 20;
    formData.assets.savingsPlan.additionalRetirementAnnual = 240;
    formData.assets.financialAssets.stocks = 1000;
    Object.assign(formData.assets.pensionAssetsBreakdown, { irp: 2000, pensionSavingsAccount: 3000, variableAnnuity: 4000 });
    formData.assets.pensionAssets = 9000;
    Object.assign(formData.assets.liquidAssets.breakdown, { savings: 500, subscription: 600 });
    formData.assets.liquidAssets.customItems = [
      { name: 'ISA', amount: 700 },
      { name: '파킹통장', amount: 800 },
      { name: '여행저축', amount: 900 },
    ];
    formData.assets.liquidAssets.total = 3500;
    const assetsBefore = structuredClone({
      liquidAssets: formData.assets.liquidAssets,
      financialAssets: formData.assets.financialAssets,
      pensionAssetsBreakdown: formData.assets.pensionAssetsBreakdown,
      pensionAssets: formData.assets.pensionAssets,
    });
    const setField = (path, value) => { formData = setIn(formData, path, value); };

    updateSavingsPresence(formData, setField, false);

    expect(formData.assets.savingsPlan.hasSavings).toBe(false);
    expect(formData.assets.savingsPlan.monthly).toBe(0);
    expect(formData.assets.savingsPlan.additionalRetirementMonthly).toBe(0);
    expect(formData.assets.savingsPlan.breakdown.stocks.monthly).toBe('');
    expect(formData.assets.savingsPlan.breakdown.irp.monthly).toBe('');
    expect(formData.assets.savingsPlan.customItems).toEqual([
      { name: '여행저축', monthly: '', remainingMonths: '', interestRate: '' },
    ]);
    expect({
      liquidAssets: formData.assets.liquidAssets,
      financialAssets: formData.assets.financialAssets,
      pensionAssetsBreakdown: formData.assets.pensionAssetsBreakdown,
      pensionAssets: formData.assets.pensionAssets,
    }).toEqual(assetsBefore);

    const canonical = buildCanonicalInput(formData);
    expect(canonical.assets.savingsPlan.monthly).toBe(0);
    expect(canonical.assets.savingsPlan.annual).toBe(0);
    expect(canonical.assets.savingsPlan.additionalRetirementAnnual).toBe(0);
    expect(canonical.assets.liquidAssets.total).toBe(3500);
    expect(canonical.assets.pensionAssets).toBe(9000);

    updateSavingsPresence(formData, setField, true);
    expect(formData.assets.financialAssets.stocks).toBe(1000);
    expect(formData.assets.liquidAssets.customItems).toHaveLength(3);
    expect(formData.assets.savingsPlan.customItems).toHaveLength(1);

    const restored = JSON.parse(JSON.stringify({
      schema_version: DRAFT_SCHEMA_VERSION,
      step_index: 3,
      form_data: formData,
    }));
    expect(validateDraft(restored).valid).toBe(true);
    expect(restored.form_data.assets.financialAssets.stocks).toBe(1000);
    expect(restored.form_data.assets.pensionAssetsBreakdown.irp).toBe(2000);
    expect(restored.form_data.assets.savingsPlan.monthly).toBe(0);
  });
});
