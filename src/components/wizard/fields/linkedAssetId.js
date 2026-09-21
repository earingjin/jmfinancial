export function createLinkedAssetId(cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl || typeof cryptoImpl.randomUUID !== 'function') {
    throw new Error('연결 자산 ID를 생성할 수 없습니다.');
  }
  return cryptoImpl.randomUUID();
}
