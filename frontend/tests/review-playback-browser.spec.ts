import { expect, test } from '@playwright/test';
import { examplePages } from '../src/lib/reviewExample';
import { buildReviewTrace, defaultScenario } from '../src/lib/workflowComparison';

// Native range inputs normalize trailing zeroes and floating-point tails.
const rangeValue = (value: number) => String(Number(value.toFixed(6)));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.abort());
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto('/#workflow');
  await page.getByRole('button', { name: 'Expand playback controls', exact: true }).click();
});

test('both papers arrive together; the specialized decision finishes while the frontier model keeps working', async ({ page }) => {
  const timeline = page.getByRole('slider', { name: 'Example timeline', exact: true });
  const system = buildReviewTrace(examplePages[0], 'system1', defaultScenario);
  const input = system.steps.find(step => step.id === 'input-agent')!;
  await timeline.fill(rangeValue((input.start + input.end) / 2));
  await expect(page.locator('[data-transfer="input-agent"]')).toHaveCount(2);
  const papers = await page.locator('[data-packet]').evaluateAll(elements => elements.map(element => element.getAttribute('transform')));
  expect(papers[0]).toBe(papers[1]);
  await expect(page.locator('[data-metric="time"]').first()).toHaveText('0.00s');
  await expect(page.locator('[data-metric="time"]').last()).toHaveText('0.00s');
  await timeline.fill(rangeValue(system.decisionAt + .02));
  await expect(page.locator('.strategy-system1 .svg-decision-status')).toContainText('Decided · 0.35 s');
  await expect(page.locator('.strategy-frontier .svg-decision-status')).toContainText('Deciding');
  await expect(page.locator('.strategy-frontier .svg-answer.is-known')).toHaveCount(0);
  await expect(page.locator('.comparison-decision-timing')).toContainText('Measured decision time');
  await expect(page.locator('.comparison-decision-timing')).toContainText('Simulated values');
  await expect(page.locator('.comparison-decision-timing')).toContainText('Frontier takes 10.9× as long');
  await expect(page.locator('.comparison-caption')).toContainText('excluded from latency');
  await expect(timeline).toHaveAttribute('aria-valuetext', /percent of animation/);
});

test('frontier outgoing transfers are visible, pause in place and never accrue model time', async ({ page }) => {
  const timeline = page.getByRole('slider', { name: 'Example timeline', exact: true });
  const lane = page.locator('.strategy-frontier');
  const trace = buildReviewTrace(examplePages[0], 'frontier', defaultScenario);
  const transfer = trace.steps.find(step => step.id === 'agent-produce')!;
  await timeline.fill(rangeValue(transfer.start + .08));
  const paper = lane.locator('[data-packet]');
  await expect(paper).toBeVisible();
  const before = Number(await paper.getAttribute('data-progress'));
  await page.getByRole('button', { name: 'Run simulation', exact: true }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await expect(paper).toBeVisible();
  const after = Number(await paper.getAttribute('data-progress'));
  expect(after).toBeGreaterThan(before + .1);
  expect(after).toBeLessThan(.8);
  await expect(lane.locator('[data-metric="time"]')).toHaveText('3.85s');
  await expect(lane.locator('[data-node="produce"]')).toHaveAttribute('data-state', 'available');
  const position = await paper.getAttribute('transform');
  await page.waitForTimeout(200);
  await expect(paper).toHaveAttribute('transform', position!);
  // Changing speed while paused keeps the document in place.
  await page.getByRole('slider', { name: 'Example playback speed' }).fill('2');
  await expect(paper).toHaveAttribute('transform', position!);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(paper).toBeVisible();
  expect(await paper.evaluate(element => element.getAnimations().length)).toBe(0);
  await expect(lane.locator('.flow-trail[data-flow-state="flowing"]')).toHaveCount(0);
});

test('attorney release has a visible transfer and cannot mark a page produced before arrival', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Document to follow in both graphs' }).selectOption('3');
  const timeline = page.getByRole('slider', { name: 'Example timeline', exact: true });
  await timeline.fill((await timeline.getAttribute('max'))!);
  await page.getByRole('button', { name: 'Review page', exact: true }).click();
  await page.getByRole('button', { name: 'Release page', exact: true }).click();
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await expect(page.locator('[data-transfer="attorney-produce"]')).toHaveCount(2);
  await expect(page.locator('.comparison-result')).toHaveCount(0);
  for (const strategy of ['system1', 'frontier']) await expect(page.locator(`.strategy-${strategy} [data-node="produce"]`)).toHaveAttribute('data-state', 'available');
  await timeline.fill((await timeline.getAttribute('max'))!);
  await expect(page.locator('.comparison-result')).toContainText('Same prepared outcome');
});

test('decision comparison remains readable on mobile and updates for equal and reversed assumptions', async ({ page }) => {
  for (const [seconds, expected] of [['3.8', 'Equal assumed decision time'], ['7.6', 'System 1 takes 2.0× as long']]) {
    await page.locator('.comparison-caption').getByRole('button', { name: 'Assumptions' }).click();
    await page.getByRole('spinbutton', { name: 'System 1 classification, seconds / request' }).fill(seconds);
    await page.getByRole('button', { name: 'Apply & reset' }).click();
    await expect(page.locator('.decision-timing-ratio')).toHaveText(expected);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.comparison-decision-timing')).toBeVisible();
  await page.getByRole('button', { name: 'Focus graph', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run simulation', exact: true })).toBeInViewport();
  await expect(page.getByRole('slider', { name: 'Example playback speed' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
