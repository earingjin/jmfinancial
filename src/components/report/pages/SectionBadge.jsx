// PDF 샘플 리포트의 "① 숫자 배지 + 섹션명" 헤더 스타일을 재사용하기 위한 공용 컴포넌트.
export default function SectionBadge({ number, label }) {
  return (
    <div className="num-section-title" style={{ marginBottom: 14 }}>
      <span className="num-badge">{number}</span>{label}
    </div>
  );
}
