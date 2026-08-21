// 입력 폼의 초기값 정의.
// 이 파일은 "어떤 데이터를 입력받는가"만 정의하고, 계산 로직은 절대 포함하지 않는다.
// 계산 로직은 서버(/api/calculate)에만 존재한다.

export const initialFormData = {
  basic: {
    birthYear: '',
    hasSpouse: false,       // 배우자 정보 입력 여부 - true일 때만 spouse.* 입력 항목이 화면에 나타남
    retirementAge: '',      // 은퇴(예정) 연령
    lifeExpectancy: '',     // 기대수명(노후 생활비 필요기간 계산 기준)
    serviceYears: '',       // 근속년수(퇴직금 모의계산기의 "총 재직일수÷365" 항에 사용)
    assumedReturnRate: 3,   // 예상 투자/저축 수익률(연, %) - 기본값 3%
  },

  income: {
    salary: { hasSalary: true, annual: '', monthly: '', annualBonus: '', months: '' },
    business: { annual: '', monthly: '' }, // 사업소득(본인+배우자 합산) - regularIncomes에서 자동 합산됨
    regularIncomes: [],          // [{ type: 'business'|'other', name, annual, years }] 사업소득·기타 정기수입 통합 입력 목록
    severance: {
      type: 'lumpsum',          // 'lumpsum' | 'pension' | 'none'(이미 퇴직금을 수령해 해당 없음)
      lumpsum: '',
      lumpsumAge: '',           // 퇴직금(일시금) 수령 나이
      pensionMonthly: '',
      pensionStartAge: '',       // 퇴직연금 월 수령 시작 나이
      pensionYears: '',         // 수령 기간(년) - 입력하면 pensionMonths(수령 개월수)가 자동 계산됨
      pensionMonths: '',
      calc: {                   // 퇴직금 모의계산기 입력값(퇴직금을 모르는 사용자가 lumpsum을 추정하기 위한 보조 입력)
        threeMonthSalary: '',   // 퇴직 전 3개월 급여 총액
        annualBonus: '',        // 연간 상여금 총액
        annualLeavePay: '',     // 연차수당
      },
    },
    nationalPension: {
      inputMode: 'direct',      // 'direct'(직접 입력) | 'simulate'(모의계산)
      monthly: '',
      months: '',
      paymentMonths: '',        // 실제 보험료를 납부한 총 개월 수
      paymentYears: '',         // 국민연금 납입기간(년) - 직접입력 모드의 참고용 기록(계산에는 쓰이지 않음)
      simulate: {               // 모의계산 입력값 - monthly = 월평균급여×가입기간×1.5%로 자동 계산되어 반영됨
        averageMonthlyIncome: '', // 가입기간 중 월평균급여
        contributionMonths: '',   // 실제 보험료를 납부한 총 개월 수
        years: '',                // 가입기간(년)
      },
    },
    personalPension: {
      type: 'installment',     // 'lumpsum' | 'installment'
      lumpsum: '',
      lumpsumAge: '',           // 개인연금(일시금) 수령 나이
      monthly: '',
      startAge: '',              // 개인연금 월 수령 시작 나이
      months: '',
    },
    otherIncomes: [],           // [{ name, annual, years }] 확정된 정기수입(임대수입 등) - regularIncomes 중 "기타" 항목만 자동 반영됨
  },

  spouse: {
    birthYear: '',
    retirementAge: '',
    lifeExpectancy: '',
    salary: { hasSalary: true, annual: '', monthly: '', annualBonus: '', months: '' },
    severance: {
      type: 'lumpsum',          // 'lumpsum' | 'pension' | 'none'(이미 퇴직금을 수령해 해당 없음)
      lumpsum: '',
      lumpsumAge: '',           // 퇴직금(일시금) 수령 나이
      pensionMonthly: '',
      pensionStartAge: '',
      pensionYears: '',         // 수령 기간(년) - 입력하면 pensionMonths(수령 개월수)가 자동 계산됨
      pensionMonths: '',
      serviceYears: '',         // 배우자 근속년수(퇴직금 모의계산기 전용 - 배우자용 "기본 정보" 섹션이 없어 여기 둔다)
      calc: {                   // 퇴직금 모의계산기 입력값(배우자의 lumpsum을 추정하기 위한 보조 입력)
        threeMonthSalary: '',
        annualBonus: '',
        annualLeavePay: '',
      },
    },
    nationalPension: {
      inputMode: 'direct',
      monthly: '',
      months: '',
      paymentMonths: '',
      paymentYears: '',
      simulate: {
        averageMonthlyIncome: '',
        contributionMonths: '',
        years: '',
      },
    },
    personalPension: {
      type: 'installment',
      lumpsum: '',
      lumpsumAge: '',
      monthly: '',
      startAge: '',
      months: '',
    },
  },

  expense: {
    retirementLivingCost: '',   // 노후 월 평균 생활비
    housingCost: '',            // 현재 월 주거비(관리비·공과금·통신비)
    debts: [],                  // [{ repaymentType, principal, monthlyInterest, monthlyRepayment, months }]
    children: [],               // [{ educationCost(학자금), marriageSupport, otherCost }] - 목돈 지출 총액 기준
    medical: { annual: '', years: '' },
    // items: [{ name, monthly }] "+ 기타 추가"로 자유롭게 추가하는 보험료 항목(국민건강보험료 등).
    // monthly는 이 항목들의 합계로 자동 계산되어, 기존처럼 고정지출로 집계된다.
    healthInsurance: { monthly: '', years: '', items: [] },
    otherExpenses: [],          // [{ name, annual, years }]
    // [{ name, expectedAge, amount }] - 은퇴 후 자산잔액 시뮬레이션 전용 목돈지출(차량 교체·주택
    // 수리 등). children(교육비 등)과 달리 발생 나이가 명확한 항목만 여기 담으며, 은퇴 전
    // 지출과 섞이지 않도록 children과는 별도로 관리한다(자동 연결 없음).
    retirementLumpSumExpenses: [],
  },

  assets: {
    currentIncome: { monthly: '', annual: '' },
    currentLivingCost: {
      monthly: '', annual: '',
      inputMode: 'simple',   // 'simple'(총액 한번에 입력) | 'detailed'(지출별 입력) - UI 입력 방식 선택값
      breakdown: {           // 현재 월 생활비 세부 항목(월 생활비 합계는 이 값들의 합으로 자동 계산됨)
        rent: '',            // 월세
        maintenance: '',     // 관리비
        utilities: '',       // 공과금
        fuel: '',            // 유류비
        carInsurance: '',    // 차 보험료
        clothing: '',        // 의류비
        fourInsurances: '',  // 4대보험
        food: '',            // 식비
        communication: '',   // 통신비
        medical: '',         // 의료비
        subscription: '',    // 각종 구독료
        // 원리금상환·차량할부는 여기 두지 않는다 - assets.debtStatus.monthlyRepayment(및 breakdown.carLoan)가
        // 단일 기준값이다(Step2Expense.jsx 카테고리 목록에서도 제거됨. 생활비·부채 두 곳에 중복 입력 방지).
        other: '',           // 기타지출 총액 - 아래 otherItems의 합으로 자동 계산됨(직접 입력하지 않음)
        otherItems: [],      // [{ name, amount }] "기타지출"의 종류별 세부 항목(합계가 other에 자동 반영됨)
      },
    },
    liquidAssets: {
      hasAssets: true,
      total: '',
      breakdown: {           // 현금성 자산 세부 항목(총액은 이 값들 + customItems의 합으로 자동 계산됨)
        deposit: '',         // 예금
        savings: '',         // 적금
        cma: '',             // CMA
        emergencyFund: '',   // 비상금
      },
      customItems: [],       // [{ name, amount }] 기본 항목 외 사용자가 추가한 현금성 자산
    },
    financialAssets: {
      hasAssets: true,
      stocks: '', funds: '', bonds: '', other: '',
      otherItems: [], // [{ name, amount }] "기타 금융자산"의 종류별 세부 항목(합계가 other에 자동 반영됨)
    },
    // 연금자산(개인연금·퇴직연금·IRP 등 잔액) 총액 - 금융자산과 분리. 아래 pensionAssetsBreakdown 4개
    // 항목의 합으로 자동 계산된다(변액연금·연금저축계좌·IRP는 "3. 저축"과 연동, 기타는 여기서 직접 입력).
    pensionAssets: '',
    hasPensionAssets: true,
    pensionAssetsBreakdown: {
      variableAnnuity: '',        // 변액연금(저축 파트와 연동)
      pensionSavingsAccount: '',  // 연금저축계좌(저축 파트와 연동)
      irp: '',                    // IRP개인퇴직계좌(저축 파트와 연동)
      other: '',                  // 기타 총액 - 아래 otherItems의 합으로 자동 계산됨(직접 입력하지 않음)
      otherItems: [],              // [{ name, amount }] "기타" 연금자산의 종류별 세부 항목
    },
    realEstateAssets: {
      hasAssets: true,
      // total은 mainProperty + otherItems 합으로 자동 계산된다(직접 입력하지 않음).
      total: '',
      mainPropertyType: '',      // 주요 부동산 매물 종류
      mainProperty: '',          // 주요 부동산 시세(현재 시세 기준으로 직접 입력)
      otherItems: [],            // [{ type, amount }] 기타 부동산(추가 보유 부동산)의 종류와 시세
      reverseMortgageHouse: '',  // 주택연금 신청 대상 주택 1채의 가격
    },
    otherAssets: {
      hasAssets: true,
      total: '',                 // items 금액의 합으로 자동 계산됨
      items: [],                 // [{ name, amount }] 기타 자산 항목
    },
    debtStatus: {
      hasDebt: true,
      totalBalance: '', monthlyRepayment: '',
      inputMode: 'simple',   // 'simple'(총액 한번에 입력) | 'detailed'(대출별 입력) - UI 입력 방식 선택값
      // 대출 종류별 상세(총 부채잔액/월 상환액은 이 값들의 합으로 자동 계산됨)
      // 항목별 shape: { repaymentType: 'interestOnly'|'equalPrincipal', principal, monthlyInterest, monthlyRepayment, months }
      breakdown: {
        mortgage: {},      // 주담대
        depositLoan: {},   // 보증금대출
        businessLoan: {},  // 사업자대출
        buildingLoan: {},  // 빌딩대출
        carLoan: {},       // 차량대출
        studentLoan: {},   // 학자금대출
        otherLoan: {},     // 기타대출
      },
      customItems: [],     // [{ name, repaymentType, principal, monthlyInterest, monthlyRepayment, months }] 기본 항목 외 사용자가 추가한 대출
    },
    insurance: { hasInsurance: true, monthlyPremium: '', coverageAmount: '' },
    savingsPlan: {
      hasSavings: true,
      monthly: '', annual: '',
      // 월 저축액 세부 항목(월 저축액 합계는 이 값들의 monthly + customItems의 monthly 합으로 자동 계산됨).
      // 저축 종류마다 앞으로 저축할 개월수·이자율이 서로 다를 수 있어(예: 적금 24개월 vs IRP 120개월)
      // 종류별로 따로 갖는다 - 종류 전체에 하나의 개월수·이자율만 두지 않는다.
      // "현재까지 누적된 금액"은 여기(breakdown)에 저장하지 않는다 - 종류별로 "4. 자산"의 연동 대상
      // 필드(예: irp→assets.pensionAssetsBreakdown.irp)에 바로 저장되므로 이중 저장을 피한다.
      breakdown: {
        installment: { monthly: '', remainingMonths: '', interestRate: '' }, // 적금
        isa: { monthly: '', remainingMonths: '', interestRate: '' },         // ISA
        variableAnnuity: { monthly: '', remainingMonths: '', interestRate: '' }, // 변액연금
        pensionSavings: { monthly: '', remainingMonths: '', interestRate: '' },  // 연금저축
        irp: { monthly: '', remainingMonths: '', interestRate: '' },         // IRP
        subscription: { monthly: '', remainingMonths: '', interestRate: '' }, // 청약(주택청약종합저축)
        stocks: { monthly: '', remainingMonths: '', interestRate: '' },      // 주식(적립식 투자)
        parkingAccount: { monthly: '', remainingMonths: '', interestRate: '' }, // 파킹통장
      },
      customItems: [],       // [{ name, monthly, remainingMonths, interestRate }] 기본 항목 외 사용자가 추가한 저축. "현재까지
                             // 누적된 금액"은 여기 저장하지 않고 name과 같은 이름의 assets.liquidAssets.customItems 항목과 연동된다.
      retirementMonthly: '', retirementAnnual: '',
      // true: 사용자가 직접 "일반 저축액에 이미 포함" 버튼을 선택한 경우.
      // false(기본값): 버튼을 미리 선택하지 않으며, 노후준비 저축을 별도 금액으로 합산한다.
      retirementIncludedInTotal: false,
    },
  },

  scenarios: {
    reverseMortgage: {
      enabled: false,
      ageAtStart: '',
      housePrice: '',
    },
    realEstateConversion: {
      enabled: false,
      ageAtConversion: '',
      cashOutAmount: '',
    },
    expenseReduction: {
      enabled: false,
      reductionRate: '',
      targets: [], // subset of ['living','medical','other']
    },
    additionalIncome: {
      enabled: false,
      monthlySalary: '',
      months: '',
    },
  },
};
