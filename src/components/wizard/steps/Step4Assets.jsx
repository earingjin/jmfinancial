import { useState, useEffect } from 'react';
import NumberField from '../fields/NumberField';
import CategoryBreakdownField from '../fields/CategoryBreakdownField';
import RepeatableList from '../fields/RepeatableList';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatNumber } from '../../../utils/format';

const LIQUID_ASSET_CATEGORIES = [
  { key: 'deposit', label: '예금' },
  { key: 'savings', label: '적금' },
  { key: 'cma', label: 'CMA' },
  { key: 'emergencyFund', label: '비상금' },
];

const FINANCIAL_ASSET_CATEGORIES = [
  { key: 'stocks', label: '주식' },
  { key: 'funds', label: '펀드' },
  { key: 'bonds', label: '채권' },
  { key: 'other', label: '기타' },
];

// linked: true면 "3. 저축"과 값이 연동되어 양쪽 어디서나 입력·수정 가능한 항목, false면 여기서만 직접 입력하는 항목.
const PENSION_ASSET_CATEGORIES = [
  { key: 'variableAnnuity', label: '변액연금', linked: true, savingsLabel: '변액연금' },
  { key: 'pensionSavingsAccount', label: '연금저축계좌', linked: true, savingsLabel: '연금저축' },
  { key: 'irp', label: 'IRP개인퇴직계좌', linked: true, savingsLabel: 'IRP' },
  { key: 'other', label: '기타', linked: false },
];

// pensionAssetsBreakdown의 숫자 항목만 명시적으로 나열한다(otherItems는 배열이라 합산 대상이 아님).
const PENSION_BREAKDOWN_NUMERIC_KEYS = ['variableAnnuity', 'pensionSavingsAccount', 'irp', 'other'];

