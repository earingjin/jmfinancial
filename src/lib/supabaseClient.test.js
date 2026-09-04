import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A10 회귀 테스트: 필수 환경변수가 없어도 이 모듈을 import하는 시점에 throw하면 안 된다
// (main.jsx가 React를 mount하기도 전에 죽어 흰 화면만 남는다 - ErrorBoundary도 이 시점의 오류는
// 잡지 못한다). 매 테스트마다 모듈을 새로 평가해야 하므로 vi.resetModules() + 동적 import를 쓴다.
describe('supabaseClient - 필수 환경변수 검증 (A10)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('URL/KEY가 모두 있으면 정상적으로 클라이언트를 만들고 supabaseConfigured=true다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');

    const mod = await import('./supabaseClient.js');

    expect(mod.supabaseConfigured).toBe(true);
    expect(mod.supabase).not.toBeNull();
  });

  it('URL이 없으면 throw하지 않고 supabaseConfigured=false, supabase=null이다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');

    const mod = await import('./supabaseClient.js');

    expect(mod.supabaseConfigured).toBe(false);
    expect(mod.supabase).toBeNull();
  });

  it('KEY가 없으면 throw하지 않고 supabaseConfigured=false, supabase=null이다', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    const mod = await import('./supabaseClient.js');

    expect(mod.supabaseConfigured).toBe(false);
    expect(mod.supabase).toBeNull();
  });

  it('둘 다 없으면 더미 URL/키나 service_role 등으로 대체하지 않고 정말 null을 반환한다(보안)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    const mod = await import('./supabaseClient.js');

    expect(mod.supabaseConfigured).toBe(false);
    expect(mod.supabase).toBeNull();
  });
});
