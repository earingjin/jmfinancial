import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormContext } from '../../../state/formState';
import { initialFormData } from '../../../state/initialFormData';
import Step1Income, { handleSeveranceType } from './Step1Income';

globalThis.React = React;

function renderStep(formData) {
  return renderToStaticMarkup(
    <FormContext.Provider value={{ formData, setField: vi.fn() }}>
      <Step1Income />
    </FormContext.Provider>
  );
}

describe('Step1Income national pension future contribution plan', () => {
  it('continue는 추가 납부 예정 개월 수 입력을 요구한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.basic, { birthYear: 1986, retirementAge: 50 });
    Object.assign(formData.income.nationalPension, { paymentMonths: 60, futureContributionPlan: 'continue' });
    const html = renderStep(formData);
    expect(html).toContain('앞으로 국민연금 보험료를 계속 납부할 예정인가요?');
    expect(html).toContain('추가 납부 예정 개월 수');
    expect(html).toContain('추가로 납부할 예정 개월 수를 입력하면 총 가입기간이 120개월 이상인지 확인합니다.');
  });

  it('실제 60개월과 추가 예정 60개월을 합산해 예상액 계산 기준을 안내한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.income.nationalPension, {
      paymentMonths: 60, futureContributionPlan: 'continue', expectedAdditionalContributionMonths: 60,
    });
    const html = renderStep(formData);
    expect(html).toContain('총 120개월을 기준으로 국민연금 예상액을 계산합니다.');
  });

  it('모의계산은 실제 60개월과 추가 예정 60개월을 합한 120개월로 월 예상액을 계산한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.income.nationalPension, {
      inputMode: 'simulate', futureContributionPlan: 'continue', expectedAdditionalContributionMonths: 60,
      months: 240,
      simulate: { averageMonthlyIncome: 300, contributionMonths: 60, years: 5 },
    });
    const html = renderStep(formData);
    expect(html).toContain('총 120개월을 기준으로 국민연금 예상액을 계산합니다.');
  });

  it('120개월 이상이면 기존 UI만 유지하고 추가 질문을 표시하지 않는다', () => {
    const formData = structuredClone(initialFormData);
    formData.income.nationalPension.paymentMonths = 120;
    expect(renderStep(formData)).not.toContain('앞으로 국민연금 보험료를 계속 납부할 예정인가요?');
  });

  it('본인과 배우자 계획을 독립적으로 표시한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.basic, { hasSpouse: true, birthYear: 1986, retirementAge: 65 });
    Object.assign(formData.spouse, { birthYear: 1986, retirementAge: 65 });
    formData.income.nationalPension.paymentMonths = 120;
    Object.assign(formData.spouse.nationalPension, { paymentMonths: 60, futureContributionPlan: 'unknown' });
    const html = renderStep(formData);
    expect((html.match(/앞으로 국민연금 보험료를 계속 납부할 예정인가요\?/g) || [])).toHaveLength(1);
    expect(html).toContain('현재 가입기간은 120개월 미만입니다. 국민연금(노령연금) 가입기간 120개월 미만인 경우, 그동안 낸 보험료에 이자를 더해 일시금으로 지급받게 됩니다.');
  });

  it('stop은 반환일시금 가능성을 안내한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.income.nationalPension, { paymentMonths: 60, futureContributionPlan: 'stop' });
    expect(renderStep(formData)).toContain('현재 가입기간은 120개월 미만입니다. 국민연금(노령연금) 가입기간 120개월 미만인 경우, 그동안 낸 보험료에 이자를 더해 일시금으로 지급받게 됩니다.');
  });

  it('none에서는 추가 질문과 반환일시금 안내를 표시하지 않는다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.income.nationalPension, { inputMode: 'none', paymentMonths: 60, futureContributionPlan: 'stop' });
    const html = renderStep(formData);
    expect(html).not.toContain('앞으로 국민연금 보험료를 계속 납부할 예정인가요?');
    expect(html).not.toContain('반환일시금 대상이 될 수 있습니다.');
  });
});

// RadioField의 onClick은 renderToStaticMarkup(서버 렌더링)에서는 실행되지 않아 실제 클릭을 재현할
// 수 없다 - handleSeveranceType을 직접 호출해 실제로 화면에서 쓰이는 것과 동일한 함수를 검증한다.
describe('handleSeveranceType - 퇴직금·퇴직연금 잔존값 초기화', () => {
  const RESET_FIELDS = ['lumpsum', 'lumpsumAge', 'pensionMonthly', 'pensionStartAge', 'pensionYears', 'pensionMonths'];

  it('본인: 퇴직금(일시금) 입력 후 없음으로 전환하면 lumpsum·lumpsumAge를 포함한 잔존값을 초기화한다', () => {
    const setField = vi.fn();
    handleSeveranceType(setField, 'income.severance', 'none');
    RESET_FIELDS.forEach((field) => {
      expect(setField).toHaveBeenCalledWith(`income.severance.${field}`, 0);
    });
  });

  it('본인: 퇴직연금(월지급) 입력 후 없음으로 전환하면 pensionMonthly 등 관련 값을 초기화한다', () => {
    const setField = vi.fn();
    handleSeveranceType(setField, 'income.severance', 'none');
    expect(setField).toHaveBeenCalledWith('income.severance.pensionMonthly', 0);
    expect(setField).toHaveBeenCalledWith('income.severance.pensionStartAge', 0);
    expect(setField).toHaveBeenCalledWith('income.severance.pensionYears', 0);
    expect(setField).toHaveBeenCalledWith('income.severance.pensionMonths', 0);
  });

  it('배우자도 동일하게 초기화한다', () => {
    const setField = vi.fn();
    handleSeveranceType(setField, 'spouse.severance', 'none');
    RESET_FIELDS.forEach((field) => {
      expect(setField).toHaveBeenCalledWith(`spouse.severance.${field}`, 0);
    });
  });

  it('lumpsum·pension 간 전환에서는 아무 값도 초기화하지 않는다(기존 입력값 보존)', () => {
    const setField = vi.fn();
    handleSeveranceType(setField, 'income.severance', 'lumpsum');
    handleSeveranceType(setField, 'income.severance', 'pension');
    expect(setField).not.toHaveBeenCalled();
  });
});