export default function Step4Assets() {
  const { formData, setField } = useFormData();
  const [openFinancialKeys, setOpenFinancialKeys] = useState(() => {
    const fa = getIn(formData, 'assets.financialAssets') || {};
    const otherItems = getIn(formData, 'assets.financialAssets.otherItems') || [];
    const initial = new Set();
    FINANCIAL_ASSET_CATEGORIES.forEach((c) => {
      if (c.key === 'other') {
        if (otherItems.length > 0 || Number(fa.other) > 0) initial.add(c.key);
      } else if (Number(fa[c.key]) > 0) {
        initial.add(c.key);
      }
    });
    return initial;
  });

  const toggleFinancialKey = (key) => {
    setOpenFinancialKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [openPensionKeys, setOpenPensionKeys] = useState(() => {
    const breakdown = getIn(formData, 'assets.pensionAssetsBreakdown') || {};
    const initial = new Set();
    PENSION_ASSET_CATEGORIES.forEach((c) => {
      if (Number(breakdown[c.key]) > 0) initial.add(c.key);
    });
    return initial;
  });

  const togglePensionKey = (key) => {
    setOpenPensionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // "3. 저축"의 SavingsBreakdownField.updateAccumulated(pensionBreakdown 분기)와 동일한 필드에
  // 그대로 쓴다 - 같은 값을 공유하는 연동 항목이라 어느 쪽에서 수정해도 서로 반영된다.
  const updatePensionBreakdown = (key, raw) => {
    setField(`assets.pensionAssetsBreakdown.${key}`, raw === '' ? '' : Number(raw));
  };

  // "기타" 연금자산은 종류별(name)로 나눠 입력받고, 합계만 pensionAssetsBreakdown.other에 반영한다.
  // 그 합계 변경이 다시 4개 항목 합계(assets.pensionAssets)에도 반영되도록 함께 재계산한다.
  const pensionOtherItems = getIn(formData, 'assets.pensionAssetsBreakdown.otherItems') || [];
  const pensionOtherTotal = pensionOtherItems.reduce((s, item) => s + (Number(item.amount) || 0), 0);

  useEffect(() => {
    setField('assets.pensionAssetsBreakdown.other', pensionOtherTotal);
  }, [pensionOtherTotal, setField]);

  const pensionBreakdown = getIn(formData, 'assets.pensionAssetsBreakdown') || {};
  const pensionAssetsTotal = PENSION_BREAKDOWN_NUMERIC_KEYS.reduce(
    (s, k) => s + (k === 'other' ? pensionOtherTotal : Number(pensionBreakdown[k]) || 0),
    0
  );

  useEffect(() => {
    setField('assets.pensionAssets', pensionAssetsTotal);
  }, [pensionAssetsTotal, setField]);

  // "기타 금융자산"도 종류별로 나눠 입력받고, 합계만 financialAssets.other에 반영한다.
  const financialOtherItems = getIn(formData, 'assets.financialAssets.otherItems') || [];
  const financialOtherTotal = financialOtherItems.reduce((s, item) => s + (Number(item.amount) || 0), 0);

  useEffect(() => {
    setField('assets.financialAssets.other', financialOtherTotal);
  }, [financialOtherTotal, setField]);

  const liquidAssets = Number(getIn(formData, 'assets.liquidAssets.total')) || 0;
  const financialAssetsTotal =
    (Number(getIn(formData, 'assets.financialAssets.stocks')) || 0) +
    (Number(getIn(formData, 'assets.financialAssets.funds')) || 0) +
    (Number(getIn(formData, 'assets.financialAssets.bonds')) || 0) +
    financialOtherTotal;
  const pensionAssets = Number(getIn(formData, 'assets.pensionAssets')) || 0;

  // 부동산자산 총액 = 주요 부동산 시세 + 기타 부동산(추가 보유) 시세 합계. 이 합계를 그대로
  // assets.realEstateAssets.total에 반영한다 - 서버 계산(aggregate.js 등)은 계속 이 필드를 그대로 읽는다.
  const realEstateMainProperty = Number(getIn(formData, 'assets.realEstateAssets.mainProperty')) || 0;
  const realEstateOtherItems = getIn(formData, 'assets.realEstateAssets.otherItems') || [];
  const realEstateOtherTotal = realEstateOtherItems.reduce((s, item) => s + (Number(item.amount) || 0), 0);
  const realEstateTotal = realEstateMainProperty + realEstateOtherTotal;

  useEffect(() => {
    setField('assets.realEstateAssets.total', realEstateTotal);
  }, [realEstateTotal, setField]);

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
          예금·적금·CMA는 위 현금성 자산에서 입력해 주세요. 여기는 주식·펀드·채권 등 투자자산입니다.
        </p>
        <p className="field-label">해당하는 금융자산 종류를 눌러 금액을 입력해 주세요</p>
        <div className="checkbox-group" style={{ marginTop: 8, marginBottom: 14 }}>
          {FINANCIAL_ASSET_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.key}
              className={`checkbox-pill ${openFinancialKeys.has(c.key) ? 'is-active' : ''}`}
              onClick={() => toggleFinancialKey(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {(openFinancialKeys.has('stocks') || openFinancialKeys.has('funds') || openFinancialKeys.has('bonds')) && (
          <div className="field-grid three-col">
            {openFinancialKeys.has('stocks') && <NumberField path="assets.financialAssets.stocks" label="주식" unit="만원" />}
            {openFinancialKeys.has('funds') && <NumberField path="assets.financialAssets.funds" label="펀드" unit="만원" />}
            {openFinancialKeys.has('bonds') && <NumberField path="assets.financialAssets.bonds" label="채권" unit="만원" />}
          </div>
        )}
        {openFinancialKeys.has('other') && (
          <RepeatableList
            path="assets.financialAssets.otherItems"
            label="기타 금융자산"
            addLabel="기타 금융자산 추가"
            emptyItem={{ name: '', amount: '' }}
            renderItem={(item, _i, update) => (
              <div className="field-grid three-col">
                <label className="field">
                  <span className="field-label">종류</span>
                  <input type="text" placeholder="예: 가상자산" value={item.name} onChange={(e) => update('name', e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">금액</span>
                  <div className="field-input-row">
                    <input type="number" value={item.amount} onChange={(e) => update('amount', Number(e.target.value))} />
                    <span className="field-unit">만원</span>
                  </div>
                </label>
              </div>
            )}
          />
        )}
        <label className="field" style={{ marginTop: 12 }}>
          <span className="field-label">금융자산 총액</span>
          <div className="field-input-row">
            <input type="number" value={financialAssetsTotal || ''} readOnly />
            <span className="field-unit">만원</span>
          </div>
          <span className="field-helper">선택·입력하신 항목의 합으로 자동 계산됩니다</span>
        </label>
      </section>

      <section className="step-section">
        <h3>🏦 연금자산</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          해당하는 연금자산 종류를 눌러 금액을 확인·입력해 주세요. 변액연금·연금저축계좌·IRP개인퇴직계좌는
          "3. 저축"과 값이 연동되며, 여기서 직접 입력·수정할 수도 있습니다.
        </p>
        <div className="checkbox-group" style={{ marginBottom: 14 }}>
          {PENSION_ASSET_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.key}
              className={`checkbox-pill ${openPensionKeys.has(c.key) ? 'is-active' : ''}`}
              onClick={() => togglePensionKey(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="field-grid three-col">
          {PENSION_ASSET_CATEGORIES.filter((c) => c.linked && openPensionKeys.has(c.key)).map((c) => (
            <label className="field" key={c.key}>
              <span className="field-label">{c.label}</span>
              <div className="field-input-row">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={getIn(formData, `assets.pensionAssetsBreakdown.${c.key}`) ?? ''}
                  onChange={(e) => updatePensionBreakdown(c.key, e.target.value)}
                />
                <span className="field-unit">만원</span>
              </div>
              <span className="field-helper">"3. 저축"의 "{c.savingsLabel}" 항목과 연동됩니다 - 어느 쪽에서 입력해도 서로 반영됩니다</span>
            </label>
          ))}
        </div>
        {openPensionKeys.has('other') && (
          <RepeatableList
            path="assets.pensionAssetsBreakdown.otherItems"
            label="기타 연금자산"
            addLabel="기타 연금자산 추가"
            emptyItem={{ name: '', amount: '' }}
            renderItem={(item, _i, update) => (
              <div className="field-grid three-col">
                <label className="field">
                  <span className="field-label">종류</span>
                  <input type="text" placeholder="예: 퇴직연금(DC형)" value={item.name} onChange={(e) => update('name', e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">금액</span>
                  <div className="field-input-row">
                    <input type="number" value={item.amount} onChange={(e) => update('amount', Number(e.target.value))} />
                    <span className="field-unit">만원</span>
                  </div>
                </label>
              </div>
            )}
          />
        )}
        <label className="field" style={{ marginTop: 12 }}>
          <span className="field-label">연금자산 총액</span>
          <div className="field-input-row">
            <input type="number" value={getIn(formData, 'assets.pensionAssets') || ''} readOnly />
            <span className="field-unit">만원</span>
          </div>
          <span className="field-helper">위 4개 항목의 합으로 자동 계산됩니다. 금융자산비중지표 계산 시 금융자산과 별도로 취급됩니다.</span>
        </label>
      </section>

      <section className="step-section">
        <h3>🏠 부동산자산</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          매입가·공시가가 아닌 현재 시세 기준으로 입력해 주세요.
        </p>
        <div className="field-grid three-col">
          <NumberField path="assets.realEstateAssets.mainProperty" label="부동산 시세" unit="만원" helper="주요 보유 부동산 1건" />
          <NumberField
            path="assets.realEstateAssets.reverseMortgageHouse"
            label="주택연금 신청 대상 주택 1채의 가격"
            unit="만원"
            helper="해당 없으면 0"
          />
        </div>
        <RepeatableList
          path="assets.realEstateAssets.otherItems"
          label="기타 부동산"
          addLabel="기타 부동산 추가"
          emptyItem={{ name: '', amount: '' }}
          renderItem={(item, _i, update) => (
            <div className="field-grid three-col">
              <label className="field">
                <span className="field-label">종류</span>
                <input type="text" placeholder="예: 상가" value={item.name} onChange={(e) => update('name', e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">시세</span>
                <div className="field-input-row">
                  <input type="number" value={item.amount} onChange={(e) => update('amount', Number(e.target.value))} />
                  <span className="field-unit">만원</span>
                </div>
              </label>
            </div>
          )}
        />
        <label className="field" style={{ marginTop: 12 }}>
          <span className="field-label">부동산자산 총액</span>
          <div className="field-input-row">
            <input type="number" value={realEstateTotal || ''} readOnly />
            <span className="field-unit">만원</span>
          </div>
          <span className="field-helper">부동산 시세와 기타 부동산 시세의 합으로 자동 계산됩니다</span>
        </label>
      </section>

      <section className="step-section">
        <h3>🧮 자산 합계</h3>
        <table className="grade-table compact">
          <thead>
            <tr><th>구분</th><th style={{ textAlign: 'right' }}>금액</th></tr>
          </thead>
          <tbody>
            <tr><td>현금성 자산</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(liquidAssets)}만원</td></tr>
            <tr><td>금융자산</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(financialAssetsTotal)}만원</td></tr>
            <tr><td>연금자산</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(pensionAssets)}만원</td></tr>
            <tr><td>부동산자산</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(realEstateTotal)}만원</td></tr>
            <tr className="total-row"><td>총자산 합계</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(totalAssets)}만원</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
