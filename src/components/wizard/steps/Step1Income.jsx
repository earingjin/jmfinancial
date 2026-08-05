import { useEffect } from 'react';
import NumberField from '../fields/NumberField';
import RadioField from '../fields/RadioField';
import AnnualIncomeField from '../fields/AnnualIncomeField';
import RemainingTermField from '../fields/RemainingTermField';
import RegularIncomeListField from '../fields/RegularIncomeListField';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { initialFormData } from '../../../state/initialFormData';

export default function Step1Income() {
  const { formData, setField } = useFormData();
  const severanceType = getIn(formData, 'income.severance.type');
  const personalPensionType = getIn(formData, 'income.personalPension.type');
  const spousePersonalPensionType = getIn(formData, 'spouse.personalPension.type');
  const hasSpouse = !!getIn(formData, 'basic.hasSpouse');

  // 배우자 정보 입력을 끄면, 화면에서 사라진 배우자 항목의 예전 값이 계산에 남아있지 않도록
  // spouse.* 전체를 초기값으로 리셋한다.
  const setHasSpouse = (value) => {
    setField('basic.hasSpouse', value);
    if (!value) setField('spouse', initialFormData.spouse);
  };

  // "현재 기준 소득"은 급여(본인+배우자) 합계만을 뜻한다. 사업소득은 본인·배우자 구분 없이
  // income.business(정기수입 목록에서 자동 합산)로 별도 관리되어, 서버 계산(aggregate.js)에서
  // salaryMonthly + businessMonthly로 합산된다. 예전에는 별도 입력칸이라 급여·사업소득만
  // 채우고 이 칸을 안 채우면 리포트의 "급여" 항목이 0원으로 나오는 문제가 있었다.
  const selfSalaryMonthly = Number(getIn(formData, 'income.salary.monthly')) || 0;
  const spouseSalaryMonthly = Number(getIn(formData, 'spouse.salary.monthly')) || 0;
  const currentSalaryMonthly = selfSalaryMonthly + spouseSalaryMonthly;

  useEffect(() => {
    setField('assets.currentIncome.monthly', currentSalaryMonthly);
    setField('assets.currentIncome.annual', Math.round(currentSalaryMonthly * 12));
  }, [currentSalaryMonthly, setField]);

  const businessMonthly = Number(getIn(formData, 'income.business.monthly')) || 0;

  // "총 수입 합계"는 급여·사업소득뿐 아니라 수령 개월 수(또는 기간)가 입력된 연금·정기수입까지
  // 전부 합산한 값이다. 퇴직금·개인연금 일시금은 자산 성격이라 별도(참고용)로만 표시한다.
  const pick = (monthly, months) => (Number(months) > 0 ? Number(monthly) || 0 : 0);

  const nationalPensionTotal =
    pick(getIn(formData, 'income.nationalPension.monthly'), getIn(formData, 'income.nationalPension.months')) +
    pick(getIn(formData, 'spouse.nationalPension.monthly'), getIn(formData, 'spouse.nationalPension.months'));

  const severanceTotal =
    (severanceType === 'pension'
      ? pick(getIn(formData, 'income.severance.pensionMonthly'), getIn(formData, 'income.severance.pensionMonths'))
      : 0) +
    pick(getIn(formData, 'spouse.severance.pensionMonthly'), getIn(formData, 'spouse.severance.pensionMonths'));

  const personalPensionTotal =
    (personalPensionType === 'installment'
      ? pick(getIn(formData, 'income.personalPension.monthly'), getIn(formData, 'income.personalPension.months'))
      : 0) +
    (spousePersonalPensionType === 'installment'
      ? pick(getIn(formData, 'spouse.personalPension.monthly'), getIn(formData, 'spouse.personalPension.months'))
      : 0);

  const otherIncomes = getIn(formData, 'income.otherIncomes') || [];
  const otherIncomesMonthly = otherIncomes.reduce((s, item) => s + (Number(item.annual) || 0), 0) / 12;

  const totalMonthlyIncome =
    currentSalaryMonthly + businessMonthly + nationalPensionTotal + severanceTotal + personalPensionTotal + otherIncomesMonthly;

  const lumpSumTotal =
    (severanceType === 'lumpsum' ? Number(getIn(formData, 'income.severance.lumpsum')) || 0 : 0) +
    (Number(getIn(formData, 'spouse.severance.lumpsum')) || 0) +
    (personalPensionType === 'lumpsum' ? Number(getIn(formData, 'income.personalPension.lumpsum')) || 0 : 0) +
    (spousePersonalPensionType === 'lumpsum' ? Number(getIn(formData, 'spouse.personalPension.lumpsum')) || 0 : 0);

  return (
    <div className="step">
      <h2 className="step-title">1. 수입</h2>
      <p className="step-desc">본인의 수입 항목을 입력합니다. 해당 사항이 없으면 0으로 입력해 주세요. 배우자가 있다면 아래에서 "배우자 정보 입력"을 선택해 주세요.</p>

      <section className="step-section">
        <h3>📝 기본 정보</h3>
        <div className="field-grid">
          <NumberField path="basic.birthYear" label="본인 출생년도" placeholder="예: 1968" />
          <NumberField path="basic.retirementAge" label="은퇴(예정) 연령" unit="세" />
          <NumberField
            path="basic.lifeExpectancy"
            label="기대수명"
            unit="세"
            helper="노후 생활비가 필요한 기간 계산에 사용하는 예상 수명"
          />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <span className="field-label">배우자</span>
          <div className="radio-group" style={{ marginTop: 6 }}>
            <button type="button" className={`radio-pill ${!hasSpouse ? 'is-active' : ''}`} onClick={() => setHasSpouse(false)}>
              배우자 없음
            </button>
            <button type="button" className={`radio-pill ${hasSpouse ? 'is-active' : ''}`} onClick={() => setHasSpouse(true)}>
              배우자 정보 입력
            </button>
          </div>
        </div>
      </section>

      <section className="step-section">
        <h3>💵 급여</h3>
        {hasSpouse && <p className="field-subgroup-label">본인</p>}
        <div className="field-grid three-col">
          <AnnualIncomeField
            annualPath="income.salary.annual"
            monthlyPath="income.salary.monthly"
            label="현재 소득"
          />
          <RemainingTermField monthsPath="income.salary.months" label="남은 퇴직기간" />
        </div>
        {hasSpouse && (
          <>
            <p className="field-subgroup-label">배우자</p>
            <div className="field-grid three-col">
              <AnnualIncomeField
                annualPath="spouse.salary.annual"
                monthlyPath="spouse.salary.monthly"
                label="현재 소득"
              />
              <RemainingTermField monthsPath="spouse.salary.months" label="남은 퇴직기간" />
            </div>
          </>
        )}
      </section>

      <section className="step-section">
        <h3>📊 현재 기준 소득</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          위 급여(본인+배우자) 합계로 자동 계산됩니다. 사업소득은 아래 "기타 정기수입"에서 별도로 합산됩니다.
        </p>
        <div className="field-grid">
          <label className="field">
            <span className="field-label">현재 기준 월 소득</span>
            <div className="field-input-row">
              <input type="number" value={currentSalaryMonthly} readOnly />
              <span className="field-unit">만원</span>
            </div>
          </label>
          <label className="field">
            <span className="field-label">현재 기준 연 소득</span>
            <div className="field-input-row">
              <input type="number" value={Math.round(currentSalaryMonthly * 12)} readOnly />
              <span className="field-unit">만원</span>
            </div>
          </label>
        </div>
      </section>

      <section className="step-section">
        <h3>💼 퇴직금 · 퇴직연금</h3>
        {hasSpouse && <p className="field-subgroup-label">본인</p>}
        <RadioField
          path="income.severance.type"
          label="수령 방식"
          options={[
            { value: 'lumpsum', label: '퇴직금(일시금)' },
            { value: 'pension', label: '퇴직연금(월지급)' },
          ]}
        />
        <div className="field-grid">
          {severanceType === 'lumpsum' ? (
            <NumberField path="income.severance.lumpsum" label="퇴직금 총 수령 금액" unit="만원" />
          ) : (
            <>
              <NumberField path="income.severance.pensionMonthly" label="퇴직연금 월 수령 금액" unit="만원" />
              <NumberField path="income.severance.pensionMonths" label="퇴직연금 수령 개월 수" unit="개월" />
            </>
          )}
        </div>
        {severanceType !== 'lumpsum' && (
          <RadioField
            path="income.severance.inflationLinked"
            label="퇴직연금 물가연동 여부"
            helper="정액형은 수령액이 고정되어 시간이 지날수록 실질가치가 하락합니다"
            options={[
              { value: true, label: '물가연동형' },
              { value: false, label: '정액형(고정)' },
            ]}
          />
        )}

        {hasSpouse && (
          <>
            <p className="field-subgroup-label">배우자</p>
            <div className="field-grid">
              <NumberField path="spouse.severance.lumpsum" label="퇴직금" unit="만원" />
              <NumberField path="spouse.severance.pensionMonthly" label="월 퇴직연금" unit="만원" />
              <NumberField path="spouse.severance.pensionMonths" label="퇴직연금 수령 개월 수" unit="개월" />
            </div>
            <RadioField
              path="spouse.severance.inflationLinked"
              label="퇴직연금 물가연동 여부"
              helper="정액형은 수령액이 고정되어 시간이 지날수록 실질가치가 하락합니다. 월 퇴직연금이 없으면 해당 없음"
              options={[
                { value: true, label: '물가연동형' },
                { value: false, label: '정액형(고정)' },
              ]}
            />
          </>
        )}
      </section>

      <section className="step-section">
        <h3>🏛️ 국민연금</h3>
        {hasSpouse && <p className="field-subgroup-label">본인</p>}
        <div className="field-grid">
          <NumberField
            path="income.nationalPension.monthly"
            label="국민연금 월 수령(예상) 금액"
            unit="만원"
            helper="국민연금공단 예상연금 조회를 참고하셔도 됩니다"
          />
          <NumberField path="income.nationalPension.months" label="수령 개월 수" unit="개월" />
        </div>
        {hasSpouse && (
          <>
            <p className="field-subgroup-label">배우자</p>
            <div className="field-grid">
              <NumberField path="spouse.nationalPension.monthly" label="국민연금 월 수령(예상) 금액" unit="만원" />
              <NumberField path="spouse.nationalPension.months" label="수령 개월 수" unit="개월" />
            </div>
          </>
        )}
      </section>

      <section className="step-section">
        <h3>🐷 개인연금</h3>
        {hasSpouse && <p className="field-subgroup-label">본인</p>}
        <RadioField
          path="income.personalPension.type"
          label="수령 방식"
          helper="개인연금이 없다면 분할 수령을 선택하고 0으로 입력해 주세요"
          options={[
            { value: 'lumpsum', label: '일시금 수령' },
            { value: 'installment', label: '분할 수령' },
          ]}
        />
        <div className="field-grid">
          {personalPensionType === 'lumpsum' ? (
            <NumberField path="income.personalPension.lumpsum" label="개인연금 일시금 수령액" unit="만원" />
          ) : (
            <>
              <NumberField path="income.personalPension.monthly" label="개인연금 월 수령액" unit="만원" />
              <NumberField path="income.personalPension.months" label="수령 개월 수" unit="개월" />
            </>
          )}
        </div>
        {personalPensionType === 'installment' && (
          <RadioField
            path="income.personalPension.inflationLinked"
            label="개인연금 물가연동 여부"
            helper="정액형은 수령액이 고정되어 시간이 지날수록 실질가치가 하락합니다"
            options={[
              { value: true, label: '물가연동형' },
              { value: false, label: '정액형(고정)' },
            ]}
          />
        )}

        {hasSpouse && (
          <>
            <p className="field-subgroup-label">배우자</p>
            <RadioField
              path="spouse.personalPension.type"
              label="수령 방식"
              options={[
                { value: 'lumpsum', label: '일시금 수령' },
                { value: 'installment', label: '분할 수령' },
              ]}
            />
            <div className="field-grid">
              {spousePersonalPensionType === 'lumpsum' ? (
                <NumberField path="spouse.personalPension.lumpsum" label="개인연금 일시금 수령액" unit="만원" />
              ) : (
                <>
                  <NumberField path="spouse.personalPension.monthly" label="개인연금 월 수령액" unit="만원" />
                  <NumberField path="spouse.personalPension.months" label="수령 개월 수" unit="개월" />
                </>
              )}
            </div>
            {spousePersonalPensionType === 'installment' && (
              <RadioField
                path="spouse.personalPension.inflationLinked"
                label="개인연금 물가연동 여부"
                helper="정액형은 수령액이 고정되어 시간이 지날수록 실질가치가 하락합니다"
                options={[
                  { value: true, label: '물가연동형' },
                  { value: false, label: '정액형(고정)' },
                ]}
              />
            )}
          </>
        )}
      </section>

      <section className="step-section">
        <h3>📈 기타 정기수입 (사업소득 포함)</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          사업소득은 본인·배우자 구분 없이 아래 목록에 합산해 입력해 주세요. "사업소득"으로 표시한 항목은
          총소득(가계수지비율 · 보험료비율 등) 계산에 포함되고, "기타 수입"은 참고용 정기수입으로 별도 집계됩니다.
        </p>
        <RegularIncomeListField
          path="income.regularIncomes"
          businessMonthlyPath="income.business.monthly"
          businessAnnualPath="income.business.annual"
          otherIncomesPath="income.otherIncomes"
        />
      </section>

      <section className="step-section">
        <h3>🧮 총 수입 합계</h3>
        <table className="grade-table compact">
          <thead>
            <tr><th>항목</th><th style={{ textAlign: 'right' }}>월 금액</th></tr>
          </thead>
          <tbody>
            <tr><td>급여</td><td className="num" style={{ textAlign: 'right' }}>{currentSalaryMonthly}만원</td></tr>
            <tr><td>사업소득</td><td className="num" style={{ textAlign: 'right' }}>{businessMonthly}만원</td></tr>
            <tr><td>국민연금</td><td className="num" style={{ textAlign: 'right' }}>{nationalPensionTotal}만원</td></tr>
            <tr><td>퇴직연금</td><td className="num" style={{ textAlign: 'right' }}>{severanceTotal}만원</td></tr>
            <tr><td>개인연금</td><td className="num" style={{ textAlign: 'right' }}>{personalPensionTotal}만원</td></tr>
            <tr><td>기타 정기수입(연 환산)</td><td className="num" style={{ textAlign: 'right' }}>{Math.round(otherIncomesMonthly)}만원</td></tr>
            <tr className="total-row"><td>총 월 수입 합계</td><td className="num" style={{ textAlign: 'right' }}>{Math.round(totalMonthlyIncome)}만원</td></tr>
            <tr className="total-row"><td>총 연 수입 합계</td><td className="num" style={{ textAlign: 'right' }}>{Math.round(totalMonthlyIncome) * 12}만원</td></tr>
          </tbody>
        </table>
        <span className="field-helper">
          수령 개월 수(또는 기간)가 입력된 연금·수입만 합산됩니다.
        </span>
        {lumpSumTotal > 0 && (
          <div className="field-grid" style={{ marginTop: 10 }}>
            <label className="field">
              <span className="field-label">일시금 수입 합계(참고용)</span>
              <div className="field-input-row">
                <input type="number" value={lumpSumTotal} readOnly />
                <span className="field-unit">만원</span>
              </div>
              <span className="field-helper">퇴직금·개인연금 일시금 수령액 합계로, 자산 성격이라 위 월 수입 합계에는 포함되지 않습니다</span>
            </label>
          </div>
        )}
      </section>
    </div>
  );
}
