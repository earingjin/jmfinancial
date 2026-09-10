import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FormContext } from '../../../state/formState';
import { initialFormData } from '../../../state/initialFormData';
import { computeWizardRequiredFields } from '../../../state/wizardRequiredFields';
import { validateInput } from '../../../../api/_lib/validate.js';
import { calculatePensionIncomeAtTarget } from '../../../../api/_lib/futureFinance.js';
import { syncRetirementPensionAssetTotal } from '../fields/inputModeTransitions';
import Step1Income, { handleSeveranceType, remainingRetirementYearsToMonths } from './Step1Income';

globalThis.React = React;

function renderStep(formData, props = {}) {
  return renderToStaticMarkup(
    <FormContext.Provider value={{ formData, setField: vi.fn() }}>
      <Step1Income {...props} />
    </FormContext.Provider>
  );
}

describe('Step1Income basic information screens', () => {
  it('keeps service years in the basic-work screen', () => {
    const html = renderStep(structuredClone(initialFormData), { screenId: 'basic-work' });
    expect(html).toContain('근속년수 *');
    expect(html).toContain('현재 직장의 입사일부터 퇴직(예정)일까지의 전체 재직기간입니다. 퇴직금 모의계산에 사용됩니다.');
  });
});

describe('남은 퇴직기간 입력', () => {
  it('연 단위 사용자 입력을 기존 개월 저장 필드 값으로 변환한다', () => {
    expect(remainingRetirementYearsToMonths(10)).toBe(120);
    expect(remainingRetirementYearsToMonths(10.5)).toBe(126);
    expect(remainingRetirementYearsToMonths('')).toBe('');
    expect(remainingRetirementYearsToMonths(null)).toBe('');
    expect(remainingRetirementYearsToMonths(undefined)).toBe('');
  });

  it('본인과 배우자 모두 남은 퇴직기간을 수정 가능한 입력칸으로 표시한다', () => {
    const formData = structuredClone(initialFormData);
    formData.basic.hasSpouse = true;

    const html = renderStep(formData);

    expect(html).toContain('id="income.salary.months"');
    expect(html).toContain('id="spouse.salary.months"');
    expect(html).not.toMatch(/id="income\.salary\.months"[^>]*readonly/);
    expect(html).not.toMatch(/id="spouse\.salary\.months"[^>]*readonly/);
  });
});

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

describe('Step1Income - retirement-pension asset linkage', () => {
  it('shows the calculation guidance and current-balance inputs in Step 1', () => {
    const formData = structuredClone(initialFormData);
    formData.basic.hasSpouse = true;
    formData.income.severance.type = 'pension';
    formData.spouse.severance.type = 'pension';
    const html = renderStep(formData);
    expect(html).toContain('퇴직연금은 현재 쌓인 금액과 퇴직 후 받을 금액을 구분해 입력해 주세요.');
    expect(html).toContain('퇴직 후 매월 받을 것으로 예상되는 금액을 입력해 주세요.');
    expect(html).toContain('지금까지 쌓여 있는 퇴직연금 금액을 입력해 주세요. Step 4 연금자산과 연동됩니다.');
    expect(html).toContain('현재 본인 퇴직연금 적립금');
    expect(html).toContain('현재 배우자 퇴직연금 적립금');
    const selfPensionAssetIndex = html.indexOf('현재 본인 퇴직연금 적립금');
    expect(html.indexOf('수령 시작 나이 *')).toBeLessThan(selfPensionAssetIndex);
    expect(selfPensionAssetIndex).toBeLessThan(html.indexOf('수령 기간', selfPensionAssetIndex));
  });

  it('퇴직금 일시금의 의미를 본인과 배우자 모두 향후 추가 수령액으로 표시한다', () => {
    const formData = structuredClone(initialFormData);
    formData.basic.hasSpouse = true;
    formData.income.severance.type = 'lumpsum';
    formData.spouse.severance.type = 'lumpsum';
    const html = renderStep(formData);
    expect((html.match(/퇴직 시 예상 퇴직급여 일시금/g) || [])).toHaveLength(4);
    expect(html).toContain('퇴직 시 받을 것으로 예상되는 총액을 입력해 주세요. 현재 퇴직연금 적립금도 포함합니다.');
    expect(html).toContain('이미 받은 퇴직금·퇴직연금 일시금은 현재 보유 중인 예금·금융자산에 포함해 주세요.');
  });

  it('updates the simple pension-asset total by the changed balance delta', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.pensionAssetsInputMode = 'simple';
    formData.assets.pensionAssets = 5000;
    formData.assets.pensionAssetsBreakdown.selfRetirementPension = 2000;
    const setField = vi.fn();
    syncRetirementPensionAssetTotal(
      formData, setField, 'assets.pensionAssetsBreakdown.selfRetirementPension', 3000
    );
    expect(setField).toHaveBeenCalledWith('assets.pensionAssets', 6000);
    expect(setField).toHaveBeenCalledWith('assets.pensionAssetsSimpleTotal', 6000);
    expect(setField).toHaveBeenCalledWith('assets.pensionAssetsSimpleInputStored', true);
  });

  it('leaves the total to the canonical detailed aggregation in detailed mode', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.pensionAssetsInputMode = 'detailed';
    const setField = vi.fn();
    syncRetirementPensionAssetTotal(
      formData, setField, 'assets.pensionAssetsBreakdown.selfRetirementPension', 3000
    );
    expect(setField).not.toHaveBeenCalled();
  });
});

