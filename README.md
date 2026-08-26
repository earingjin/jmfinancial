# JM Financial Planner — 재무진단 웹앱

퇴직/은퇴 준비 재무진단 리포트를 생성하는 웹앱입니다. 사용자가 Supabase 계정으로 로그인한 뒤
마법사(wizard) 형태로 수입·지출·저축·자산·부채 정보를 입력하면, 서버에서 한국형 가계재무비율을 참고한 8개 재무건강지표와 별도 노후분석,
은퇴자산 시뮬레이션, 동일연령대 비교, 대응방안 시나리오를 계산해 요약 화면과 다중 페이지
리포트(인쇄/PDF 저장 가능)로 보여줍니다. 진단 결과는 로그인 계정 기준으로 Supabase에 저장되어
이후 이력 목록에서 다시 열어볼 수 있습니다.

## 기술 스택

- React 19 + Vite (프론트엔드 SPA, `package.json` `react`/`react-dom`/`vite`)
- Vercel Functions (`api/` 폴더, 서버리스 계산/삭제 API — `calculate.js`, `delete-result.js`)
- Supabase (`@supabase/supabase-js`, `src/lib/supabaseClient.js`) — 로그인/세션 인증 + 진단 이력 저장(DB)
- Vitest — 계산 로직과 표시 helper(`api/_lib/*.test.js`, `src/**/*.test.js`) 단위 테스트
- oxlint — 린트

## 주요 기능

- 로그인/회원가입 후 이용 가능한 재무진단 마법사 (수입/지출/저축/자산/부채/순자산 6단계 입력)
- 8개 재무건강지표 진단과 4개 영역별 종합해석·행동제안
- 은퇴자산 시뮬레이션 (필요자금/준비자산/부족액/준비율)
- 동일연령대 비교 (2025년 가계금융복지조사 등 실제 통계 기반)
- 대응방안 입력 스키마와 계산 모듈 유지(현재 계산 결과와 리포트에는 입력값을 반영하지 않음)
- 결과 요약 화면 + 다중 페이지 리포트, 인쇄/PDF 저장(A4 레이아웃)
- 진단 이력 저장/재조회·삭제 (로그인 계정별, Supabase)

## 폴더 구조

