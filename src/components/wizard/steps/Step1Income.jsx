import { useEffect } from 'react';
import NumberField from '../fields/NumberField';
import RadioField from '../fields/RadioField';
import MonthlyIncomeField from '../fields/MonthlyIncomeField';
import RemainingTermField from '../fields/RemainingTermField';
import SeveranceCalculatorButton from '../fields/SeveranceCalculatorButton';
import PensionCalculatorButton from '../fields/PensionCalculatorButton';
import RegularIncomeListField from '../fields/RegularIncomeListField';
import TotalAmountBox from '../fields/TotalAmountBox';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { initialFormData } from '../../../state/initialFormData';
import { formatNumber } from '../../../utils/format';

// 2024년 통계청 발표 기준 대한민국 평균 기대수명(성별 구분 없는 평균치, 참고용 초기 제안값).
// 출생년도 입력 시 기대수명이 비어 있을 때만 이 값으로 자동 채워지며, 사용자가 직접 수정할 수 있다.
const AVERAGE_LIFE_EXPECTANCY = 84.6;

// 금융감독원 통합연금포털 안내 배너(국민연금·퇴직연금·개인연금 섹션에서 공통으로 사용).
function PensionPortalNotice() {
  return (
    <div className="portal-notice">
      <p>
        아래 통합연금포털을 이용하면 모든 연금을 보다 정확히 확인해 보실 수 있습니다. 단, 연금포털 최초가입자는
        연금조회 신청 후 3일 정도 소요됩니다.
      </p>
      <a
        href="https://www.fss.or.kr/fss/lifeplan/lifeplanIndex/index.do?menuNo=201101"
        target="_blank"
        rel="noopener noreferrer"
      >
        금융감독원 통합연금포털 가기
      </a>
    </div>
  );
}

