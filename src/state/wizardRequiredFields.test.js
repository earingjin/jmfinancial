import { describe, expect, it } from 'vitest';
import { initialFormData } from './initialFormData';
import { computeWizardRequiredFields, getWizardRequiredFieldDefinitions } from './wizardRequiredFields';
import { WIZARD_SCREENS, getRequiredScreenIndex, getWizardScreens } from './wizardScreens';

// 2026-09-01 실제 문의 재현 케이스: 배우자 개인연금 수령방식이 기본값 "분할 수령"인 채로
// 수령 시작 나이(startAge)를 채우지 않고 제출하면 서버(api/_lib/validate.js)가 400으로
// 거부하는데, 위저드는 이 항목을 필수로 취급하지 않아 사용자가 원인을 알 수 없이 반복
// 실패했다. 이 파일은 그 회귀를 방지한다.
const fillBasicRequired = (formData) => {
  formData.basic.birthYear = 1970;
  formData.basic.retirementAge = 65;
  formData.basic.lifeExpectancy = 90;
  formData.basic.serviceYears = 10;
  formData.income.severance.lumpsum = 5000;
  formData.income.severance.lumpsumAge = 65;
  formData.spouse.severance.lumpsum = 3000;
  formData.spouse.severance.lumpsumAge = 65;
  formData.income.salary.hasSalary = false;
  formData.spouse.salary.hasSalary = false;
  formData.assets.currentLivingCost.monthly = 0;
  formData.assets.insurance.hasInsurance = false;
  formData.assets.savingsPlan.hasSavings = false;
  formData.assets.liquidAssets.hasAssets = false;
  formData.assets.financialAssets.hasAssets = false;
  formData.assets.hasPensionAssets = false;
  formData.assets.realEstateAssets.hasAssets = false;
  formData.assets.otherAssets.hasAssets = false;
  formData.assets.debtStatus.hasDebt = false;
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
      'income.salary.monthly',
      'income.severance.lumpsum',
      'income.severance.lumpsumAge',
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
    // 퇴직연금 적립금(assets.pensionAssetsBreakdown.selfRetirementPension)도 동시에 필수가 되지만,
    // 이 테스트는 수령 시작 나이만 검증하므로 별도로 채워 다른 항목만 남긴다.
    formData.assets.pensionAssetsBreakdown.selfRetirementPension = 0;

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

// 국민연금 "계속 납부 예정"(futureContributionPlan==='continue') 선택 시 서버(api/_lib/validate.js)는
// expectedAdditionalContributionMonths를 필수로 요구해 400을 반환하지만, 위저드는 이 항목을 필수로
// 취급하지 않아 사용자가 원인을 알 수 없이 제출에 반복 실패했다. 이 describe는 그 회귀를 방지한다.
describe('computeWizardRequiredFields - 국민연금 계속 납부 예정 추가 납부개월', () => {
  it('가입기간 120개월 미만 + 계속 납부 예정인데 추가 납부개월을 안 채우면 걸린다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.income.nationalPension.paymentMonths = 60;
    formData.income.nationalPension.futureContributionPlan = 'continue';

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(true);
    expect(result.missingIncomeFields.map(([path]) => path)).toEqual([
      'income.nationalPension.expectedAdditionalContributionMonths',
    ]);
    expect(result.requiredErrorMessage).toBe('"1. 수입"에서 다음 항목을 입력해 주세요: 국민연금 추가 납부 예정 개월 수');
  });

  it('가입기간 120개월 미만 + 계속 납부 예정 + 유효한 추가 납부개월을 채우면 통과한다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.income.nationalPension.paymentMonths = 60;
    formData.income.nationalPension.futureContributionPlan = 'continue';
    formData.income.nationalPension.expectedAdditionalContributionMonths = 60;

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(false);
  });

  it('"계속 납부 예정"이 아니면(중단/모름/미선택) 추가 납부개월을 필수로 요구하지 않는다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.income.nationalPension.paymentMonths = 60;

    formData.income.nationalPension.futureContributionPlan = 'stop';
    expect(computeWizardRequiredFields(formData).basicInfoMissing).toBe(false);

    formData.income.nationalPension.futureContributionPlan = 'unknown';
    expect(computeWizardRequiredFields(formData).basicInfoMissing).toBe(false);

    formData.income.nationalPension.futureContributionPlan = '';
    expect(computeWizardRequiredFields(formData).basicInfoMissing).toBe(false);
  });

  it('배우자도 동일한 조건으로 독립 판정되며, 채우면 더 이상 걸리지 않는다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.basic.hasSpouse = true;
    formData.spouse.birthYear = 1972;
    formData.spouse.retirementAge = 65;
    formData.spouse.lifeExpectancy = 88;
    formData.spouse.personalPension.startAge = 60;
    formData.spouse.nationalPension.paymentMonths = 60;
    formData.spouse.nationalPension.futureContributionPlan = 'continue';

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(true);
    expect(result.missingIncomeFields.map(([path]) => path)).toEqual([
      'spouse.nationalPension.expectedAdditionalContributionMonths',
    ]);

    formData.spouse.nationalPension.expectedAdditionalContributionMonths = 24;
    expect(computeWizardRequiredFields(formData).basicInfoMissing).toBe(false);
  });

  it('배우자 정보를 끄면 배우자 국민연금 계속 납부 여부와 무관하게 걸리지 않는다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.basic.hasSpouse = false;
    formData.spouse.nationalPension.futureContributionPlan = 'continue';

    expect(computeWizardRequiredFields(formData).basicInfoMissing).toBe(false);
  });
});

