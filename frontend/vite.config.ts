import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Parent .env loading is a local-development convenience only. Vercel builds
  // use frontend/.env files or injected VITE_* deployment configuration.
  envDir: command === 'serve' ? fileURLToPath(new URL('..', import.meta.url)) : '.',
  server: { port: 5173, strictPort: true },
  build: { sourcemap: false },
}));
