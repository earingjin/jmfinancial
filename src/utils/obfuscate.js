// 아주 단순한 XOR + Base64 스크램블 유틸.
// 진짜 암호화가 아니다 — 복호화 키가 이 파일 자체(클라이언트 번들)에 들어 있으므로,
// 마음만 먹으면 Sources 탭에서 이 파일을 찾아 수동으로 풀어낼 수 있다.
// 목적은 딱 하나: F12 → Network 탭에서 응답 JSON을 "그냥 읽을 수 없게" 만드는 것.
// (평범한 사용자가 무심코 눌러봤을 때 평문 계산 결과/기준표가 바로 보이지 않게 하는 최소한의 가림막)
//
// 이 파일에는 절대 실제 계산 로직(공식·임계값·등급표)을 넣지 않는다 — 그건 여전히
// api/_lib/ 안에만 존재해야 한다. 여기는 순수한 인코딩/디코딩 기계일 뿐이다.

const KEY = 'jm-fhs-secret-2026';
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function xorBytes(bytes, key) {
  const keyBytes = new TextEncoder().encode(key);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  return out;
}

function bytesToBase64(bytes) {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const triplet = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    result += B64_CHARS[(triplet >> 18) & 0x3f];
    result += B64_CHARS[(triplet >> 12) & 0x3f];
    result += b1 !== undefined ? B64_CHARS[(triplet >> 6) & 0x3f] : '=';
    result += b2 !== undefined ? B64_CHARS[triplet & 0x3f] : '=';
  }
  return result;
}

function base64ToBytes(b64) {
  const clean = b64.replace(/=+$/, '');
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const val = B64_CHARS.indexOf(clean[i]);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

/** 아무 JSON 직렬화 가능한 값이나 인코딩된 문자열로 스크램블한다. */
export function obfuscate(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return bytesToBase64(xorBytes(bytes, KEY));
}

/** obfuscate()로 만든 문자열을 원래 값으로 복원한다. */
export function deobfuscate(encoded) {
  const bytes = xorBytes(base64ToBytes(encoded), KEY);
  return JSON.parse(new TextDecoder().decode(bytes));
}
