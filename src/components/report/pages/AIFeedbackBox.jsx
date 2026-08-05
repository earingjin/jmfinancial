// AI가 작성하는 피드백 문구를 표시하는 공용 박스.
// text가 아직 없으면(= API 미연결 상태) 준비 중 문구를 대신 보여준다.
// text는 문자열이거나, PDF의 "굵은 소제목 — 설명" 불릿 형식을 위한
// { title, body } 객체 배열일 수 있다.

export default function AIFeedbackBox({ text }) {
  const isEmpty = !text || (Array.isArray(text) && text.length === 0);

  return (
    <>
      <span className="tab-label">Feedback</span>
      <div className="fb-box" style={{ padding: '14px 18px', fontSize: 13, color: isEmpty ? 'var(--ink-soft)' : 'var(--ink)' }}>
        {isEmpty ? (
          'AI가 이 섹션에 대한 맞춤 피드백을 작성합니다. (준비 중)'
        ) : Array.isArray(text) ? (
          <ul className="fb-bullet-list">
            {text.map((item, i) => (
              <li key={i}>
                {item?.title && <strong>{item.title}</strong>}
                {item?.title && ' — '}
                {item?.body ?? item}
              </li>
            ))}
          </ul>
        ) : (
          text
        )}
      </div>
    </>
  );
}
