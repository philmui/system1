import { expect, test } from '@playwright/test';
import pages from '../../data/education-examples/review-pages-v1.json' with { type: 'json' };

test('Classify page reaches the real backend through a frontend port absent from CORS', async ({ page, baseURL }) => {
  const failures: string[] = [];
  page.on('requestfailed', request => failures.push(request.url()));
  await page.goto('/#explore/review');
  const health = await page.evaluate(async () => {
    const response = await fetch('/api/health');
    return { status: response.status, body: await response.json() };
  });
  expect(health.status).toBe(200);
  expect(health.body.integrations.openai).toBe('missing_credentials');
  await page.getByRole('button', { name: 'Live requests', exact: true }).click();
  const request = page.waitForResponse(response => response.url().endsWith('/api/lessons/review/live'));
  await page.getByRole('button', { name: 'Classify page', exact: true }).click();
  const response = await request;
  expect(response.url()).toBe(`${baseURL}/api/lessons/review/live`);
  // No provider keys are present in browser tests. A readable missing-key
  // response proves routing, Origin admission and handler execution all worked.
  expect(response.status()).toBe(503);
  expect((await response.json()).detail).toContain('OPENAI_API_KEY');
  await expect(page.getByRole('alert')).toContainText('OPENAI_API_KEY');
  await expect(page.getByRole('button', { name: 'Classify page', exact: true })).toBeEnabled();
  expect(failures).toEqual([]);
});

test('the proxy preserves an untrusted Origin so the backend rejects it', async ({ request }) => {
  const page = pages.pages[0];
  const response = await request.post('/api/lessons/review/live', {
    headers: { Origin: 'https://attacker.example' },
    data: { page_id: page.id, content_version: page.content_version, action: 'classify' },
  });
  expect(response.status()).toBe(403);
  expect((await response.json()).detail).toContain('origin is not allowed');
});
