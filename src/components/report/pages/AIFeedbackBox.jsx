// AI가 작성하는 피드백 문구를 표시하는 공용 박스.
// text가 아직 없으면(= API 미연결 상태) 아직 고객에게 전달할 내용이 없다는 뜻이므로,
// "준비 중" placeholder를 화면에 그대로 노출하지 않고 이 자리 자체를 렌더링하지 않는다
// (완성도가 낮아 보이는 문제 - 기능/자리(mount 지점)는 그대로 남겨두고, text가 채워지면
// 자동으로 다시 나타난다. AI 피드백 기능 자체를 제거하는 것이 아님).
// text는 문자열이거나, PDF의 "굵은 소제목 — 설명" 불릿 형식을 위한
// { title, body } 객체 배열일 수 있다.

export default function AIFeedbackBox({ text }) {
  const isEmpty = !text || (Array.isArray(text) && text.length === 0);

  if (isEmpty) return null;

  return (
    <>
      <div className="fb-box" style={{ padding: '10px 14px', fontSize: 13, color: 'var(--ink)' }}>
        {Array.isArray(text) ? (
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
