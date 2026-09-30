import { expect, test } from '@playwright/test';
import { examplePages } from '../src/lib/reviewExample';
import { buildReviewTrace, defaultScenario } from '../src/lib/workflowComparison';

test('synchronized legal example, focus, speed, disclosure, review and themes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // The local illustration must work without the live API.
  await page.route('**/api/**', route => route.abort());
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto('/#workflow');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.review-lane')).toHaveCount(2);
  await expect(page.locator('.global-error')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/LangGraph|Jev/);
  const speed = page.getByRole('slider', { name: 'Example playback speed', exact: true });
  await expect(speed).toHaveValue('1');
  await expect(speed).toHaveAttribute('min', '0.1');
  await expect(speed).toHaveAttribute('max', '4');
  await speed.focus(); await page.keyboard.press('Home'); await expect(speed).toHaveValue('0.1');
  await page.keyboard.press('End'); await expect(speed).toHaveValue('4');
  await page.getByRole('button', { name: 'Expand playback controls', exact: true }).click();
  const timeline = page.getByRole('slider', { name: 'Example timeline', exact: true });
  await timeline.fill('1');
  await page.getByRole('button', { name: 'Focus graph', exact: true }).click();
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  await expect(timeline).toHaveValue('1');
  await expect(speed).toHaveValue('4');
  await page.getByRole('button', { name: 'Exit graph focus', exact: true }).click();
  await expect(page.locator('.topbar')).toBeVisible();

  const select = page.getByRole('combobox', { name: 'Document to follow in both graphs' });
  await select.selectOption('2');
  await expect(timeline).toHaveValue('0');
  const systemTrace = buildReviewTrace(examplePages[2], 'system1', defaultScenario);
  const frontierTrace = buildReviewTrace(examplePages[2], 'frontier', defaultScenario);
  await timeline.fill(String(frontierTrace.decisionAt - .05));
  await page.locator('.strategy-frontier [data-node="redact"]').click();
  await expect(page.getByRole('button', { name: 'Redacted copy', exact: true })).toHaveCount(0);
  await expect(page.locator('.shared-state pre')).toContainText('"decisions": null');
  await page.getByRole('button', { name: 'System 1 path', exact: true }).click();
  await expect(page.getByRole('button', { name: 'System 1 path', exact: true })).toBeFocused();
  await timeline.fill(String(systemTrace.steps.find(step => step.id === 'redact')!.end + .05));
  await expect(page.getByRole('button', { name: 'Redacted copy', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redacted copy', exact: true }).click();
  await expect(page.locator('.comparison-source pre')).toContainText('[REDACTED]');
  await page.getByRole('button', { name: 'Close workflow details' }).click();
  await timeline.fill((await timeline.getAttribute('max'))!);
  await expect(page.locator('.strategy-system1 [data-metric="cost"]')).toHaveText('$0.0081');
  await expect(page.locator('.strategy-frontier [data-metric="cost"]')).toHaveText('$0.0140');
  await timeline.fill('0');
  await expect(page.locator('.strategy-system1 [data-metric="cost"]')).toHaveText('$0.0000');

  await select.selectOption('3');
  await timeline.fill((await timeline.getAttribute('max'))!);
  await expect(page.locator('.comparison-review-prompt')).toBeVisible();
  await expect(page.locator('.comparison-result')).toHaveCount(0);
  await page.getByRole('button', { name: 'Review page', exact: true }).click();
  await page.getByRole('button', { name: 'Release page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Focus graph', exact: true })).toBeFocused();
  await expect(page.locator('.comparison-result')).toContainText('Same prepared outcome');

  await page.locator('.comparison-caption').getByRole('button', { name: 'Assumptions' }).click();
  await page.getByRole('spinbutton', { name: 'System 1 classification, seconds / request' }).fill('8');
  await page.getByRole('spinbutton', { name: 'Frontier classification, seconds / request' }).fill('0.1');
  await page.getByRole('button', { name: 'Apply & reset' }).click();
  await expect(page.getByRole('button', { name: 'Focus graph', exact: true })).toBeFocused();
  await expect(timeline).toHaveValue('0');
  await select.selectOption('0');
  await timeline.fill((await timeline.getAttribute('max'))!);
  await expect(page.locator('.comparison-result')).toContainText('7.90s more machine time');

  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('slider', { name: 'Example playback speed' })).toHaveValue('1');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Focus graph', exact: true }).click();
  for (const size of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('button', { name: 'Exit graph focus' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Reset example' })).toBeInViewport();
    await expect(page.getByRole('slider', { name: 'Example playback speed' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.topbar')).toBeVisible();
  expect(errors).toEqual([]);
});
