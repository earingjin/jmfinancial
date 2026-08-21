import { useEffect, useRef } from 'react';
import NumberField from '../fields/NumberField';
import RadioField from '../fields/RadioField';
import MonthlyIncomeField from '../fields/MonthlyIncomeField';
import SeveranceCalculatorButton from '../fields/SeveranceCalculatorButton';
import PensionCalculatorButton from '../fields/PensionCalculatorButton';
import RegularIncomeListField from '../fields/RegularIncomeListField';
import TotalAmountBox from '../fields/TotalAmountBox';
import { useFormData } from '../../../state/formState';
import { getIn } from '../../../state/pathUtils';
import { initialFormData } from '../../../state/initialFormData';
import { formatNumber, formatWon } from '../../../utils/format';
import { getNationalPensionStartAge } from '../../../utils/pensionEligibility';
import FormattedNumberInput from '../fields/FormattedNumberInput';

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
  const lifeExpectancyEditedRef = useRef(false);
  const severanceType = getIn(formData, 'income.severance.type');
  const spouseSeveranceType = getIn(formData, 'spouse.severance.type');
  const personalPensionType = getIn(formData, 'income.personalPension.type');
  const spousePersonalPensionType = getIn(formData, 'spouse.personalPension.type');
  const hasSpouse = !!getIn(formData, 'basic.hasSpouse');
  const spouseBirthYear = getIn(formData, 'spouse.birthYear');
  const spouseRetirementAge = getIn(formData, 'spouse.retirementAge');
  const spouseLifeExpectancy = getIn(formData, 'spouse.lifeExpectancy');
  const spouseLifeExpectancyEditedRef = useRef(false);
  const selfHasSalary = getIn(formData, 'income.salary.hasSalary') !== false;
  const spouseHasSalary = getIn(formData, 'spouse.salary.hasSalary') !== false;

  // 배우자 정보 입력을 끄면, 화면에서 사라진 배우자 항목의 예전 값이 계산에 남아있지 않도록
  // spouse.* 전체를 초기값으로 리셋한다.
  const setHasSpouse = (value) => {
    setField('basic.hasSpouse', value);
    if (!value) setField('spouse', initialFormData.spouse);
  };

  const setHasSalary = (basePath, value) => {
    setField(`${basePath}.hasSalary`, value);
    if (!value) {
      setField(`${basePath}.monthly`, 0);
      setField(`${basePath}.annual`, 0);
      setField(`${basePath}.annualBonus`, 0);
    }
  };

  const clearPensionValues = (basePath, fields) => {
    fields.forEach((field) => setField(`${basePath}.${field}`, 0));
  };

  const handleNationalPensionMode = (basePath, value) => {
    if (value === 'none') {
      clearPensionValues(basePath, ['monthly', 'months', 'paymentMonths', 'paymentYears']);
      clearPensionValues(`${basePath}.simulate`, ['averageMonthlyIncome', 'contributionMonths', 'years']);
    }
  };

  const handlePersonalPensionType = (basePath, value) => {
    if (value === 'none') {
      clearPensionValues(basePath, ['lumpsum', 'lumpsumAge', 'monthly', 'startAge', 'months']);
    }
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

  // 본인과 배우자의 "남은 퇴직기간"은 각자의 출생년도·은퇴(예정) 연령으로 자동 계산한다.
  const currentYear = new Date().getFullYear();
  const selfCurrentAge = birthYear !== '' && birthYear != null ? currentYear - Number(birthYear) : null;
  const selfYearsToRetirement =
    selfCurrentAge != null && retirementAge !== '' && retirementAge != null
      ? Math.max(0, Number(retirementAge) - selfCurrentAge)
      : null;
  const spouseCurrentAge = spouseBirthYear !== '' && spouseBirthYear != null ? currentYear - Number(spouseBirthYear) : null;
  const spouseYearsToRetirement =
    spouseCurrentAge != null && spouseRetirementAge !== '' && spouseRetirementAge != null
      ? Math.max(0, Number(spouseRetirementAge) - spouseCurrentAge)
      : null;

  useEffect(() => {
    if (selfYearsToRetirement != null) {
      setField('income.salary.months', selfYearsToRetirement * 12);
    }
  }, [selfYearsToRetirement, setField]);

  useEffect(() => {
    if (hasSpouse && spouseYearsToRetirement != null) {
      setField('spouse.salary.months', spouseYearsToRetirement * 12);
    }
  }, [hasSpouse, spouseYearsToRetirement, setField]);

  // "퇴직전 급여 총액"(사용자 승인) = 이번 1년(연봉+상여금) 기준 총액 × 은퇴까지 남은 기간(년).
  // 매년 급여가 동일하다고 가정하는 단순화이며, 실제 계산(aggregate.js 등)에는 쓰이지 않는
  // 이 화면 전용 참고 표시값이다. 남은 기간을 아직 계산할 수 없으면(출생년도·은퇴연령 미입력) 0으로 둔다.
  const selfSalaryThisYearTotal = Math.round(selfSalaryMonthly * 12) + selfAnnualBonus;
  const spouseSalaryThisYearTotal = Math.round(spouseSalaryMonthly * 12) + spouseAnnualBonus;
  const selfSalaryLifetimeTotal = selfSalaryThisYearTotal * (selfYearsToRetirement ?? 0);
  const spouseSalaryLifetimeTotal = spouseSalaryThisYearTotal * (spouseYearsToRetirement ?? 0);
  const householdSalaryLifetimeTotal = selfSalaryLifetimeTotal + spouseSalaryLifetimeTotal;

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

  // 실제 납부 개월 수를 12로 나눠 가입기간(년)을 산출한다. 120개월 이상일 때만 노령연금 수급 대상으로 본다.
  const nationalPensionInputMode = getIn(formData, 'income.nationalPension.inputMode') || 'direct';
  const spouseNationalPensionInputMode = getIn(formData, 'spouse.nationalPension.inputMode') || 'direct';
  const isFilledValue = (v) => v !== '' && v != null && Number.isFinite(Number(v));

  const selfNpAvgIncome = getIn(formData, 'income.nationalPension.simulate.averageMonthlyIncome');
  const selfNpContributionMonths = getIn(formData, 'income.nationalPension.simulate.contributionMonths');
  const selfNpPaymentMonths = getIn(formData, 'income.nationalPension.paymentMonths');
  const selfNpLegacyContributionYears = getIn(formData, 'income.nationalPension.simulate.years');
  const selfNpLegacyPaymentYears = getIn(formData, 'income.nationalPension.paymentYears');
  const selfNpEffectiveContributionMonths = isFilledValue(selfNpContributionMonths)
    ? Number(selfNpContributionMonths)
    : (isFilledValue(selfNpLegacyContributionYears) ? Number(selfNpLegacyContributionYears) * 12 : '');
  const selfNpEffectivePaymentMonths = isFilledValue(selfNpPaymentMonths)
    ? Number(selfNpPaymentMonths)
    : (isFilledValue(selfNpLegacyPaymentYears) ? Number(selfNpLegacyPaymentYears) * 12 : '');
  const selfNpContributionYears = isFilledValue(selfNpEffectiveContributionMonths) ? Number(selfNpEffectiveContributionMonths) / 12 : null;
  const selfNpPaymentYears = isFilledValue(selfNpEffectivePaymentMonths) ? Number(selfNpEffectivePaymentMonths) / 12 : null;
  const selfNpEligibilityMonths = nationalPensionInputMode === 'simulate' ? selfNpEffectiveContributionMonths : selfNpEffectivePaymentMonths;
  const selfNpEligible = isFilledValue(selfNpEligibilityMonths) && Number(selfNpEligibilityMonths) >= 120;
  const selfNpSimulated =
    isFilledValue(selfNpAvgIncome) && selfNpContributionYears != null && selfNpEligible
      ? Math.round(Number(selfNpAvgIncome) * selfNpContributionYears * 0.015)
      : null;

  useEffect(() => {
    setField('income.nationalPension.simulate.years', selfNpContributionYears ?? '');
  }, [selfNpContributionYears, setField]);

  useEffect(() => {
    setField('income.nationalPension.paymentYears', selfNpPaymentYears ?? '');
  }, [selfNpPaymentYears, setField]);

  useEffect(() => {
    if (nationalPensionInputMode === 'simulate') {
      setField('income.nationalPension.monthly', selfNpSimulated ?? '');
    }
  }, [nationalPensionInputMode, selfNpSimulated, setField]);

  const spouseNpAvgIncome = getIn(formData, 'spouse.nationalPension.simulate.averageMonthlyIncome');
  const spouseNpContributionMonths = getIn(formData, 'spouse.nationalPension.simulate.contributionMonths');
  const spouseNpPaymentMonths = getIn(formData, 'spouse.nationalPension.paymentMonths');
  const spouseNpLegacyContributionYears = getIn(formData, 'spouse.nationalPension.simulate.years');
  const spouseNpLegacyPaymentYears = getIn(formData, 'spouse.nationalPension.paymentYears');
  const spouseNpEffectiveContributionMonths = isFilledValue(spouseNpContributionMonths)
    ? Number(spouseNpContributionMonths)
    : (isFilledValue(spouseNpLegacyContributionYears) ? Number(spouseNpLegacyContributionYears) * 12 : '');
  const spouseNpEffectivePaymentMonths = isFilledValue(spouseNpPaymentMonths)
    ? Number(spouseNpPaymentMonths)
    : (isFilledValue(spouseNpLegacyPaymentYears) ? Number(spouseNpLegacyPaymentYears) * 12 : '');
  const spouseNpContributionYears = isFilledValue(spouseNpEffectiveContributionMonths) ? Number(spouseNpEffectiveContributionMonths) / 12 : null;
  const spouseNpPaymentYears = isFilledValue(spouseNpEffectivePaymentMonths) ? Number(spouseNpEffectivePaymentMonths) / 12 : null;
  const spouseNpEligibilityMonths = spouseNationalPensionInputMode === 'simulate' ? spouseNpEffectiveContributionMonths : spouseNpEffectivePaymentMonths;
  const spouseNpEligible = isFilledValue(spouseNpEligibilityMonths) && Number(spouseNpEligibilityMonths) >= 120;
  const spouseNpSimulated =
    isFilledValue(spouseNpAvgIncome) && spouseNpContributionYears != null && spouseNpEligible
      ? Math.round(Number(spouseNpAvgIncome) * spouseNpContributionYears * 0.015)
      : null;

  useEffect(() => {
    setField('spouse.nationalPension.simulate.years', spouseNpContributionYears ?? '');
  }, [spouseNpContributionYears, setField]);

  useEffect(() => {
    setField('spouse.nationalPension.paymentYears', spouseNpPaymentYears ?? '');
  }, [spouseNpPaymentYears, setField]);

  useEffect(() => {
    if (spouseNationalPensionInputMode === 'simulate') {
      setField('spouse.nationalPension.monthly', spouseNpSimulated ?? '');
    }
  }, [spouseNationalPensionInputMode, spouseNpSimulated, setField]);

  // 국민연금 수령 개월 수는 출생연도별 법정 개시 연령부터 기대수명까지로 자동 계산한다.
  const selfNpStartAge = isFilledValue(birthYear) ? getNationalPensionStartAge(Number(birthYear)) : null;
  const spouseNpStartAge = isFilledValue(spouseBirthYear) ? getNationalPensionStartAge(Number(spouseBirthYear)) : null;
  // 수령기간 자체는 출생연도와 기대수명만으로 정해지므로 납부 개월 수 입력 전에도 바로 표시한다.
  // 최소 120개월 가입요건은 예상 연금액의 산출·반영 여부에만 적용한다.
  const selfNpMonths = nationalPensionInputMode !== 'none' && selfNpStartAge != null && isFilledValue(lifeExpectancy)
    ? Math.round(Math.max(0, Number(lifeExpectancy) - selfNpStartAge) * 12)
    : null;
  const spouseNpMonths = hasSpouse && spouseNationalPensionInputMode !== 'none' && spouseNpStartAge != null && isFilledValue(spouseLifeExpectancy || lifeExpectancy)
    ? Math.round(Math.max(0, Number(spouseLifeExpectancy || lifeExpectancy) - spouseNpStartAge) * 12)
    : null;

  useEffect(() => {
    if (nationalPensionInputMode !== 'none') {
      setField('income.nationalPension.months', selfNpMonths ?? '');
    }
  }, [nationalPensionInputMode, selfNpMonths, setField]);

  useEffect(() => {
    if (hasSpouse && spouseNationalPensionInputMode !== 'none') {
      setField('spouse.nationalPension.months', spouseNpMonths ?? '');
    }
  }, [hasSpouse, spouseNationalPensionInputMode, spouseNpMonths, setField]);

  // "국민연금 수령 총액" = 월 수령(예상) 금액 × 수령 개월 수.
  const selfNationalPensionMonthly = Number(getIn(formData, 'income.nationalPension.monthly')) || 0;
  const selfNationalPensionMonths = Number(getIn(formData, 'income.nationalPension.months')) || 0;
  const selfNationalPensionTotal = selfNpEligible ? selfNationalPensionMonthly * selfNationalPensionMonths : 0;
  const spouseNationalPensionMonthly = Number(getIn(formData, 'spouse.nationalPension.monthly')) || 0;
  const spouseNationalPensionMonths = Number(getIn(formData, 'spouse.nationalPension.months')) || 0;
  const spouseNationalPensionTotal = spouseNpEligible ? spouseNationalPensionMonthly * spouseNationalPensionMonths : 0;
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

  // 출생년도를 입력하면 기대수명이 비어 있을 때 평균 기대수명을 최초 제안값으로 채운다.
  // 이후에는 사용자가 값을 지우거나 변경해도 자동값으로 덮어쓰지 않는다.
  useEffect(() => {
    if (!lifeExpectancyEditedRef.current && birthYear !== '' && birthYear != null && (lifeExpectancy === '' || lifeExpectancy == null)) {
      setField('basic.lifeExpectancy', AVERAGE_LIFE_EXPECTANCY);
    }
  }, [birthYear, lifeExpectancy, setField]);

  useEffect(() => {
    if (hasSpouse && !spouseLifeExpectancyEditedRef.current && spouseBirthYear !== '' && spouseBirthYear != null
      && (spouseLifeExpectancy === '' || spouseLifeExpectancy == null)) {
      setField('spouse.lifeExpectancy', AVERAGE_LIFE_EXPECTANCY);
    }
  }, [hasSpouse, spouseBirthYear, spouseLifeExpectancy, setField]);

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
    (selfNpEligible ? pick(getIn(formData, 'income.nationalPension.monthly'), getIn(formData, 'income.nationalPension.months')) : 0) +
    (spouseNpEligible ? pick(getIn(formData, 'spouse.nationalPension.monthly'), getIn(formData, 'spouse.nationalPension.months')) : 0);

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

  // "총 수입 합계" 표의 "수입 기간(년)" 열 - 본인+배우자를 합산한 행(급여·국민연금·퇴직연금·개인연금)은
  // 두 사람의 남은 기간이 서로 다를 수 있어 각자 따로 표시한다(사용자 승인). 해당 유형을 선택하지
  // 않은 경우(예: 퇴직금을 일시금으로 받는 경우)는 기간 개념 자체가 없어 null로 둔다.
  const selfSeverancePensionYears = severanceType === 'pension' ? selfPensionMonths / 12 : null;
  const spouseSeverancePensionYears = spouseSeveranceType === 'pension' ? spousePensionMonths / 12 : null;
  const selfPersonalPensionMonthsForPeriod =
    personalPensionType === 'installment' ? Number(getIn(formData, 'income.personalPension.months')) || 0 : null;
  const spousePersonalPensionMonthsForPeriod =
    spousePersonalPensionType === 'installment' ? Number(getIn(formData, 'spouse.personalPension.months')) || 0 : null;
  const selfPersonalPensionYears = selfPersonalPensionMonthsForPeriod != null ? selfPersonalPensionMonthsForPeriod / 12 : null;
  const spousePersonalPensionYears =
    spousePersonalPensionMonthsForPeriod != null ? spousePersonalPensionMonthsForPeriod / 12 : null;

  const otherIncomes = getIn(formData, 'income.otherIncomes') || [];
  const otherIncomesMonthly = otherIncomes.reduce((s, item) => s + (Number(item.annual) || 0), 0) / 12;

  // "사업소득 총액"(사용자 승인) = 급여와 같은 기준(은퇴까지 남은 기간)으로 계산한다. 사업소득은
  // 본인·배우자 구분이 없어(위 60번째 줄 주석 참고) 본인 은퇴 시점을 기준으로 삼고, 항목별
  // "수령 기간" 입력은 여기서 쓰지 않는다. 매년 사업소득이 동일하다고 가정하는 단순화다.
  const businessAnnual = Number(getIn(formData, 'income.business.annual')) || 0;
  const businessLifetimeTotal = businessAnnual * (selfYearsToRetirement ?? 0);

  // "기타 수입 총액"(사용자 승인) = 항목별로 입력받은 "연간 수입 금액 × 수령 기간(년)"을 그대로 합산한다.
  const otherIncomesLifetimeTotal = otherIncomes.reduce(
    (s, item) => s + (Number(item.annual) || 0) * (Number(item.years) || 0),
    0
  );

  const totalMonthlyIncome =
    currentSalaryMonthly + businessMonthly + nationalPensionTotal + severanceTotal + personalPensionTotal + otherIncomesMonthly;

  // "수입 기간(년)" 열 표시 형식 - null(해당 없음)이면 "-", 배우자 정보를 입력한 경우 본인·배우자를
  // 각자 따로 표기한다(사용자 승인). 소수점은 첫째 자리까지만(개월 단위 나눗셈으로 생기는 소수 방지).
  const formatYears = (years) => (years == null || !Number.isFinite(years) ? '-' : `${Math.round(years * 10) / 10}년`);
  const formatPeriodRow = (selfYears, spouseYears) =>
    hasSpouse ? `본인 ${formatYears(selfYears)} · 배우자 ${formatYears(spouseYears)}` : formatYears(selfYears);

  // "수령 시작 나이" 열 - 급여·사업소득·기타 정기수입은 지금 이미 받고 있어 개시 나이 개념이 없다(null).
  // 국민연금은 출생연도별 법정 개시 나이, 퇴직연금·개인연금은 사용자가 입력한 수령 시작 나이를 그대로 보여준다.
  const formatAge = (age) => (isFilledValue(age) ? `${Math.round(Number(age))}세` : '-');
  const formatStartAgeRow = (selfAge, spouseAge) =>
    hasSpouse ? `본인 ${formatAge(selfAge)} · 배우자 ${formatAge(spouseAge)}` : formatAge(selfAge);
  const selfSeveranceStartAge = severanceType === 'pension' ? getIn(formData, 'income.severance.pensionStartAge') : null;
  const spouseSeveranceStartAge = spouseSeveranceType === 'pension' ? getIn(formData, 'spouse.severance.pensionStartAge') : null;
  const selfPersonalPensionStartAge = personalPensionType === 'installment' ? getIn(formData, 'income.personalPension.startAge') : null;
  const spousePersonalPensionStartAge = spousePersonalPensionType === 'installment' ? getIn(formData, 'spouse.personalPension.startAge') : null;

  return (
    <div className="step">
      <h2 className="step-title">1. 수입</h2>
      <p className="step-desc">본인의 수입 항목을 입력합니다. 해당 사항이 없으면 0으로 입력해 주세요. 배우자가 있다면 아래에서 "배우자 정보 입력"을 선택해 주세요.</p>

      <section className="step-section">
        <h3><span className="step-icon">📝</span> 기본 정보</h3>
        <div className="field-grid">
          <NumberField path="basic.birthYear" label="본인 출생년도 *" placeholder="예: 1968" required integerOnly useGrouping={false} />
          <NumberField path="basic.retirementAge" label="은퇴(예정) 연령 *" unit="세" required />
          <NumberField
            path="basic.lifeExpectancy"
            label="기대수명 * (직접 수정 가능)"
            unit="세"
            required
            onValueChange={() => { lifeExpectancyEditedRef.current = true; }}
            helper="출생년도를 입력하면 평균 기대수명 84.6세가 자동으로 제안됩니다. 본인의 건강 상태나 계획에 맞게 자유롭게 수정할 수 있습니다. (2024년 대한민국 예상 평균수명: 남성 81.6세, 여성 87.6세)"
          />
          <NumberField
            path="basic.serviceYears"
            label="근속년수 *"
            unit="년"
            required
            helper="현재 직장의 입사일부터 퇴직(예정)일까지의 전체 재직기간입니다. 퇴직금 모의계산에 사용됩니다."
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
        {hasSpouse && (
          <div className="field-grid" style={{ marginTop: 14 }}>
            <NumberField
              path="spouse.birthYear"
              label="배우자 출생년도 *"
              placeholder="예: 1968"
              helper="배우자 국민연금 수령 개시 연령과 수령 기간 계산에 사용됩니다."
              required
              integerOnly
              useGrouping={false}
            />
            <NumberField path="spouse.retirementAge" label="배우자 은퇴(예정) 연령 *" unit="세" required />
            <NumberField
              path="spouse.lifeExpectancy"
              label="배우자 기대여명 * (직접 수정 가능)"
              unit="세"
              required
              onValueChange={() => { spouseLifeExpectancyEditedRef.current = true; }}
              helper="배우자 출생년도를 입력하면 평균 기대수명 84.6세가 자동으로 제안됩니다."
            />
          </div>
        )}
      </section>

      <section className="step-section">
        <h3><span className="step-icon">💵</span> 급여</h3>
        {hasSpouse && <p className="field-subgroup-label">본인</p>}
        <div className="field" style={{ marginBottom: 16 }}>
          <span className="field-label">급여 여부</span>
          <div className="radio-group" style={{ marginTop: 6 }}>
            <button type="button" className={`radio-pill ${selfHasSalary ? 'is-active' : ''}`} onClick={() => setHasSalary('income.salary', true)}>급여 있음</button>
            <button type="button" className={`radio-pill ${!selfHasSalary ? 'is-active' : ''}`} onClick={() => setHasSalary('income.salary', false)}>급여 없음</button>
          </div>
        </div>
        {selfHasSalary ? (
          <>
            <div className="field-grid three-col">
              <MonthlyIncomeField monthlyPath="income.salary.monthly" annualPath="income.salary.annual" label="현재 소득 (세금 제외한 실수령액)" />
              <NumberField path="income.salary.annualBonus" label="상여금" unit="만원(연)" helper="연간 상여금 총액" />
              <label className="field">
                <span className="field-label">남은 퇴직기간</span>
                <div className="field-input-row">
                  <FormattedNumberInput value={selfYearsToRetirement ?? ''} readOnly />
                  <span className="field-unit">년</span>
                </div>
                <span className="field-helper">출생년도·은퇴(예정) 연령을 입력하면 자동으로 계산됩니다</span>
              </label>
            </div>
            <TotalAmountBox label="퇴직전 급여 총액" amount={selfSalaryLifetimeTotal} />
            <span className="field-helper">현재 소득(월급+상여금) 기준, 은퇴까지 남은 기간 동안 급여가 동일하게 유지된다고 가정한 누적 총액입니다</span>
          </>
        ) : <p className="field-helper">급여 없음으로 선택했습니다. 급여와 상여금은 소득 계산에서 제외됩니다.</p>}

        {hasSpouse && (
          <>
            <p className="field-subgroup-label">배우자</p>
            <div className="field" style={{ marginBottom: 16 }}>
              <span className="field-label">급여 여부</span>
              <div className="radio-group" style={{ marginTop: 6 }}>
                <button type="button" className={`radio-pill ${spouseHasSalary ? 'is-active' : ''}`} onClick={() => setHasSalary('spouse.salary', true)}>급여 있음</button>
                <button type="button" className={`radio-pill ${!spouseHasSalary ? 'is-active' : ''}`} onClick={() => setHasSalary('spouse.salary', false)}>급여 없음</button>
              </div>
            </div>
            {spouseHasSalary ? (
              <>
                <div className="field-grid three-col">
                  <MonthlyIncomeField monthlyPath="spouse.salary.monthly" annualPath="spouse.salary.annual" label="현재 소득 (세금 제외한 실수령액)" />
                  <NumberField path="spouse.salary.annualBonus" label="상여금" unit="만원(연)" helper="연간 상여금 총액" />
                  <label className="field">
                    <span className="field-label">남은 퇴직기간</span>
                    <div className="field-input-row">
                      <FormattedNumberInput value={spouseYearsToRetirement ?? ''} readOnly />
                      <span className="field-unit">년</span>
                    </div>
                    <span className="field-helper">배우자 출생년도·은퇴(예정) 연령을 입력하면 자동으로 계산됩니다</span>
                  </label>
                </div>
                <TotalAmountBox label="퇴직전 급여 총액" amount={spouseSalaryLifetimeTotal} />
                <span className="field-helper">현재 소득(월급+상여금) 기준, 은퇴까지 남은 기간 동안 급여가 동일하게 유지된다고 가정한 누적 총액입니다</span>
              </>
            ) : <p className="field-helper">배우자 급여 없음으로 선택했습니다. 급여와 상여금은 소득 계산에서 제외됩니다.</p>}
          </>
        )}
      </section>

      <section className="step-section">
        <h3><span className="step-icon">📊</span> 현재 기준 소득</h3>
        <p className="field-helper" style={{ marginBottom: 10 }}>
          위 급여(월급+상여금, 본인+배우자) 합계로 자동 계산됩니다. 사업소득은 아래 "기타 정기수입"에서 별도로 합산됩니다.
        </p>
        <div className="field-grid">
          <label className="field">
            <span className="field-label">현재 기준 월 소득</span>
            <div className="field-input-row">
              <FormattedNumberInput value={Math.round(currentSalaryMonthly)} readOnly />
              <span className="field-unit">만원</span>
            </div>
          </label>
          <label className="field">
            <span className="field-label">현재 기준 연 소득</span>
            <div className="field-input-row">
              <FormattedNumberInput value={Math.round(currentSalaryMonthly * 12)} readOnly />
              <span className="field-unit">만원</span>
            </div>
          </label>
        </div>
        <TotalAmountBox label="가구 급여총액" amount={householdSalaryLifetimeTotal} />
        <span className="field-helper">본인·배우자 각자의 은퇴까지 남은 기간을 반영한 급여 누적 총액의 합입니다</span>
      </section>

      <section className="step-section">
        <h3><span className="step-icon">💼</span> 퇴직금 · 퇴직연금</h3>
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
              <NumberField path="income.severance.pensionStartAge" label="수령 시작 나이" unit="세" />
              <NumberField path="income.severance.pensionYears" label="수령 기간" unit="년" />
              <label className="field">
                <span className="field-label">수령 개월 수</span>
                <div className="field-input-row">
                  <FormattedNumberInput value={getIn(formData, 'income.severance.pensionMonths') || ''} readOnly />
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
                  <NumberField path="spouse.severance.pensionStartAge" label="수령 시작 나이" unit="세" />
                  <NumberField path="spouse.severance.pensionYears" label="수령 기간" unit="년" />
                  <label className="field">
                    <span className="field-label">수령 개월 수</span>
                    <div className="field-input-row">
                      <FormattedNumberInput value={getIn(formData, 'spouse.severance.pensionMonths') || ''} readOnly />
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
        <h3><span className="step-icon">🏛️</span> 국민연금</h3>
        <PensionPortalNotice />
        {hasSpouse && <p className="field-subgroup-label">본인</p>}
        <RadioField
          path="income.nationalPension.inputMode"
          label="입력 방식"
          onChange={(value) => handleNationalPensionMode('income.nationalPension', value)}
          options={[
            { value: 'direct', label: '직접 입력' },
            { value: 'simulate', label: '모의계산' },
            { value: 'none', label: '없음' },
          ]}
        />
        {nationalPensionInputMode === 'none' ? (
          <p className="field-helper">본인 국민연금 없음으로 선택했습니다.</p>
        ) : nationalPensionInputMode === 'simulate' ? (
          <>
            <div className="field-grid three-col">
              <NumberField path="income.nationalPension.simulate.averageMonthlyIncome" label="가입기간 중 월평균급여" unit="만원" />
              <NumberField
                path="income.nationalPension.simulate.contributionMonths"
                label="실제 보험료 납부 개월 수"
                unit="개월"
                helper={isFilledValue(selfNpContributionMonths)
                  ? (selfNpEligible
                    ? `${formatNumber(selfNpContributionYears)}년으로 환산됩니다.`
                    : `현재 ${formatNumber(selfNpContributionMonths)}개월입니다. 노령연금 수급에는 최소 120개월(10년)이 필요합니다.`)
                  : '실제로 보험료를 납부한 전체 개월 수를 입력해 주세요. 최소 120개월(10년)이 필요합니다.'}
              />
              <label className="field">
                <span className="field-label">수령 개월 수</span>
                <div className="field-input-row">
                  <FormattedNumberInput value={getIn(formData, 'income.nationalPension.months') ?? ''} readOnly />
                  <span className="field-unit">개월</span>
                </div>
                <span className="field-helper">
                  {selfNpStartAge != null
                    ? `출생연도 기준 ${selfNpStartAge}세부터 기대수명까지로 자동 계산됩니다.`
                    : '출생년도와 기대수명을 입력하면 자동 계산됩니다.'}
                </span>
              </label>
            </div>
            <label className="field" style={{ marginTop: 12 }}>
              <span className="field-label">국민연금 월 수령(예상) 금액</span>
              <div className="field-input-row">
                <FormattedNumberInput value={getIn(formData, 'income.nationalPension.monthly') || ''} readOnly />
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
                <FormattedNumberInput value={getIn(formData, 'income.nationalPension.months') ?? ''} readOnly />
                <span className="field-unit">개월</span>
              </div>
              <span className="field-helper">
                {selfNpStartAge != null
                  ? `출생연도 기준 ${selfNpStartAge}세부터 기대수명까지로 자동 계산됩니다.`
                  : '출생년도와 기대수명을 입력하면 자동 계산됩니다.'}
              </span>
            </label>
            <NumberField
              path="income.nationalPension.paymentMonths"
              label="국민연금 실제 납부 개월 수"
              unit="개월"
              helper={isFilledValue(selfNpPaymentMonths)
                ? (selfNpEligible
                  ? `${formatNumber(selfNpPaymentYears)}년으로 환산됩니다.`
                  : `현재 ${formatNumber(selfNpPaymentMonths)}개월입니다. 노령연금 수급에는 최소 120개월(10년)이 필요합니다.`)
                : '실제로 보험료를 납부한 전체 개월 수를 입력해 주세요. 최소 120개월(10년)이 필요합니다.'}
            />
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
              onChange={(value) => handleNationalPensionMode('spouse.nationalPension', value)}
              options={[
                { value: 'direct', label: '직접 입력' },
                { value: 'simulate', label: '모의계산' },
                { value: 'none', label: '없음' },
              ]}
            />
            {spouseNationalPensionInputMode === 'none' ? (
              <p className="field-helper">배우자 국민연금 없음으로 선택했습니다.</p>
            ) : spouseNationalPensionInputMode === 'simulate' ? (
              <>
                <div className="field-grid three-col">
                  <NumberField path="spouse.nationalPension.simulate.averageMonthlyIncome" label="가입기간 중 월평균급여" unit="만원" />
                  <NumberField
                    path="spouse.nationalPension.simulate.contributionMonths"
                    label="실제 보험료 납부 개월 수"
                    unit="개월"
                    helper={isFilledValue(spouseNpContributionMonths)
                      ? (spouseNpEligible
                        ? `${formatNumber(spouseNpContributionYears)}년으로 환산됩니다.`
                        : `현재 ${formatNumber(spouseNpContributionMonths)}개월입니다. 노령연금 수급에는 최소 120개월(10년)이 필요합니다.`)
                      : '실제로 보험료를 납부한 전체 개월 수를 입력해 주세요. 최소 120개월(10년)이 필요합니다.'}
                  />
                  <label className="field">
                    <span className="field-label">수령 개월 수</span>
                    <div className="field-input-row">
                      <FormattedNumberInput value={getIn(formData, 'spouse.nationalPension.months') ?? ''} readOnly />
                      <span className="field-unit">개월</span>
                    </div>
                    <span className="field-helper">
                      {spouseNpStartAge != null
                        ? `배우자 출생연도 기준 ${spouseNpStartAge}세부터 기대수명까지로 자동 계산됩니다.`
                        : '배우자 출생년도와 기대수명을 입력하면 자동 계산됩니다.'}
                    </span>
                  </label>
                </div>
                <label className="field" style={{ marginTop: 12 }}>
                  <span className="field-label">국민연금 월 수령(예상) 금액</span>
                  <div className="field-input-row">
                    <FormattedNumberInput value={getIn(formData, 'spouse.nationalPension.monthly') || ''} readOnly />
                    <span className="field-unit">만원</span>
                  </div>
                  <span className="field-helper">월평균 소득 × 가입기간 × 1.5%로 자동 계산됩니다</span>
                </label>
              </>
            ) : (
              <div className="field-grid three-col">
                <NumberField path="spouse.nationalPension.monthly" label="국민연금 월 수령(예상) 금액" unit="만원" />
                <label className="field">
                  <span className="field-label">수령 개월 수</span>
                  <div className="field-input-row">
                    <FormattedNumberInput value={getIn(formData, 'spouse.nationalPension.months') ?? ''} readOnly />
                    <span className="field-unit">개월</span>
                  </div>
                  <span className="field-helper">
                    {spouseNpStartAge != null
                      ? `배우자 출생연도 기준 ${spouseNpStartAge}세부터 기대수명까지로 자동 계산됩니다.`
                      : '배우자 출생년도와 기대수명을 입력하면 자동 계산됩니다.'}
                  </span>
                </label>
                <NumberField
                  path="spouse.nationalPension.paymentMonths"
                  label="국민연금 실제 납부 개월 수"
                  unit="개월"
                  helper={isFilledValue(spouseNpPaymentMonths)
                    ? (spouseNpEligible
                      ? `${formatNumber(spouseNpPaymentYears)}년으로 환산됩니다.`
                      : `현재 ${formatNumber(spouseNpPaymentMonths)}개월입니다. 노령연금 수급에는 최소 120개월(10년)이 필요합니다.`)
                    : '실제로 보험료를 납부한 전체 개월 수를 입력해 주세요. 최소 120개월(10년)이 필요합니다.'}
                />
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
        <h3><span className="step-icon">🐷</span> 개인연금</h3>
        <PensionPortalNotice />
        {hasSpouse && <p className="field-subgroup-label">본인</p>}
        <RadioField
          path="income.personalPension.type"
          label="수령 방식"
          onChange={(value) => handlePersonalPensionType('income.personalPension', value)}
          options={[
            { value: 'lumpsum', label: '일시금 수령' },
            { value: 'installment', label: '분할 수령' },
            { value: 'none', label: '없음' },
          ]}
        />
        {personalPensionType === 'none' ? (
          <p className="field-helper">본인 개인연금 없음으로 선택했습니다.</p>
        ) : <div className="field-grid">
          {personalPensionType === 'lumpsum' ? (
            <>
              <NumberField path="income.personalPension.lumpsum" label="개인연금 일시금 수령액" unit="만원" />
              <NumberField path="income.personalPension.lumpsumAge" label="수령 나이" unit="세" />
            </>
          ) : (
            <>
              <NumberField path="income.personalPension.monthly" label="개인연금 월 수령액" unit="만원" />
              <NumberField path="income.personalPension.startAge" label="수령 시작 나이" unit="세" />
              <NumberField path="income.personalPension.months" label="수령 개월 수" unit="개월" />
            </>
          )}
        </div>}
        {selfPersonalPensionTotal > 0 && (
          <TotalAmountBox label="개인연금 수령 총액" amount={selfPersonalPensionTotal} valueLabel="수령 총액은" />
        )}

        {hasSpouse && (
          <>
            <p className="field-subgroup-label">배우자</p>
            <RadioField
              path="spouse.personalPension.type"
              label="수령 방식"
              onChange={(value) => handlePersonalPensionType('spouse.personalPension', value)}
              options={[
                { value: 'lumpsum', label: '일시금 수령' },
                { value: 'installment', label: '분할 수령' },
                { value: 'none', label: '없음' },
              ]}
            />
            {spousePersonalPensionType === 'none' ? (
              <p className="field-helper">배우자 개인연금 없음으로 선택했습니다.</p>
            ) : <div className="field-grid">
              {spousePersonalPensionType === 'lumpsum' ? (
                <>
                  <NumberField path="spouse.personalPension.lumpsum" label="개인연금 일시금 수령액" unit="만원" />
                  <NumberField path="spouse.personalPension.lumpsumAge" label="수령 나이" unit="세" />
                </>
              ) : (
                <>
                  <NumberField path="spouse.personalPension.monthly" label="개인연금 월 수령액" unit="만원" />
                  <NumberField path="spouse.personalPension.startAge" label="수령 시작 나이" unit="세" />
                  <NumberField path="spouse.personalPension.months" label="수령 개월 수" unit="개월" />
                </>
              )}
            </div>}
            {spousePersonalPensionTotal > 0 && (
              <TotalAmountBox label="개인연금 수령 총액" amount={spousePersonalPensionTotal} valueLabel="수령 총액은" />
            )}
          </>
        )}

        <TotalAmountBox label="개인연금 수령 총액(본인+배우자)" amount={combinedPersonalPensionTotal} valueLabel="총액은" />
      </section>

      <section className="step-section">
        <h3><span className="step-icon">📈</span> 기타 정기수입 (사업소득 포함)</h3>
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
        {businessAnnual > 0 && (
          <>
            <TotalAmountBox
              label="사업소득 총액"
              amount={businessLifetimeTotal}
              valueLabel="총액은"
            />
            <span className="field-helper">현재 연간 사업소득이 은퇴까지 남은 기간(본인 기준) 동안 동일하게 유지된다고 가정한 누적 총액입니다</span>
          </>
        )}
        {otherIncomesLifetimeTotal > 0 && (
          <>
            <TotalAmountBox
              label="기타 수입 총액"
              amount={otherIncomesLifetimeTotal}
              valueLabel="총액은"
            />
            <span className="field-helper">항목별 "연간 수입 금액 × 수령 기간"을 합산한 값입니다</span>
          </>
        )}
      </section>

      <section className="step-section">
        <h3><span className="step-icon">🧮</span> 총 수입 합계</h3>
        <table className="grade-table compact">
          <thead>
            <tr>
              <th>항목</th>
              <th style={{ textAlign: 'right' }}>월 예상 금액</th>
              <th style={{ textAlign: 'right' }}>수령 시작 나이</th>
              <th style={{ textAlign: 'right' }}>수입 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr className="total-row">
              <td>총 월 수입 합계</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(Math.round(totalMonthlyIncome))}</td>
              <td className="num" style={{ textAlign: 'right' }}>-</td>
              <td className="num" style={{ textAlign: 'right' }}>-</td>
            </tr>
            <tr className="total-row">
              <td>총 연 수입 합계</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(Math.round(totalMonthlyIncome) * 12)}</td>
              <td className="num" style={{ textAlign: 'right' }}>-</td>
              <td className="num" style={{ textAlign: 'right' }}>-</td>
            </tr>
            <tr>
              <td>급여(상여금 포함)</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(Math.round(currentSalaryMonthly))}</td>
              <td className="num" style={{ textAlign: 'right' }}>-</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatPeriodRow(selfYearsToRetirement, spouseYearsToRetirement)}</td>
            </tr>
            <tr>
              <td>사업소득</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(businessMonthly)}</td>
              <td className="num" style={{ textAlign: 'right' }}>-</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatYears(selfYearsToRetirement)}</td>
            </tr>
            <tr>
              <td>국민연금</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(nationalPensionTotal)}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatStartAgeRow(selfNpEligible ? selfNpStartAge : null, spouseNpEligible ? spouseNpStartAge : null)}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatPeriodRow(selfNationalPensionMonths / 12, spouseNationalPensionMonths / 12)}</td>
            </tr>
            <tr>
              <td>퇴직연금</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(severanceTotal)}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatStartAgeRow(selfSeveranceStartAge, spouseSeveranceStartAge)}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatPeriodRow(selfSeverancePensionYears, spouseSeverancePensionYears)}</td>
            </tr>
            <tr>
              <td>개인연금</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(personalPensionTotal)}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatStartAgeRow(selfPersonalPensionStartAge, spousePersonalPensionStartAge)}</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatPeriodRow(selfPersonalPensionYears, spousePersonalPensionYears)}</td>
            </tr>
            <tr>
              <td>기타 정기수입(연 환산)</td>
              <td className="num" style={{ textAlign: 'right' }}>{formatWon(Math.round(otherIncomesMonthly))}</td>
              <td className="num" style={{ textAlign: 'right' }}>-</td>
              <td className="num" style={{ textAlign: 'right' }}>{otherIncomes.length > 0 ? '항목별 상이' : '-'}</td>
            </tr>
          </tbody>
        </table>
        <span className="field-helper">
          연금 금액은 실제로 받고 있는 돈이 아니라, 입력하신 수령 시작 나이부터 적용되는 예상 수령액입니다.
          수령 개월 수(또는 기간)가 입력된 연금·수입만 합산됩니다.
        </span>
      </section>
    </div>
  );
}
