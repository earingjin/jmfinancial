import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialFormData } from '../../../state/initialFormData';
import { FormContext } from '../../../state/formState';
import CategoryBreakdownField, { getSavingsAssetConnectionLabel } from './CategoryBreakdownField';
import { createLinkedAssetId } from './linkedAssetId';

globalThis.React = React;

describe('현금성 추가 자산 연결 식별', () => {
  it('충돌 방지를 위해 브라우저 UUID 생성기를 그대로 사용한다', () => {
    const crypto = { randomUUID: () => '00000000-0000-4000-8000-000000000001' };
    expect(createLinkedAssetId(crypto)).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('ID 연결 자산과 안전한 기존 이름 연결을 구분한다', () => {
    const formData = structuredClone(initialFormData);
    formData.assets.liquidAssets.customItems = [
      { id: 'asset-a', name: '여행 자금', amount: 60 },
      { name: '비상 자금', amount: 30 },
    ];
    formData.assets.savingsPlan.customItems = [
      { name: '여행 적금', linkedAssetId: 'asset-a', assetConnection: 'linked' },
      { name: '비상 자금' },
    ];
    expect(getSavingsAssetConnectionLabel(formData, formData.assets.liquidAssets.customItems[0]))
      .toBe('추가 저축과 연결됨');
    expect(getSavingsAssetConnectionLabel(formData, formData.assets.liquidAssets.customItems[1]))
      .toBe('추가 저축과 이름 기반 연결');
  });

  it('자산 화면에 연결 상태를 읽기 전용으로 표시한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.assets.liquidAssets, {
      customItems: [{ id: 'asset-a', name: '여행 자금', amount: 60 }],
      total: 60,
    });
    formData.assets.savingsPlan.customItems = [{
      name: '여행 적금', linkedAssetId: 'asset-a', assetConnection: 'linked',
    }];
    const html = renderToStaticMarkup(React.createElement(
      FormContext.Provider,
      { value: { formData, setField: () => {} } },
      React.createElement(CategoryBreakdownField, {
        basePath: 'assets.liquidAssets.breakdown',
        customPath: 'assets.liquidAssets.customItems',
        totalPath: 'assets.liquidAssets.total',
        categories: [],
        trackSavingsConnections: true,
      })
    ));
    expect(html).toContain('추가 저축과 연결됨');
    expect(html).toContain('여행 자금');
  });
});
