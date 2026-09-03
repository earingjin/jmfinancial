import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }));

import { FormProvider } from './FormContext';
import { useFormData } from './formState';
import { buildCanonicalInput } from '../../api/_lib/canonicalInput';
import { buildAggregates } from '../../api/_lib/aggregate';
import { calcIndicators } from '../../api/_lib/indicators';
import { initialFormData } from './initialFormData';
import { fetchDraft, upsertDraft } from './draftStorage';

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

describe('FormProvider - detailed debt draft restoration', () => {
  it('저장·조회한 모든 기본/추가 대출과 모드 보존값을 복원하고 계산 결과를 유지한다', async () => {
    const original = structuredClone(initialFormData);
    Object.assign(original.assets.debtStatus, {
      inputMode: 'detailed', totalBalance: 28000, monthlyRepayment: 280,
      simpleTotalBalance: 1234, simpleMonthlyRepayment: 12, simpleInputStored: true,
    });
    const keys = ['mortgage', 'depositLoan', 'businessLoan', 'buildingLoan', 'carLoan', 'studentLoan', 'otherLoan'];
    keys.forEach((key, index) => {
      original.assets.debtStatus.breakdown[key] = index % 2 === 0
        ? { repaymentType: 'interestOnly', principal: (index + 1) * 1000, monthlyInterest: index + 1, monthlyRepayment: 0, months: 120 - index }
        : { repaymentType: 'equalPrincipal', principal: (index + 1) * 1000, monthlyInterest: '', monthlyRepayment: (index + 1) * 10, months: 120 - index };
    });
    original.assets.debtStatus.customItems = [
      { name: '신용대출', repaymentType: 'interestOnly', principal: 8000, monthlyInterest: 8, monthlyRepayment: '', months: 24 },
      { name: '가족대출', repaymentType: 'equalPrincipal', principal: 0, monthlyInterest: '', monthlyRepayment: 0, months: '' },
    ];
    original.assets.liquidAssets.breakdown.deposit = 50000;

    let storedRow;
    const client = {
      from: () => ({
        upsert: (row) => ({ select: () => ({ single: async () => {
          storedRow = structuredClone({ ...row, updated_at: '2026-09-03T00:00:00Z' });
          return { data: storedRow, error: null };
        } }) }),
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: structuredClone(storedRow), error: null }) }) }),
      }),
    };
    await upsertDraft('debt-restore-user', original, 4, client);
    const fetched = await fetchDraft('debt-restore-user', client);
    expect(fetched.form_data.assets.debtStatus).toEqual(original.assets.debtStatus);

    let restored;
    function DebtProbe() {
      restored = useFormData().formData;
      return <div>{restored.assets.debtStatus.inputMode}</div>;
    }
    renderToStaticMarkup(
      <FormProvider userId="debt-restore-user" initialDraft={fetched}>
        <DebtProbe />
      </FormProvider>
    );

    expect(restored.assets.debtStatus.breakdown).toEqual(original.assets.debtStatus.breakdown);
    expect(restored.assets.debtStatus.customItems).toEqual(original.assets.debtStatus.customItems);
    expect(restored.assets.debtStatus).toMatchObject({
      inputMode: 'detailed', simpleTotalBalance: 1234, simpleMonthlyRepayment: 12, simpleInputStored: true,
    });

    const beforeCanonical = buildCanonicalInput(original);
    const afterCanonical = buildCanonicalInput(restored);
    const beforeAggregates = buildAggregates(beforeCanonical);
    const afterAggregates = buildAggregates(afterCanonical);
    expect(afterAggregates).toMatchObject({
      totalDebt: 36000,
      monthlyDebtRepayment: 144,
      netWorth: 14000,
    });
    expect(afterAggregates).toMatchObject({
      totalDebt: beforeAggregates.totalDebt,
      monthlyDebtRepayment: beforeAggregates.monthlyDebtRepayment,
      netWorth: beforeAggregates.netWorth,
    });
    const beforeDebtIndicators = calcIndicators(beforeCanonical).indicators.filter((item) => ['dsr', 'debtBurden'].includes(item.key));
    const afterDebtIndicators = calcIndicators(afterCanonical).indicators.filter((item) => ['dsr', 'debtBurden'].includes(item.key));
    expect(afterDebtIndicators).toEqual(beforeDebtIndicators);

    const restoredAgain = renderToStaticMarkup(
      <FormProvider userId="debt-restore-user" initialDraft={{ ...fetched, form_data: restored }}>
        <DebtProbe />
      </FormProvider>
    );
    expect(restoredAgain).toContain('detailed');
    expect(restored.assets.debtStatus.customItems).toHaveLength(2);
  });

  it('필드가 일부 없거나 빈 값·0인 기존 초안에는 누락 필드만 기본값을 채운다', () => {
    const rawDraft = {
      step_index: 4,
      form_data: {
        basic: {}, income: {}, spouse: {}, expense: {},
        assets: {
          debtStatus: {
            inputMode: 'simple', totalBalance: 0, monthlyRepayment: '',
            breakdown: { mortgage: { repaymentType: 'interestOnly', principal: 0, monthlyInterest: '', months: 120 } },
            customItems: [],
          },
        },
      },
    };
    let restored;
    function LegacyDebtProbe() {
      restored = useFormData().formData;
      return null;
    }
    renderToStaticMarkup(<FormProvider userId="legacy-user" initialDraft={rawDraft}><LegacyDebtProbe /></FormProvider>);
    expect(restored.assets.debtStatus.totalBalance).toBe(0);
    expect(restored.assets.debtStatus.monthlyRepayment).toBe('');
    expect(restored.assets.debtStatus.breakdown.mortgage).toEqual({
      repaymentType: 'interestOnly', principal: 0, monthlyInterest: '', monthlyRepayment: '', months: 120,
    });
    expect(restored.assets.debtStatus.simpleInputStored).toBe(false);
  });
});
