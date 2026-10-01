import { expect, test } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExperimentCoverageView, ExperimentReceipt } from '../src/components/ExperimentEvidence';
import type { ExperimentCoverage, PolicyReceipt } from '../src/lib/api.generated';

test('experiment receipts distinguish a retained judgment, policy route, and unpublished proposal', () => {
  const receipt = {
    signal: { choice: 'contract', confidence: .96 }, reason: 'mixed_purpose',
    selected_route: 'interpret', requires_review: true,
  } as PolicyReceipt;
  const html = renderToStaticMarkup(createElement(ExperimentReceipt, { title: 'Your simulation', receipt }));
  expect(html).toContain('96% confidence');
  expect(html).toContain('Runtime rule');
  expect(html).toContain('Proposed terms guard');
  expect(html).toContain('Frontier proposal → human approval');
  expect(html).toContain('A proposal cannot publish itself.');
  const accepted = renderToStaticMarkup(createElement(ExperimentReceipt, {
    title: 'Your simulation', receipt: { ...receipt, selected_route: 'accept', reason: 'accepted', requires_review: false },
  }));
  expect(accepted).toContain('Accept category');
  expect(accepted).toContain('this simulation publishes nothing');
  expect(accepted).not.toContain('A proposal cannot publish itself');
});

test('reference tradeoffs use explicit denominators and never call coverage accuracy', () => {
  const original: ExperimentCoverage = {
    eligible: 5, accepted: 3, escalated: 2, acceptance_coverage: .6,
    accepted_reference_mistakes: 0, accepted_policy_violations: 0, quality_basis: 'Prepared reference labels',
  };
  const html = renderToStaticMarkup(createElement(ExperimentCoverageView, {
    original, simulated: { ...original, accepted: 5, escalated: 0, accepted_reference_mistakes: 2, accepted_policy_violations: 1 },
  }));
  expect(html).toContain('not an accuracy benchmark');
  expect(html).toContain('Accepted category mismatches');
  expect(html).toContain('Required reviews bypassed');
  expect(html).toContain('/ 5 accepted');
});

test('a pending evaluation cannot present an earlier route as its current answer', () => {
  const html = renderToStaticMarkup(createElement(ExperimentReceipt, { title: 'Your simulation', pending: true }));
  expect(html).toContain('Evaluating this rule');
  expect(html).not.toContain('Accept category');
  expect(html).not.toContain('Frontier proposal');
  expect(html).not.toContain('confidence');
});
