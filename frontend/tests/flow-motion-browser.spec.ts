import { expect, test, type Locator, type Page } from '@playwright/test';
import type { LessonCatalogue, RunSnapshot } from '../src/lib/api.generated';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { classificationReplaySteps } from '../src/lib/replay';
import { discoveryJourneySteps } from '../src/lib/discoveryJourney';
import { examplePages, exampleRoute } from '../src/lib/reviewExample';
import { buildReviewTrace, defaultScenario } from '../src/lib/workflowComparison';
import { mockLiveClassification } from './helpers/liveClassificationFixture';

const catalogue = raw as unknown as LessonCatalogue;
type MotionWindow = Window & { __rememberedFlow?: { element: Element; animation: Animation; phase: number } };

/** Every request is intercepted: these are replay/illustration checks, never model calls. */
async function preparedOnly(page: Page) {
  const writes: string[] = [];
  const documents = [...catalogue.classification.documents, ...catalogue.discovery.documents];
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      writes.push(`${request.method()} ${path}`);
      await route.fulfill({ status: 405, json: { detail: 'This motion test permits prepared reads only.' } });
      return;
    }
    const source = documents.find(item => path === `/api/documents/${item.document.id}`);
    const body = path === '/api/health' ? { mode: 'test-fixture', fts5: true, integrations: {} }
      : path === '/api/lessons' ? catalogue
        : path === '/api/documents' ? { documents: documents.map(item => item.document), excluded_unknown_dates: 0 }
          : path === '/api/runs' ? { runs: [catalogue.classification.snapshot.run] }
            : source ? { document: source.document, passages: source.passages }
              : path === `/api/runs/${catalogue.classification.snapshot.run.id}` ? catalogue.classification.snapshot : {};
    await route.fulfill({ json: body });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  return writes;
}

async function riverState(river: Locator) {
  return river.evaluate(element => {
    const animations = element.getAnimations().filter(animation =>
      (animation.effect as KeyframeEffect | null)?.getKeyframes().some(frame => 'strokeDashoffset' in frame));
    const animation = animations[0];
    const path = element.querySelector('.route-forward-flow')!;
    const style = getComputedStyle(path);
    return {
      animations: animations.length, phase: Number(animation?.currentTime ?? 0), playState: animation?.playState,
      rate: animation?.playbackRate, offset: style.strokeDashoffset, dasharray: style.strokeDasharray,
      stroke: style.stroke, opacity: Number(style.opacity), cssAnimation: style.animationName,
      same: (window as MotionWindow).__rememberedFlow?.element === element && (window as MotionWindow).__rememberedFlow?.animation === animation,
    };
  });
}

async function rememberRiver(river: Locator) {
  return river.evaluate(element => {
    const animation = element.getAnimations().find(animation =>
      (animation.effect as KeyframeEffect | null)?.getKeyframes().some(frame => 'strokeDashoffset' in frame))!;
    const phase = Number(animation.currentTime);
    (window as MotionWindow).__rememberedFlow = { element, animation, phase };
    return phase;
  });
}

async function expectPaintedFlow(river: Locator) {
  // SVG vertical/horizontal strokes have a zero-area fill box, but are painted.
  await expect(river).toHaveCount(1);
  const strokeBounds = await river.locator('.route-forward-flow').evaluate(path => {
    const box = path.getBoundingClientRect(), style = getComputedStyle(path);
    return { length: Math.hypot(box.width, box.height), stroke: parseFloat(style.strokeWidth), visibility: style.visibility };
  });
  expect(strokeBounds.length).toBeGreaterThan(0);
  expect(strokeBounds.stroke).toBeGreaterThan(0);
  expect(strokeBounds.visibility).toBe('visible');
}