```
src/
  main.jsx / App.jsx   앱 진입점, 화면 전환(home/wizard/loading/summary/report/history/admin) 관리
  lib/
    supabaseClient.js  Supabase 클라이언트 초기화
    aiFeedback.js      AI 피드백 문구 관련 유틸
  state/
    AuthContext.jsx / authState.js   Supabase 로그인 세션 관리
    FormContext.jsx / formState.js  폼 상태 관리
    initialFormData.js  폼 초기값
    pathUtils.js         중첩 폼 경로 접근 유틸
  components/
    auth/AuthGate.jsx    로그인/회원가입 화면
    home/                홈 화면, 진단 이력 목록(HistoryList)
    admin/AdminDashboard.jsx   관리자 대시보드 (role=admin 계정 전용, /admin 경로)
    wizard/              입력 마법사
      Wizard.jsx           6단계 스텝 정의/네비게이션(대응방안 단계는 현재 비활성화)
      steps/               Step1~7 소스 파일(현재 Step1~6만 마법사에서 사용, Step7 대응방안은 비활성화)
      fields/              재사용 입력 컴포넌트 (숫자, 라디오, 토글, 체크박스, 반복리스트,
                            연금/퇴직금 계산기 버튼, 항목별 세부 입력 등)
    summary/             결과 요약 화면 (SimpleSummaryReport, DonutChart) — 리포트 다운로드 전 미리보기
    report/              다중 페이지 리포트 (Report.jsx + pages/ 표지·요약·현황·시뮬레이션·
                          동일연령대 비교·대응방안 등 각 페이지, 인쇄/PDF 저장(window.print) 지원)
  utils/
    format.js            숫자 표시 포맷팅 (계산 로직 아님)
    obfuscate.js         서버 응답 난독화(obfuscate)/복호화(deobfuscate)
    pieChart.js / trendChart.js / pensionEligibility.js   화면 표시용 보조 유틸
  styles/                디자인 토큰 + 레이아웃 CSS + 인쇄(A4)용 @media print 스타일

api/
  calculate.js        서버리스 함수 엔트리포인트 (POST /api/calculate, 로그인 필요 + 응답 난독화)
  delete-result.js    저장된 진단 이력 삭제용 서버리스 함수
  _lib/
    auth.js              Authorization 헤더의 Supabase 세션 검증 (requireUser)
    constants.js         서버 경제 가정치 (계산별 물가상승률, 국민연금 증가율 가정 등) ← 핵심 로직
    canonicalInput.js    세부 입력으로 자동 합계를 서버에서 재계산하는 canonical 입력 경계
    aggregate.js         canonical 입력 → 집계값(총소득/총지출/총자산 등) 변환
    indicators.js        9개 지표 공식 + 등급 판정 테이블  ← 핵심 로직
    indicatorMeta.js / indicatorComposition.js / gradeBands.js   지표 메타정보/구성/등급구간 정의
    grading.js           등급 구간 판정 유틸
    simulation.js        은퇴자산 시뮬레이션(필요자금/준비자산/부족액/준비율)  ← 핵심 로직
    scenarios.js         4개 대응방안 시나리오 적용 및 전/후 비교 (주택연금 등)  ← 핵심 로직
    peerComparison.js    동일연령대 비교 로직 (재무건강 총점만 placeholder, 나머지는 실제 통계)
    peerBenchmarks.js    동일연령대 실제 통계 원천 데이터(2025년 가계금융복지조사 등)
    pensionProjection.js / pensionEligibility.js   국민연금 등 연금 추정
    futureFinance.js     목표 나이별 연금소득 기준 생활비 충당률 계산
    finite.js            비유한 계산 결과(NaN/Infinity) 차단
    reportBreakdowns.js / reportEnrichment.js / executiveSummary.js / summaryOverview.js
                          리포트/요약 화면에 표시할 세부 데이터 가공
    lifestyleTiers.js    생활수준 구간 정의
    validate.js          서버 측 입력 검증
    *.test.js            위 모듈들에 대한 Vitest 단위 테스트

scripts/
  verify-auth.mjs      인증 설정(Supabase 환경변수 등) 점검 스크립트 (npm run verify:auth)
```

## 인증 & 데이터 저장 (Supabase)

- 앱의 모든 화면은 `AuthGate`를 통과한 로그인 사용자만 접근할 수 있습니다 (`src/App.jsx`의 `AuthGatedApp`).
- `/api/calculate` 요청에는 로그인 세션의 `access_token`을 `Authorization: Bearer` 헤더로 함께 보내며,
  서버(`api/_lib/auth.js`의 `requireUser`)가 Supabase로 토큰을 검증합니다. 세션이 없거나 만료되면
  401 응답과 함께 클라이언트가 자동 로그아웃됩니다.
- 계산이 끝난 결과는 로그인한 사용자 소유로 Supabase `planner_results` 테이블에 저장됩니다
  (`schema_version`, `input_json`, `result_json`, `assumptions_json` 포함). 홈 화면의 "이전 결과 보기"
  (`HistoryList`)에서 목록을 조회/재조회하고, 삭제는 `api/delete-result.js`를 통해 처리합니다.
- 과거 저장 결과를 여는 동작은 `result_json`을 그대로 조회하며 과거 입력을 자동으로 재계산하지 않습니다.
  다만 과거 입력을 다시 제출하는 기능을 사용하거나 같은 내용을 새로 입력해 계산할 때, 월 수령 방식의
  개인연금·퇴직연금에 시작 나이가 없다면 현재 검증 규칙에 따라 필수정보를 입력해야 합니다.
- `/admin` 경로는 Supabase `profiles` 테이블의 `role`이 `admin`인 계정만 접근 가능한 별도
  관리자 대시보드(`AdminDashboard.jsx`)입니다.

## 보안 설계 (핵심 로직 은닉)

