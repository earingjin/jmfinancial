import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const hookRuntime = { values: [], cursor: 0 };
const formRuntime = { formData: null };

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
    useEffect: () => {},
  };
});

vi.mock('../../../state/formState', () => ({
  useFormData: () => ({
    formData: formRuntime.formData,
    setField: vi.fn(),
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

function renderOtherAmount(formData) {
  formRuntime.formData = formData;
  hookRuntime.values = [];
  hookRuntime.cursor = 0;
  const field = ExpenseBreakdownField({
    basePath: 'assets.currentLivingCost.breakdown',
    totalPath: 'assets.currentLivingCost.monthly',
    annualPath: 'assets.currentLivingCost.annual',
    modePath: 'assets.currentLivingCost.inputMode',
    simpleTotalPath: 'assets.currentLivingCost.simpleTotal',
    simpleAnnualPath: 'assets.currentLivingCost.simpleAnnual',
    simpleStoredPath: 'assets.currentLivingCost.simpleInputStored',
    categories,
  });
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
