import { describe, expect, it } from 'vitest';
import { isCategorySelected, selectedKeysFrom } from './SavingsBreakdownField.jsx';

const CATEGORY_KEYS = ['installment', 'isa', 'irp'];

// 저축 카테고리 버튼 "선택" 상태는 openKeys(로컬 UI 상태, 패널 접기/펼치기 전용)와 완전히 분리된
// assets.savingsPlan.selectedCategories(formData)로 판정한다. 이 필드가 명시적으로 배열이면
// 그것을 그대로 따르고(빈 배열 포함), 배열이 아니면(레거시 저장 데이터) 월 저축액이 양수인
// 항목만 선택된 것으로 복원한다.
describe('isCategorySelected', () => {
  it('명시적 배열이 있으면 그 배열만 신뢰한다(월액이 양수여도 배열에 없으면 미선택)', () => {
    const breakdown = { installment: { monthly: '' }, isa: { monthly: 30 } };
    expect(isCategorySelected(['installment'], breakdown, 'installment')).toBe(true);
    expect(isCategorySelected(['installment'], breakdown, 'isa')).toBe(false);
  });

  it('명시적 배열이 빈 배열이어도(신규 진단) 그대로 "미선택"으로 신뢰한다', () => {
    const breakdown = { installment: { monthly: 30 } };
    expect(isCategorySelected([], breakdown, 'installment')).toBe(false);
  });

  it('배열이 아니면(레거시, 필드 자체가 없음) 월 저축액이 양수인 항목만 선택된 것으로 본다', () => {
    const breakdown = { installment: { monthly: 30 }, isa: { monthly: 0 }, irp: { monthly: '' } };
    expect(isCategorySelected(undefined, breakdown, 'installment')).toBe(true);
    expect(isCategorySelected(undefined, breakdown, 'isa')).toBe(false);
    expect(isCategorySelected(undefined, breakdown, 'irp')).toBe(false);
    expect(isCategorySelected(null, breakdown, 'installment')).toBe(true);
  });
});

describe('selectedKeysFrom', () => {
  it('명시적 배열 기준으로 선택된 key 목록을 그대로 반환한다', () => {
    expect(selectedKeysFrom(['isa', 'irp'], {}, CATEGORY_KEYS)).toEqual(['isa', 'irp']);
  });

  it('레거시(배열 없음)에서는 월 저축액이 양수인 항목만 반환한다', () => {
    const breakdown = { installment: { monthly: 30 }, isa: { monthly: '' }, irp: { monthly: 0 } };
    expect(selectedKeysFrom(undefined, breakdown, CATEGORY_KEYS)).toEqual(['installment']);
  });

  it('아무 것도 선택되지 않은 신규 진단 기본값(빈 배열)은 빈 목록을 반환한다', () => {
    expect(selectedKeysFrom([], { installment: { monthly: 30 } }, CATEGORY_KEYS)).toEqual([]);
  });
});