// 퇴직연금퇴직금중복해결: income.severance.type(또는 배우자)을 "월지급(연금)"으로 선택했으면
// assets.pensionAssetsBreakdown.selfRetirementPension(또는 spouseRetirementPension)이 서버(validate.js)
// 필수값이다. 이 필드는 assets 섹션 데이터이지만 Step1Income.jsx가 정확히 같은 조건(severance.type
// === 'pension')일 때 "1. 수입" 화면에 함께 렌더링하므로, 안내 문구도 "1. 수입"을 그대로 가리키면 된다.
describe('computeWizardRequiredFields - 퇴직연금 월지급 시 적립금 필수(1. 수입)', () => {
  it('본인 퇴직연금을 "월지급"으로 선택하고 적립금을 비워두면 걸린다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.income.severance.type = 'pension';
    formData.income.severance.pensionStartAge = 65;

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(true);
    expect(result.missingIncomeFields.map(([path]) => path)).toContain('assets.pensionAssetsBreakdown.selfRetirementPension');
    expect(result.requiredErrorMessage).toContain('"1. 수입"');
    expect(result.requiredErrorMessage).toContain('본인 퇴직연금 적립금');
  });

  it('적립금에 명시적으로 0을 입력하면 더 이상 걸리지 않는다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.income.severance.type = 'pension';
    formData.income.severance.pensionStartAge = 65;
    formData.assets.pensionAssetsBreakdown.selfRetirementPension = 0;

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(false);
  });

  it('배우자 퇴직연금을 "월지급"으로 선택하고 적립금을 비워두면 걸린다', () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.startAge = 60;
    formData.basic.hasSpouse = true;
    formData.spouse.birthYear = 1972;
    formData.spouse.retirementAge = 65;
    formData.spouse.lifeExpectancy = 88;
    formData.spouse.personalPension.startAge = 60;
    formData.spouse.severance.type = 'pension';
    formData.spouse.severance.pensionStartAge = 65;

    const result = computeWizardRequiredFields(formData);

    expect(result.basicInfoMissing).toBe(true);
    expect(result.missingIncomeFields.map(([path]) => path)).toContain('assets.pensionAssetsBreakdown.spouseRetirementPension');
    expect(result.requiredErrorMessage).toContain('"1. 수입"');
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

  it('공백만 입력한 필수 생활비는 미입력으로 처리한다', () => {
    const formData = structuredClone(initialFormData);
    fullyFilledIncome(formData);
    formData.expense.retirementLivingCost = '   ';
    expect(computeWizardRequiredFields(formData).retirementLivingCostMissing).toBe(true);
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
      'expense.retirementLumpSumExpenses.0.expectedAge',
    ]);
    expect(getWizardRequiredFieldDefinitions(formData).expenseRequiredFields).toContainEqual([
      'expense.retirementLumpSumExpenses.0.name',
      '목돈지출 계획 1번째 항목의 지출 용도',
      true,
    ]);
    expect(result.requiredErrorMessage).toContain('목돈지출 계획 1번째 항목의 지출 용도');
    expect(result.requiredErrorMessage).toContain('목돈지출 계획 1번째 항목의 발생 나이');
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

describe('필수 입력 필드 → wizardScreens 오류 이동 연결', () => {
  const mappingForms = () => {
    const lumpsum = structuredClone(initialFormData);
    lumpsum.basic.hasSpouse = true;
    lumpsum.income.nationalPension.futureContributionPlan = 'continue';
    lumpsum.spouse.nationalPension.futureContributionPlan = 'continue';
    lumpsum.expense.retirementLumpSumExpenses = [{ name: '', expectedAge: 70, amount: 1000 }];

    const pension = structuredClone(lumpsum);
    pension.income.severance.type = 'pension';
    pension.spouse.severance.type = 'pension';

    return [lumpsum, pension];
  };

  it('필수 필드 정의의 모든 path가 정확히 한 소화면 prefix에 포함된다', () => {
    for (const formData of mappingForms()) {
      const definitions = getWizardRequiredFieldDefinitions(formData);
      for (const [stepKey, fields] of [
        ['income', definitions.incomeRequiredFields],
        ['expense', definitions.expenseRequiredFields],
      ]) {
        for (const [path] of fields) {
          const matchingScreens = WIZARD_SCREENS[stepKey]
            .filter(({ prefixes }) => prefixes.some((prefix) => path.startsWith(prefix)));
          expect(matchingScreens.map(({ id }) => id), `${path}의 소화면 연결`).toHaveLength(1);
        }
      }
    }
  });

  it('실제로 누락 판정된 모든 필드가 배우자 포함 화면 목록의 해당 소화면으로 이동한다', () => {
    for (const formData of mappingForms()) {
      const required = computeWizardRequiredFields(formData);
      for (const [stepKey, fields] of [
        ['income', required.missingIncomeFields],
        ['expense', required.missingExpenseFields],
      ]) {
        const screens = getWizardScreens(stepKey, true);
        for (const [path] of fields) {
          const expected = WIZARD_SCREENS[stepKey]
            .find(({ prefixes }) => prefixes.some((prefix) => path.startsWith(prefix)));
          expect(screens[getRequiredScreenIndex(stepKey, path, true)]?.id, `${path}의 오류 이동`).toBe(expected.id);
        }
      }
    }
  });
});

describe('computeWizardRequiredFields - 현재 재무상태 조건부 필수값', () => {
  const baseForm = () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.type = 'none';
    formData.expense.retirementLivingCost = 200;
    return formData;
  };

  it('급여 있음은 양수 월급을 요구하고, 배우자는 배우자 정보가 활성화된 때만 검사한다', () => {
    const formData = baseForm();
    formData.income.salary.hasSalary = true;
    expect(computeWizardRequiredFields(formData).missingIncomeFields.map(([path]) => path)).toContain('income.salary.monthly');
    formData.income.salary.monthly = 0;
    expect(computeWizardRequiredFields(formData).missingIncomeFields.map(([path]) => path)).toContain('income.salary.monthly');
    formData.income.salary.monthly = 450;
    expect(computeWizardRequiredFields(formData).missingIncomeFields.map(([path]) => path)).not.toContain('income.salary.monthly');

    formData.spouse.salary.hasSalary = true;
    expect(computeWizardRequiredFields(formData).missingIncomeFields.map(([path]) => path)).not.toContain('spouse.salary.monthly');
    formData.basic.hasSpouse = true;
    formData.spouse.birthYear = 1972;
    formData.spouse.retirementAge = 65;
    formData.spouse.lifeExpectancy = 90;
    formData.spouse.personalPension.type = 'none';
    expect(computeWizardRequiredFields(formData).missingIncomeFields.map(([path]) => path)).toContain('spouse.salary.monthly');
    formData.spouse.salary.monthly = 250;
    expect(computeWizardRequiredFields(formData).missingIncomeFields.map(([path]) => path)).not.toContain('spouse.salary.monthly');
  });

  it('현재 생활비는 공란을 거부하고 명시적 0을 허용하며, 상세입력은 저장된 금액 하나 이상을 요구한다', () => {
    const formData = baseForm();
    formData.assets.currentLivingCost.monthly = '';
    expect(computeWizardRequiredFields(formData).missingExpenseFields.map(([path]) => path)).toContain('assets.currentLivingCost.monthly');
    formData.assets.currentLivingCost.monthly = 0;
    expect(computeWizardRequiredFields(formData).missingExpenseFields.map(([path]) => path)).not.toContain('assets.currentLivingCost.monthly');
    formData.assets.currentLivingCost.inputMode = 'detailed';
    expect(computeWizardRequiredFields(formData).missingExpenseFields.map(([path]) => path)).toContain('assets.currentLivingCost.monthly');
    formData.assets.currentLivingCost.breakdown.food = 0;
    expect(computeWizardRequiredFields(formData).missingExpenseFields.map(([path]) => path)).not.toContain('assets.currentLivingCost.monthly');
  });

  it('보험 있음은 보험료 입력을 요구하되 명시적 0을 허용한다', () => {
    const formData = baseForm();
    formData.assets.insurance.hasInsurance = true;
    expect(computeWizardRequiredFields(formData).missingExpenseFields.map(([path]) => path)).toContain('assets.insurance.monthlyPremium');
    formData.assets.insurance.monthlyPremium = 0;
    expect(computeWizardRequiredFields(formData).missingExpenseFields.map(([path]) => path)).not.toContain('assets.insurance.monthlyPremium');
    formData.assets.insurance.hasInsurance = false;
    formData.assets.insurance.monthlyPremium = '';
    expect(computeWizardRequiredFields(formData).missingExpenseFields.map(([path]) => path)).not.toContain('assets.insurance.monthlyPremium');
  });

  it('저축 있음은 simple과 detailed 모두 실제 합계가 양수여야 한다', () => {
    const formData = baseForm();
    formData.assets.savingsPlan.hasSavings = true;
    for (const value of ['', 0]) {
      formData.assets.savingsPlan.monthly = value;
      expect(computeWizardRequiredFields(formData).missingSavingsFields).toHaveLength(1);
    }
    formData.assets.savingsPlan.monthly = 10;
    expect(computeWizardRequiredFields(formData).missingSavingsFields).toHaveLength(0);
    formData.assets.savingsPlan.inputMode = 'detailed';
    expect(computeWizardRequiredFields(formData).missingSavingsFields).toHaveLength(1);
    formData.assets.savingsPlan.breakdown.installment.monthly = 10;
    expect(computeWizardRequiredFields(formData).missingSavingsFields).toHaveLength(0);
  });

  it.each([
    ['liquidAssets', 'assets.liquidAssets.total', (data, value) => { data.assets.liquidAssets.breakdown.deposit = value; }],
    ['financialAssets', 'assets.financialAssets.total', (data, value) => { data.assets.financialAssets.stocks = value; }],
    ['pensionAssets', 'assets.pensionAssets', (data, value) => { data.assets.pensionAssetsBreakdown.irp = value; }],
    ['realEstateAssets', 'assets.realEstateAssets.total', (data, value) => { data.assets.realEstateAssets.mainProperty = value; }],
    ['otherAssets', 'assets.otherAssets.total', (data, value) => { data.assets.otherAssets.items = [{ name: '기타', amount: value }]; }],
  ])('%s 있음은 simple과 detailed 모두 양수 합계를 요구한다', (type, path, setDetail) => {
    const formData = baseForm();
    if (type === 'pensionAssets') {
      formData.assets.hasPensionAssets = true;
      formData.assets.pensionAssets = 0;
    } else {
      formData.assets[type].hasAssets = true;
      formData.assets[type].total = 0;
    }
    expect(computeWizardRequiredFields(formData).missingAssetFields.map(([fieldPath]) => fieldPath)).toContain(path);
    if (type === 'pensionAssets') {
      formData.assets.pensionAssets = 1;
      formData.assets.pensionAssetsInputMode = 'detailed';
    } else {
      formData.assets[type].total = 1;
      formData.assets[type].inputMode = 'detailed';
    }
    expect(computeWizardRequiredFields(formData).missingAssetFields.map(([fieldPath]) => fieldPath)).toContain(path);
    setDetail(formData, 1);
    expect(computeWizardRequiredFields(formData).missingAssetFields.map(([fieldPath]) => fieldPath)).not.toContain(path);
  });

  it('부채 있음은 양수 잔액과 입력된 월 부담을 요구하며 월 부담 0은 허용한다', () => {
    const formData = baseForm();
    formData.assets.debtStatus.hasDebt = true;
    expect(computeWizardRequiredFields(formData).missingDebtFields).toHaveLength(2);
    formData.assets.debtStatus.totalBalance = 100;
    expect(computeWizardRequiredFields(formData).missingDebtFields).toHaveLength(1);
    formData.assets.debtStatus.monthlyRepayment = 0;
    expect(computeWizardRequiredFields(formData).missingDebtFields).toHaveLength(0);

    formData.assets.debtStatus.inputMode = 'detailed';
    expect(computeWizardRequiredFields(formData).missingDebtFields).toHaveLength(2);
    formData.assets.debtStatus.breakdown.mortgage.principal = 100;
    formData.assets.debtStatus.breakdown.mortgage.monthlyInterest = 0;
    expect(computeWizardRequiredFields(formData).missingDebtFields).toHaveLength(0);
  });
});

