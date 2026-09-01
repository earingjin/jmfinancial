import { describe, expect, it } from 'vitest';
import { initialFormData } from './initialFormData';
import { computeWizardRequiredFields } from './wizardRequiredFields';

// 2026-09-01 실제 문의 재현 케이스: 배우자 개인연금 수령방식이 기본값 "분할 수령"인 채로
// 수령 시작 나이(startAge)를 채우지 않고 제출하면 서버(api/_lib/validate.js)가 400으로
// 거부하는데, 위저드는 이 항목을 필수로 취급하지 않아 사용자가 원인을 알 수 없이 반복
// 실패했다. 이 파일은 그 회귀를 방지한다.
const fillBasicRequired = (formData) => {
  formData.basic.birthYear = 1970;
  formData.basic.retirementAge = 65;
  formData.basic.lifeExpectancy = 90;
  formData.basic.serviceYears = 10;
};

describe('computeWizardRequiredFields - 기본 정보(1. 수입)', () => {
  it('완전히 빈 초기 폼 데이터는 기본 정보 4개와 본인 개인연금 수령 시작 나이(기본값이 분할 수령)를 모두 필수 누락으로 잡는다', () => {
    const formData = structuredClone(initialFormData);

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(true);
    expect(result.missingIncomeFields.map(([path]) => path)).toEqual([
      'basic.birthYear',
      'basic.retirementAge',
      'basic.lifeExpectancy',
      'basic.serviceYears',
      'income.personalPension.startAge',
    ]);
    expect(result.requiredErrorMessage).toContain('"1. 수입"');
    expect(result.requiredErrorMessage).toContain('출생년도');
    expect(result.requiredErrorMessage).toContain('개인연금 수령 시작 나이');
  });

  it('기본 정보와 본인 개인연금 수령 시작 나이까지 채우면(배우자 없음) 더 이상 누락으로 잡지 않는다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(false);
    expect(result.missingIncomeFields).toEqual([]);
  });

  it('본인 개인연금을 "없음"으로 바꾸면 수령 시작 나이는 더 이상 필수가 아니다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.type = 'none';

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(false);
  });

  it('본인 퇴직연금을 "월지급"으로 선택하면 수령 시작 나이가 필수가 된다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.income.severance.type = 'pension';

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(true);
    expect(result.missingIncomeFields.map(([path]) => path)).toEqual(['income.severance.pensionStartAge']);
    expect(result.requiredErrorMessage).toContain('퇴직연금 수령 시작 나이');
  });

  it('실제 문의 재현: 배우자 정보를 켜고 기본정보를 채워도, 배우자 개인연금(기본값 분할 수령)의 수령 시작 나이를 안 채우면 걸린다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.basic.hasSpouse = true;
    formData.spouse.birthYear = 1972;
    formData.spouse.retirementAge = 65;
    formData.spouse.lifeExpectancy = 88;
    // formData.spouse.personalPension.type은 initialFormData 기본값 그대로 'installment'.
    // formData.spouse.personalPension.startAge도 기본값 그대로 '' - 이게 실제 문의의 원인이었다.

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(true);
    expect(result.missingIncomeFields.map(([path]) => path)).toEqual(['spouse.personalPension.startAge']);
    expect(result.requiredErrorMessage).toBe('"1. 수입"에서 다음 항목을 입력해 주세요: 배우자 개인연금 수령 시작 나이');
  });

  it('배우자 정보를 켰는데 배우자 기본정보(출생년도 등)를 안 채우면 그 항목들도 걸린다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.basic.hasSpouse = true;
    formData.spouse.personalPension.startAge = 60; // 개인연금 쪽은 이미 채워서 이 테스트에서 제외

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(true);
    expect(result.missingIncomeFields.map(([path]) => path)).toEqual([
      'spouse.birthYear',
      'spouse.retirementAge',
      'spouse.lifeExpectancy',
    ]);
  });

  it('배우자 정보를 끄면 배우자 필드는 비어 있어도 걸리지 않는다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.basic.hasSpouse = false;

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(false);
  });
});

describe('computeWizardRequiredFields - 지출(2. 지출)', () => {
  const fullyFilledIncome = (formData) => {
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
  };

  it('노후 월 평균 생활비가 비어 있으면 걸린다', () => {
    const formData = structuredClone(initialFormData);
    fullyFilledIncome(formData);

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(false);
    expect(result.retirementLivingCostMissing).toBe(true);
    expect(result.requiredErrorMessage).toBe('"2. 지출"에서 다음 항목을 입력해 주세요: 노후 월 평균 생활비');
  });

  it('명시적으로 입력한 0은 유효한 값으로 통과시킨다', () => {
    const formData = structuredClone(initialFormData);
    fullyFilledIncome(formData);
    formData.expense.retirementLivingCost = 0;

    const result = computeWizardRequiredFields(formData);

    expect(result.retirementLivingCostMissing).toBe(false);
  });

  it('목돈지출 계획 항목에 금액만 입력하고 지출 용도를 비워두면 걸린다', () => {
    const formData = structuredClone(initialFormData);
    fullyFilledIncome(formData);
    formData.expense.retirementLivingCost = 150;
    formData.expense.retirementLumpSumExpenses = [{ name: '', expectedAge: '', amount: 1000 }];

    const result = computeWizardRequiredFields(formData);

    expect(result.retirementLivingCostMissing).toBe(true);
    expect(result.missingExpenseFields.map(([path]) => path)).toEqual([
      'expense.retirementLumpSumExpenses.0.name',
    ]);
    expect(result.requiredErrorMessage).toBe('"2. 지출"에서 다음 항목을 입력해 주세요: 목돈지출 계획 1번째 항목의 지출 용도');
  });

  it('완전히 비어 있는 목돈지출 항목(추가만 하고 아무것도 안 채움)은 필수로 취급하지 않는다', () => {
    const formData = structuredClone(initialFormData);
    fullyFilledIncome(formData);
    formData.expense.retirementLivingCost = 150;
    formData.expense.retirementLumpSumExpenses = [{ name: '', expectedAge: '', amount: '' }];

    const result = computeWizardRequiredFields(formData);

    expect(result.retirementLivingCostMissing).toBe(false);
  });

  it('모든 필수값을 채우면 지출 단계도 통과한다', () => {
    const formData = structuredClone(initialFormData);
    fullyFilledIncome(formData);
    formData.expense.retirementLivingCost = 150;
    formData.expense.retirementLumpSumExpenses = [{ name: '자녀 결혼지원', expectedAge: 68, amount: 3000 }];

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(false);
    expect(result.retirementLivingCostMissing).toBe(false);
  });
});
