// "income.salary.monthly" 같은 점(dot) 표기 경로로 중첩 객체를 읽고/불변으로 갱신하는 유틸.
// 폼 상태 관리 전반에서 재사용한다.

export function getIn(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export function setIn(obj, path, value) {
  const keys = path.split('.');
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  let cursor = clone;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = cursor[key];
    cursor[key] = Array.isArray(next) ? [...next] : { ...next };
    cursor = cursor[key];
  }

  cursor[keys[keys.length - 1]] = value;
  return clone;
}