describe('Step1Income - 배우자 포함 합계', () => {
  it('가구 및 연금 합계 박스에 본인과 배우자 금액을 함께 표시한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.basic, { hasSpouse: true, birthYear: 1986, retirementAge: 65, lifeExpectancy: 85 });
    Object.assign(formData.spouse, { birthYear: 1986, retirementAge: 65, lifeExpectancy: 85 });
    Object.assign(formData.income.salary, { monthly: 100, annualBonus: 0 });
    Object.assign(formData.spouse.salary, { monthly: 200, annualBonus: 0 });
    Object.assign(formData.income.severance, { type: 'lumpsum', lumpsum: 111, lumpsumAge: 65 });
    Object.assign(formData.spouse.severance, { type: 'lumpsum', lumpsum: 222, lumpsumAge: 65 });
    Object.assign(formData.income.personalPension, { type: 'lumpsum', lumpsum: 333, lumpsumAge: 65 });
    Object.assign(formData.spouse.personalPension, { type: 'lumpsum', lumpsum: 444, lumpsumAge: 65 });
    Object.assign(formData.income.nationalPension, { monthly: 10, paymentMonths: 120, months: 240 });
    Object.assign(formData.spouse.nationalPension, { monthly: 20, paymentMonths: 120, months: 240 });

    const html = renderStep(formData);
    expect((html.match(/본인 금액은/g) || [])).toHaveLength(4);
    expect((html.match(/배우자 금액은/g) || [])).toHaveLength(4);
  });
});

describe('Step1Income - 총 수입 합계 반응형 표시', () => {
  it('데스크톱 4열 표와 동일 값을 사용하는 모바일 요약을 함께 렌더링한다', () => {
    const html = renderStep(structuredClone(initialFormData));

    expect(html).toContain('grade-table compact income-summary-desktop');
    expect(html).toContain('income-summary-mobile');
    expect(html).toContain('현재 월 소득');
    expect(html).toContain('현재 연 소득');
    expect(html).toContain('계산 기준 보기');
    expect(html).toContain('수령 시작 나이');
    expect(html).toContain('수입 기간');
  });

  it('현재 월 소득에는 급여와 상여만 포함하고 미래 연금은 포함하지 않는다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.basic, { hasSpouse: true, birthYear: 1975, retirementAge: 60, lifeExpectancy: 85 });
    Object.assign(formData.spouse, { birthYear: 1978, retirementAge: 60, lifeExpectancy: 85 });
    Object.assign(formData.income.salary, { monthly: 450, annualBonus: 600 });
    Object.assign(formData.spouse.salary, { monthly: 250, annualBonus: 0 });
    Object.assign(formData.income.nationalPension, { inputMode: 'direct', monthly: 130, paymentMonths: 120, months: 240 });
    Object.assign(formData.spouse.nationalPension, { inputMode: 'direct', monthly: 60, paymentMonths: 120, months: 240 });
    Object.assign(formData.income.personalPension, { type: 'installment', monthly: 50, startAge: 65, months: 120 });

    const html = renderStep(formData);

    expect(html).toMatch(/현재 월 소득<\/td><td[^>]*>750만원<\/td>/);
    expect(html).not.toContain('990만원');
    expect(html).toContain('국민연금');
    expect(html).toContain('개인연금');
  });

  it('현재 월 소득에 사업소득과 기타 정기수입을 각각 한 번씩 월환산해 포함한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.income.salary, { monthly: 450, annualBonus: 600 });
    Object.assign(formData.spouse.salary, { monthly: 250, annualBonus: 0 });
    formData.income.business.monthly = 30;
    formData.income.otherIncomes = [{ name: '임대수입', annual: 1200, years: 10 }];

    const html = renderStep(formData);

    expect(html).toMatch(/현재 월 소득<\/td><td[^>]*>880만원<\/td>/);
  });

  it('국민연금·퇴직연금·개인연금 금액을 변경해도 현재 월 소득은 변하지 않는다', () => {
    const base = structuredClone(initialFormData);
    Object.assign(base.income.salary, { monthly: 300, annualBonus: 0 });
    const withPensions = structuredClone(base);
    Object.assign(withPensions.income.nationalPension, { inputMode: 'direct', monthly: 300, paymentMonths: 120, months: 240 });
    Object.assign(withPensions.income.severance, { type: 'pension', pensionMonthly: 200, pensionStartAge: 60, pensionMonths: 120 });
    Object.assign(withPensions.income.personalPension, { type: 'installment', monthly: 100, startAge: 65, months: 120 });

    expect(renderStep(base)).toMatch(/현재 월 소득<\/td><td[^>]*>300만원<\/td>/);
    expect(renderStep(withPensions)).toMatch(/현재 월 소득<\/td><td[^>]*>300만원<\/td>/);
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
      expect(setField).toHaveBeenCalledWith(`income.severance.${field}`, '');
    });
    expect(setField).not.toHaveBeenCalledWith('assets.pensionAssetsBreakdown.selfRetirementPension', '');
  });

  it('본인: 퇴직연금(월지급) 입력 후 없음으로 전환하면 pensionMonthly 등 관련 값을 초기화한다', () => {
    const setField = vi.fn();
    handleSeveranceType(setField, 'income.severance', 'none');
    expect(setField).toHaveBeenCalledWith('income.severance.pensionMonthly', '');
    expect(setField).toHaveBeenCalledWith('income.severance.pensionStartAge', '');
    expect(setField).toHaveBeenCalledWith('income.severance.pensionYears', '');
    expect(setField).toHaveBeenCalledWith('income.severance.pensionMonths', '');
  });

  it('배우자도 동일하게 초기화한다', () => {
    const setField = vi.fn();
    handleSeveranceType(setField, 'spouse.severance', 'none');
    RESET_FIELDS.forEach((field) => {
      expect(setField).toHaveBeenCalledWith(`spouse.severance.${field}`, '');
    });
  });

  it('lumpsum·pension 간 전환에서는 아무 값도 초기화하지 않는다(기존 입력값 보존)', () => {
    const setField = vi.fn();
    handleSeveranceType(setField, 'income.severance', 'lumpsum');
    handleSeveranceType(setField, 'income.severance', 'pension');
    expect(setField).not.toHaveBeenCalled();
  });
});