describe('computeWizardRequiredFields - 반복·상세 행 완결성', () => {
  const baseForm = () => {
    const formData = structuredClone(initialFormData);
    fillBasicRequired(formData);
    formData.income.personalPension.type = 'none';
    formData.expense.retirementLivingCost = 200;
    return formData;
  };

  it.each([
    ['interestOnly', 'monthlyInterest'],
    ['equalPrincipal', 'monthlyRepayment'],
  ])('상세 대출(%s)은 원금과 선택 방식의 월 부담을 행 단위로 요구한다', (repaymentType, burdenKey) => {
    const formData = baseForm();
    formData.assets.debtStatus.hasDebt = true;
    formData.assets.debtStatus.inputMode = 'detailed';
    const mortgage = formData.assets.debtStatus.breakdown.mortgage;
    mortgage.repaymentType = repaymentType;

    expect(computeWizardRequiredFields(formData).missingDebtFields.map(([path]) => path))
      .not.toContain('assets.debtStatus.breakdown.mortgage.principal');
    mortgage.principal = 100;
    expect(computeWizardRequiredFields(formData).missingDebtFields.map(([path]) => path))
      .toContain(`assets.debtStatus.breakdown.mortgage.${burdenKey}`);
    mortgage[burdenKey] = 0;
    expect(computeWizardRequiredFields(formData).missingDebtFields).toHaveLength(0);
    mortgage[burdenKey] = 10;
    expect(computeWizardRequiredFields(formData).missingDebtFields).toHaveLength(0);
  });

  it('월 부담만 입력한 대출과 이름 없는 추가 대출을 거부한다', () => {
    const formData = baseForm();
    formData.assets.debtStatus.hasDebt = true;
    formData.assets.debtStatus.inputMode = 'detailed';
    formData.assets.debtStatus.breakdown.mortgage.monthlyInterest = 10;
    expect(computeWizardRequiredFields(formData).missingDebtFields.map(([path]) => path))
      .toContain('assets.debtStatus.breakdown.mortgage.principal');

    formData.assets.debtStatus.breakdown.mortgage = { repaymentType: 'interestOnly', principal: 100, monthlyInterest: 0 };
    formData.assets.debtStatus.customItems = [{ name: '', repaymentType: 'equalPrincipal', principal: 50, monthlyRepayment: 0, months: '' }];
    expect(computeWizardRequiredFields(formData).missingDebtFields.map(([path]) => path))
      .toContain('assets.debtStatus.customItems.0.name');
  });

  it.each([
    [{ name: '', annual: '', years: '' }, []],
    [{ name: '임대수입', annual: '', years: '' }, ['annual', 'years']],
    [{ name: '', annual: 1200, years: '' }, ['name', 'years']],
    [{ name: '', annual: '', years: 5 }, ['name', 'annual']],
    [{ name: '임대수입', annual: 1200, years: '' }, ['years']],
    [{ name: '임대수입', annual: 1200, years: 5 }, []],
  ])('기타 정기수입 행 %j의 완결성을 검사한다', (item, missingKeys) => {
    const formData = baseForm();
    formData.income.regularIncomes = [{ type: 'other', ...item }];
    const paths = computeWizardRequiredFields(formData).missingIncomeFields.map(([path]) => path);
    expect(paths.filter((path) => path.startsWith('income.regularIncomes.0.')))
      .toEqual(missingKeys.map((key) => `income.regularIncomes.0.${key}`));
  });

  it.each([
    [{ name: '', amount: '', expectedAge: '' }, []],
    [{ name: '차량 교체', amount: '', expectedAge: '' }, ['amount', 'expectedAge']],
    [{ name: '', amount: 1000, expectedAge: '' }, ['name', 'expectedAge']],
    [{ name: '', amount: '', expectedAge: 70 }, ['name', 'amount']],
    [{ name: '차량 교체', amount: 1000, expectedAge: '' }, ['expectedAge']],
    [{ name: '차량 교체', amount: 1000, expectedAge: 70 }, []],
  ])('목돈지출 행 %j의 완결성을 검사한다', (item, missingKeys) => {
    const formData = baseForm();
    formData.expense.retirementLumpSumExpenses = [item];
    const paths = computeWizardRequiredFields(formData).missingExpenseFields.map(([path]) => path);
    expect(paths.filter((path) => path.startsWith('expense.retirementLumpSumExpenses.0.')))
      .toEqual(missingKeys.map((key) => `expense.retirementLumpSumExpenses.0.${key}`));
  });
});
