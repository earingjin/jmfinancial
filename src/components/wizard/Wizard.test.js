import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getWizardScreens, resolveWizardScreenIndex } from '../../state/wizardScreens';

// Wizard.jsx가 Step1~7을 정적으로 import하고, 그중 DiagnosisAreaIcon.jsx는 모듈 최상위에서
// JSX를 평가한다(classic 런타임, globalThis.React 필요) - 정적 import는 이 대입문보다 먼저
// 링크·평가되므로, 동적 import로 미뤄서 globalThis.React가 설정된 뒤에 평가되게 한다.
globalThis.React = React;
vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }));

const { getNextWizardPosition, getPreviousWizardPosition, getRequiredFieldSubStep, submitAfterDraftSave } = await import('./Wizard.jsx');

describe('Wizard sub-step navigation', () => {
  const keys = ['income', 'expense', 'savings', 'assets', 'debt', 'netWorth'];
  const counts = keys.map((key) => getWizardScreens(key, false).length);

  it('첫 sub-step의 이전은 전체 첫 화면에 그대로 머문다', () => {
    expect(getPreviousWizardPosition(0, 0, counts)).toEqual({ stepIndex: 0, subStepIndex: 0, stepChanged: false });
  });

  it('같은 대단계 안에서 다음과 이전으로 이동한다', () => {
    expect(getNextWizardPosition(0, 2, counts)).toEqual({ stepIndex: 0, subStepIndex: 3, stepChanged: false });
    expect(getPreviousWizardPosition(0, 2, counts)).toEqual({ stepIndex: 0, subStepIndex: 1, stepChanged: false });
  });

  it('마지막 sub-step의 다음은 다음 대단계 첫 sub-step으로 이동한다', () => {
    expect(getNextWizardPosition(0, counts[0] - 1, counts)).toEqual({ stepIndex: 1, subStepIndex: 0, stepChanged: true });
  });

  it('대단계 첫 sub-step의 이전은 이전 대단계 마지막 sub-step으로 이동한다', () => {
    expect(getPreviousWizardPosition(1, 0, counts)).toEqual({ stepIndex: 0, subStepIndex: counts[0] - 1, stepChanged: true });
  });

  it('마지막 화면의 다음은 마지막 화면에 그대로 머문다', () => {
    expect(getNextWizardPosition(5, 0, counts)).toEqual({ stepIndex: 5, subStepIndex: 0, stepChanged: false });
  });

  it('숨겨진 필수 필드가 있는 sub-step을 찾아 기존 포커스 검증을 이어간다', () => {
    expect(getRequiredFieldSubStep('income', 'basic.birthYear')).toBe(0);
    expect(getRequiredFieldSubStep('income', 'basic.serviceYears')).toBe(1);
    expect(getRequiredFieldSubStep('income', 'income.severance.pensionStartAge')).toBe(5);
    expect(getRequiredFieldSubStep('income', 'spouse.nationalPension.expectedAdditionalContributionMonths', true)).toBe(10);
    expect(getRequiredFieldSubStep('income', 'income.personalPension.startAge')).toBe(9);
    expect(getRequiredFieldSubStep('expense', 'expense.retirementLivingCost')).toBe(1);
    expect(getRequiredFieldSubStep('expense', 'expense.retirementLumpSumExpenses.0.name')).toBe(2);
  });
});

