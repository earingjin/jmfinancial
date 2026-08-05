// 입력 폼의 초기값 정의.
// 이 파일은 "어떤 데이터를 입력받는가"만 정의하고, 계산 로직은 절대 포함하지 않는다.
// 계산 로직은 서버(/api/calculate)에만 존재한다.

export const initialFormData = {
  basic: {
    birthYear: '',
    hasSpouse: false,       // 배우자 정보 입력 여부 - true일 때만 spouse.* 입력 항목이 화면에 나타남
    retirementAge: '',      // 은퇴(예정) 연령
    lifeExpectancy: '',     // 기대수명(노후 생활비 필요기간 계산 기준)
    assumedReturnRate: 3,   // 예상 투자/저축 수익률(연, %) - 기본값 3%
  },

  income: {
    salary: { annual: '', monthly: '', months: '' },
    business: { annual: '', monthly: '' }, // 사업소득(본인+배우자 합산) - regularIncomes에서 자동 합산됨
    regularIncomes: [],          // [{ type: 'business'|'other', name, annual, years }] 사업소득·기타 정기수입 통합 입력 목록
    severance: {
      type: 'lumpsum',          // 'lumpsum' | 'pension'
      lumpsum: '',
      pensionMonthly: '',
      pensionMonths: '',
      inflationLinked: true,    // 물가연동형 여부 (false면 정액형 - 수령액이 고정, 실질가치 매년 하락)
    },
    nationalPension: { monthly: '', months: '' },
    personalPension: {
      type: 'installment',     // 'lumpsum' | 'installment'
      lumpsum: '',
      monthly: '',
      months: '',
      inflationLinked: true,    // 물가연동형 여부 (false면 정액형 - 수령액이 고정, 실질가치 매년 하락)
    },
    otherIncomes: [],           // [{ name, annual, years }] 확정된 정기수입(임대수입 등) - regularIncomes 중 "기타" 항목만 자동 반영됨
  },

  spouse: {
    salary: { annual: '', monthly: '', months: '' },
    severance: { lumpsum: '', pensionMonthly: '', pensionMonths: '', inflationLinked: true },
    nationalPension: { monthly: '', months: '' },
    personalPension: {
      type: 'installment',
      lumpsum: '',
      monthly: '',
      months: '',
      inflationLinked: true,
    },
  },

  expense: {
    retirementLivingCost: '',   // 노후 월 평균 생활비
    housingCost: '',            // 현재 월 주거비(관리비·공과금·통신비)
    debts: [],                  // [{ repaymentType, principal, monthlyInterest, monthlyRepayment, months }]
    children: [],               // [{ educationCost(학자금), marriageSupport, otherCost }] - 목돈 지출 총액 기준
    medical: { annual: '', years: '' },
    healthInsurance: { monthly: '', years: '' },
    otherExpenses: [],          // [{ name, annual, years }]
  },

  assets: {
    currentIncome: { monthly: '', annual: '' },
    currentLivingCost: {
      monthly: '', annual: '',
      inputMode: 'simple',   // 'simple'(총액 한번에 입력) | 'detailed'(항목별 입력) - UI 입력 방식 선택값
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
        other: '',           // 기타지출
      },
    },
    liquidAssets: {
      total: '',
      inputMode: 'simple',   // 'simple'(총액 한번에 입력) | 'detailed'(항목별 입력) - UI 입력 방식 선택값
      breakdown: {           // 현금성 자산 세부 항목(총액은 이 값들 + customItems의 합으로 자동 계산됨)
        deposit: '',         // 예금
        savings: '',         // 적금
        emergencyFund: '',   // 비상금
      },
      customItems: [],       // [{ name, amount }] 기본 항목 외 사용자가 추가한 현금성 자산
    },
    financialAssets: {
      stocks: '', funds: '', other: '',
    },
    pensionAssets: '',           // 연금자산(개인연금·퇴직연금·IRP 등 잔액) - 금융자산과 분리
    realEstateAssets: {
      total: '',
      reverseMortgageHouse: '',  // 주택연금 신청 대상 주택 1채의 가격
    },
    debtStatus: {
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
    insurance: { monthlyPremium: '', coverageAmount: '' },
    savingsPlan: {
      monthly: '', annual: '',
      inputMode: 'simple',   // 'simple'(총액 한번에 입력) | 'detailed'(항목별 입력) - UI 입력 방식 선택값
      breakdown: {           // 월 저축액 세부 항목(월 저축액 합계는 이 값들 + customItems의 합으로 자동 계산됨)
        installment: '',     // 적금
        isa: '',             // ISA
        irp: '',             // IRP
        subscription: '',    // 청약(주택청약종합저축)
        stocks: '',          // 주식(적립식 투자)
        parkingAccount: '',  // 파킹통장
      },
      customItems: [],       // [{ name, amount }] 기본 항목 외 사용자가 추가한 저축
      retirementMonthly: '', retirementAnnual: '',
    },
    netWorthPriorYear: '',
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
