import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookRuntime = { values: [], cursor: 0 };
const formRuntime = { formData: null, setField: vi.fn() };

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
  };
});

vi.mock('../../../state/formState', () => ({
  useFormData: () => formRuntime,
}));

import { getNumericInputUpdate } from './numericInputText.js';
import RemainingTermField from './RemainingTermField.jsx';

globalThis.React = React;

function renderMonthInput() {
  hookRuntime.values = [];
  hookRuntime.cursor = 0;
  const tree = RemainingTermField({ monthsPath: 'months', label: '기간' });
  const children = tree.props.children[1].props.children;
  const monthElement = children[2];
  hookRuntime.cursor = 0;
  return { element: monthElement, input: monthElement.type.render(monthElement.props, null).props.children[0] };
}

describe('RemainingTermField month maximum', () => {
  beforeEach(() => {
    formRuntime.formData = { months: 5 };
    formRuntime.setField.mockClear();
  });

  it('commits 11 months through the actual field handler and updates total months', () => {
    const { input } = renderMonthInput();

    input.props.onChange({ target: { value: '11' }, currentTarget: { value: '11' } });

    expect(formRuntime.setField).toHaveBeenCalledWith('months', 11);
  });

  it('rejects 12 months, keeps the existing total, and shows the maximum error', () => {
    const { element, input } = renderMonthInput();

    input.props.onChange({ target: { value: '12' }, currentTarget: { value: '12' } });
    hookRuntime.cursor = 0;
    const rerendered = element.type.render(element.props, null);

    expect(formRuntime.setField).not.toHaveBeenCalled();
    expect(rerendered.props.children[0].props.value).toBe('12');
    expect(rerendered.props.children[0].props['aria-invalid']).toBe(true);
    expect(rerendered.props.children[1].props.children).toContain('11 이하로 입력해 주세요.');
    expect(getNumericInputUpdate('12', { max: 11 })).toMatchObject({ shouldCommit: false, error: 'max' });
  });
});
