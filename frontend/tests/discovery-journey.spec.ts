import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LessonCatalogue, LiveDiscoveryResponse } from '../src/lib/api.generated';
import type { LiveLessonState } from '../src/lib/useLiveLesson';
import raw from '../src/data/lessons.json' with { type: 'json' };
import { DiscoveryJourney } from '../src/components/DiscoveryJourney';
import { mockLiveDiscovery } from './helpers/liveDiscoveryFixture';

const catalogue = raw as unknown as LessonCatalogue;
const prepared = catalogue.discovery.compare;
const claimText = String((prepared.run.result?.claims as { text: string }[])[0].text);
const text = (html: string) => html.replace(/<[^>]+>/g, '').trim();
function button(html: string, name: string) {
  const result = html.match(/<button\b[^>]*>.*?<\/button>/g)?.find(item => text(item) === name);
  expect(result, `button: ${name}`).toBeDefined();
  return result!;
}
function render(state: LiveLessonState<LiveDiscoveryResponse>, onPrepared = () => {}) {
  const response = state.status === 'complete' ? state.response : undefined;
  return renderToStaticMarkup(createElement(DiscoveryJourney, {
    snapshot: response?.snapshot || prepared, documents: response?.documents || catalogue.discovery.documents,
    liveState: state, autoPlay: true, onPrepared,
  }));
}

test('a returned run exposes labeled whole-run totals while its initial replay has no later claims or component timing', () => {
  const html = render({ status: 'complete', response: mockLiveDiscovery() });
  expect(html).toContain('aria-label="Whole returned run"');
  expect(html).toContain('Independent of replay position');
  expect(html).toContain('<dt>Overall elapsed</dt><dd>9.50 s</dd>');
  expect(html).toContain('<dt>Frontier attempts</dt><dd>2</dd>');
  expect(html).toContain('<dt>Answer accuracy</dt><dd>Not evaluated</dd>');
  expect(html).toContain('At this step: 0 frontier requests');
  expect(html).toContain('aria-label="Discovery capability flow"');
  expect(html).toContain('aria-label="Pause lesson"');
  expect(html).toMatch(/<input[^>]*aria-label="Lesson progress"[^>]*value="0"/);
  expect(button(html, 'View results')).toContain('disabled=""');
  expect(button(html, 'Timing &amp; checks')).not.toContain('disabled=""');
  expect(html).not.toContain(claimText);
  expect(html).not.toContain('performance-report');
  expect(html).not.toContain('<table');
  expect(html).not.toContain('performance-bar');
  expect(html).not.toContain('4.60 s');
  // The whole-recording average is labeled separately from the initial prefix.
  expect(html).toContain('125 ms avg / request');
  expect(html).not.toContain('state-succeeded');
  expect(html).not.toContain('is-traversed');
});

test('whole-run summaries preserve zero frontier attempts and missing measurements without turning checks into accuracy', () => {
  const find = mockLiveDiscovery('find');
  const html = render({ status: 'complete', response: find });
  expect(html).toContain('<dt>Frontier attempts</dt><dd>0</dd>');
  expect(html).toContain('<dt>Overall elapsed</dt><dd>650 ms</dd>');
  expect(html).toContain('<dt>Retrieval accuracy</dt><dd>Not evaluated</dd>');
  expect(button(html, 'View results')).toContain('disabled=""');
  const unmeasured = mockLiveDiscovery();
  unmeasured.metrics = null;
  unmeasured.snapshot.events = unmeasured.snapshot.events.filter(event => event.type !== 'run_started');
  const unknown = render({ status: 'complete', response: unmeasured });
  expect(unknown).toContain('<dt>Overall elapsed</dt><dd>Not recorded</dd>');
  expect(unknown).not.toContain('<dt>Overall elapsed</dt><dd>0');
});

