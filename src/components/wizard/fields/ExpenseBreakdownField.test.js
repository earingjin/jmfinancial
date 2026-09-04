import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const hookRuntime = { values: [], cursor: 0 };
const formRuntime = { formData: null, setField: null };

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: (initial) => {
      const index = hookRuntime.cursor++;
      if (!(index in hookRuntime.values)) hookRuntime.values[index] = typeof initial === 'function' ? initial() : initial;
      return [hookRuntime.values[index], (next) => {
        hookRuntime.values[index] = typeof next === 'function' ? next(hookRuntime.values[index]) : next;
      }];
    },
    // 실제 렌더 사이클을 흉내내기 위해 effect를 컴포넌트 함수 호출 시점에 동기 실행한다.
    useEffect: (effect) => { effect(); },
  };
});

vi.mock('../../../state/formState', () => ({
  useFormData: () => ({
    formData: formRuntime.formData,
    setField: formRuntime.setField,
    updateListItem: (path, index, key, value) => {
      const list = formRuntime.formData.assets.currentLivingCost.breakdown.otherItems;
      list[index] = { ...list[index], [key]: value };
    },
  }),
}));

import ExpenseBreakdownField from './ExpenseBreakdownField.jsx';
import FormattedNumberInput from './FormattedNumberInput.jsx';
import { livingDetailedTotal } from './inputModeTransitions.js';

globalThis.React = React;

const categories = [{ key: 'other', label: '기타' }];

function find(node, predicate) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}

const FIELD_PATHS = {
  basePath: 'assets.currentLivingCost.breakdown',
  totalPath: 'assets.currentLivingCost.monthly',
  annualPath: 'assets.currentLivingCost.annual',
  modePath: 'assets.currentLivingCost.inputMode',
  simpleTotalPath: 'assets.currentLivingCost.simpleTotal',
  simpleAnnualPath: 'assets.currentLivingCost.simpleAnnual',
  simpleStoredPath: 'assets.currentLivingCost.simpleInputStored',
};

// 컴포넌트를 한 번 "렌더"(함수 호출)하고, 그 과정에서 effect들이 호출한 setField를 돌려준다.
function renderField(formData) {
  formRuntime.formData = formData;
  formRuntime.setField = vi.fn();
  hookRuntime.values = [];
  hookRuntime.cursor = 0;
  ExpenseBreakdownField({ ...FIELD_PATHS, categories });
  return formRuntime.setField;
}

function renderOtherAmount(formData) {
  formRuntime.formData = formData;
  formRuntime.setField = vi.fn();
  hookRuntime.values = [];
  hookRuntime.cursor = 0;
  const field = ExpenseBreakdownField({ ...FIELD_PATHS, categories });
  const list = find(field, (node) => node?.type?.name === 'RepeatableList');
  const listTree = list.type(list.props);
  const numberInput = find(listTree, (node) => node?.type === FormattedNumberInput);
  hookRuntime.cursor = 0;
  return numberInput.type.render(numberInput.props, null).props.children[0];
}

describe('ExpenseBreakdownField other expense amount', () => {
  it('stores a cleared amount as blank through the RepeatableList update handler', () => {
    const formData = {
      assets: { currentLivingCost: { inputMode: 'detailed', monthly: 0, annual: 0, breakdown: { other: 100, otherItems: [{ name: '기타', amount: 100 }] } } },
    };
    const input = renderOtherAmount(formData);

    input.props.onChange({ target: { value: '' }, currentTarget: { value: '' } });

    expect(formData.assets.currentLivingCost.breakdown.otherItems[0].amount).toBe('');
    expect(livingDetailedTotal(formData, 'assets.currentLivingCost.breakdown', categories)).toBe(0);
  });

  it('stores an explicit zero as number zero and keeps the same zero total', () => {
    const formData = {
      assets: { currentLivingCost: { inputMode: 'detailed', monthly: 0, annual: 0, breakdown: { other: 100, otherItems: [{ name: '기타', amount: 100 }] } } },
    };
    const input = renderOtherAmount(formData);

    input.props.onChange({ target: { value: '0' }, currentTarget: { value: '0' } });

    expect(formData.assets.currentLivingCost.breakdown.otherItems[0].amount).toBe(0);
    expect(livingDetailedTotal(formData, 'assets.currentLivingCost.breakdown', categories)).toBe(0);
  });
});

// 회귀 테스트: '기타지출' 세부항목 합계 동기화 effect가 simple(총액) 모드에서도 동작해
// 사용자가 입력한 총액을 조용히 덮어쓰던 문제(모드 가드 누락)를 검증한다.
describe('ExpenseBreakdownField other expense total respects input mode', () => {
  it('detailed 모드에서는 기타지출 세부항목 합계가 총액에 반영된다', () => {
    const formData = {
      assets: {
        currentLivingCost: {
          inputMode: 'detailed',
          monthly: 0,
          annual: 0,
          breakdown: { other: 0, otherItems: [{ name: '기타', amount: 120 }] },
        },
      },
    };

    const setField = renderField(formData);

    expect(setField).toHaveBeenCalledWith('assets.currentLivingCost.breakdown.other', 120);
    expect(setField).toHaveBeenCalledWith('assets.currentLivingCost.monthly', 120);
  });

  it('simple 모드에서는 기타지출 세부항목 합계가 있어도 사용자가 입력한 총액을 덮어쓰지 않는다', () => {
    const formData = {
      assets: {
        currentLivingCost: {
          inputMode: 'simple',
          monthly: 300,
          annual: 3600,
          simpleTotal: 300,
          simpleAnnual: 3600,
          simpleInputStored: true,
          breakdown: { other: 0, otherItems: [{ name: '기타', amount: 120 }] },
        },
      },
    };

    const setField = renderField(formData);

    expect(setField).not.toHaveBeenCalled();
    expect(formData.assets.currentLivingCost.monthly).toBe(300);
  });

  it('simple → detailed → simple로 모드를 오가도 각 모드의 규칙이 유지된다', () => {
    const formData = {
      assets: {
        currentLivingCost: {
          inputMode: 'simple',
          monthly: 500,
          annual: 6000,
          simpleTotal: 500,
          simpleAnnual: 6000,
          simpleInputStored: true,
          breakdown: { other: 0, otherItems: [{ name: '기타', amount: 80 }] },
        },
      },
    };

    expect(renderField(formData)).not.toHaveBeenCalled();
    expect(formData.assets.currentLivingCost.monthly).toBe(500);

    formData.assets.currentLivingCost.inputMode = 'detailed';
    const detailedSetField = renderField(formData);
    expect(detailedSetField).toHaveBeenCalledWith('assets.currentLivingCost.monthly', 80);

    formData.assets.currentLivingCost.inputMode = 'simple';
    formData.assets.currentLivingCost.monthly = 500;
    expect(renderField(formData)).not.toHaveBeenCalled();
    expect(formData.assets.currentLivingCost.monthly).toBe(500);
  });
});