async function expectVisibleForwardFlow(river: Locator) {
  await expectPaintedFlow(river);
  await expect(river).toHaveAttribute('data-flow-state', 'flowing');
  await expect.poll(async () => (await riverState(river)).playState).toBe('running');
  const initial = await riverState(river);
  expect(initial.animations).toBe(1);
  expect(initial.opacity).toBeGreaterThan(0);
  expect(initial.stroke).not.toBe('none');
  expect(initial.dasharray).not.toBe('none');
  expect(initial.dasharray.split(/[ ,]+/).some(value => parseFloat(value) > 0)).toBe(true);
  // A second CSS animation would fight the shared WAAPI clock.
  expect(initial.cssAnimation).toBe('none');
  const direction = await river.evaluate(element => {
    const motion = element.getAnimations().find(animation =>
      (animation.effect as KeyframeEffect | null)?.getKeyframes().some(frame => 'strokeDashoffset' in frame))!;
    const frames = (motion.effect as KeyframeEffect).getKeyframes();
    return [parseFloat(String(frames[0].strokeDashoffset)), parseFloat(String(frames.at(-1)!.strokeDashoffset))];
  });
  expect(direction[1]).toBeLessThan(direction[0]);
  await expect.poll(async () => (await riverState(river)).phase, { intervals: [25, 50] }).toBeGreaterThan(initial.phase);
  await expect.poll(async () => (await riverState(river)).offset, { intervals: [25, 50] }).not.toBe(initial.offset);
}

function discoveryPosition(snapshot: RunSnapshot, predicate: (event: RunSnapshot['events'][number]) => boolean) {
  const cursor = snapshot.events.findIndex(predicate) + 1;
  expect(cursor).toBeGreaterThan(0);
  const position = discoveryJourneySteps(snapshot).findIndex(beat => beat.cursor >= cursor) + 1;
  expect(position).toBeGreaterThan(0);
  return position;
}

async function seekDiscovery(page: Page, position: number) {
  const timeline = page.getByRole('slider', { name: 'Lesson progress', exact: true });
  await timeline.fill(String(position));
  await expect(timeline).toHaveValue(String(position));
  await expect(page.getByRole('button', { name: 'Play lesson', exact: true })).toBeVisible();
}

