import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { api } from '../src/lib/api';
import { frontierModels, frontierModelLabel, isFrontierModel } from '../src/lib/frontierModels';
import { FrontierModelSelect } from '../src/components/FrontierModelSelect';

test('frontier selection exposes exactly the requested models and never relabels unknown recorded identities', () => {
  let changes = 0;
  const html = renderToStaticMarkup(createElement(FrontierModelSelect, { value: 'gpt-4.1', onChange: () => changes++, disabled: true }));
  expect(changes).toBe(0);
  expect(html).toContain('Frontier model');
  expect(html.match(/<option /g)).toHaveLength(3);
  expect(html).toContain('value="gpt-4.1" selected=""');
  expect(html).toContain('disabled=""');
  for (const model of frontierModels) {
    expect(isFrontierModel(model.value)).toBe(true);
    expect(frontierModelLabel(model.value)).toBe(model.label);
  }
  expect(isFrontierModel('gpt-5.6')).toBe(false);
  expect(isFrontierModel('unexpected-model')).toBe(false);
  expect(frontierModelLabel('gpt-4.1-2025-04-14')).toBe('gpt-4.1-2025-04-14');
  expect(frontierModelLabel(null)).toBe('Frontier model');
});

test('each live lesson request passes its explicit selection unchanged, and omitted selection retains the default', async () => {
  const originalFetch = globalThis.fetch;
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ path: String(url).split('/api/')[1], body: JSON.parse(String(init?.body)) });
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    for (const model of frontierModels) {
      await api.classifyLesson('clear', 'content-hash', model.value);
      await api.compareClassification('ambiguous', 'content-hash', model.value);
      await api.interpretLesson('proposed', 'content-hash', model.value);
      await api.discoverLesson('compare', 'live', model.value);
      await api.reviewLesson('fictional-page', 'content-hash', 'redact', model.value);
      expect(requests.slice(-5).map(request => request.body.frontier_model)).toEqual(Array(5).fill(model.value));
    }
    expect(new Set(requests.map(request => request.path)).size).toBe(5);
    await api.classifyLesson('clear', 'content-hash');
    expect(requests.at(-1)?.body.frontier_model).toBe('gpt-5.5');
    expect(requests).toHaveLength(16);
  } finally { globalThis.fetch = originalFetch; }
});
