import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Wizard.jsx가 Step1~7을 정적으로 import하고, 그중 DiagnosisAreaIcon.jsx는 모듈 최상위에서
// JSX를 평가한다(classic 런타임, globalThis.React 필요) - 정적 import는 이 대입문보다 먼저
// 링크·평가되므로, 동적 import로 미뤄서 globalThis.React가 설정된 뒤에 평가되게 한다.
globalThis.React = React;
vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }));

const { submitAfterDraftSave } = await import('./Wizard.jsx');

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