test('pending execution clears the prepared graph and result evidence rather than guessing the current capability', () => {
  const html = render({ status: 'pending', startedAt: 0 });
  expect(html).toContain('Browser wait');
  expect(html).toContain('Judge intent');
  expect(html).toContain('Runtime selects next work');
  expect(html).toContain('waiting time, not an animated live trace');
  expect(html).toContain('Waiting for recorded steps');
  expect(html).not.toContain('aria-label="Discovery capability flow"');
  expect(html).not.toContain('flow-node');
  expect(html).not.toContain('is-traversed');
  expect(html).not.toContain('Compose answer');
  expect(html).not.toContain('At this step:');
  expect(html).not.toContain(claimText);
  expect(html).not.toContain('Overall elapsed');
  expect(html).not.toContain('Frontier attempts');
  expect(html).not.toContain('Whole returned run');
  expect(html).not.toContain('performance-report');
  expect(html).toMatch(/<input[^>]*aria-label="Lesson progress"[^>]*disabled=""/);
  expect(button(html, 'View results')).toContain('disabled=""');
  expect(button(html, 'View sources')).not.toContain('disabled=""');
});

test('transport failure retains the actionable error without substituting the prepared successful run', () => {
  let actions = 0;
  const html = render({ status: 'failed', message: 'Live Jev connection failed.' }, () => actions++);
  expect(actions).toBe(0);
  expect(html).toContain('role="alert"');
  expect(html).toContain('Live System 1 Model connection failed.');
  expect(html).toContain('No response substituted');
  expect(button(html, 'Return to prepared example')).not.toContain('disabled=""');
  expect(button(html, 'View results')).toContain('disabled=""');
  expect(html).not.toContain('aria-label="Discovery capability flow"');
  expect(html).not.toContain('flow-node');
  expect(html).not.toContain('Whole returned run');
  expect(html).not.toContain('Overall elapsed');
  expect(html).not.toContain('performance-report');
  expect(html).not.toContain(claimText);
});

test('an idle prepared lesson labels its provenance and exposes no fabricated measurement or future output', () => {
  let actions = 0;
  const html = render({ status: 'idle' }, () => actions++);
  expect(actions).toBe(0);
  expect(html).toContain('Prepared example · simulated models');
  expect(html).toContain('Run to measure real models');
  expect(html).toContain('Illustrated replay');
  expect(html).toContain('At this step: 0 frontier requests');
  expect(html).toContain('aria-label="Discovery capability flow"');
  expect(button(html, 'How it works')).not.toContain('disabled=""');
  expect(button(html, 'View results')).toContain('disabled=""');
  expect(html).not.toContain('Overall elapsed');
  expect(html).not.toContain('Whole returned run');
  expect(html).not.toContain('performance-report');
  expect(html).not.toContain('<table');
  expect(html).not.toContain('state-succeeded');
  expect(html).not.toContain(claimText);
});

test('playback controls precede the visualization with a separately labeled whole-example service breakdown', () => {
  const html = render({ status: 'idle' });
  expect(html.indexOf('aria-label="Workflow playback controls"')).toBeLessThan(html.indexOf('aria-label="Discovery capability flow"'));
  expect(html.indexOf('aria-label="Whole run service latency breakdown"')).toBeLessThan(html.indexOf('aria-label="Discovery capability flow"'));
  expect(html.match(/aria-label="Lesson progress"/g)).toHaveLength(1);
  expect(html).toContain('Assumed · whole example');
  expect(html).toContain('Total service work</dt><dd>7.63 s</dd>');
  expect(html.indexOf('discovery-latency-total')).toBeLessThan(html.indexOf('discovery-latency-bar'));
  expect(html.indexOf('discovery-latency-bar')).toBeLessThan(html.indexOf('Contributions to total service work'));
  expect(html).toContain('<dd>4.0 ms</dd>');
  expect(html).toContain('<dd>625 ms</dd>');
  expect(html).toContain('<dd>7.00 s</dd>');
  expect(html).toContain('2 simulated steps');
  expect(html).toContain('not elapsed time or accuracy');
  const pending = render({ status: 'pending', startedAt: 0 });
  expect(pending).toContain('Awaiting recorded run');
  expect(pending).not.toContain('7.00 s');
  expect(pending).not.toContain('7.63 s');
  expect(pending).not.toContain('Assumed · whole example');
});
