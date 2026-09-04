import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hookRuntime = { values: [], cursor: 0 };

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

import { formatNumericText, getNumericInputUpdate, normalizeNumericText } from './numericInputText.js';
import FormattedNumberInput from './FormattedNumberInput.jsx';

globalThis.React = React;

function renderInput(props) {
  hookRuntime.cursor = 0;
  const tree = FormattedNumberInput.render(props, null);
  return { tree, input: tree.props.children[0], helper: tree.props.children[1] };
}

function changeInput(props, value) {
  const rendered = renderInput(props);
  rendered.input.props.onChange({
    target: { value },
    currentTarget: { value },
  });
  return rendered;
}

beforeEach(() => {
  hookRuntime.values = [];
  hookRuntime.cursor = 0;
});

describe('FormattedNumberInput decimal editing', () => {
  it('preserves a trailing decimal point while the user is still typing', () => {
    expect(normalizeNumericText('2.')).toBe('2.');
    expect(formatNumericText('2.')).toBe('2.');
  });

  it('accepts a decimal amount such as 2.5만원', () => {
    expect(normalizeNumericText('2.5')).toBe('2.5');
    expect(formatNumericText('2.5')).toBe('2.5');
  });

  it('normalizes complete integer-only values without accepting decimal text', () => {
    expect(normalizeNumericText('24', { integerOnly: true })).toBe('24');
  });

  it('keeps grouping separators without losing the decimal part', () => {
    expect(formatNumericText('12345.6')).toBe('12,345.6');
  });

  it('keeps valid negative decimal text for fields that allow negatives', () => {
    expect(getNumericInputUpdate('-2.5', { allowsNegative: true })).toEqual({
      shouldCommit: true,
      value: '-2.5',
    });
  });

  it('keeps an empty value as a valid clear action', () => {
    expect(getNumericInputUpdate('')).toEqual({ shouldCommit: true, value: '' });
  });

  it('does not turn a disallowed negative number into a positive form value', () => {
    const update = getNumericInputUpdate('-100', { allowsNegative: false });

    expect(update).toEqual({ shouldCommit: false, error: 'negative' });
    expect(normalizeNumericText('-100', { allowsNegative: false })).toBe('-100');
  });

  it.each(['1O0', '12a3'])('does not strip invalid text %s into a form value', (input) => {
    const update = getNumericInputUpdate(input);

    expect(update).toEqual({ shouldCommit: false, error: 'numeric' });
    expect(normalizeNumericText(input)).toBe(input);
  });

  it.each([
    ['-100', { allowsNegative: false }],
    ['1O0', {}],
    ['12a3', {}],
  ])('keeps the existing form value when %s is invalid', (input, options) => {
    const formData = { amount: 250 };
    const update = getNumericInputUpdate(input, options);

    if (update.shouldCommit) formData.amount = Number(update.value);

    expect(formData.amount).toBe(250);
  });

  it('continues to reject decimal text for integer-only fields without a form update', () => {
    expect(getNumericInputUpdate('24.5', { integerOnly: true })).toEqual({
      shouldCommit: false,
      error: 'integer',
    });
  });

  it('commits a value at the configured maximum', () => {
    expect(getNumericInputUpdate('11', { max: 11 })).toEqual({
      shouldCommit: true,
      value: '11',
    });
  });

  it('rejects a value above the configured maximum and reports the limit', () => {
    expect(getNumericInputUpdate('12', { max: 11 })).toEqual({
      shouldCommit: false,
      error: 'max',
      max: 11,
    });
  });

  it('keeps the existing form value when the configured maximum is exceeded', () => {
    const formData = { months: 5 };
    const update = getNumericInputUpdate('12', { max: 11 });

    if (update.shouldCommit) formData.months = Number(update.value);

    expect(formData.months).toBe(5);
  });

  it('applies RemainingTermField month boundaries without changing integer validation', () => {
    expect(getNumericInputUpdate('11', { max: 11 })).toMatchObject({ shouldCommit: true });
    expect(getNumericInputUpdate('12', { max: 11 })).toMatchObject({ shouldCommit: false, error: 'max' });
    expect(getNumericInputUpdate('10.5', { integerOnly: true, max: 11 })).toMatchObject({ shouldCommit: false, error: 'integer' });
  });

  it('commits an in-range value through the actual input handler', () => {
    const onChange = vi.fn();

    changeInput({ value: '', max: 11, onChange }, '11');

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].target.value).toBe('11');
  });

  it('keeps an over-limit value visible while preserving form state and showing an error', () => {
    const onChange = vi.fn();
    changeInput({ value: '10', max: 11, onChange }, '12');
    const rendered = renderInput({ value: '10', max: 11, onChange });

    expect(onChange).not.toHaveBeenCalled();
    expect(rendered.input.props.value).toBe('12');
    expect(rendered.input.props['aria-invalid']).toBe(true);
    expect(rendered.helper.props.children).toContain('11 이하로 입력해 주세요.');
  });

  it('clears the over-limit error after a valid value is entered', () => {
    const onChange = vi.fn();
    changeInput({ value: '10', max: 11, onChange }, '12');
    changeInput({ value: '10', max: 11, onChange }, '11');
    const rendered = renderInput({ value: '10', max: 11, onChange });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].target.value).toBe('11');
    expect(rendered.input.props['aria-invalid']).toBeUndefined();
    expect(rendered.helper).toBeFalsy();
  });
});
