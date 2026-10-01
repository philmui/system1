import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command, mode }) => {
  // Parent .env loading is a local-development convenience only. Vercel builds
  // use frontend/.env files or injected VITE_* deployment configuration.
  const envDir = command === 'serve' ? fileURLToPath(new URL('..', import.meta.url)) : '.';
  const target = loadEnv(mode, envDir, 'DEV_').DEV_API_PROXY_TARGET || 'http://127.0.0.1:8000';
  const backendOrigin = new URL(target).origin;
  return {
    plugins: [react()],
    envDir,
    server: {
      port: 5173, strictPort: true,
      proxy: {
        '^/api(?:/|$)': {
          target,
          // Preserve Host and Origin together so the backend can verify a
          // same-origin local request without trusting forwarded headers.
          changeOrigin: false,
          configure(proxy) {
            proxy.on('error', (_error, _request, response) => {
              if ('writeHead' in response && !response.headersSent && !response.writableEnded) {
                response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                response.end(JSON.stringify({ detail: `Cannot reach the backend at ${backendOrigin}. Start the backend and try again.` }));
              }
            });
          },
        },
      },
    },
    build: { sourcemap: false },
  };
});