export default function Step1Income() {
  const { formData, setField } = useFormData();
  const birthYear = getIn(formData, 'basic.birthYear');
  const retirementAge = getIn(formData, 'basic.retirementAge');
  const lifeExpectancy = getIn(formData, 'basic.lifeExpectancy');
  const severanceType = getIn(formData, 'income.severance.type');
  const spouseSeveranceType = getIn(formData, 'spouse.severance.type');
  const personalPensionType = getIn(formData, 'income.personalPension.type');
  const spousePersonalPensionType = getIn(formData, 'spouse.personalPension.type');
  const hasSpouse = !!getIn(formData, 'basic.hasSpouse');

  // 배우자 정보 입력을 끄면, 화면에서 사라진 배우자 항목의 예전 값이 계산에 남아있지 않도록
  // spouse.* 전체를 초기값으로 리셋한다.
  const setHasSpouse = (value) => {
    setField('basic.hasSpouse', value);
    if (!value) setField('spouse', initialFormData.spouse);
  };

  // "현재 기준 소득"은 급여(월급+상여금, 본인+배우자) 합계를 뜻한다. 상여금은 연간 총액으로 입력받아
  // 12로 나눈 월 환산분을 합산에 포함한다(상여금도 실제 소득이므로 가계수지비율·보험료비율 등
  // 소득 기준 지표에 반영되어야 한다). 사업소득은 본인·배우자 구분 없이 income.business(정기수입
  // 목록에서 자동 합산)로 별도 관리되어, 서버 계산(aggregate.js)에서 salaryMonthly + businessMonthly로
  // 합산된다. 예전에는 별도 입력칸이라 급여·사업소득만 채우고 이 칸을 안 채우면 리포트의 "급여" 항목이
  // 0원으로 나오는 문제가 있었다.
  const selfSalaryMonthly = Number(getIn(formData, 'income.salary.monthly')) || 0;
  const spouseSalaryMonthly = Number(getIn(formData, 'spouse.salary.monthly')) || 0;
  const selfAnnualBonus = Number(getIn(formData, 'income.salary.annualBonus')) || 0;
  const spouseAnnualBonus = Number(getIn(formData, 'spouse.salary.annualBonus')) || 0;
  const selfSalaryMonthlyTotal = selfSalaryMonthly + selfAnnualBonus / 12;
  const spouseSalaryMonthlyTotal = spouseSalaryMonthly + spouseAnnualBonus / 12;
  const currentSalaryMonthly = selfSalaryMonthlyTotal + spouseSalaryMonthlyTotal;

  useEffect(() => {
    setField('assets.currentIncome.monthly', currentSalaryMonthly);
    setField('assets.currentIncome.annual', Math.round(currentSalaryMonthly * 12));
  }, [currentSalaryMonthly, setField]);

  // 본인 "남은 퇴직기간"은 출생년도·은퇴(예정) 연령이 모두 입력되면 자동으로 계산된다(수동 입력 불가).
  // 배우자는 출생년도·은퇴연령 입력 항목이 없어 동일한 방식으로 계산할 수 없으므로 수동 입력을 유지한다.
  const currentYear = new Date().getFullYear();
  const selfCurrentAge = birthYear !== '' && birthYear != null ? currentYear - Number(birthYear) : null;
  const selfYearsToRetirement =
    selfCurrentAge != null && retirementAge !== '' && retirementAge != null
      ? Math.max(0, Number(retirementAge) - selfCurrentAge)
      : null;

  useEffect(() => {
    if (selfYearsToRetirement != null) {
      setField('income.salary.months', selfYearsToRetirement * 12);
    }
  }, [selfYearsToRetirement, setField]);

  // "퇴직전 급여 총액"은 은퇴 전까지의 누적 총액이 아니라, 이번 1년(연봉+상여금) 기준 총액이다.
  const selfSalaryAnnualTotal = Math.round(selfSalaryMonthly * 12) + selfAnnualBonus;
  const spouseSalaryAnnualTotal = Math.round(spouseSalaryMonthly * 12) + spouseAnnualBonus;
  const householdSalaryAnnualTotal = selfSalaryAnnualTotal + spouseSalaryAnnualTotal;

  // 퇴직연금 "수령 기간(년)"을 입력하면 "수령 개월 수"가 자동으로 계산된다(직접 입력하지 않음).
  const selfPensionYears = getIn(formData, 'income.severance.pensionYears');
  const spousePensionYears = getIn(formData, 'spouse.severance.pensionYears');

  useEffect(() => {
    if (selfPensionYears !== '' && selfPensionYears != null) {
      setField('income.severance.pensionMonths', Math.round(Number(selfPensionYears) * 12));
    }
  }, [selfPensionYears, setField]);

  useEffect(() => {
    if (spousePensionYears !== '' && spousePensionYears != null) {
      setField('spouse.severance.pensionMonths', Math.round(Number(spousePensionYears) * 12));
    }
  }, [spousePensionYears, setField]);

  // 퇴직연금(월지급) 선택 시 "퇴직금 총액" = 월 수령 금액 × 수령 개월 수.
  const selfPensionMonthly = Number(getIn(formData, 'income.severance.pensionMonthly')) || 0;
  const selfPensionMonths = Number(getIn(formData, 'income.severance.pensionMonths')) || 0;
  const selfPensionTotal = selfPensionMonthly * selfPensionMonths;
  const spousePensionMonthly = Number(getIn(formData, 'spouse.severance.pensionMonthly')) || 0;
  const spousePensionMonths = Number(getIn(formData, 'spouse.severance.pensionMonths')) || 0;
  const spousePensionTotal = spousePensionMonthly * spousePensionMonths;

  // "퇴직금·퇴직연금 총액"(본인+배우자) = 수령 방식이 일시금이면 총 수령 금액, 월지급이면 월×개월 총액,
  // 없음이면 0을 각자 더한 값이다.
  const selfSeveranceTotal =
    severanceType === 'lumpsum'
      ? Number(getIn(formData, 'income.severance.lumpsum')) || 0
      : severanceType === 'pension'
        ? selfPensionTotal
        : 0;
  const spouseSeveranceTotal =
    spouseSeveranceType === 'lumpsum'
      ? Number(getIn(formData, 'spouse.severance.lumpsum')) || 0
      : spouseSeveranceType === 'pension'
        ? spousePensionTotal
        : 0;
  const combinedSeveranceTotal = selfSeveranceTotal + spouseSeveranceTotal;

  // 국민연금 "모의계산": 월평균 소득 × 가입기간(년) × 1.5%로 예상 월 수령액을 계산해 monthly에 반영한다.
  const nationalPensionInputMode = getIn(formData, 'income.nationalPension.inputMode') || 'direct';
  const spouseNationalPensionInputMode = getIn(formData, 'spouse.nationalPension.inputMode') || 'direct';
  const isFilledValue = (v) => v !== '' && v != null && Number.isFinite(Number(v));

  const selfNpAvgIncome = getIn(formData, 'income.nationalPension.simulate.averageMonthlyIncome');
  const selfNpYears = getIn(formData, 'income.nationalPension.simulate.years');
  const selfNpSimulated =
    isFilledValue(selfNpAvgIncome) && isFilledValue(selfNpYears)
      ? Math.round(Number(selfNpAvgIncome) * Number(selfNpYears) * 0.015)
      : null;

  useEffect(() => {
    if (nationalPensionInputMode === 'simulate' && selfNpSimulated != null) {
      setField('income.nationalPension.monthly', selfNpSimulated);
    }
  }, [nationalPensionInputMode, selfNpSimulated, setField]);

  const spouseNpAvgIncome = getIn(formData, 'spouse.nationalPension.simulate.averageMonthlyIncome');
  const spouseNpYears = getIn(formData, 'spouse.nationalPension.simulate.years');
  const spouseNpSimulated =
    isFilledValue(spouseNpAvgIncome) && isFilledValue(spouseNpYears)
      ? Math.round(Number(spouseNpAvgIncome) * Number(spouseNpYears) * 0.015)
      : null;

  useEffect(() => {
    if (spouseNationalPensionInputMode === 'simulate' && spouseNpSimulated != null) {
      setField('spouse.nationalPension.monthly', spouseNpSimulated);
    }
  }, [spouseNationalPensionInputMode, spouseNpSimulated, setField]);

  // 본인 "국민연금 수령 개월 수"는 65세부터 기대수명까지로 자동 계산된다(수동 입력 불가).
  // 배우자는 기대수명 입력 항목이 없어 동일한 방식으로 계산할 수 없으므로 수동 입력을 유지한다.
  const NATIONAL_PENSION_START_AGE = 65;
  const selfNpMonths = isFilledValue(lifeExpectancy)
    ? Math.round(Math.max(0, Number(lifeExpectancy) - NATIONAL_PENSION_START_AGE) * 12)
    : null;

  useEffect(() => {
    if (selfNpMonths != null) {
      setField('income.nationalPension.months', selfNpMonths);
    }
  }, [selfNpMonths, setField]);

  // "국민연금 수령 총액" = 월 수령(예상) 금액 × 수령 개월 수.
  const selfNationalPensionMonthly = Number(getIn(formData, 'income.nationalPension.monthly')) || 0;
  const selfNationalPensionMonths = Number(getIn(formData, 'income.nationalPension.months')) || 0;
  const selfNationalPensionTotal = selfNationalPensionMonthly * selfNationalPensionMonths;
  const spouseNationalPensionMonthly = Number(getIn(formData, 'spouse.nationalPension.monthly')) || 0;
  const spouseNationalPensionMonths = Number(getIn(formData, 'spouse.nationalPension.months')) || 0;
  const spouseNationalPensionTotal = spouseNationalPensionMonthly * spouseNationalPensionMonths;
  const combinedNationalPensionTotal = selfNationalPensionTotal + spouseNationalPensionTotal;

  // "개인연금 수령 총액" = 일시금이면 일시금 수령액 그대로, 분할 수령이면 월 수령액 × 수령 개월 수.
  const selfPersonalPensionTotal =
    personalPensionType === 'lumpsum'
      ? Number(getIn(formData, 'income.personalPension.lumpsum')) || 0
      : (Number(getIn(formData, 'income.personalPension.monthly')) || 0) *
        (Number(getIn(formData, 'income.personalPension.months')) || 0);
  const spousePersonalPensionTotal =
    spousePersonalPensionType === 'lumpsum'
      ? Number(getIn(formData, 'spouse.personalPension.lumpsum')) || 0
      : (Number(getIn(formData, 'spouse.personalPension.monthly')) || 0) *
        (Number(getIn(formData, 'spouse.personalPension.months')) || 0);
  const combinedPersonalPensionTotal = selfPersonalPensionTotal + spousePersonalPensionTotal;

  // 출생년도를 입력하면 기대수명이 비어 있을 때만 평균 기대수명으로 자동 채운다(사용자가 입력한 값은 덮어쓰지 않음).
  useEffect(() => {
    if (birthYear !== '' && birthYear != null && (lifeExpectancy === '' || lifeExpectancy == null)) {
      setField('basic.lifeExpectancy', AVERAGE_LIFE_EXPECTANCY);
    }
  }, [birthYear, lifeExpectancy, setField]);

  const retirementAgeNum = Number(retirementAge);
  const lifeExpectancyNum = Number(lifeExpectancy);
  const retirementYearsCalculable =
    retirementAge !== '' && retirementAge != null &&
    lifeExpectancy !== '' && lifeExpectancy != null &&
    Number.isFinite(retirementAgeNum) && Number.isFinite(lifeExpectancyNum);
  const retirementYears = retirementYearsCalculable
    ? Math.round(Math.max(0, lifeExpectancyNum - retirementAgeNum))
    : null;

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
    (spouseSeveranceType === 'pension'
      ? pick(getIn(formData, 'spouse.severance.pensionMonthly'), getIn(formData, 'spouse.severance.pensionMonths'))
      : 0);

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
    (spouseSeveranceType === 'lumpsum' ? Number(getIn(formData, 'spouse.severance.lumpsum')) || 0 : 0) +
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
            helper="기대 수명나이는 출생년도를 입력하면 자동 계산됩니다. 2024년 대한민국 예상 평균수명은 남성 81.6세, 여성 87.6세 평균 약 84.6세입니다."
          />
          <NumberField
            path="basic.serviceYears"
            label="근속년수"
            unit="년"
            helper="퇴직금 모의계산기에서 사용됩니다"
          />
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <span className="field-label">예상 노후 생활</span>
          <div className="field-computed-box">
            {retirementYears != null ? `${retirementYears}년` : '년'}
          </div>
          <span className="field-helper">
            {retirementYears != null
              ? `직업에서 은퇴하게 될 경우 ${retirementYears}년의 노후 생활 기간이 예상됩니다.`
              : '은퇴(예정) 연령과 기대수명을 입력하면 예상 노후 생활 기간이 자동으로 계산됩니다.'}
          </span>
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
          <MonthlyIncomeField
            monthlyPath="income.salary.monthly"
            annualPath="income.salary.annual"
            label="현재 소득"
          />
          <NumberField path="income.salary.annualBonus" label="상여금" unit="만원(연)" helper="연간 상여금 총액" />
          <label className="field">
            <span className="field-label">남은 퇴직기간</span>
            <div className="field-input-row">
              <input type="number" value={selfYearsToRetirement ?? ''} readOnly />
              <span className="field-unit">년</span>
            </div>
            <span className="field-helper">출생년도·은퇴(예정) 연령을 입력하면 자동으로 계산됩니다</span>
          </label>
        </div>
        <TotalAmountBox label="퇴직전 급여 총액" amount={selfSalaryAnnualTotal} />

        {hasSpouse && (
          <>
            <p className="field-subgroup-label">배우자</p>
            <div className="field-grid three-col">
              <MonthlyIncomeField
                monthlyPath="spouse.salary.monthly"
                annualPath="spouse.salary.annual"
                label="현재 소득"
              />
              <NumberField path="spouse.salary.annualBonus" label="상여금" unit="만원(연)" helper="연간 상여금 총액" />
              <RemainingTermField monthsPath="spouse.salary.months" label="남은 퇴직기간" />
            </div>
            <TotalAmountBox label="퇴직전 급여 총액" amount={spouseSalaryAnnualTotal} />
          </>
        )}

        <TotalAmountBox label="가구 급여총액" amount={householdSalaryAnnualTotal} />
      </section>

      <section className="step-section">
        <h3>📊 현재 기준 소득</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          위 급여(월급+상여금, 본인+배우자) 합계로 자동 계산됩니다. 사업소득은 아래 "기타 정기수입"에서 별도로 합산됩니다.
        </p>
        <div className="field-grid">
          <label className="field">
            <span className="field-label">현재 기준 월 소득</span>
            <div className="field-input-row">
              <input type="number" value={Math.round(currentSalaryMonthly)} readOnly />
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
        <PensionPortalNotice />
        {hasSpouse && <p className="field-subgroup-label">본인</p>}
        <RadioField
          path="income.severance.type"
          label="수령 방식"
          helper="이미 퇴직하여 퇴직금을 수령하신 경우 '없음'을 선택해 주세요"
          options={[
            { value: 'lumpsum', label: '퇴직금(일시금)' },
            { value: 'pension', label: '퇴직연금(월지급)' },
            { value: 'none', label: '없음' },
          ]}
        />
        {severanceType === 'lumpsum' && (
          <>
            <div className="field-grid">
              <NumberField path="income.severance.lumpsum" label="퇴직금 총 수령 금액" unit="만원" />
              <NumberField path="income.severance.lumpsumAge" label="수령 나이" unit="세" />
            </div>
            <SeveranceCalculatorButton
              calcBasePath="income.severance.calc"
              serviceYearsPath="basic.serviceYears"
              lumpsumPath="income.severance.lumpsum"
              lifeExpectancyPath="basic.lifeExpectancy"
              retirementAgePath="basic.retirementAge"
              serviceYearsFromBasicInfo
            />
          </>
        )}
        {severanceType === 'pension' && (
          <>
            <div className="field-grid">
              <NumberField path="income.severance.pensionMonthly" label="퇴직연금 월 수령 금액" unit="만원" />
              <NumberField path="income.severance.pensionYears" label="수령 기간" unit="년" />
              <label className="field">
                <span className="field-label">수령 개월 수</span>
                <div className="field-input-row">
                  <input type="number" value={getIn(formData, 'income.severance.pensionMonths') || ''} readOnly />
                  <span className="field-unit">개월</span>
                </div>
                <span className="field-helper">수령 기간을 입력하면 자동으로 계산됩니다</span>
              </label>
            </div>
            {selfPensionMonthly > 0 && selfPensionMonths > 0 && (
              <TotalAmountBox label="퇴직금 총액" amount={selfPensionTotal} valueLabel="퇴직금 총액은" />
            )}
            <PensionCalculatorButton
              monthlySalaryPath="income.salary.monthly"
              remainingMonthsPath="income.salary.months"
              pensionMonthsPath="income.severance.pensionMonths"
              pensionMonthlyPath="income.severance.pensionMonthly"
            />
          </>
        )}

        {hasSpouse && (
          <>
            <p className="field-subgroup-label">배우자</p>
            <RadioField
              path="spouse.severance.type"
              label="수령 방식"
              helper="이미 퇴직하여 퇴직금을 수령하신 경우 '없음'을 선택해 주세요"
              options={[
                { value: 'lumpsum', label: '퇴직금(일시금)' },
                { value: 'pension', label: '퇴직연금(월지급)' },
                { value: 'none', label: '없음' },
              ]}
            />
            {spouseSeveranceType === 'lumpsum' && (
              <>
                <div className="field-grid">
                  <NumberField path="spouse.severance.lumpsum" label="퇴직금 총 수령 금액" unit="만원" />
                  <NumberField path="spouse.severance.lumpsumAge" label="수령 나이" unit="세" />
                </div>
                <SeveranceCalculatorButton
                  calcBasePath="spouse.severance.calc"
                  serviceYearsPath="spouse.severance.serviceYears"
                  lumpsumPath="spouse.severance.lumpsum"
                />
              </>
            )}
            {spouseSeveranceType === 'pension' && (
              <>
                <div className="field-grid">
                  <NumberField path="spouse.severance.pensionMonthly" label="퇴직연금 월 수령 금액" unit="만원" />
                  <NumberField path="spouse.severance.pensionYears" label="수령 기간" unit="년" />
                  <label className="field">
                    <span className="field-label">수령 개월 수</span>
                    <div className="field-input-row">
                      <input type="number" value={getIn(formData, 'spouse.severance.pensionMonths') || ''} readOnly />
                      <span className="field-unit">개월</span>
                    </div>
                    <span className="field-helper">수령 기간을 입력하면 자동으로 계산됩니다</span>
                  </label>
                </div>
                {spousePensionMonthly > 0 && spousePensionMonths > 0 && (
                  <TotalAmountBox label="퇴직금 총액" amount={spousePensionTotal} valueLabel="퇴직금 총액은" />
                )}
                <PensionCalculatorButton
                  monthlySalaryPath="spouse.salary.monthly"
                  remainingMonthsPath="spouse.salary.months"
                  pensionMonthsPath="spouse.severance.pensionMonths"
                  pensionMonthlyPath="spouse.severance.pensionMonthly"
                />
              </>
            )}
          </>
        )}

        <TotalAmountBox label="퇴직금·퇴직연금 총액" amount={combinedSeveranceTotal} valueLabel="총액은" />
      </section>

      <section className="step-section">
        <h3>🏛️ 국민연금</h3>
        <PensionPortalNotice />
        {hasSpouse && <p className="field-subgroup-label">본인</p>}
        <RadioField
          path="income.nationalPension.inputMode"
          label="입력 방식"
          options={[
            { value: 'direct', label: '직접 입력' },
            { value: 'simulate', label: '모의계산' },
          ]}
        />
        {nationalPensionInputMode === 'simulate' ? (
          <>
            <div className="field-grid three-col">
              <NumberField path="income.nationalPension.simulate.averageMonthlyIncome" label="가입기간 중 월평균급여" unit="만원" />
              <NumberField path="income.nationalPension.simulate.years" label="가입기간" unit="년" />
              <label className="field">
                <span className="field-label">수령 개월 수</span>
                <div className="field-input-row">
                  <input type="number" value={getIn(formData, 'income.nationalPension.months') || ''} readOnly />
                  <span className="field-unit">개월</span>
                </div>
                <span className="field-helper">65세부터 기대수명까지로 자동 계산됩니다</span>
              </label>
            </div>
            <label className="field" style={{ marginTop: 12 }}>
              <span className="field-label">국민연금 월 수령(예상) 금액</span>
              <div className="field-input-row">
                <input type="number" value={getIn(formData, 'income.nationalPension.monthly') || ''} readOnly />
                <span className="field-unit">만원</span>
              </div>
              <span className="field-helper">월평균 소득 × 가입기간 × 1.5%로 자동 계산됩니다</span>
            </label>
          </>
        ) : (
          <div className="field-grid three-col">
            <NumberField
              path="income.nationalPension.monthly"
              label="국민연금 월 수령(예상) 금액"
              unit="만원"
              helper="국민연금공단 예상연금 조회를 참고하셔도 됩니다"
            />
            <label className="field">
              <span className="field-label">수령 개월 수</span>
              <div className="field-input-row">
                <input type="number" value={getIn(formData, 'income.nationalPension.months') || ''} readOnly />
                <span className="field-unit">개월</span>
              </div>
              <span className="field-helper">65세부터 기대수명까지로 자동 계산됩니다</span>
            </label>
            <NumberField path="income.nationalPension.paymentYears" label="국민연금 납입기간" unit="년" />
          </div>
        )}
        {selfNationalPensionMonthly > 0 && selfNationalPensionMonths > 0 && (
          <TotalAmountBox label="국민연금 수령 총액" amount={selfNationalPensionTotal} valueLabel="수령 총액은" />
        )}

        {hasSpouse && (
          <>
            <p className="field-subgroup-label">배우자</p>
            <RadioField
              path="spouse.nationalPension.inputMode"
              label="입력 방식"
              options={[
                { value: 'direct', label: '직접 입력' },
                { value: 'simulate', label: '모의계산' },
              ]}
            />
            {spouseNationalPensionInputMode === 'simulate' ? (
              <>
                <div className="field-grid three-col">
                  <NumberField path="spouse.nationalPension.simulate.averageMonthlyIncome" label="가입기간 중 월평균급여" unit="만원" />
                  <NumberField path="spouse.nationalPension.simulate.years" label="가입기간" unit="년" />
                  <NumberField path="spouse.nationalPension.months" label="수령 개월 수" unit="개월" />
                </div>
                <label className="field" style={{ marginTop: 12 }}>
                  <span className="field-label">국민연금 월 수령(예상) 금액</span>
                  <div className="field-input-row">
                    <input type="number" value={getIn(formData, 'spouse.nationalPension.monthly') || ''} readOnly />
                    <span className="field-unit">만원</span>
                  </div>
                  <span className="field-helper">월평균 소득 × 가입기간 × 1.5%로 자동 계산됩니다</span>
                </label>
              </>
            ) : (
              <div className="field-grid three-col">
                <NumberField path="spouse.nationalPension.monthly" label="국민연금 월 수령(예상) 금액" unit="만원" />
                <NumberField path="spouse.nationalPension.months" label="수령 개월 수" unit="개월" />
                <NumberField path="spouse.nationalPension.paymentYears" label="국민연금 납입기간" unit="년" />
              </div>
            )}
            {spouseNationalPensionMonthly > 0 && spouseNationalPensionMonths > 0 && (
              <TotalAmountBox label="국민연금 수령 총액" amount={spouseNationalPensionTotal} valueLabel="수령 총액은" />
            )}
          </>
        )}

        <TotalAmountBox label="국민연금 수령 총액(본인+배우자)" amount={combinedNationalPensionTotal} valueLabel="총액은" />
      </section>

      <section className="step-section">
        <h3>🐷 개인연금</h3>
        <PensionPortalNotice />
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
            <>
              <NumberField path="income.personalPension.lumpsum" label="개인연금 일시금 수령액" unit="만원" />
              <NumberField path="income.personalPension.lumpsumAge" label="수령 나이" unit="세" />
            </>
          ) : (
            <>
              <NumberField path="income.personalPension.monthly" label="개인연금 월 수령액" unit="만원" />
              <NumberField path="income.personalPension.months" label="수령 개월 수" unit="개월" />
            </>
          )}
        </div>
        {selfPersonalPensionTotal > 0 && (
          <TotalAmountBox label="개인연금 수령 총액" amount={selfPersonalPensionTotal} valueLabel="수령 총액은" />
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
                <>
                  <NumberField path="spouse.personalPension.lumpsum" label="개인연금 일시금 수령액" unit="만원" />
                  <NumberField path="spouse.personalPension.lumpsumAge" label="수령 나이" unit="세" />
                </>
              ) : (
                <>
                  <NumberField path="spouse.personalPension.monthly" label="개인연금 월 수령액" unit="만원" />
                  <NumberField path="spouse.personalPension.months" label="수령 개월 수" unit="개월" />
                </>
              )}
            </div>
            {spousePersonalPensionTotal > 0 && (
              <TotalAmountBox label="개인연금 수령 총액" amount={spousePersonalPensionTotal} valueLabel="수령 총액은" />
            )}
          </>
        )}

        <TotalAmountBox label="개인연금 수령 총액(본인+배우자)" amount={combinedPersonalPensionTotal} valueLabel="총액은" />
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
            <tr><td>급여(상여금 포함)</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(Math.round(currentSalaryMonthly))}만원</td></tr>
            <tr><td>사업소득</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(businessMonthly)}만원</td></tr>
            <tr><td>국민연금</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(nationalPensionTotal)}만원</td></tr>
            <tr><td>퇴직연금</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(severanceTotal)}만원</td></tr>
            <tr><td>개인연금</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(personalPensionTotal)}만원</td></tr>
            <tr><td>기타 정기수입(연 환산)</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(Math.round(otherIncomesMonthly))}만원</td></tr>
            <tr className="total-row"><td>총 월 수입 합계</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(Math.round(totalMonthlyIncome))}만원</td></tr>
            <tr className="total-row"><td>총 연 수입 합계</td><td className="num" style={{ textAlign: 'right' }}>{formatNumber(Math.round(totalMonthlyIncome) * 12)}만원</td></tr>
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
