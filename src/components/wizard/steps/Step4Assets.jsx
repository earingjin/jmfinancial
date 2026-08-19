import { useState, useEffect } from 'react';
import NumberField from '../fields/NumberField';
import CategoryBreakdownField from '../fields/CategoryBreakdownField';
import RepeatableList from '../fields/RepeatableList';
import PresenceField from '../fields/PresenceField';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { formatNumber } from '../../../utils/format';
import FormattedNumberInput from '../fields/FormattedNumberInput';
import TotalAmountBox from '../fields/TotalAmountBox';

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

const REAL_ESTATE_TYPES = ['주택', '아파트', '빌라', '오피스텔', '다가구', '고시원', '상가', '농지', '임야', '기타'];

function PropertyTypeField({ value, onChange, label = '매물 종류' }) {
  const isLegacyType = value && !REAL_ESTATE_TYPES.includes(value);
  return (
    <label className="field property-type-field">
      <span className="field-label property-type-label">{label}</span>
      <span className="property-type-select-wrap">
        <span className="property-type-icon" aria-hidden="true">⌂</span>
        <select
          className={!value ? 'is-placeholder' : ''}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">종류를 선택해 주세요</option>
          {isLegacyType && <option value={value}>{value}</option>}
          {REAL_ESTATE_TYPES.map((type) => <option value={type} key={type}>{type}</option>)}
        </select>
      </span>
    </label>
  );
}

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
  const hasLiquidAssets = getIn(formData, 'assets.liquidAssets.hasAssets') !== false;
  const hasFinancialAssets = getIn(formData, 'assets.financialAssets.hasAssets') !== false;
  const hasPensionAssets = getIn(formData, 'assets.hasPensionAssets') !== false;
  const hasRealEstateAssets = getIn(formData, 'assets.realEstateAssets.hasAssets') !== false;
  const hasOtherAssets = getIn(formData, 'assets.otherAssets.hasAssets') !== false;

  const setAssetPresence = (path, value, clear) => {
    setField(path, value);
    if (!value) clear();
  };

  const clearLiquidAssets = () => {
    LIQUID_ASSET_CATEGORIES.forEach(({ key }) => setField(`assets.liquidAssets.breakdown.${key}`, ''));
    setField('assets.liquidAssets.customItems', []);
    setField('assets.liquidAssets.total', 0);
  };

  const clearFinancialAssets = () => {
    FINANCIAL_ASSET_CATEGORIES.forEach(({ key }) => setField(`assets.financialAssets.${key}`, ''));
    setField('assets.financialAssets.otherItems', []);
  };

  const clearPensionAssets = () => {
    PENSION_ASSET_CATEGORIES.forEach(({ key }) => setField(`assets.pensionAssetsBreakdown.${key}`, ''));
    setField('assets.pensionAssetsBreakdown.otherItems', []);
    setField('assets.pensionAssets', 0);
  };

  const clearRealEstateAssets = () => {
    setField('assets.realEstateAssets.mainPropertyType', '');
    setField('assets.realEstateAssets.mainProperty', '');
    setField('assets.realEstateAssets.reverseMortgageHouse', '');
    setField('assets.realEstateAssets.otherItems', []);
    setField('assets.realEstateAssets.total', 0);
  };

  const clearOtherAssets = () => {
    setField('assets.otherAssets.items', []);
    setField('assets.otherAssets.total', 0);
  };
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

  // pill을 다시 눌러 패널을 접기만 하면 입력창이 숨겨질 뿐 값은 그대로 남아 금융자산
  // 총액에 계속 포함된다. "이 항목 삭제"는 값을 실제로 비우고 패널도 닫는다.
  const removeFinancialItem = (key) => {
    setField(`assets.financialAssets.${key}`, '');
    setOpenFinancialKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
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

  // pill을 다시 눌러 패널을 접기만 하면 입력창이 숨겨질 뿐 값은 그대로 남아 연금자산
  // 총액에 계속 포함된다. "이 항목 삭제"는 값을 실제로 비우고(연동된 "3. 저축" 쪽도 함께
  // 비워짐 - 같은 필드를 공유하므로) 패널도 닫는다.
  const removePensionItem = (key) => {
    updatePensionBreakdown(key, '');
    setOpenPensionKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
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

  const otherAssetItems = getIn(formData, 'assets.otherAssets.items') || [];
  const otherAssetsTotal = otherAssetItems.reduce((s, item) => s + (Number(item.amount) || 0), 0);

  useEffect(() => {
    setField('assets.otherAssets.total', otherAssetsTotal);
  }, [otherAssetsTotal, setField]);

  useEffect(() => {
    setField('assets.realEstateAssets.total', realEstateTotal);
  }, [realEstateTotal, setField]);

  const totalAssets = liquidAssets + financialAssetsTotal + pensionAssets + realEstateTotal + otherAssetsTotal;

  return (
    <div className="step">
      <h2 className="step-title">4. 자산</h2>

      <section className="step-section">
        <h3><span className="step-icon">💵</span> 현금성 자산</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          예금·적금·비상금 등 즉시 인출 가능한 자산입니다.
        </p>
        <PresenceField label="현금성 자산 여부" present={hasLiquidAssets} onChange={(value) => setAssetPresence('assets.liquidAssets.hasAssets', value, clearLiquidAssets)} presentLabel="자산 있음" absentLabel="자산 없음" />
        {hasLiquidAssets ? <CategoryBreakdownField
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
        /> : <p className="field-helper">현금성 자산 없음으로 선택했습니다.</p>}
      </section>

      <section className="step-section">
        <h3><span className="step-icon">📈</span> 금융자산</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          예금·적금·CMA는 위 현금성 자산에서 입력해 주세요. 여기는 주식·펀드·채권 등 투자자산입니다.
        </p>
        <PresenceField label="금융자산 여부" present={hasFinancialAssets} onChange={(value) => setAssetPresence('assets.financialAssets.hasAssets', value, clearFinancialAssets)} presentLabel="자산 있음" absentLabel="자산 없음" />
        {hasFinancialAssets ? <>
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
            {FINANCIAL_ASSET_CATEGORIES.filter((c) => c.key !== 'other' && openFinancialKeys.has(c.key)).map((c) => (
              <label className="field" key={c.key}>
                <span className="field-label">{c.label}</span>
                <div className="field-input-row">
                  <FormattedNumberInput
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={getIn(formData, `assets.financialAssets.${c.key}`) ?? ''}
                    onChange={(e) => setField(`assets.financialAssets.${c.key}`, e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  <span className="field-unit">만원</span>
                </div>
                <button type="button" className="repeatable-remove" onClick={() => removeFinancialItem(c.key)}>
                  이 항목 삭제
                </button>
              </label>
            ))}
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
                    <FormattedNumberInput value={item.amount} onChange={(e) => update('amount', Number(e.target.value))} />
                    <span className="field-unit">만원</span>
                  </div>
                </label>
              </div>
            )}
          />
        )}
        <TotalAmountBox label="금융자산 총액" amount={financialAssetsTotal} valueLabel="총액은" />
        <span className="field-helper">선택·입력하신 항목의 합으로 자동 계산됩니다</span>
        </> : <p className="field-helper">금융자산 없음으로 선택했습니다.</p>}
      </section>

      <section className="step-section">
        <h3><span className="step-icon">🏦</span> 연금자산</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          해당하는 연금자산 종류를 눌러 금액을 확인·입력해 주세요. 변액연금·연금저축계좌·IRP개인퇴직계좌는
          "3. 저축"과 값이 연동되며, 여기서 직접 입력·수정할 수도 있습니다.
        </p>
        <PresenceField label="연금자산 여부" present={hasPensionAssets} onChange={(value) => setAssetPresence('assets.hasPensionAssets', value, clearPensionAssets)} presentLabel="자산 있음" absentLabel="자산 없음" />
        {hasPensionAssets ? <>
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
                <FormattedNumberInput
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={getIn(formData, `assets.pensionAssetsBreakdown.${c.key}`) ?? ''}
                  onChange={(e) => updatePensionBreakdown(c.key, e.target.value)}
                />
                <span className="field-unit">만원</span>
              </div>
              <span className="field-helper">"3. 저축"의 "{c.savingsLabel}" 항목과 연동됩니다 - 어느 쪽에서 입력해도 서로 반영됩니다</span>
              <button type="button" className="repeatable-remove" onClick={() => removePensionItem(c.key)}>
                이 항목 삭제
              </button>
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
                    <FormattedNumberInput value={item.amount} onChange={(e) => update('amount', Number(e.target.value))} />
                    <span className="field-unit">만원</span>
                  </div>
                </label>
              </div>
            )}
          />
        )}
        <TotalAmountBox label="연금자산 총액" amount={pensionAssets} valueLabel="총액은" />
        <span className="field-helper">위 4개 항목의 합으로 자동 계산됩니다. 금융자산비중지표 계산 시 금융자산과 별도로 취급됩니다.</span>
        </> : <p className="field-helper">연금자산 없음으로 선택했습니다.</p>}
      </section>

      <section className="step-section">
        <h3><span className="step-icon">🏠</span> 부동산자산</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          매입가·공시가가 아닌 현재 시세 기준으로 입력해 주세요.
        </p>
        <PresenceField label="부동산자산 여부" present={hasRealEstateAssets} onChange={(value) => setAssetPresence('assets.realEstateAssets.hasAssets', value, clearRealEstateAssets)} presentLabel="자산 있음" absentLabel="자산 없음" />
        {hasRealEstateAssets ? <>
        <div className="field-grid three-col">
          <PropertyTypeField
            value={getIn(formData, 'assets.realEstateAssets.mainPropertyType')}
            onChange={(value) => setField('assets.realEstateAssets.mainPropertyType', value)}
            label="주요 부동산 종류"
          />
          <NumberField
            path="assets.realEstateAssets.mainProperty"
            label="주요 부동산 시세"
            unit="만원"
            helper={getIn(formData, 'assets.realEstateAssets.mainPropertyType') ? '선택한 주요 보유 부동산 1건의 현재 시세' : '매물 종류를 먼저 선택해 주세요'}
            disabled={!getIn(formData, 'assets.realEstateAssets.mainPropertyType')}
          />
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
          emptyItem={{ type: '', amount: '' }}
          renderItem={(item, _i, update) => (
            <div className="field-grid three-col">
              <PropertyTypeField value={item.type || item.name} onChange={(value) => update('type', value)} />
              <label className="field">
                <span className="field-label">시세</span>
                <div className="field-input-row">
                  <FormattedNumberInput
                    value={item.amount}
                    disabled={!(item.type || item.name)}
                    onChange={(e) => update('amount', Number(e.target.value))}
                  />
                  <span className="field-unit">만원</span>
                </div>
                {!(item.type || item.name) && <span className="field-helper">매물 종류를 먼저 선택해 주세요</span>}
              </label>
            </div>
          )}
        />
        <TotalAmountBox label="부동산자산 총액" amount={realEstateTotal} valueLabel="총액은" />
        <span className="field-helper">부동산 시세와 기타 부동산 시세의 합으로 자동 계산됩니다</span>
        </> : <p className="field-helper">부동산자산 없음으로 선택했습니다.</p>}
      </section>

      <section className="step-section">
        <h3><span className="step-icon">📦</span> 기타 자산</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          위 자산 분류에 포함되지 않는 기타 보유 자산을 입력해 주세요.
        </p>
        <PresenceField label="기타 자산 여부" present={hasOtherAssets} onChange={(value) => setAssetPresence('assets.otherAssets.hasAssets', value, clearOtherAssets)} presentLabel="자산 있음" absentLabel="자산 없음" />
        {hasOtherAssets ? <>
          <RepeatableList
            path="assets.otherAssets.items"
            label="기타 자산 추가"
            addLabel="기타 자산 추가"
            emptyItem={{ name: '', amount: '' }}
            renderItem={(item, _i, update) => (
              <div className="field-grid three-col">
                <label className="field">
                  <span className="field-label">자산 이름</span>
                  <input type="text" placeholder="예: 귀금속" value={item.name} onChange={(e) => update('name', e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">현재 가치</span>
                  <div className="field-input-row">
                    <FormattedNumberInput value={item.amount} onChange={(e) => update('amount', e.target.value === '' ? '' : Number(e.target.value))} />
                    <span className="field-unit">만원</span>
                  </div>
                </label>
              </div>
            )}
          />
          <TotalAmountBox label="기타 자산 총액" amount={otherAssetsTotal} valueLabel="총액은" />
          <span className="field-helper">입력하신 기타 자산의 현재 가치를 자동으로 합산한 금액입니다.</span>
        </> : <p className="field-helper">기타 자산 없음으로 선택했습니다.</p>}
      </section>

      <section className="step-section">
        <h3><span className="step-icon">🧮</span> 자산 합계</h3>
        <table className="grade-table compact">
          <thead>
            <tr><th>구분</th><th style={{ textAlign: 'right' }}>금액</th></tr>
          </thead>
          <tbody>
            <tr><td>현금성 자산</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(liquidAssets)}만원</td></tr>
            <tr><td>금융자산</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(financialAssetsTotal)}만원</td></tr>
            <tr><td>연금자산</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(pensionAssets)}만원</td></tr>
            <tr><td>부동산자산</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(realEstateTotal)}만원</td></tr>
            <tr><td>기타 자산</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(otherAssetsTotal)}만원</td></tr>
            <tr className="total-row"><td>총자산 합계</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(totalAssets)}만원</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