describe.each([false, true])('소화면 전체 경로 (배우자: %s)', (hasSpouse) => {
  const keys = ['income', 'expense', 'savings', 'assets', 'debt', 'netWorth'];
  const screens = keys.map((key) => getWizardScreens(key, hasSpouse));
  const counts = screens.map((items) => items.length);

  it('본인/배우자/합계 순서와 항상 접근 가능한 배우자 선택 화면을 유지한다', () => {
    expect(screens[0].map(({ id }) => id)).toEqual([
      'basic-self', 'basic-work', 'basic-spouse', 'salary-self', ...(hasSpouse ? ['salary-spouse'] : []), 'salary-total',
      'severance-self', ...(hasSpouse ? ['severance-spouse'] : []), 'severance-total',
      'national-self', ...(hasSpouse ? ['national-spouse'] : []), 'national-total',
      'personal-self', ...(hasSpouse ? ['personal-spouse'] : []), 'personal-total', 'regular', 'income-total',
    ]);
    expect(counts).toEqual([hasSpouse ? 17 : 13, 6, 2, 6, 1, 1]);
  });

  it('모든 다음/이전 이동은 정확히 반대이며 영역 경계에서 누락이 없다', () => {
    const positions = screens.flatMap((items, stepIndex) => items.map((_, subStepIndex) => ({ stepIndex, subStepIndex })));
    positions.slice(0, -1).forEach((position, index) => {
      const next = getNextWizardPosition(position.stepIndex, position.subStepIndex, counts);
      expect(next).toMatchObject(positions[index + 1]);
      expect(getPreviousWizardPosition(next.stepIndex, next.subStepIndex, counts)).toMatchObject(position);
    });
  });

  it('연금 필수항목과 적립금 오류는 각 소유자의 입력 화면으로 이동한다', () => {
    for (const [path, id] of [
      ['basic.serviceYears', 'basic-work'], ['spouse.birthYear', 'basic-spouse'],
      ['income.severance.lumpsumAge', 'severance-self'],
      ['assets.pensionAssetsBreakdown.selfRetirementPension', 'severance-self'],
      ['income.personalPension.startAge', 'personal-self'],
      ['income.nationalPension.expectedAdditionalContributionMonths', 'national-self'],
      ...(hasSpouse ? [
        ['spouse.severance.pensionStartAge', 'severance-spouse'],
        ['assets.pensionAssetsBreakdown.spouseRetirementPension', 'severance-spouse'],
        ['spouse.personalPension.startAge', 'personal-spouse'],
        ['spouse.nationalPension.expectedAdditionalContributionMonths', 'national-spouse'],
      ] : []),
    ]) {
      expect(screens[0][getRequiredFieldSubStep('income', path, hasSpouse)].id).toBe(id);
    }
  });
});

it('배우자 제외 시 해당 묶음 본인 화면으로 보정하고 기존 합계 화면은 유지한다', () => {
  const screens = getWizardScreens('income', false);
  for (const group of ['salary', 'severance', 'national', 'personal']) {
    expect(screens[resolveWizardScreenIndex('income', `${group}-spouse`, false)].id).toBe(`${group}-self`);
    expect(screens[resolveWizardScreenIndex('income', `${group}-total`, false)].id).toBe(`${group}-total`);
  }
  expect(resolveWizardScreenIndex('income', null)).toBe(0);
  expect(resolveWizardScreenIndex('income', 'unknown')).toBe(0);
});

// A5 회귀 테스트: 위저드 최종 제출은 임시 저장(draft) 성공 여부와 무관하게 계산 제출(onSubmit)로
// 이어져야 한다. completePlannerSubmission(plannerSubmission.js)이 formData를 그대로 쓰고 서버
// draft를 다시 읽지 않으므로, 임시 저장은 최종 제출의 필수 선행조건이 아니다 - 실패해도 흡수하고
// 계산은 계속 진행해야 사용자가 버튼을 눌렀을 때 아무 반응이 없는 것처럼 보이지 않는다.
describe('submitAfterDraftSave (A5)', () => {
  const formData = { basic: { birthYear: 1970 } };

  it('draft 저장 성공 시 onSubmit이 formData와 함께 호출된다', async () => {
    const saveCurrentDraft = vi.fn().mockResolvedValue({ skipped: false });
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    await submitAfterDraftSave(saveCurrentDraft, 3, onSubmit, formData);

    expect(saveCurrentDraft).toHaveBeenCalledWith(3);
    expect(onSubmit).toHaveBeenCalledWith(formData);
  });

  it('draft 저장이 실패해도 onSubmit은 계속 호출되어 제출이 멈추지 않는다', async () => {
    const saveCurrentDraft = vi.fn().mockRejectedValue(new Error('네트워크 오류'));
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    await expect(submitAfterDraftSave(saveCurrentDraft, 5, onSubmit, formData)).resolves.toBeUndefined();

    expect(onSubmit).toHaveBeenCalledWith(formData);
  });

  it('draft 저장 실패 후 계산 API(onSubmit)가 성공하면 정상적으로 완료된다', async () => {
    const saveCurrentDraft = vi.fn().mockRejectedValue(new Error('임시 저장 실패'));
    const onSubmit = vi.fn().mockResolvedValue('ok');

    await expect(submitAfterDraftSave(saveCurrentDraft, 0, onSubmit, formData)).resolves.toBeUndefined();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('onSubmit(계산 API) 자체의 실패는 흡수하지 않고 그대로 전달한다(App.jsx가 자체적으로 처리)', async () => {
    const saveCurrentDraft = vi.fn().mockResolvedValue({ skipped: false });
    const calcError = new Error('계산에 실패했습니다.');
    const onSubmit = vi.fn().mockRejectedValue(calcError);

    await expect(submitAfterDraftSave(saveCurrentDraft, 2, onSubmit, formData)).rejects.toBe(calcError);
  });
});