- 계산 공식·임계값·등급표·경제 가정치는 전부 `api/` 폴더 안에만 존재합니다 (`api/_lib/constants.js`,
  `indicators.js`, `grading.js`, `simulation.js`, `scenarios.js`, `peerBenchmarks.js` 등).
- `api/` 폴더는 Vite 클라이언트 빌드에 포함되지 않고, Vercel에서 별도의 서버리스 함수로만 실행됩니다.
- 클라이언트(`src/`)는 로그인 세션 토큰과 함께 입력값을 `/api/calculate`로 전송하고, **계산이 끝난
  결과만** 받아 화면에 표시합니다.
- `api/calculate.js`는 응답 payload를 그대로 반환하지 않고 `src/utils/obfuscate.js`의 `obfuscate()`로
  한 번 더 스크램블한 뒤 전송하며, 클라이언트는 `deobfuscate()`로 복원합니다. 즉 브라우저 devtools의
  Network 탭에서도 원문 JSON이 아니라 난독화된 문자열만 보입니다.
- 브라우저 devtools의 Sources 탭에서 `src/` 번들을 열어봐도 공식·구간·계수는 보이지 않습니다.
  (숨기는 대상은 "계산 방법"이지 "계산 결과"가 아닙니다 — 다만 위와 같이 결과 전송 자체도 난독화되어 있습니다.)

## 계산 데이터 흐름

- 브라우저의 자동 합계는 입력 편의를 위한 미리보기이며 최종 계산값으로 신뢰하지 않습니다.
- `/api/calculate`는 원본 입력을 검증한 뒤 `buildCanonicalInput()`으로 급여·상여금 월 환산, 정기소득,
  생활비·건강보험료, 자산, 상세 부채, 일반저축 및 노후저축 합계를 세부 입력에서 다시 계산합니다.
- `aggregate`, 지표, 시뮬레이션, 카드, 차트 및 인쇄/PDF 데이터는 이 canonical 입력과 서버 계산 결과를
  소비합니다. 클라이언트가 전송한 자동 합계로 서버 계산 결과를 덮어쓰지 않습니다.
- 일반저축 합계에 노후저축이 포함되지 않은 경우에는 두 금액을 합산하고, 이미 포함된 경우에는 중복해서
  더하지 않습니다.

## 로컬 개발

```bash
npm install
npm run dev
```

`vite.config.js`에 로컬 전용 미들웨어(`localApiMiddleware`)를 넣어서, `npm run dev`만으로도
`/api/calculate`가 실제 서버리스 함수처럼 동작합니다 (Vercel CLI 없이도 로컬 테스트 가능). 실제 배포
환경에서는 이 미들웨어 대신 Vercel이 `api/` 폴더를 자동으로 서버리스 함수로 인식합니다.

로그인/데이터 저장 기능이 Supabase에 의존하므로, 로컬에서도 프로젝트 루트에 `.env.local`을 만들고
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 설정해야 합니다. `vite.config.js`는 이 값을
`loadEnv`로 읽어 `process.env`에도 주입하므로, `npm run dev` 상태에서 `api/` 서버리스 함수(인증 검증
등)도 동일한 키를 사용할 수 있습니다. 설정 상태는 `npm run verify:auth`로 점검할 수 있습니다.

## 배포 (Vercel)

1. 이 프로젝트를 GitHub 저장소로 올립니다.
2. vercel.com 에서 New Project → 해당 저장소 선택.
3. Framework Preset은 Vite로 자동 인식됩니다. Build Command/Output Directory는 기본값 그대로 두면 됩니다.
4. `api/*.js` 파일들은 별도 설정 없이 Vercel Functions로 자동 인식됩니다.
5. **환경변수 설정이 필수입니다.** Vercel 프로젝트 Settings → Environment Variables에
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 등록하세요. 이 값이 없으면 `api/_lib/auth.js`의
   `requireUser()`가 실패하여 `/api/calculate`가 500 에러를 반환합니다.
6. 배포 후 브라우저 devtools의 Sources/Network 탭을 직접 열어 계산 로직이 노출되지 않는지
   (Network 응답도 난독화되어 있는지) 최종 확인하세요.

## 현재 구현의 가정 및 알려진 제약사항 (중요)

