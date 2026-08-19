// /api/calculate 인증 통과 경로(401 차단 + 200 통과) 일회성 검증 스크립트.
// .env.local의 테스트 계정으로 실제 Supabase 토큰을 발급받아 세 가지 케이스를 확인한다.
// 계산 로직 검증이 아니라 인증 배선(auth wiring) 검증이 목적이다 — 여기서 재무 판정을 내리지 않는다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initialFormData } from '../src/state/initialFormData.js';
import { deobfuscate } from '../src/utils/obfuscate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function parseEnvLocal(filePath) {
  const env = {};
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return env;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function fail(message) {
  console.error(`\n[FAIL] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { url: 'http://localhost:5174' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) {
      args.url = argv[i + 1];
      i++;
    }
  }
  return args;
}

const { url: baseUrl } = parseArgs(process.argv.slice(2));

const env = parseEnvLocal(path.join(rootDir, '.env.local'));
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TEST_USER_EMAIL = env.TEST_USER_EMAIL;
const TEST_USER_PASSWORD = env.TEST_USER_PASSWORD;

const missing = [
  ['VITE_SUPABASE_URL', SUPABASE_URL],
  ['VITE_SUPABASE_PUBLISHABLE_KEY', SUPABASE_KEY],
  ['TEST_USER_EMAIL', TEST_USER_EMAIL],
  ['TEST_USER_PASSWORD', TEST_USER_PASSWORD],
].filter(([, value]) => !value).map(([key]) => key);

if (missing.length > 0) {
  fail(
    `.env.local에 다음 값이 없습니다: ${missing.join(', ')}\n` +
    '  TEST_USER_EMAIL=...\n  TEST_USER_PASSWORD=...\n' +
    '위 두 줄을 .env.local에 직접 추가한 뒤 다시 실행하세요.'
  );
}

console.log(`대상 URL: ${baseUrl}`);
console.log('Supabase 액세스 토큰 발급 중...');

const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
});

const tokenBody = await tokenRes.json().catch(() => ({}));
if (!tokenRes.ok || !tokenBody.access_token) {
  console.error('토큰 발급 실패. 응답:');
  console.error(JSON.stringify(tokenBody, null, 2));
  process.exit(1);
}

const accessToken = tokenBody.access_token;
console.log('토큰 발급 성공.\n');

// initialFormData 스키마를 그대로 쓰고 필요한 값만 덮어쓴다 - 손으로 새 객체를 만들지 않는다.
const testPayload = structuredClone(initialFormData);
testPayload.basic.birthYear = 1975;
testPayload.basic.retirementAge = 60;
testPayload.basic.lifeExpectancy = 90;
testPayload.basic.serviceYears = 10;
testPayload.expense.retirementLivingCost = 300;
testPayload.assets.currentIncome.monthly = 500;
testPayload.income.personalPension.startAge = 65;

const results = [];

function report(name, expected, actual, passed) {
  results.push(passed);
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name} — 기대: ${expected}, 실제: ${actual}`);
}

// 케이스 1: Authorization 헤더 없음 -> 401
{
  const res = await fetch(`${baseUrl}/api/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload),
  });
  report('Authorization 헤더 없이 POST', 401, res.status, res.status === 401);
}

// 케이스 2: 잘못된 토큰 -> 401
{
  const res = await fetch(`${baseUrl}/api/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer invalid.token.here',
    },
    body: JSON.stringify(testPayload),
  });
  report('잘못된 토큰으로 POST', 401, res.status, res.status === 401);
}

// 케이스 3: 정상 토큰 -> 200 + payload 존재
{
  const res = await fetch(`${baseUrl}/api/calculate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(testPayload),
  });
  const body = await res.json().catch(() => ({}));
  const ok = res.status === 200 && typeof body.payload === 'string';
  report('정상 토큰으로 POST', '200 + payload 문자열', `${res.status}${ok ? ' + payload 있음' : ' + payload 없음/타입불일치'}`, ok);

  if (ok) {
    try {
      const decoded = deobfuscate(body.payload);
      const hasTotalScore = decoded?.summary && 'totalScore' in decoded.summary;
      const hasSimulation = !!decoded?.simulation;
      report(
        '복호화 후 summary.totalScore / simulation 존재',
        'totalScore 필드 있음, simulation 있음',
        `totalScore=${decoded?.summary?.totalScore}, simulation=${hasSimulation ? '있음' : '없음'}`,
        hasTotalScore && hasSimulation
      );
    } catch (err) {
      report('복호화 후 summary.totalScore / simulation 존재', '복호화 성공', `복호화 실패: ${err.message}`, false);
    }
  } else {
    console.error('응답 본문:', JSON.stringify(body, null, 2));
  }
}

console.log('');
if (results.every(Boolean)) {
  console.log('모든 케이스 PASS');
  process.exit(0);
} else {
  console.log('하나 이상 FAIL');
  process.exit(1);
}
