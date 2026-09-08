// verify-wizard-screens.mjs 전용. 프로덕션 진입점에서는 import하지 않는다.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FormProvider } from '../src/state/FormContext';
import { useFormData } from '../src/state/formState';
import { initialFormData } from '../src/state/initialFormData';
import { getIn } from '../src/state/pathUtils';
import { getWizardScreens } from '../src/state/wizardScreens';
import { fetchDraft } from '../src/state/draftStorage';
import { testStore } from '../src/lib/supabaseClient';
import { requestCalculation } from '../src/services/calculationApi';
import { completePlannerSubmission } from '../src/services/plannerSubmission';
import { deobfuscate } from '../src/utils/obfuscate';
import Wizard from '../src/components/wizard/Wizard';
import '../src/styles/app.css';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById('root'));
const messages = [];
let context;
let submitted;
let result;
let mountKey = 0;
// oxlint-disable-next-line react/only-export-components
function Probe() { context = useFormData(); return null; }
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const flush = async (fn = () => {}) => { await act(async () => { await fn(); }); };
function check(condition, message) { if (!condition) throw new Error(message); }
function equal(actual, expected, message) { check(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)}`); }
const visible = (node) => node && node.getClientRects().length > 0;
const allVisible = (selector) => [...document.querySelectorAll(selector)].filter(visible);
const title = () => document.querySelector('.wizard-substep-progress strong')?.textContent;
const button = (text) => allVisible('button').find((node) => node.textContent.trim() === text);
const click = async (node) => { check(visible(node), '클릭 대상이 표시되어야 함'); await flush(() => node.click()); };
const next = () => click(button('다음'));
const previous = () => click(button('이전'));
const area = (label) => click(allVisible('.wizard-progress-item').find((node) => node.textContent.endsWith(label)));
async function input(pathOrElement, value) {
  const element = typeof pathOrElement === 'string' ? document.getElementById(pathOrElement) : pathOrElement;
  check(visible(element) && !element.readOnly, `입력 가능 필드: ${pathOrElement}`);
  await flush(() => {
    element.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(value));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.blur();
  });
}
async function gotoIncome(id) {
  await area('수입');
  const screens = getWizardScreens('income', !!context.formData.basic.hasSpouse);
  const index = screens.findIndex((item) => item.id === id);
  check(index >= 0, `유효한 수입 화면 ${id}`);
  for (let i = 0; i < index; i++) await next();
  equal(title(), screens[index].label, '소화면 제목');
}
function seed(hasSpouse) {
  const data = structuredClone(initialFormData);
  Object.assign(data.basic, { birthYear: 1970, retirementAge: 65, lifeExpectancy: 90, serviceYears: 20, hasSpouse });
  Object.assign(data.spouse, { birthYear: 1972, retirementAge: 65, lifeExpectancy: 90 });
  for (const person of [data.income, ...(hasSpouse ? [data.spouse] : [])]) {
    Object.assign(person.salary, { monthly: 300, annual: 3600, annualBonus: 120 });
    Object.assign(person.severance, { type: 'pension', pensionStartAge: 65, pensionYears: 20, pensionMonths: 240, pensionMonthly: 40 });
    Object.assign(person.nationalPension, { inputMode: 'direct', monthly: 80, paymentMonths: 240, paymentYears: 20, months: 300 });
    Object.assign(person.personalPension, { type: 'installment', startAge: 65, monthly: 20, months: 240 });
  }
  data.assets.pensionAssetsInputMode = 'simple';
  data.assets.pensionAssets = 5000;
  data.assets.pensionAssetsSimpleTotal = 5000;
  data.assets.pensionAssetsSimpleInputStored = true;
  data.assets.pensionAssetsBreakdown.selfRetirementPension = 1000;
  data.assets.pensionAssetsBreakdown.spouseRetirementPension = hasSpouse ? 1000 : '';
  data.expense.retirementLivingCost = 300;
  return data;
}
async function calculate(data) {
  const response = await requestCalculation(data);
  const payload = await response.json();
  check(response.ok, `계산 API 실패: ${JSON.stringify(payload)}`);
  return deobfuscate(payload.payload);
}
async function mount(data, initialStep = 0, draft = null) {
  submitted = null;
  result = null;
  await flush(() => root.render(
    <FormProvider key={++mountKey} userId="local-test" initialDraft={draft || { form_data: data, step_index: initialStep }}>
      <Probe />
      <div className="app-main"><Wizard initialStep={initialStep} onSubmit={async (latest) => {
        submitted = structuredClone(latest);
        result = await calculate(latest);
        await completePlannerSubmission({ formData: latest, data: result, submissionId: 'local-test', resultSaved: false }, { id: 'local-test' });
      }} /></div>
    </FormProvider>
  ));
}
async function run() {
  for (const hasSpouse of [false, true]) {
    await mount(seed(hasSpouse));
    const keys = ['income', 'expense', 'savings', 'assets', 'debt', 'netWorth'];
    const labels = keys.flatMap((key) => getWizardScreens(key, hasSpouse).map((item) => item.label));
    check(button('이전').disabled, '첫 화면 이전 비활성화');
    const baseline = await calculate(context.formData);
    for (let i = 0; i < labels.length; i++) {
      equal(title(), labels[i], '전체 다음 이동 순서');
      check(allVisible('.step').length === 1, '활성 영역이 하나여야 함');
      if (i < labels.length - 1) await next();
    }
    check(visible(button('진단 결과 보기')), '최종 제출 버튼');
    for (let i = labels.length - 2; i >= 0; i--) { await previous(); equal(title(), labels[i], '전체 이전 이동 순서'); }
    const after = await calculate(context.formData);
    equal(after.aggregates, baseline.aggregates, '동일 입력 왕복 전후 서버 집계');
    equal(after.indicators, baseline.indicators, '동일 입력 왕복 전후 지표');
    messages.push(`배우자 ${hasSpouse ? '있음' : '없음'}: ${labels.length}개 화면 양방향 이동·계산 결과 유지`);
  }

  const edits = [
    ['severance-self', 'income.severance.pensionMonthly', 71],
    ['severance-spouse', 'spouse.severance.pensionMonthly', 73],
    ['national-self', 'income.nationalPension.monthly', 111],
    ['national-spouse', 'spouse.nationalPension.monthly', 113],
    ['personal-self', 'income.personalPension.monthly', 31],
    ['personal-spouse', 'spouse.personalPension.monthly', 33],
  ];
  for (const [id, path, value] of edits) {
    await gotoIncome(id);
    if (id.startsWith('severance')) {
      await click(button('퇴직연금을 모르시나요? 모의계산기 열기'));
      await click(button('확인'));
    }
    await input(path, value);
    await next(); await previous();
    equal(getIn(context.formData, path), value, '소화면 왕복 후 연금 수정값');
    if (id.startsWith('severance')) check(visible(button('수정')), '계산기 확인 상태 유지');
    await area('자산'); await gotoIncome(id);
    equal(getIn(context.formData, path), value, '영역 왕복 후 연금 수정값');
    if (id.startsWith('severance')) check(visible(button('수정')), '영역 왕복 후 계산기 확인 상태 유지');
  }
  messages.push('본인·배우자 6개 연금 수정값 및 퇴직연금 계산기 확인 상태 유지');

  await gotoIncome('severance-self');
  await input('assets.pensionAssetsBreakdown.selfRetirementPension', 1500);
  equal(context.formData.assets.pensionAssets, 5500, '퇴직연금 적립금 자산 연동');
  await area('자산'); await next(); await next();
  equal(Number(document.getElementById('assets.pensionAssetsBreakdown.selfRetirementPension').value.replaceAll(',', '')), 1500, '자산 화면 적립금');
  await gotoIncome('severance-self');
  equal(context.formData.assets.pensionAssets, 5500, '왕복 시 적립금 중복 합산 없음');

  await area('저축');
  await click(button('항목별로 자세히 입력'));
  await click(button('주식'));
  const accumulated = allVisible('label.field').find((node) => node.textContent.includes('현재까지 누적된 금액')).querySelector('input');
  await input(accumulated, 4321);
  await area('자산'); await next();
  equal(context.formData.assets.financialAssets.stocks, 4321, '저축 누적액 금융자산 연동');
  await area('저축');
  check(allVisible('input').some((node) => node.value === '4,321'), '왕복 후 저축 누적액 표시');
  messages.push('퇴직연금↔자산, 저축↔자산 연동·중복 합산 방지');

  await flush(() => context.saveCurrentDraft(2));
  const draft = await fetchDraft('local-test');
  check(!Object.hasOwn(draft, 'screenId'), '저장 스키마 확장 없음');
  await mount(null, draft.step_index, draft);
  for (const [, path, value] of edits) equal(getIn(context.formData, path), value, '임시저장 복원 연금 수정값');
  await area('순자산');
  await click(button('진단 결과 보기'));
  for (let i = 0; !result && i < 100; i++) await wait(50);
  check(result, '최종 제출 및 계산 완료');
  for (const [, path, value] of edits) {
    equal(getIn(submitted, path), value, '계산 API에 최신 연금 전달');
    equal(getIn(testStore.result.input_json, path), value, '최종 저장 입력 최신 값');
  }
  equal(result.aggregates.nationalPensionMonthly, 224, '서버 국민연금 수정 합계');
  equal(result.aggregates.severancePensionMonthly, 144, '서버 퇴직연금 수정 합계');
  equal(result.aggregates.personalPensionMonthly, 64, '서버 개인연금 수정 합계');
  equal(testStore.draft, null, '기존 제출 후 초안 삭제');
  messages.push('임시저장 복원 → 최종 제출 → 실제 계산 API → 결과 저장에 최신 연금액 반영');

  await mount(seed(true));
  // 소화면마다 새 차단 없이 수입 영역 마지막에서만 기존 필수 검사를 수행한다.
  await flush(() => context.setField('spouse.personalPension.startAge', ''));
  await gotoIncome('income-total');
  await next(); await wait(200);
  equal(title(), '배우자 개인연금', '필수 오류 배우자 화면');
  equal(document.activeElement.id, 'spouse.personalPension.startAge', '필수 오류 포커스');
  await input('spouse.personalPension.startAge', 65);
  await gotoIncome('severance-spouse');
  await flush(() => context.setField('basic.hasSpouse', false));
  equal(title(), '본인 퇴직금 · 퇴직연금', '비유효 배우자 화면 보정');
  await next(); equal(title(), '퇴직금 · 퇴직연금 합계 확인', '보정 후 다음');
  messages.push('기존 검사 시점·배우자 오류 포커스·조건 변경 시 화면 보정');

  await gotoIncome('basic-self');
  check(document.documentElement.scrollWidth <= window.innerWidth, '모바일 가로 넘침 없음');
  document.getElementById('verification').textContent = `PASS\n${messages.join('\n')}`;
}
run().catch((error) => { document.getElementById('verification').textContent = `FAIL\n${messages.join('\n')}\n${error.stack}`; });