원본 리포트(JM_재무진단_리포트_미리보기.html) 및 계산로직 문서(1_계산로직.html) 기준으로 구현되어
있으나, 아래 항목은 여전히 단순화된 가정이거나 회사 기준 재검증이 필요합니다.

- 은퇴자산 시뮬레이션 (`api/_lib/simulation.js`)과 미래재무 전망(`api/_lib/futureFinance.js`)은
  모두 `api/_lib/constants.js`의 `GENERAL_INFLATION_RATE`(연 3%, CPI 기준 모델 가정, 사용자
  승인 2026-08-20)를 공통으로 사용합니다. 사용자가 입력한(또는 기본값 3%인) 예상 수익률로 현재가치를
  환산하는 계리(actuarial) 모델 자체는 여전히 근사 모델이며, 실제 회사 기준 검증/교체가 필요합니다.
  이 물가상승률의 갱신주기는 아직 승인 대기 사항입니다.
- 국민연금 증가율(`NATIONAL_PENSION_GROWTH_RATE`, 연 2.1%)은 영구 고정 정책이 아니라 모델 가정입니다.
  기준일은 `2026-01-12`, 적용 연도는 2026년이며 근거 메타데이터는
  `NATIONAL_PENSION_GROWTH_ASSUMPTION`에 저장됩니다.
- 개인연금과 퇴직연금의 증가율은 아직 승인 대기 사항입니다. 미래재무 전망의 현재 구현값은 각각 0%이며,
  다른 계산과의 통합이나 변경은 승인 없이 수행하지 않습니다.
- 미래재무 전망의 공식 지표명은 **연금소득 기준 생활비 충당률**입니다. 목표 나이에 실제 수령 중인
  국민연금·퇴직연금·개인연금의 월소득만 예상 월 생활비와 비교하며, 전체 자산·순자산·일시금은 분자에
  포함하지 않습니다. 시작 시점 포함·종료 시점 제외로 판정하고, 월 연금액이 있어도 시작 또는 종료 정보를
  확인할 수 없으면 부분 충당률을 제공하지 않고 해당 목표 나이를 산출 불가로 처리합니다. 상세 기준은
  [`docs/future-finance-spec.md`](docs/future-finance-spec.md)를 참조하세요.
- 주택연금 월지급액 추정 (`api/_lib/scenarios.js`의 `REVERSE_MORTGAGE_RATE_TABLE`): 나이대별
  주택가격 대비 월지급률을 단순화한 표입니다. 실제 금액은 반드시 한국주택금융공사 예상연금 조회로
  재확인해야 합니다.
- 동일연령대 비교 (`api/_lib/peerComparison.js`, `peerBenchmarks.js`): 순자산·소득·금융자산 평균은
  2025년 가계금융복지조사 등 실제 통계를 연령대(5구간)별로 반영합니다. 다만 "재무건강 총점" 평균만은
  공식 통계가 없어 여전히 placeholder 값(69.9점)을 사용합니다.
- 자녀 생애 목돈 지출 준비율: 금융자산 + 현금성(유동) 자산을 우선 재원으로 가정한 단순 비율입니다
  (`api/_lib/simulation.js`). 실제로는 목표별 재원 배분 규칙(예: 목적자금 통장 분리 여부)을 반영해야
  더 정확합니다.

## 향후 개선 체크리스트

- [x] 실제 벤치마크 통계 데이터 연동 (동일연령대 비교) — 순자산/소득/금융자산은 완료
- [ ] 재무건강 총점(FHS) 동일연령대 평균 — 공식 통계 부재로 여전히 placeholder(69.9점)
- [ ] 한국주택금융공사 공식 문서 기반으로 주택연금 계산 정교화
- [ ] 은퇴자산 시뮬레이션 계리 모델 회사 기준으로 검증
- [x] 입력값 저장/불러오기 — Supabase 로그인 연동 + 진단 이력 저장/조회/삭제 구현 완료
- [x] PDF 출력/인쇄용 스타일 — 리포트에 A4 `@media print` 레이아웃 및 인쇄/PDF 저장 버튼 구현 완료
