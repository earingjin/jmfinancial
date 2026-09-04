import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildCanonicalInput } from '../../../../api/_lib/canonicalInput';
import { buildAggregates } from '../../../../api/_lib/aggregate';
import { FormContext } from '../../../state/formState';
import { initialFormData } from '../../../state/initialFormData';
import Step6NetWorth from './Step6NetWorth';

globalThis.React = React;

function makeFormData({ bonds = 0, otherAssets = 0, debt = 0 } = {}) {
  const formData = structuredClone(initialFormData);
  formData.assets.liquidAssets.inputMode = 'detailed';
  formData.assets.financialAssets.inputMode = 'detailed';
  formData.assets.pensionAssetsInputMode = 'detailed';
  formData.assets.realEstateAssets.inputMode = 'detailed';
  formData.assets.otherAssets.inputMode = 'detailed';
  formData.assets.financialAssets.bonds = bonds;
  formData.assets.otherAssets.items = otherAssets ? [{ name: '차량', amount: otherAssets }] : [];
  formData.assets.otherAssets.total = otherAssets;
  formData.assets.debtStatus.totalBalance = debt;
  return formData;
}

function renderAmounts(formData) {
  const html = renderToStaticMarkup(
    <FormContext.Provider value={{ formData }}>
      <Step6NetWorth />
    </FormContext.Provider>
  );
  const amountFor = (label) => {
    const match = html.match(new RegExp(`<td>${label}</td><td[^>]*>([^<]+)</td>`));
    return match?.[1];
  };
  return {
    totalAssets: amountFor('총자산'),
    totalDebt: amountFor('총부채'),
    netWorth: amountFor('현재 순자산'),
  };
}

function serverAmounts(formData) {
  const aggregate = buildAggregates(buildCanonicalInput(formData));
  return {
    totalAssets: aggregate.totalAssets,
    totalDebt: aggregate.totalDebt,
    netWorth: aggregate.netWorth,
  };
}

describe('Step6NetWorth asset coverage', () => {
  it.each([
    ['채권만 보유', { bonds: 1000 }, { totalAssets: '1,000만원', totalDebt: '0만원', netWorth: '1,000만원' }],
    ['기타자산만 보유', { otherAssets: 2000 }, { totalAssets: '2,000만원', totalDebt: '0만원', netWorth: '2,000만원' }],
    ['채권과 기타자산 보유', { bonds: 1000, otherAssets: 2000 }, { totalAssets: '3,000만원', totalDebt: '0만원', netWorth: '3,000만원' }],
    ['부채 포함', { bonds: 1000, otherAssets: 2000, debt: 500 }, { totalAssets: '3,000만원', totalDebt: '500만원', netWorth: '2,500만원' }],
    ['부채가 자산보다 많음', { bonds: 1000, otherAssets: 2000, debt: 4000 }, { totalAssets: '3,000만원', totalDebt: '4,000만원', netWorth: '-1,000만원' }],
  ])('%s일 때 화면과 서버 결과가 일치한다', (_name, input, displayed) => {
    const formData = makeFormData(input);
    const bonds = input.bonds || 0;
    const otherAssets = input.otherAssets || 0;
    const debt = input.debt || 0;
    expect(renderAmounts(formData)).toEqual(displayed);
    expect(serverAmounts(formData)).toEqual({
      totalAssets: bonds + otherAssets,
      totalDebt: debt,
      netWorth: bonds + otherAssets - debt,
    });
  });

  it('모든 자산 분류를 중복 없이 합산해 서버 결과와 일치시킨다', () => {
    const formData = makeFormData({ bonds: 400, otherAssets: 800, debt: 900 });
    formData.assets.liquidAssets.breakdown.deposit = 100;
    formData.assets.liquidAssets.total = 100;
    Object.assign(formData.assets.financialAssets, { stocks: 200, funds: 300, other: 500 });
    formData.assets.financialAssets.otherItems = [{ name: '금', amount: 500 }];
    formData.assets.pensionAssetsBreakdown.variableAnnuity = 600;
    formData.assets.pensionAssets = 600;
    formData.assets.realEstateAssets.mainProperty = 700;
    formData.assets.realEstateAssets.total = 700;

    expect(renderAmounts(formData)).toEqual({ totalAssets: '3,600만원', totalDebt: '900만원', netWorth: '2,700만원' });
    expect(serverAmounts(formData)).toEqual({ totalAssets: 3600, totalDebt: 900, netWorth: 2700 });
  });

  it('4단계에서 합계가 수정되거나 삭제된 뒤 재진입하면 최신 값을 표시한다', () => {
    const formData = makeFormData({ bonds: 1000, otherAssets: 2000 });
    expect(renderAmounts(formData).totalAssets).toBe('3,000만원');

    formData.assets.financialAssets.bonds = 250;
    formData.assets.otherAssets.items = [];
    formData.assets.otherAssets.total = 0;

    expect(renderAmounts(formData)).toEqual({ totalAssets: '250만원', totalDebt: '0만원', netWorth: '250만원' });
    expect(serverAmounts(formData)).toEqual({ totalAssets: 250, totalDebt: 0, netWorth: 250 });
  });
});
