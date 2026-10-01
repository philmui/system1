import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const data = join(root, '.runtime', `browser-${process.pid}-${Date.now()}`);
const frontendPort = process.env.PLAYWRIGHT_PORT || '5174';
const baseURL = `http://127.0.0.1:${frontendPort}`;
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 90_000,
  expect: { timeout: 15_000 }, reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', ...devices['Desktop Chrome'] },
  webServer: [
    { command: `${join(root, '.venv/bin/python')} -m uvicorn doc_discovery.api:app --host 127.0.0.1 --port 8001`, cwd: root, url: 'http://127.0.0.1:8001/api/health', reuseExistingServer: false, timeout: 30_000,
      env: { APP_MODE: 'test-fixture', APP_DATA_DIR: data, LANGSMITH_TRACING: 'false', TYPESAFE_API_KEY: '', OPENAI_API_KEY: '', LANGSMITH_API_KEY: '', CORS_ORIGINS: 'http://127.0.0.1:5173,http://localhost:5173' } },
    { command: `npm run dev -- --port ${frontendPort}`, url: baseURL, reuseExistingServer: false, timeout: 30_000, env: { VITE_API_BASE_URL: '', DEV_API_PROXY_TARGET: 'http://127.0.0.1:8001' } },
  ],
});
