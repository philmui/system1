import { expect, test } from '@playwright/test';
import { api, API_BASE, ApiError } from '../src/lib/api';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

test('the default API uses the frontend origin and reads avoid an unnecessary JSON preflight', async () => {
  expect(API_BASE).toBe('');
  const calls: { url: string; options: RequestInit }[] = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return Response.json({ status: 'ok' });
  };
  await api.health();
  expect(calls[0].url).toBe('/api/health');
  expect(calls[0].options.credentials).toBe('include');
  expect(new Headers(calls[0].options.headers).has('Content-Type')).toBe(false);
  await api.reviewLesson('fictional-page', 'content-hash', 'classify');
  expect(calls[1].url).toBe('/api/lessons/review/live');
  expect(new Headers(calls[1].options.headers).get('Content-Type')).toBe('application/json');
  expect(JSON.parse(String(calls[1].options.body)).action).toBe('classify');
});

test('provider and proxy HTTP errors retain their concrete message and never retry a paid request', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ detail: 'OPENAI_API_KEY is missing; live execution cannot call OpenAI.' }, { status: 503 });
  };
  await expect(api.reviewLesson('fictional-page', 'content-hash', 'classify')).rejects.toMatchObject({ status: 503, message: expect.stringContaining('OPENAI_API_KEY') });
  expect(calls).toBe(1);
  globalThis.fetch = async () => Response.json({ detail: 'Cannot reach the backend at http://127.0.0.1:8000. Start the backend and try again.' }, { status: 503 });
  await expect(api.health()).rejects.toMatchObject({ status: 503, message: expect.stringContaining('Start the backend') });
});

test('network failures are connection errors rather than a fabricated provider result', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await expect(api.health()).rejects.toBeInstanceOf(ApiError);
  await expect(api.health()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Could not connect to the app') });
});

for (const failure of ['html', 'malformed-json', 'network']) test(`${failure} after a command preserves its key for a deliberate retry`, async () => {
  const keys: (string | null)[] = [];
  globalThis.fetch = async (_url, options) => {
    keys.push(new Headers(options?.headers).get('Idempotency-Key'));
    if (keys.length > 1) return Response.json({ id: 'retained-run' });
    if (failure === 'network') throw new TypeError('Failed to fetch');
    return new Response(failure === 'html' ? '<!doctype html><html>Frontend fallback</html>' : '{', {
      headers: { 'Content-Type': failure === 'html' ? 'text/html' : 'application/json' },
    });
  };
  await expect(api.classify([`document-${failure}`])).rejects.toMatchObject({ status: 0, message: expect.stringContaining(failure === 'html' ? 'web page instead of data' : failure === 'network' ? 'Could not connect' : 'unreadable response') });
  expect(keys).toHaveLength(1);
  await expect(api.classify([`document-${failure}`])).resolves.toMatchObject({ id: 'retained-run' });
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});
