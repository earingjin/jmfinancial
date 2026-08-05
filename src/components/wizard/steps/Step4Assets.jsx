import NumberField from '../fields/NumberField';
import CategoryBreakdownField from '../fields/CategoryBreakdownField';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';

const LIQUID_ASSET_CATEGORIES = [
  { key: 'deposit', label: '예금' },
  { key: 'savings', label: '적금' },
  { key: 'emergencyFund', label: '비상금' },
];

export default function Step4Assets() {
  const { formData } = useFormData();
  const liquidAssets = Number(getIn(formData, 'assets.liquidAssets.total')) || 0;
  const fa = getIn(formData, 'assets.financialAssets') || {};
  const financialAssetsTotal = ['stocks', 'funds', 'other']
    .reduce((s, k) => s + (Number(fa[k]) || 0), 0);
  const pensionAssets = Number(getIn(formData, 'assets.pensionAssets')) || 0;
  const realEstateTotal = Number(getIn(formData, 'assets.realEstateAssets.total')) || 0;
  const totalAssets = liquidAssets + financialAssetsTotal + pensionAssets + realEstateTotal;

  return (
    <div className="step">
      <h2 className="step-title">4. 자산</h2>

      <section className="step-section">
        <h3>💵 현금성 자산</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          예금·적금·비상금 등 즉시 인출 가능한 자산입니다.
        </p>
        <CategoryBreakdownField
          basePath="assets.liquidAssets.breakdown"
          customPath="assets.liquidAssets.customItems"
          totalPath="assets.liquidAssets.total"
          modePath="assets.liquidAssets.inputMode"
          categories={LIQUID_ASSET_CATEGORIES}
          totalLabel="현금성 자산 총액"
          pillPrompt="해당하는 현금성 자산 종류를 눌러 금액을 입력해 주세요"
          customListLabel="기본 항목 외 추가 현금성 자산"
          customNameLabel="자산 이름"
          customNamePlaceholder="예: 외화예금"
          customAmountLabel="금액"
          addItemLabel="현금성 자산 항목 추가"
        />
      </section>

      <section className="step-section">
        <h3>📈 금융자산</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          예금·적금은 위 현금성 자산에서 입력해 주세요. 여기는 주식·펀드 등 투자자산입니다.
        </p>
        <div className="field-grid three-col">
          <NumberField path="assets.financialAssets.stocks" label="주식" unit="만원" />
          <NumberField path="assets.financialAssets.funds" label="펀드" unit="만원" />
          <NumberField path="assets.financialAssets.other" label="기타 금융자산" unit="만원" />
        </div>
      </section>

      <section className="step-section">
        <h3>🏦 연금자산</h3>
        <div className="field-grid">
          <NumberField
            path="assets.pensionAssets"
            label="연금자산(개인연금 · 퇴직연금 · IRP 등) 잔액"
            unit="만원"
            helper="금융자산비중지표 계산 시 금융자산과 별도로 취급됩니다"
          />
        </div>
      </section>

      <section className="step-section">
        <h3>🏠 부동산자산</h3>
        <div className="field-grid">
          <NumberField path="assets.realEstateAssets.total" label="총 부동산자산" unit="만원" />
          <NumberField
            path="assets.realEstateAssets.reverseMortgageHouse"
            label="주택연금 신청 대상 주택 1채의 가격"
            unit="만원"
            helper="해당 없으면 0"
          />
        </div>
      </section>

      <section className="step-section">
        <h3>🧮 자산 합계</h3>
        <table className="grade-table compact">
          <thead>
            <tr><th>구분</th><th style={{ textAlign: 'right' }}>금액</th></tr>
          </thead>
          <tbody>
            <tr><td>현금성 자산</td><td className="num" style={{ textAlign: 'right' }}>{liquidAssets}만원</td></tr>
            <tr><td>금융자산</td><td className="num" style={{ textAlign: 'right' }}>{financialAssetsTotal}만원</td></tr>
            <tr><td>연금자산</td><td className="num" style={{ textAlign: 'right' }}>{pensionAssets}만원</td></tr>
            <tr><td>부동산자산</td><td className="num" style={{ textAlign: 'right' }}>{realEstateTotal}만원</td></tr>
            <tr className="total-row"><td>총자산 합계</td><td className="num" style={{ textAlign: 'right' }}>{totalAssets}만원</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
