import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildCanonicalInput } from '../../../../api/_lib/canonicalInput';
import { buildAggregates } from '../../../../api/_lib/aggregate';
import { initialFormData } from '../../../state/initialFormData';
import ShortfallFillPage from './ShortfallFillPage';

globalThis.React = React;

const FAKE_SIMULATION = {
  lifeGoals: {
    totalGoalAmount: 0,
    preparedAmount: 0,
    byCategory: { marriageSupport: 0, education: 0, other: 0 },
  },
};

function renderPage(formData) {
  const aggregates = buildAggregates(buildCanonicalInput(formData));
  return renderToStaticMarkup(
    <ShortfallFillPage
      simulation={FAKE_SIMULATION}
      aggregates={aggregates}
      retirementReadiness={{ notCalculable: true }}
      pageNumber={1}
      totalPages={1}
    />
  );
}

describe('ShortfallFillPage - 퇴직금(일시금) 잔존값 노출 여부', () => {
  it('type이 lumpsum이면 입력한 금액을 그대로 보여준다(기존 동작 유지)', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.income.severance, { type: 'lumpsum', lumpsum: 5000 });
    const html = renderPage(formData);
    expect(html).toContain('5,000만원');
  });

  it('lumpsum 입력 후 없음으로 전환하면(잔존값이 남아있어도) 0원으로 표시한다', () => {
    const formData = structuredClone(initialFormData);
    // 프론트 초기화가 누락되거나 과거 저장 데이터에 잔존값이 남아있는 상황을 그대로 재현한다.
    Object.assign(formData.income.severance, { type: 'none', lumpsum: 5000 });
    const html = renderPage(formData);
    expect(html).not.toContain('5,000만원');
  });

  it('pension 선택 후에도 이전 lumpsum 잔존값을 일시금으로 보여주지 않는다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.income.severance, {
      type: 'pension', lumpsum: 5000, pensionMonthly: 40, pensionStartAge: 65, pensionMonths: 120,
    });
    const html = renderPage(formData);
    expect(html).not.toContain('5,000만원');
  });

  it('배우자도 동일하게 처리한다', () => {
    const formData = structuredClone(initialFormData);
    Object.assign(formData.basic, { hasSpouse: true });
    Object.assign(formData.spouse.severance, { type: 'none', lumpsum: 3000 });
    const html = renderPage(formData);
    expect(html).not.toContain('3,000만원');
  });
});
