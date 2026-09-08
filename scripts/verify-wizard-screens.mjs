// 로컬 Chromium에서 실제 React DOM/effect와 기존 제출 경로를 검증한다.
// 실행: node scripts/verify-wizard-screens.mjs [Chromium 실행 파일 경로]
// 실제 계정/DB 대신 이 검증 서버 안에서만 인증과 저장 어댑터를 대체한다.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const executable = process.argv[2] || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!executable) throw new Error('Chromium 실행 파일 경로를 인수로 지정해 주세요.');
const output = mkdtempSync(join(tmpdir(), 'jm-wizard-check-'));
const clientModule = `
export const testStore = { draft: null, result: null };
export const supabase = {
  auth: { getSession: async () => ({ data: { session: { access_token: 'local-test' } } }) },
  from(table) {
    return {
      upsert(row) { testStore.draft = structuredClone({ ...row, updated_at: '2026-09-08T00:00:00Z' }); return this; },
      insert(row) { testStore.result = structuredClone(row); return this; },
      select() { return this; }, eq() { return this; },
      single: async () => ({ data: table === 'planner_drafts' ? testStore.draft : { id: 'test-result' }, error: null }),
      maybeSingle: async () => ({ data: testStore.draft, error: null }),
      delete() { testStore.draft = null; return { eq: async () => ({ error: null }) }; },
    };
  },
};`;
const server = await createServer({
  configFile: false,
  root: resolve('.'),
  server: { host: '127.0.0.1', port: 0 },
  plugins: [react(), {
    name: 'wizard-local-test-adapters',
    enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('supabaseClient') || id.endsWith('supabaseClient.js')) return '\0wizard-test-client';
      if (id.endsWith('/_lib/auth.js')) return '\0wizard-test-auth';
    },
    load(id) {
      if (id === '\0wizard-test-client') return clientModule;
      if (id === '\0wizard-test-auth') return 'export async function requireUser() { return { ok: true, user: { id: "local-test" } }; }';
    },
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (req.url === '/__wizard-check') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(await vite.transformIndexHtml(req.url, '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><pre id="verification">RUNNING</pre><script type="module" src="/scripts/wizard-screen-check.jsx"></script></body></html>'));
        } else if (req.url === '/api/calculate') {
          let body = '';
          for await (const chunk of req) body += chunk;
          req.body = body;
          const { default: handler } = await vite.ssrLoadModule('/api/calculate.js');
          await handler(req, {
            status(code) { res.statusCode = code; return this; },
            json(value) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); },
          });
        } else next();
      });
    },
  }],
});
try {
  await server.listen();
  const address = server.httpServer.address();
  const args = [
    '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', `--user-data-dir=${join(output, 'profile')}`,
    '--window-size=390,844', '--force-device-scale-factor=1', '--hide-scrollbars',
    '--virtual-time-budget=90000', '--dump-dom', `--screenshot=${join(output, 'mobile.png')}`,
    `http://127.0.0.1:${address.port}/__wizard-check`,
  ];
  const html = await new Promise((resolveOutput, reject) => {
    const child = spawn(executable, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Browser verification timed out')); }, 120000);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code) reject(new Error(`Chromium exited ${code}: ${stderr.slice(-1500)}`));
      else resolveOutput(stdout);
    });
  });
  const match = html.match(/<pre id="verification">([\s\S]*?)<\/pre>/);
  const result = match?.[1]?.replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
  console.log(result || html.slice(-1500));
  console.log(`Mobile screenshot: ${join(output, 'mobile.png')}`);
  // Keep source available for reviewers without including generated files in git.
  if (!result?.startsWith('PASS')) process.exitCode = 1;
} finally {
  await server.close();
}
