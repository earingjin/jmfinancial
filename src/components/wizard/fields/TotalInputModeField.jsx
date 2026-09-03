import { useEffect } from 'react';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import FormattedNumberInput from './FormattedNumberInput';
import TotalAmountBox from './TotalAmountBox';
import { changeTotalInputMode } from './inputModeTransitions';

const amount = (value) => Number(value) || 0;

export default function TotalInputModeField({
  modePath, totalPath, simpleTotalPath, simpleStoredPath, detailedTotal,
  detailedHasInput = true, totalLabel, inputLabel, children, annualPath, simpleAnnualPath,
}) {
  const { formData, setField } = useFormData();
  const mode = getIn(formData, modePath) || 'detailed';
  const total = getIn(formData, totalPath);

  const changeMode = (nextMode) => changeTotalInputMode({
    formData, setField, nextMode, modePath, totalPath, simpleTotalPath, simpleStoredPath,
    detailedTotal, detailedHasInput, annualPath, simpleAnnualPath, totalLabel, confirmChange: (message) => window.confirm(message),
  });

  useEffect(() => {
    const nextTotal = detailedHasInput ? detailedTotal : '';
    if (mode !== 'detailed' || total === nextTotal) return;
    setField(totalPath, nextTotal);
    if (annualPath) setField(annualPath, nextTotal === '' ? '' : Math.round(amount(detailedTotal) * 12));
  }, [annualPath, detailedHasInput, detailedTotal, mode, setField, total, totalPath]);

  const updateSimple = (raw) => {
    const value = raw === '' ? '' : Number(raw);
    setField(totalPath, value);
    setField(simpleTotalPath, value);
    if (annualPath) setField(annualPath, value === '' ? '' : Math.round(value * 12));
    if (simpleAnnualPath) setField(simpleAnnualPath, value === '' ? '' : Math.round(value * 12));
    setField(simpleStoredPath, true);
  };

  return <div className="field">
    <span className="field-label">입력 방식을 선택해 주세요</span>
    <div className="radio-group" style={{ marginTop: 8, marginBottom: 14 }}>
      <button type="button" className={`radio-pill ${mode === 'simple' ? 'is-active' : ''}`} onClick={() => changeMode('simple')}>총액으로 한 번에 입력</button>
      <button type="button" className={`radio-pill ${mode === 'detailed' ? 'is-active' : ''}`} onClick={() => changeMode('detailed')}>항목별로 자세히 입력</button>
    </div>
    {mode === 'simple' ? <>
      <label className="field" style={{ marginBottom: 14 }}>
        <span className="field-label">{inputLabel || totalLabel}</span>
        <div className="field-input-row"><FormattedNumberInput min={0} value={total ?? ''} onChange={(e) => updateSimple(e.target.value)} /><span className="field-unit">만원</span></div>
      </label>
      <TotalAmountBox label={totalLabel} amount={amount(total)} valueLabel="총액은" />
    </> : children}
  </div>;
}
