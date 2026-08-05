// 도시 2인가구 생활수준 구간 (1_계산로직.html §5.1, 2025년 기준). 표시 전용 참고 구간표다.
// 원래 클라이언트 번들에 있었으나 서버로 옮겨, 응답에는 계산된 트랙(segments/markerPercent/currentTier)만 내려간다.

export const LIFESTYLE_TIERS = [
  { key: 'min', label: '최소생활', min: 180, max: 220, color: '#DCE6F5' },
  { key: 'standard', label: '적정생활', min: 280, max: 350, color: '#CFEDE8' },
  { key: 'comfortable', label: '여유생활', min: 450, max: 600, color: '#FBE9CE' },
  { key: 'affluent', label: '풍요생활', min: 700, max: Infinity, color: '#F5DAD5' },
];

// 각 구간을 [0, scaleMax] 기준 left%/width%로 변환하고, 사용자 값의 마커 위치(%)를 함께 반환한다.
export function buildLifestyleTrack(retirementLivingCost) {
  const scaleMax = Math.max(900, retirementLivingCost * 1.15);
  const segments = LIFESTYLE_TIERS.map((tier) => {
    const rightEdge = Number.isFinite(tier.max) ? tier.max : scaleMax;
    const left = (tier.min / scaleMax) * 100;
    const width = Math.max(0, (rightEdge / scaleMax) * 100 - left);
    return { ...tier, left, width };
  });

  const markerPercent = Math.min(100, Math.max(0, (retirementLivingCost / scaleMax) * 100));
  const currentTier = LIFESTYLE_TIERS.find((t) => retirementLivingCost >= t.min && retirementLivingCost <= t.max)
    || (retirementLivingCost < LIFESTYLE_TIERS[0].min ? LIFESTYLE_TIERS[0] : LIFESTYLE_TIERS[LIFESTYLE_TIERS.length - 1]);

  return { scaleMax, segments, markerPercent, currentTier };
}
