import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));

import { FormProvider } from './FormContext';
import { useFormData } from './formState';

globalThis.React = React;

function VersionProbe() {
  const { formData } = useFormData();
  return <div data-testid="version">{String(formData.assets.savingsPlan.retirementSavingsInputVersion)}</div>;
}

function renderVersion(initialDraft) {
  return renderToStaticMarkup(
    <FormProvider userId="user-1" initialDraft={initialDraft}>
      <VersionProbe />
    </FormProvider>
  );
}

// FormContext.jsx가 실제로 mergeDraft 이전 원본 저장 데이터만 보고 버전을 판정하는지 컴포넌트
// 레벨에서 검증한다(resolveRetirementSavingsInputVersion 단위 테스트는 draftStorage.test.js에
// 이미 있지만, 여기서는 FormProvider가 그 결과를 실제로 formData에 반영하는지까지 확인한다).
describe('FormProvider - retirementSavingsInputVersion 병합 전 판정(코드리뷰 후속)', () => {
  it('Case A: 버전 필드가 없는 기존 raw draft를 복원해도 merge 이후에 v1으로 유지된다', () => {
    const rawDraft = {
      user_id: 'user-1',
      step_index: 2,
      form_data: {
        basic: {}, income: {}, spouse: {}, expense: {},
        assets: { savingsPlan: { monthly: 100, retirementMonthly: 30 } },
      },
      updated_at: null,
    };
    expect(renderVersion(rawDraft)).toContain('>1<');
  });

  it('저장된 초안이 없으면(새 진단) v2로 초기화된다', () => {
    expect(renderVersion(null)).toContain('>2<');
  });

  it('저장된 초안에 버전 필드가 명시적으로 2면(작성 중이던 v2) v2로 유지된다', () => {
    const rawDraft = {
      user_id: 'user-1',
      step_index: 1,
      form_data: {
        basic: {}, income: {}, spouse: {}, expense: {},
        assets: { savingsPlan: { retirementSavingsInputVersion: 2, additionalRetirementMonthly: 10 } },
      },
      updated_at: null,
    };
    expect(renderVersion(rawDraft)).toContain('>2<');
  });
});