test('Discovery crosses each segment once and leaves a complete static route through service rails', async ({ page }) => {
  const writes = await preparedOnly(page);
  const snapshot = catalogue.discovery.find;
  await page.goto('/#explore/discover?example=find');
  const canvas = page.locator('.discovery-decision-tree');
  await expect(canvas.locator('.discovery-tree-card')).toHaveCount(6);
  const handoff = discoveryPosition(snapshot, event => event.type === 'edge_selected' && event.payload.source_instance_id === 'intent' && event.payload.target_instance_id === 'plan');
  await seekDiscovery(page, handoff);
  const progress = canvas.locator('.tree-transfer-progress'), marker = canvas.locator('.discovery-flow-token');
  await expect(canvas.locator('.flow-trail')).toHaveCount(0);
  await expect(progress).toHaveCount(1);
  await expect(marker).toHaveCount(1);
  expect(await progress.evaluate(element => element.getAnimations()[0].effect!.getTiming().iterations)).toBe(1);
  expect(await marker.evaluate(element => element.getAnimations()[0].effect!.getTiming().iterations)).toBe(1);
  await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('0.5');
  await page.getByRole('button', { name: 'Play lesson', exact: true }).click();
  await expect.poll(() => progress.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeGreaterThan(30);
  const start = (await marker.boundingBox())!;
  await page.waitForTimeout(100);
  const end = (await marker.boundingBox())!;
  expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Pause lesson', exact: true }).click();
  const phase = await progress.evaluate(element => Number(element.getAnimations()[0].currentTime));
  const markerPhase = await marker.evaluate(element => Number(element.getAnimations()[0].currentTime));
  await page.waitForTimeout(160);
  expect(await progress.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeCloseTo(phase, 0);
  expect(await marker.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeCloseTo(markerPhase, 0);
  await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('2');
  expect(await progress.evaluate(element => element.getAnimations()[0].playbackRate)).toBe(2);
  expect(await progress.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeCloseTo(phase, 0);
  expect(await marker.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeCloseTo(markerPhase, 0);
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(progress).toHaveCount(0);
  await expect(canvas.locator('[data-tree-edge="judgment--code-plan"]')).toHaveClass(/is-traversed/);
  await expect(canvas.locator('.tree-stage-track.is-traversed')).toHaveCount(1);
  await expect(canvas.locator('.tree-stage-progress')).toHaveCount(1);
  await seekDiscovery(page, discoveryJourneySteps(snapshot).length);
  await expect(canvas.locator('.tree-link.is-traversed')).toHaveCount(3);
  await expect(canvas.locator('.tree-stage-track.is-traversed')).toHaveCount(4);
  await expect(canvas.locator('.tree-stage-progress, .tree-transfer-progress, .flow-trail')).toHaveCount(0);
  expect(await canvas.locator('.tree-link.is-traversed > path').first().evaluate(element => getComputedStyle(element).stroke)).toBe(await canvas.locator('.tree-stage-track.is-traversed').first().evaluate(element => getComputedStyle(element).stroke));
  expect(await canvas.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(marker).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'View results', exact: true })).toBeEnabled();
  expect(writes).toEqual([]);
});

test('All steps uses the same river on traversed edges without animating possible routes', async ({ page }) => {
  const writes = await preparedOnly(page);
  await page.goto('/#explore/discover?example=compare');
  await page.getByRole('button', { name: 'All steps', exact: true }).click();
  const canvas = page.locator('.discovery-journey-canvas');
  await expect(canvas.locator('.flow-trail')).toHaveCount(0);
  await seekDiscovery(page, discoveryPosition(catalogue.discovery.compare, event => event.type === 'edge_selected' && event.payload.source_instance_id === 'intent' && event.payload.target_instance_id === 'plan'));
  const river = canvas.locator('.flow-route:has(path[id="intent--plan"]) .flow-trail');
  await expect(river).toHaveCount(1);
  await expect(canvas.locator('.flow-route:not(.is-traversed):not(.is-current) .flow-trail')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('0.5');
  await page.getByRole('button', { name: 'Play lesson', exact: true }).click();
  await expectVisibleForwardFlow(river);
  await page.getByRole('button', { name: 'Pause lesson', exact: true }).click();
  await expect.poll(async () => (await riverState(river)).playState).toBe('paused');
  expect(writes).toEqual([]);
});

test('reduced motion keeps a static service position and manual stepping without recurring sweeps', async ({ page }) => {
  const writes = await preparedOnly(page);
  await page.goto('/#explore/discover?example=compare');
  await seekDiscovery(page, discoveryPosition(catalogue.discovery.compare, event => event.type === 'node_started' && event.instance_id === 'plan'));
  const marker = page.locator('.discovery-flow-token'), progress = page.locator('.tree-stage-progress');
  await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('0.5');
  await page.getByRole('button', { name: 'Play lesson', exact: true }).click();
  await expect.poll(() => marker.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeGreaterThan(30);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(marker).toHaveAttribute('data-flow-state', 'reduced');
  await expect(progress).toHaveAttribute('data-flow-state', 'reduced');
  expect(await marker.evaluate(element => element.getAnimations().length)).toBe(0);
  expect(await progress.evaluate(element => element.getAnimations().length)).toBe(0);
  await expect(marker.locator('.packet-paper')).toBeVisible();
  await expect(page.locator('.discovery-decision-tree .flow-trail')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause lesson', exact: true }).click();
  const position = (await marker.boundingBox())!;
  await page.waitForTimeout(120);
  const stopped = (await marker.boundingBox())!;
  expect(stopped.x).toBeCloseTo(position.x, 0);
  expect(stopped.y).toBeCloseTo(position.y, 0);
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(page.locator('[data-tree-id="frontier-plan"]')).toContainText('Complete');
  await expect(page.locator('.tree-stage-track.is-traversed')).toHaveCount(2);
  await expect(page.locator('.tree-stage-progress')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeEnabled();
  expect(writes).toEqual([]);
});

for (const example of ['clear', 'ambiguous', 'proposed'] as const) test(`${example}: the document follows relative latency, pauses, and stops at the actual output`, async ({ page }, testInfo) => {
  const unexpectedWrites = await preparedOnly(page);
  let requests = 0;
  const response = mockLiveClassification(example);
  await page.route('**/api/lessons/classify/live', async route => {
    requests++;
    await route.fulfill({ json: response });
  });
  await page.goto(`/#explore/classify?example=${example}`);
  await page.getByRole('group', { name: 'Classification mode', exact: true }).getByRole('button', { name: 'Live models', exact: true }).click();
  await page.locator('.lesson-subject').getByRole('button', { name: 'Run document', exact: true }).click();
  const live = page.getByRole('region', { name: 'Live classification workflow', exact: true });
  const controls = live.getByRole('group', { name: 'Recorded route animation' });
  const progress = controls.getByRole('slider', { name: 'Document route progress' });
  await controls.getByRole('button', { name: 'Pause route animation', exact: true }).click();
  await expect(progress).toHaveValue('0');
  await expect(live.locator('[data-id="judge"] .node-document')).toContainText('here');
  await expect(live.locator('.classification-journey-caption')).toContainText('Judge · System 1');
  await expect(controls).toContainText('Document speed follows relative service latency');
  const summary = await live.locator('.live-classification-summary').textContent();
  const receipt = await live.locator('.lesson-receipt').textContent();

  // Step controls and keyboard seeking keep exactly one document on the canvas.
  await controls.getByRole('button', { name: 'Next route step' }).click();
  await expect(live.locator('.tracked-packet')).toHaveCount(1);
  await expect(live.locator('.node-document')).toHaveCount(0);
  const judgeDuration = await live.locator('.tracked-packet').evaluate(element => Number(element.getAnimations()[0].effect!.getTiming().duration));
  await controls.getByRole('button', { name: 'Next route step' }).click();
  await expect(live.locator('[data-id="policy"] .node-document')).toBeVisible();
  await expect(live.locator('.tracked-packet')).toHaveCount(0);
  await progress.focus();
  await progress.press('ArrowRight');
  await expect(progress).toHaveValue('3');
  const branch = example === 'clear' ? 'accept' : 'interpret';
  const river = live.locator(`.flow-route:has(path[id="policy--${branch}"]) .flow-trail`);
  const packet = live.locator('.tracked-packet');
  await expect(packet).toHaveCount(1);
  const branchDuration = await packet.evaluate(element => Number(element.getAnimations()[0].effect!.getTiming().duration));
  if (example === 'clear') expect(branchDuration).toBe(judgeDuration);
  else expect(branchDuration).toBeGreaterThan(judgeDuration * 8);
  await controls.getByRole('combobox', { name: 'Route animation speed' }).selectOption('0.5');
  await controls.getByRole('button', { name: 'Continue route animation' }).click();
  await expectVisibleForwardFlow(river);
  await expect.poll(() => packet.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeGreaterThan(80);
  const before = (await packet.boundingBox())!;
  await page.waitForTimeout(120);
  const after = (await packet.boundingBox())!;
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(0.1);
  await page.screenshot({ path: testInfo.outputPath('document-in-transit.png'), fullPage: true });
  await controls.getByRole('button', { name: 'Pause route animation' }).click();
  await expect.poll(async () => (await riverState(river)).playState).toBe('paused');
  const phase = await rememberRiver(river);
  const packetPhase = await packet.evaluate(element => Number(element.getAnimations()[0].currentTime));
  await page.waitForTimeout(160);
  expect((await riverState(river)).phase).toBeCloseTo(phase, 0);
  expect(await packet.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeCloseTo(packetPhase, 0);
  // Speed updates must retain the packet and its progress, as well as the river.
  await controls.getByRole('combobox', { name: 'Route animation speed' }).selectOption('2');
  expect((await riverState(river)).same).toBe(true);
  expect(await packet.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeCloseTo(packetPhase, 0);
  expect(await packet.evaluate(element => element.getAnimations()[0].playbackRate)).toBe(2);

  await controls.getByRole('button', { name: 'Continue route animation' }).click();
  await page.locator('.lesson-subject').getByRole('button', { name: 'View document', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await expect(river).toHaveAttribute('data-flow-state', 'paused');
  const reading = await packet.evaluate(element => Number(element.getAnimations()[0].currentTime));
  await drawer.getByRole('button', { name: 'Close details', exact: true }).click();
  await page.waitForTimeout(120);
  expect(await packet.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeCloseTo(reading, 0);

  await controls.getByRole('button', { name: 'Continue route animation' }).click();
  await expect(progress).toHaveValue('4');
  await expect(live.locator('.tracked-packet')).toHaveCount(0);
  await expect(live.locator(`[data-id="${branch}"] .node-document`)).toBeVisible();
  await expect(live.locator('.classification-journey-caption')).toContainText('preview ends here');
  await expect(controls.getByRole('button', { name: 'Replay document route' })).toBeEnabled();
  await expect(live.locator('.flow-trail[data-flow-state="flowing"]')).toHaveCount(0);
  await expect(live.locator('[data-id="review"], [data-id="publish"]').filter({ hasText: 'Outside preview' })).toHaveCount(example === 'clear' ? 1 : 2);
  await expect(live.locator('.live-classification-summary')).toHaveText(summary!);
  await expect(live.locator('.lesson-receipt')).toHaveText(receipt!);
  // Replay starts at Judge; it never sends another provider request.
  await controls.getByRole('button', { name: 'Replay document route' }).click();
  await expect(progress).toHaveValue('0');
  await expect(live.locator('[data-id="judge"] .node-document')).toBeVisible();
  await progress.fill('3');
  await controls.getByRole('button', { name: 'Continue route animation' }).click();
  const evidence = live.locator('details.live-classification-evidence');
  await evidence.locator('summary').first().click();
  await expect(river).toHaveAttribute('data-flow-state', 'paused');
  await expect(controls.getByRole('button', { name: 'Continue route animation' })).toBeDisabled();
  await evidence.locator('summary').first().click();
  await expect(controls.getByRole('button', { name: 'Continue route animation' })).toBeEnabled();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(controls.getByRole('button', { name: 'Continue route animation' })).toBeDisabled();
  await expect.poll(() => packet.evaluate(element => element.getAnimations().length)).toBe(0);
  await controls.getByRole('button', { name: 'Next route step' }).click();
  await expect(live.locator(`[data-id="${branch}"] .node-document`)).toBeVisible();
  await progress.fill('0');
  await expect(live.locator('[data-id="judge"] .node-document')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(controls.getByRole('button', { name: 'Continue route animation' })).toHaveAttribute('aria-pressed', 'false');
  expect(requests).toBe(1);
  expect(unexpectedWrites).toEqual([]);
});

for (const example of ['clear', 'proposed'] as const) test(`recorded classification ${example} animates only the route actually selected by policy`, async ({ page }) => {
  const writes = await preparedOnly(page);
  const snapshot = catalogue.classification.snapshot;
  const documentId = catalogue.classification.documents.find(item => item.example_id === example)!.document.id;
  await page.goto(`/#runs/${snapshot.run.id}`);
  await page.getByRole('combobox', { name: 'Follow input', exact: true }).selectOption(`worker:${documentId}`);
  const steps = classificationReplaySteps(snapshot.events, documentId);
  const handoff = steps.findIndex(step => step.kind === 'transfer' && step.source === `${documentId}:jev`);
  expect(handoff).toBeGreaterThanOrEqual(0);
  const slider = page.getByRole('slider', { name: 'Replay step', exact: true });
  await slider.fill('0');
  const branch = example === 'clear' ? 'accept' : 'interpret', alternative = example === 'clear' ? 'interpret' : 'accept';
  const chosen = page.locator(`.flow-route:has(path[id="policy--${branch}"]) .flow-trail`);
  await expect(chosen).toHaveCount(0);
  await slider.fill(String(handoff + 1));
  await expect(chosen).toHaveCount(1);
  await expect(page.locator(`.flow-route:has(path[id="policy--${alternative}"]) .flow-trail`)).toHaveCount(0);
  await page.getByRole('slider', { name: 'Playback speed', exact: true }).fill('0.5');
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expectVisibleForwardFlow(chosen);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await expect.poll(async () => (await riverState(chosen)).playState).toBe('paused');
  expect(writes).toEqual([]);
});

test('a completed Review lane freezes its river while the slower lane continues on the shared clock', async ({ page }) => {
  const writes = await preparedOnly(page);
  const pageIndex = examplePages.findIndex(item => exampleRoute(item) === 'produce');
  expect(pageIndex).toBeGreaterThanOrEqual(0);
  const source = examplePages[pageIndex];
  const system = buildReviewTrace(source, 'system1', defaultScenario), frontier = buildReviewTrace(source, 'frontier', defaultScenario);
  expect(system.end).toBeLessThan(frontier.end);
  await page.goto('/#workflow');
  await page.getByRole('button', { name: 'Prepared comparison', exact: true }).click();
  await page.getByRole('combobox', { name: 'Document to follow in both graphs', exact: true }).selectOption(String(pageIndex));
  await page.getByRole('button', { name: 'Expand playback controls', exact: true }).click();
  const timeline = page.getByRole('slider', { name: 'Example timeline', exact: true });
  await timeline.fill(((system.end + frontier.end) / 2).toFixed(2));
  await page.getByRole('slider', { name: 'Example playback speed', exact: true }).fill('0.5');
  const complete = page.locator('.review-lane.strategy-system1'), working = page.locator('.review-lane.strategy-frontier');
  const stoppedRiver = complete.locator('.flow-trail').first(), runningRiver = working.locator('.flow-trail').first();
  await expectPaintedFlow(stoppedRiver);
  await expectPaintedFlow(runningRiver);
  const completeMetric = await complete.locator('[data-metric="time"]').textContent();
  await page.getByRole('button', { name: 'Run simulation', exact: true }).click();
  await expect(stoppedRiver).toHaveAttribute('data-flow-state', 'paused');
  await expectVisibleForwardFlow(runningRiver);
  const stopped = await riverState(stoppedRiver), running = await riverState(runningRiver);
  await page.waitForTimeout(160);
  expect((await riverState(stoppedRiver)).phase).toBeCloseTo(stopped.phase, 0);
  expect((await riverState(stoppedRiver)).offset).toBe(stopped.offset);
  expect((await riverState(runningRiver)).phase).toBeGreaterThan(running.phase);
  await expect(complete.locator('[data-metric="time"]')).toHaveText(completeMetric!);
  await expect(complete.locator('.diagram-route:not(:has(.is-active)):not(:has(.is-visited)) .flow-trail')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  expect(writes).toEqual([]);
});

test('Discovery keeps one visible marker, retains its phase through pause and speed changes, and labels slower frontier work', async ({ page }) => {
  const writes = await preparedOnly(page);
  const snapshot = catalogue.discovery.compare;
  await page.goto('/#explore/discover?example=compare');
  await seekDiscovery(page, discoveryPosition(snapshot, event => event.type === 'node_started' && event.instance_id === 'plan' && event.payload.state === 'running'));
  const marker = page.locator('.discovery-flow-token');
  await expect(marker).toHaveCount(1);
  await expect(marker.locator('.packet-paper')).toBeVisible();
  await expect(page.locator('.discovery-flow-caption')).toContainText('Plan search · Frontier');
  await expect(page.locator('.discovery-flow-caption')).toContainText('Assumed service work 2.40 s');
  const progress = page.locator('.tree-stage-progress');
  expect(await progress.evaluate(element => Number(element.getAnimations()[0].effect!.getTiming().duration))).toBe(2400);
  expect(await marker.evaluate(element => element.getAnimations().length)).toBe(1);
  await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('0.5');
  await page.getByRole('button', { name: 'Play lesson', exact: true }).click();
  await expect.poll(() => progress.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeGreaterThan(80);
  const before = (await marker.boundingBox())!;
  await page.waitForTimeout(120);
  const after = (await marker.boundingBox())!;
  expect(after.x - before.x).toBeGreaterThan(1); // The item crosses the service rail once during its work.
  await page.getByRole('button', { name: 'Pause lesson', exact: true }).click();
  const phase = await progress.evaluate(element => Number(element.getAnimations()[0].currentTime));
  await page.waitForTimeout(120);
  expect(await progress.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeCloseTo(phase, 0);
  await page.getByRole('combobox', { name: 'Playback speed', exact: true }).selectOption('2');
  await expect.poll(() => progress.evaluate(element => element.getAnimations()[0].playbackRate)).toBe(2);
  expect(await progress.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeCloseTo(phase, 0);
  // Inspection freezes the same marker and returns keyboard focus to the stage.
  const stage = page.locator('[data-tree-id="frontier-plan"]');
  await stage.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(stage).toBeFocused();
  expect(await progress.evaluate(element => Number(element.getAnimations()[0].currentTime))).toBeCloseTo(phase, 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(marker).toHaveAttribute('data-flow-state', 'reduced');
  await expect.poll(() => marker.evaluate(element => element.getAnimations().length)).toBe(0);
  await expect(marker.locator('.packet-paper')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#explore/discover?example=find');
  await seekDiscovery(page, discoveryPosition(catalogue.discovery.find, event => event.type === 'node_started' && event.instance_id === 'plan'));
  await expect(marker).toHaveCount(1);
  await expect(page.locator('.discovery-flow-caption')).toContainText('Plan search · Code');
  await expect(page.locator('.discovery-flow-caption')).toContainText('Assumed service work 1 ms');
  expect(await progress.evaluate(element => Number(element.getAnimations()[0].effect!.getTiming().duration))).toBe(160);
  await page.goto('/#explore/discover?example=compare');
  await seekDiscovery(page, discoveryJourneySteps(snapshot).length);
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveAttribute('data-flow-state', 'paused');
  await expect(page.locator('.discovery-flow-caption')).toContainText('Result 01');
  await expect(page.getByRole('button', { name: 'View results', exact: true })).toBeEnabled();
  expect(writes).toEqual([]);
});

for (const width of [1440, 1024, 390, 320]) test(`Discovery at ${width}px bounds stage sizes and gives every animated connector room around its marker`, async ({ page }) => {
  const writes = await preparedOnly(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/#explore/discover?example=compare');
  const graph = page.locator('.discovery-decision-tree');
  await expect(graph.locator('.discovery-tree-card')).toHaveCount(6);
  await expect(graph.locator('.tree-link > path').first()).toHaveAttribute('d', /^M /);
  const geometry = await graph.evaluate(element => {
    const root = element.getBoundingClientRect();
    const vertical = window.matchMedia('(max-width: 760px)').matches;
    const cards = [...element.querySelectorAll('.discovery-tree-card')].map(card => {
      const body = card.querySelector('.tree-card-body')!, box = body.getBoundingClientRect(), padding = getComputedStyle(body);
      return { id: card.getAttribute('data-tree-id'), bounds: card.getBoundingClientRect(), textLeft: box.left + parseFloat(padding.paddingLeft), textBottom: box.bottom - parseFloat(padding.paddingBottom) };
    });
    const collisions: string[] = [];
    for (const path of element.querySelectorAll<SVGPathElement>('.tree-link > path')) {
      const length = path.getTotalLength();
      for (let i = 0; i <= 100; i++) {
        const point = path.getPointAtLength(length * i / 100), x = point.x + root.left, y = point.y + root.top;
        for (const card of cards) {
          const endpoints = path.parentElement?.getAttribute('data-tree-edge')?.split('--') || [];
          const endpoint = endpoints.includes(card.id || '');
          const left = endpoint && vertical ? card.textLeft : card.bounds.left;
          const bottom = endpoint ? card.textBottom : card.bounds.bottom;
          if (x + 17 > left && x - 17 < card.bounds.right && y + 21 > card.bounds.top && y - 21 < bottom) collisions.push(`${path.parentElement?.getAttribute('data-tree-edge')} ${card.id} ${i}`);
        }
      }
    }
    return { collisions, width: root.width, ratio: cards.reduce((sum, card) => sum + card.bounds.width * card.bounds.height, 0) / (root.width * root.height), cards: cards.map(card => ({ id: card.id, width: card.bounds.width })) };
  });
  expect(geometry.collisions).toEqual([]);
  expect(geometry.ratio).toBeLessThan(.4);
  for (const card of geometry.cards) expect(card.width).toBeLessThanOrEqual(width <= 760 ? 192 : 176);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(writes).toEqual([]);
});