// 퇴직연금(월지급)의 "수령 기간"(pensionYears, 사용자가 직접 입력) → "수령 개월 수"(pensionMonths,
// 계산에 실제로 쓰이는 자동계산 필드) 동기화는 useEffect(() => setField(pensionMonthsPath,
// remainingRetirementYearsToMonths(pensionYears)), [pensionYears])로 이루어진다(본인·배우자 각각
// 별도 useEffect이지만 동일한 remainingRetirementYearsToMonths를 재사용한다 - "남은 퇴직기간"
// 필드가 이미 본인/배우자에 이 함수를 공용으로 쓰던 것과 같은 패턴). 이 프로젝트에는 실제 useEffect를
// 구동할 jsdom 환경이 없으므로, 그 본문과 정확히 같은 계산(remainingRetirementYearsToMonths)이
// pensionYears가 비워졌을 때도 pensionMonths를 함께 비운다는 것을 직접 검증한다.
describe('퇴직연금 수령기간(pensionYears) 삭제 시 수령 개월 수(pensionMonths) 동기화', () => {
  it('10년을 입력하면 120개월로 계산되고, 이후 완전히 삭제하면 개월 수도 함께 비워진다', () => {
    expect(remainingRetirementYearsToMonths(10)).toBe(120);
    expect(remainingRetirementYearsToMonths('')).toBe('');
  });

  const fillBaseFormData = () => {
    const formData = structuredClone(initialFormData);
    formData.basic.birthYear = 1970;
    formData.basic.retirementAge = 65;
    formData.basic.lifeExpectancy = 90;
    formData.basic.serviceYears = 10;
    formData.income.personalPension.type = 'none';
    formData.income.nationalPension.inputMode = 'none';
    formData.income.salary.hasSalary = false;
    formData.assets.currentLivingCost.monthly = 0;
    formData.assets.insurance.hasInsurance = false;
    formData.assets.savingsPlan.hasSavings = false;
    formData.assets.liquidAssets.hasAssets = false;
    formData.assets.financialAssets.hasAssets = false;
    formData.assets.hasPensionAssets = false;
    formData.assets.realEstateAssets.hasAssets = false;
    formData.assets.otherAssets.hasAssets = false;
    formData.assets.debtStatus.hasDebt = false;
    formData.expense.retirementLivingCost = 200;
    formData.income.severance.type = 'pension';
    formData.income.severance.pensionStartAge = 65;
    formData.income.severance.pensionMonthly = 100;
    formData.assets.pensionAssetsBreakdown.selfRetirementPension = 0;
    return formData;
  };

  // 실제 useEffect 본문: setField(pensionMonthsPath, remainingRetirementYearsToMonths(nextPensionYears)).
  const syncPensionMonthsFromYears = (severance, nextPensionYears) => {
    severance.pensionYears = nextPensionYears;
    severance.pensionMonths = remainingRetirementYearsToMonths(nextPensionYears);
  };

  it('본인: 수령기간을 지우면 pensionYears·pensionMonths가 모두 비워지고, 프론트/서버 validation이 모두 실패하며, 과거 120개월이 계산에 남지 않는다', () => {
    const formData = fillBaseFormData();

    syncPensionMonthsFromYears(formData.income.severance, 10);
    expect(formData.income.severance.pensionMonths).toBe(120);

    syncPensionMonthsFromYears(formData.income.severance, '');
    expect(formData.income.severance.pensionYears).toBe('');
    expect(formData.income.severance.pensionMonths).toBe('');

    const required = computeWizardRequiredFields(formData);
    expect(required.missingIncomeFields.map(([path]) => path)).toContain('income.severance.pensionMonths');
    expect(required.basicInfoMissing).toBe(true);

    const serverInput = {
      basic: formData.basic, income: formData.income, spouse: formData.spouse,
      expense: formData.expense, assets: formData.assets, scenarios: formData.scenarios,
    };
    const serverResult = validateInput(serverInput);
    expect(serverResult.ok).toBe(false);
    expect(serverResult.errors.join(' ')).toContain('income.severance.pensionMonths');

    const pensionResult = calculatePensionIncomeAtTarget({
      input: { basic: formData.basic, income: formData.income },
      currentYear: 2026,
      years: 30,
    });
    const component = pensionResult.components.find((c) => c.key === 'self.retirementPension');
    expect(component.inclusionStatus).toBe('unknown');
    expect(component.amount).toBeNull();
  });

  it('배우자: 동일한 수령기간 삭제 흐름이 spouse.severance에도 동일하게 적용된다', () => {
    const formData = fillBaseFormData();
    formData.income.severance.type = 'none';
    formData.basic.hasSpouse = true;
    formData.spouse.birthYear = 1972;
    formData.spouse.retirementAge = 65;
    formData.spouse.lifeExpectancy = 88;
    formData.spouse.personalPension.type = 'none';
    formData.spouse.nationalPension.inputMode = 'none';
    formData.spouse.severance.type = 'pension';
    formData.spouse.severance.pensionStartAge = 65;
    formData.spouse.severance.pensionMonthly = 100;
    formData.assets.pensionAssetsBreakdown.spouseRetirementPension = 0;

    syncPensionMonthsFromYears(formData.spouse.severance, 10);
    expect(formData.spouse.severance.pensionMonths).toBe(120);

    syncPensionMonthsFromYears(formData.spouse.severance, '');
    expect(formData.spouse.severance.pensionYears).toBe('');
    expect(formData.spouse.severance.pensionMonths).toBe('');

    const required = computeWizardRequiredFields(formData);
    expect(required.missingIncomeFields.map(([path]) => path)).toContain('spouse.severance.pensionMonths');

    const serverInput = {
      basic: formData.basic, income: formData.income, spouse: formData.spouse,
      expense: formData.expense, assets: formData.assets, scenarios: formData.scenarios,
    };
    const serverResult = validateInput(serverInput);
    expect(serverResult.ok).toBe(false);
    expect(serverResult.errors.join(' ')).toContain('spouse.severance.pensionMonths');
  });

  it('정상적으로 수령기간을 채운 경우의 기존 계산 결과는 그대로 유지된다', () => {
    const formData = fillBaseFormData();
    syncPensionMonthsFromYears(formData.income.severance, 10);

    const required = computeWizardRequiredFields(formData);
    expect(required.basicInfoMissing).toBe(false);

    const serverInput = {
      basic: formData.basic, income: formData.income, spouse: formData.spouse,
      expense: formData.expense, assets: formData.assets, scenarios: formData.scenarios,
    };
    expect(validateInput(serverInput).ok).toBe(true);

    // birthYear 1970 기준 currentAge(2026)=56, pensionStartAge=65·pensionMonths=120(10년)이므로
    // 65<=나이<75 구간(years 9~19)에서 활성화된다.
    const pensionResult = calculatePensionIncomeAtTarget({
      input: { basic: formData.basic, income: formData.income },
      currentYear: 2026,
      years: 10,
    });
    const component = pensionResult.components.find((c) => c.key === 'self.retirementPension');
    expect(component.inclusionStatus).toBe('included');
    expect(component.amount).toBeGreaterThan(0);
  });
});
