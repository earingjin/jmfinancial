# AGENTS.md

## Priorities

계산 정확성 > 기존 동작 보존 > 보안/서버 경계 > 테스트 > 최소 구현.

코드량보다 계산 안전성을 우선한다.

## Rules

- 새 코드/파일/dependency 전에 기존 구현을 먼저 찾는다.
- 우선순위: 재사용 → 기존 모듈 수정 → 기본 기능 → 기존 dependency → 작은 신규 코드 → 새 파일/dependency.
- 사용자 승인 없이 계산식, 배점, 임계값, 경제 가정을 변경하지 않는다.
- 불명확한 기준은 추정하지 않는다.
- `rawValue`로 계산/등급 판정하고 `displayValue`를 재사용하지 않는다.
- 분모 0을 0%로 처리하지 않는다.
- 음수, `NaN`, `Infinity` 및 중복 합산을 허용하지 않는다.
- 임계값 변경 시 `T-0.01`, `T`, `T+0.01`을 테스트한다.
- 관련 없는 리팩터링, 디자인/프레임워크/인증 변경은 하지 않는다.

## Architecture

재무 계산의 source of truth는 `api/`다.

브라우저 자동 합계는 신뢰하지 않고 `canonicalInput.js`에서 세부 입력으로 다시 계산한다.

`src/`는 입력, 상태, API 호출, 표시, 차트, 포맷팅만 담당하며 재무 공식/등급/경제 가정을 새로 구현하지 않는다.

Summary와 Report는 동일한 서버 결과를 재사용한다.

책임 모듈:

- canonical 입력 → `canonicalInput.js`
- 집계 → `aggregate.js`
- 경제 가정 → `constants.js`
- 유한값 검증 → `finite.js`
- 재무지표/등급 → `indicators.js`, `grading.js`, `gradeBands.js`
- 은퇴 → `simulation.js`
- 대응방안 → `scenarios.js`
- 또래 비교 → `peerComparison.js`, `peerBenchmarks.js`
- 연금 → `pensionProjection.js`, `pensionEligibility.js`
- 미래재무 → `futureFinance.js`
- 입력 검증 → `validate.js`

같은 공식, 상수, 합산 규칙을 복제하지 않는다.

`api/calculate.js`는 인증·검증·canonical 생성·모듈 호출·결과 조합·payload 구성을 담당하는 orchestrator이며 새 재무 공식을 직접 넣지 않는다.

## Project Constraints

- 미래재무 전망은 `CLAUDE.md`와 `docs/future-finance-spec.md`를 따른다.
- 공식 명칭은 `연금소득 기준 생활비 충당률`이며 종합 은퇴 준비도로 해석하지 않는다.
- 현재 Wizard는 Step1~6만 사용하며 Step7은 사용자 요청 없이 활성화하지 않는다.
- 과거 저장 결과는 사용자 요청 없이 자동 재계산하지 않는다.
- 기존 Supabase 인증, 관리자 권한, 응답 난독화, 환경변수 구조를 유지한다.
- `helpers.js`, `common.js`, `misc.js`, `calculationUtils.js` 같은 모호한 범용 파일을 만들지 않는다.

## Validation

작업 범위에 맞게 실행:

```bash
npm test
npm run lint
npm run build
npm run verify:auth
```

완료 전 확인:

- 기존 구현을 재사용했는가
- 새 파일/dependency가 필요한가
- canonical 입력을 우회하지 않았는가
- 계산/상수 중복이 없는가
- 계산 로직이 `src/`로 이동하지 않았는가
- 관련 없는 변경이 없는가
- 계산 변경에 테스트가 있는가

작업 후 변경 파일, 재사용한 코드, 테스트 결과, 남은 위험만 간단히 보고한다.
