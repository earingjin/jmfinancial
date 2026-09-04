import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

// main.jsx는 document.getElementById('root')를 즉시 호출해 createRoot(...).render(...)를 실행하므로
// (이 프로젝트 테스트 환경에는 DOM이 없다 - App.test.js와 같은 이유), import해서 실행하지 않고
// 소스 텍스트만 읽어 A9(ErrorBoundary)·A10(설정 검증) 배선이 실제로 존재하는지 확인한다.
async function readMainSource() {
  return readFile(new URL('./main.jsx', import.meta.url), 'utf8');
}

describe('main.jsx - ErrorBoundary/설정 검증 배선 (A9/A10)', () => {
  it('supabaseConfigured가 false면 <App/>을 mount하지 않고 AppFallbackScreen만 보여준다', async () => {
    const source = await readMainSource();
    expect(source).toContain("import { supabaseConfigured } from './lib/supabaseClient.js'");
    expect(source).toContain('supabaseConfigured ?');
    expect(source).toContain('<AppFallbackScreen message="서비스 설정 문제로 현재 이용할 수 없습니다." />');
  });

  it('supabaseConfigured가 true인 경로에서는 <App/>이 ErrorBoundary로 감싸져 있다', async () => {
    const source = await readMainSource();
    const trueyBranchStart = source.indexOf('supabaseConfigured ? (');
    const elseStart = source.indexOf(') : (', trueyBranchStart);
    const truthyBranch = source.slice(trueyBranchStart, elseStart);
    expect(truthyBranch).toContain('<ErrorBoundary>');
    expect(truthyBranch).toContain('<App />');
  });

  it('main.jsx가 별도 상태관리 라이브러리를 새로 도입하지 않는다', async () => {
    const source = await readMainSource();
    expect(source).not.toMatch(/redux|zustand|recoil|mobx/i);
  });
});
