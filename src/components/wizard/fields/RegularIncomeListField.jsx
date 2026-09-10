import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import FormattedNumberInput from './FormattedNumberInput';

/**
 * 기타 정기수입(임대수입 등)을 본인·배우자 구분 없이 하나의 목록에서 입력받는 필드.
 * 기존 사업소득 데이터는 그대로 두고, 새로 추가하거나 수정하는 항목만 기타 수입으로 반영한다.
 */
export default function RegularIncomeListField({ path, otherIncomesPath }) {
  const { formData, setField } = useFormData();
  const items = getIn(formData, path) || [];

  const sync = (nextItems) => {
    setField(path, nextItems);
    const otherItems = nextItems.filter((i) => i.type !== 'business');
    setField(otherIncomesPath, otherItems);
  };

  const addItem = () => sync([...items, { type: 'other', name: '', annual: '', years: '' }]);
  const removeItem = (index) => sync(items.filter((_, i) => i !== index));
  const updateItem = (index, key, value) => sync(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

  return (
    <div className="repeatable-list">
      <div className="repeatable-list-head">
        <span className="field-label">급여·연금 외 정기적으로 들어오는 수입 (임대수입, 배당수입 등)</span>
      </div>

      {items.map((item, index) => item.type !== 'business' && (
        <div className="repeatable-item" key={index}>
          <div className="field-grid three-col">
            <label className="field">
              <span className="field-label">수입 항목 이름</span>
              <input
                id={`income.regularIncomes.${index}.name`}
                type="text"
                placeholder="예: 임대수입, 배당수입 등"
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
              />
            </label>현재 `모바일최적화` 브랜치에 구현된 A4 1페이지 요약리포트를 수정해줘.

이번 수정의 가장 중요한 원칙:

“더 자세히 보여주는 것”이 아니라
“사용자가 총액을 신뢰하고 이해할 수 있을 만큼의 최소한의 근거를 보여준다.”

베타테스터 피드백:
현재 `현재 나는 어느 정도 가지고 있나?`에서

총자산 - 총부채 = 순자산

총액만 보여주기 때문에 사용자가

- 총자산에 무엇이 포함됐는지
- 내가 입력한 자산이 제대로 반영됐는지
- 총부채에 어떤 대출이 포함됐는지

직관적으로 확인하기 어렵다는 의견이 있었다.

따라서 기존 총액 아래에 자산·부채의 1단계 구성내역만 추가한다.


[1. 가장 중요한 구현 원칙]

새로운 계산을 만들지 않는다.

현재 서비스에서 이미 계산하거나 보유하고 있는
자산·부채 내역 데이터를 그대로 재사용한다.

특히 현재 모바일 결과의 자산/부채 `내역 보기` 등에서
이미 사용 중인 분류와 값을 우선 재사용할 수 있는지 확인한다.

계산 로직을 복제하거나
A4 전용 합계 계산을 새로 만들지 않는다.

데이터 구조/API/저장 구조 변경 금지.


[2. 현재 재무상태 영역]

현재 구조:

총자산 - 총부채 = 순자산

은 유지한다.

다만 총자산과 총부채 아래에
각 총액을 이해하는 데 필요한 1단계 내역을 표시한다.

예시 구조:

총자산
4억원

현금성자산      2,000만원
금융자산        5,000만원
연금자산        3,000만원
부동산          3억원


총부채
4,000만원

주택담보대출    3,000만원
차량대출        1,000만원


순자산
3억 6,000만원

실제 항목명과 값은 현재 서비스의 기존 데이터를 사용한다.
위 금액은 구조 설명을 위한 예시일 뿐 하드코딩하지 않는다.


[3. 어디까지 보여줄 것인가]

A4에서는 “1단계 구성”까지만 보여준다.

자산 예:
- 현금성자산
- 금융자산
- 연금자산
- 부동산
- 기타자산

부채 예:
- 주택담보대출
- 보증금대출
- 차량대출
- 기타 기존 부채 분류

실제 분류는 기존 코드에서 사용하는 항목을 기준으로 한다.

연금자산 안의
개인연금 / 퇴직연금 등의 세부 구성까지 다시 펼치지 않는다.

금융자산 안의 세부 상품도 표시하지 않는다.

즉:

총자산
→ 자산 1단계 구성

총부채
→ 부채 1단계 구성

까지만 허용한다.

목적은 상세리포트를 A4로 옮기는 것이 아니라
사용자가 “이것들을 합쳐서 이 총액이 나왔구나”라고
이해할 수 있게 하는 것이다.


[4. 0원 항목 처리]

금액이 0인 자산·부채 항목은 표시하지 않는다.

사용자가 실제 보유하거나 입력한 항목 중심으로 보여준다.

단, 0원 필터링을 위해 새로운 계산 구조를 만들지는 않는다.
기존 값을 기준으로 표시 여부만 결정한다.

모든 항목이 0이거나 세부내역을 표시할 수 없는 과거 결과 등
예외 상황에서도 레이아웃이 깨지지 않게 한다.


[5. 디자인]

자산·부채 내역을 새로운 큰 카드들로 만들지 않는다.

현재의

총자산 - 총부채 = 순자산

관계가 가장 먼저 보여야 한다.

세부내역은 총액보다 시각적 우선순위를 낮춘다.

권장 위계:

총자산
4억원
────────
현금성자산      ○○원
금융자산        ○○원
연금자산        ○○원
부동산          ○○원


총부채
4,000만원
────────
주택담보대출    ○○원
차량대출        ○○원


순자산
3억 6,000만원

세부내역은:
- 작은 글씨
- 일반 텍스트 색상
- 좌측 항목명 / 우측 금액 정렬
- 과도한 배경색 금지
- 항목마다 별도 카드 생성 금지
- 얇은 구분선 정도만 사용

사용자가 먼저 총액을 보고,
필요하면 바로 아래에서 근거를 확인할 수 있게 한다.


[6. 순자산]

순자산은 결과값이므로
별도의 세부내역을 만들지 않는다.

총자산 - 총부채 = 순자산

관계를 유지하고
순자산은 현재처럼 결과로 강조한다.


[7. A4 공간 재조정]

자산·부채 내역이 추가되므로
현재 A4 하단의 여백 일부를 자연스럽게 사용할 수 있다.

하지만 A4를 억지로 꽉 채우는 것이 목적은 아니다.

새 내역 때문에:
- 글씨를 지나치게 작게 만들거나
- 섹션 간격을 과도하게 줄이거나
- 미래 전망 영역을 압축해서 읽기 어렵게 만들지 않는다.

필요한 범위에서 전체 세로 간격을 균형 있게 조정한다.

A4 1페이지는 유지한다.


[8. 나머지 영역]

이번 작업에서는 아래 내용의 정보구조를 변경하지 않는다.

- 종합 결과
- 은퇴 준비
- 또래 비교
- 은퇴 후 생활비 충당 전망

이전 베타테스트에서 제외한 다음 항목도 다시 추가하지 않는다.

- 나의 재무 구성 도넛 그래프
- 현재 노후소득보장률
- 은퇴 시점 월소득 비교
- 예상 자산 유지기간


[9. 변경 금지]

절대 변경하지 않는다.

- 재무 계산 로직
- 합계 계산 방식
- 모바일 결과
- 상세리포트
- 상세리포트의 내용/레이아웃
- API
- 저장 구조
- 서버 결과
- 기존 사용자 데이터


[10. 구현 전 확인]

바로 수정하지 말고 먼저 코드에서 확인한다.

1. A4의 총자산/총부채/순자산이 어떤 기존 결과값을 사용하는지
2. 모바일 결과의 자산/부채 `내역 보기`가 어떤 데이터를 사용하는지
3. 그 데이터를 A4에서도 그대로 재사용할 수 있는지
4. 부채가 간편입력/상세입력 등 입력 방식에 따라 어떻게 제공되는지
5. 과거 저장 결과에서도 안전하게 표시할 수 있는지

가능하면 기존 데이터와 표시용 데이터를 재사용하고
A4 전용 계산 로직을 추가하지 않는다.


[11. 검증]

수정 후 다음을 확인한다.

- 총자산 값이 기존과 동일
- 총부채 값이 기존과 동일
- 순자산 값이 기존과 동일
- 표시된 자산 내역이 기존 총자산 데이터와 일관됨
- 표시된 부채 내역이 기존 총부채 데이터와 일관됨
- 0원 항목 미노출
- 내역이 없는 경우에도 화면이 깨지지 않음
- A4 세로 1페이지 유지
- footer와 내용 겹침 없음
- 모바일 결과 변경 없음
- 상세리포트 변경 없음
- 계산 로직 변경 없음


작업 후 아래만 짧게 보고해줘.

1. 변경 파일
2. 자산/부채 내역에 재사용한 기존 데이터
3. 간편입력/상세입력에 따른 표시 방식
4. 과거 저장 결과 처리 방식
5. 새 계산 추가 여부
6. 모바일/상세리포트 영향 여부
7. A4 1페이지 인쇄 검증 결과
            <label className="field">
              <span className="field-label">연간 수입 금액</span>
              <div className="field-input-row">
                <FormattedNumberInput
                  id={`income.regularIncomes.${index}.annual`}
                  type="number"
                  min={0}
                  value={item.annual}
                  onChange={(e) => updateItem(index, 'annual', e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="field-unit">만원</span>
              </div>
            </label>
            <label className="field">
              <span className="field-label">월수입 흐름 향후 유지예상 기간</span>
              <div className="field-input-row">
                <FormattedNumberInput
                  id={`income.regularIncomes.${index}.years`}
                  type="number"
                  value={item.years}
                  onChange={(e) => updateItem(index, 'years', e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className="field-unit">년</span>
              </div>
            </label>
          </div>
          <button type="button" className="repeatable-remove" onClick={() => removeItem(index)}>
            이 항목 삭제
          </button>
        </div>
      ))}

      <button type="button" className="repeatable-add" onClick={addItem}>
        + 수입 항목 추가
      </button>
    </div>
  );
}
