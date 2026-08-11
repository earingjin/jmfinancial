import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 로컬 개발(`npm run dev`)에서 /api/calculate 서버리스 함수를 그대로 흉내내는 미들웨어.
// 실제 배포 환경(Vercel)에서는 이 미들웨어 없이 api/ 폴더가 자동으로 서버리스 함수로 인식된다.
function localApiMiddleware() {
  return {
    name: 'local-api-middleware',
    configureServer(server) {
      server.middlewares.use('/api/calculate', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST 요청만 허용됩니다.' }));
          return;
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            req.body = body;
            const mod = await server.ssrLoadModule('/api/calculate.js');
            const jsonRes = {
              statusCode: 200,
              status(code) { this.statusCode = code; return this; },
              json(payload) {
                res.statusCode = this.statusCode;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));
              },
            };
            await mod.default(req, jsonRes);
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: '로컬 API 처리 중 오류', detail: String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // 로컬 dev에서 api/ 함수가 process.env로 Supabase 키를 읽을 수 있게 주입.
  // Vercel에서는 프로젝트 환경변수가 자동으로 process.env에 들어간다.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [react(), localApiMiddleware()] };
});
