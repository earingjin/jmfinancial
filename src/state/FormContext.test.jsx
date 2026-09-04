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
// Wizard.jsx가 Step1~7을 거쳐 DiagnosisAreaIcon.jsx(모듈 최상위에서 JSX를 평가하는 classic 런타임
// 컴포넌트)를 import한다 - 정적 import는 위 대입문보다 먼저 링크·평가되므로, 동적 import로 미뤄서
// globalThis.React가 설정된 뒤에 평가되게 한다(Wizard.test.js와 같은 이유).
const { default: Wizard } = await import('../components/wizard/Wizard');

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

// A14 회귀 테스트: editHistoryResult(App.jsx)처럼 initialDraft 객체는 있지만 updated_at이 없는
// 경우(저장된 결과를 위저드에 다시 불러온 것일 뿐, 아직 draft로 저장된 적은 없음)에도 status가
// 'saved'로 판정되어 배지("저장됨")와 문구("아직 저장되지 않았습니다")가 서로 모순되던 문제를
// 검증한다.
function DraftStateProbe() {
  const { draftState } = useFormData();
  return <div data-testid="draft-state">{JSON.stringify(draftState)}</div>;
}

function renderDraftState(initialDraft) {
  const html = renderToStaticMarkup(
    <FormProvider userId="user-1" initialDraft={initialDraft}>
      <DraftStateProbe />
    </FormProvider>
  );
  const match = html.match(/<div data-testid="draft-state">(.*?)<\/div>/);
  return JSON.parse(match[1].replace(/&quot;/g, '"'));
}

describe('FormProvider - draftState 초기값 (A14)', () => {
  it('새 진단 시작(initialDraft 없음) - idle, updatedAt null', () => {
    expect(renderDraftState(null)).toMatchObject({ status: 'idle', updatedAt: null });
  });

  it('실제 저장된 draft를 이어하기(updated_at 있음) - saved, updatedAt 그대로', () => {
    const draft = { step_index: 2, form_data: { basic: {} }, updated_at: '2026-08-20T00:00:00Z' };
    expect(renderDraftState(draft)).toMatchObject({ status: 'saved', updatedAt: '2026-08-20T00:00:00Z' });
  });

  it('결과 수정하기 재진입(updated_at: null) - status와 updatedAt이 모순 없이 idle로 일치한다', () => {
    // App.jsx의 editHistoryResult가 실제로 만드는 모양: { form_data: historyInput, step_index: null, updated_at: null }.
    const draft = { form_data: { basic: {} }, step_index: null, updated_at: null };
    const state = renderDraftState(draft);
    expect(state.status).toBe('idle'); // 'saved'가 아니다 - 실제로 저장된 draft가 아직 없음
    expect(state.updatedAt).toBeNull();
    // status==='saved'인데 updatedAt이 없는(또는 반대) 모순 조합이 아닌지 명시적으로 확인.
    expect(state.status === 'saved' ? state.updatedAt != null : state.updatedAt == null).toBe(true);
  });
});

// Wizard.jsx의 배지 클래스(is-saved)·안내 문구(아직 저장되지 않았습니다/마지막 저장: ...)는
// draftState만 보고 그대로 그리므로, 실제 화면 렌더링에서도 모순이 사라졌는지 통합 확인한다.
describe('Wizard 저장 상태 배지 - 결과 수정 재진입 시 모순 없음 (A14)', () => {
  function renderWizardWithDraft(initialDraft) {
    return renderToStaticMarkup(
      <FormProvider userId="user-1" initialDraft={initialDraft}>
        <Wizard onSubmit={() => {}} />
      </FormProvider>
    );
  }

  it('결과 수정하기 재진입 시 "저장됨" 배지 없이 "아직 저장되지 않았습니다"만 보인다', () => {
    const html = renderWizardWithDraft({ form_data: { basic: {} }, step_index: null, updated_at: null });
    const bannerStart = html.indexOf('wizard-draft-status');
    const bannerEnd = html.indexOf('</div>', bannerStart);
    const banner = html.slice(bannerStart, bannerEnd);
    expect(banner).not.toContain('is-saved');
    expect(banner).toContain('아직 저장되지 않았습니다');
  });

  it('실제로 저장된 draft를 이어할 때는 기존처럼 "저장됨" 배지와 마지막 저장 시각이 함께 보인다(회귀 방지)', () => {
    const html = renderWizardWithDraft({ form_data: { basic: {} }, step_index: 2, updated_at: '2026-08-20T09:00:00Z' });
    const bannerStart = html.indexOf('wizard-draft-status');
    const bannerEnd = html.indexOf('</div>', bannerStart);
    const banner = html.slice(bannerStart, bannerEnd);
    expect(banner).toContain('is-saved');
    expect(banner).toContain('마지막 저장:');
    expect(banner).not.toContain('아직 저장되지 않았습니다');
  });

  it('새 진단(초안 없음)은 기존처럼 "저장됨" 배지 없이 "아직 저장되지 않았습니다"를 보여준다(회귀 방지)', () => {
    const html = renderWizardWithDraft(null);
    const bannerStart = html.indexOf('wizard-draft-status');
    const bannerEnd = html.indexOf('</div>', bannerStart);
    const banner = html.slice(bannerStart, bannerEnd);
    expect(banner).not.toContain('is-saved');
    expect(banner).toContain('아직 저장되지 않았습니다');
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
