import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/supabaseClient', () => ({ supabase: {} }));

import { FormContext } from '../../../state/formState';
import { initialFormData } from '../../../state/initialFormData';
import Step4Assets from './Step4Assets';

globalThis.React = React;

describe('Step4Assets input mode selectors', () => {
  it('renders an independent total/detail selector for every asset category', () => {
    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData: structuredClone(initialFormData), setField: vi.fn() }}>
        <Step4Assets />
      </FormContext.Provider>
    );

    expect(html.match(/총액으로 한 번에 입력/g)).toHaveLength(5);
    expect(html.match(/항목별로 자세히 입력/g)).toHaveLength(5);
  });

  it('shows only the total input for a category in simple mode', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.otherAssets.inputMode = 'simple';
    formData.assets.otherAssets.total = 2000;
    formData.assets.otherAssets.simpleTotal = 2000;
    formData.assets.otherAssets.simpleInputStored = true;

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step4Assets />
      </FormContext.Provider>
    );

    expect(html).toContain('기타 자산 총액');
    expect(html).not.toContain('+ 기타 자산 추가');
  });

  it('does not render 0 as the initial value of an empty simple total input', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.otherAssets.inputMode = 'simple';
    formData.assets.otherAssets.total = '';
    formData.assets.otherAssets.simpleTotal = '';

    const html = renderToStaticMarkup(
      <FormContext.Provider value={{ formData, setField: vi.fn() }}>
        <Step4Assets />
      </FormContext.Provider>
    );

    const otherAssetsSection = html.slice(html.indexOf('기타 자산</h3>'));
    expect(otherAssetsSection).toContain('value=""');
  });
});
