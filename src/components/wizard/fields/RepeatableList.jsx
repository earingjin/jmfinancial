import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

/**
 * path의 배열을 렌더링하고 항목 추가/삭제를 관리하는 래퍼.
 * renderItem(item, index, updateItem) => JSX
 */
export default function RepeatableList({ path, label, emptyItem, addLabel, renderItem, maxItems }) {
  const { formData, addListItem, removeListItem, updateListItem } = useFormData();
  const list = getIn(formData, path) || [];
  const atMax = maxItems != null && list.length >= maxItems;

  const updateItem = (index) => (key, value) => updateListItem(path, index, key, value);

  return (
    <div className="repeatable-list">
      <div className="repeatable-list-head">
        <span className="field-label">{label}</span>
      </div>

      {list.map((item, index) => (
        <div className="repeatable-item" key={index}>
          {renderItem(item, index, updateItem(index))}
          <button
            type="button"
            className="repeatable-remove"
            onClick={() => removeListItem(path, index)}
          >
            이 항목 삭제
          </button>
        </div>
      ))}

      {!atMax && (
        <button
          type="button"
          className="repeatable-add"
          onClick={() => addListItem(path, emptyItem)}
        >
          + {addLabel}
        </button>
      )}
      {atMax && (
        <p className="field-helper">최대 {maxItems}개까지 추가할 수 있습니다.</p>
      )}
    </div>
  );
}
