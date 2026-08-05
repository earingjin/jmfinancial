import PageFrame from './PageFrame';
import SectionBadge from './SectionBadge';

// 대응 옵션(ConclusionPage)을 구체적인 실행 방안 카드로 풀어보여주는 레이아웃.
// 계산 로직이 아직 없어 각 카드의 수치는 실제 값이 아닌 자리표시자("-")이다 - 추후 계산이
// 마련되면 그 값으로 채워 넣는다.
const PLACEHOLDER = '-';

export default function AssetManagementOptionsPage({ pageNumber, totalPages }) {
  return (
    <PageFrame eyebrow="Conclusion" pageNumber={pageNumber} totalPages={totalPages}>
      <SectionBadge number="8" label="자산관리" />

      <div className="option-card-grid">
        <div className="option-card">
          <div className="option-card-title">주택연금 전환</div>
          <div className="option-card-desc">보유한 주택을 주택연금으로 전환하여 노후자금을 보충하는 방안</div>
          <div className="option-card-row"><span>주택연금 월 수령금액</span><span className="num">{PLACEHOLDER}</span></div>
          <div className="option-card-row"><span>총 수령금액</span><span className="num">{PLACEHOLDER}</span></div>
        </div>

        <div className="option-card">
          <div className="option-card-title">부동산 자금전환</div>
          <div className="option-card-desc">주택 · 부동산 규모 혹은 전세금 규모를 조정해 현금으로 전환하는 방안</div>
          <div className="option-card-row"><span>부동산 현금화 금액</span><span className="num">{PLACEHOLDER}</span></div>
          <div className="option-card-row"><span>현금 전환 시 나이</span><span className="num">{PLACEHOLDER}</span></div>
          <ul className="option-card-list">
            <li>보유 주택을 매매하여 작은 평수로 이동</li>
            <li>보유 주택을 전/월세로 축소하여 현금화</li>
            <li>실거주택을 제외한 여유 주택 · 농지 매각</li>
          </ul>
        </div>

        <div className="option-card">
          <div className="option-card-title">지출 줄이기</div>
          <div className="option-card-desc">노후 생활비 · 자녀 교육 등 지출 패턴을 조정하는 방안</div>
          <div className="option-card-row"><span>지출 감소 전 생활비</span><span className="num">{PLACEHOLDER}</span></div>
          <div className="option-card-row"><span>지출 감소 후 생활비</span><span className="num">{PLACEHOLDER}</span></div>
        </div>

        <div className="option-card">
          <div className="option-card-title">재취업 수입원</div>
          <div className="option-card-desc">은퇴 이후 추가 근로소득을 모색하는 방안</div>
          <div className="option-card-row"><span>목표 월급여</span><span className="num">{PLACEHOLDER}</span></div>
          <div className="option-card-row"><span>급여 수령기간</span><span className="num">{PLACEHOLDER}</span></div>
        </div>
      </div>

      <div className="fine-print" style={{ marginTop: 12 }}>
        위 방안별 예상 금액은 아직 계산 기능이 연동되지 않아 자리표시자로 표시됩니다. 실제 재무상담 시에는
        전문가와 상의해 개별 데이터를 기준으로 산출하시기 바랍니다.
      </div>
    </PageFrame>
  );
}
