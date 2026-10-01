import type { Category, LiveClassificationResponse, ProviderMeta } from '../../src/lib/api.generated';
import type { FrontierModel } from '../../src/lib/frontierModels';
import raw from '../../src/data/lessons.json' with { type: 'json' };

/** Browser mocks only. These response intervals are not provider benchmarks. */
export function mockLiveClassification(example: 'clear' | 'ambiguous' | 'proposed' = 'ambiguous', model: FrontierModel = 'gpt-5.5'): LiveClassificationResponse {
  const subject = raw.classification.documents.find(item => item.example_id === example)!;
  const interpreted = example !== 'clear';
  const category: Category = example === 'clear' ? 'invoice' : example === 'proposed' ? 'correspondence' : 'report';
  const choice: Category = example === 'proposed' ? 'contract' : category;
  const confidence = example === 'clear' ? 0.97 : example === 'proposed' ? 0.96 : 1;
  const provider: ProviderMeta = { provider: 'jev', request_id: 'browser-mock-bounded', configured_model: 'jev-test', returned_model: 'jev-test-returned', elapsed_ms: 175, usage: null, rubric_version: 'browser-test' };
  const frontier: ProviderMeta = { provider: 'openai', request_id: 'browser-mock-frontier', configured_model: model, returned_model: model, elapsed_ms: 6071, usage: null, rubric_version: 'browser-test' };
  const agreement = { matching: 1 as const, evaluated: 1 as const, reference_category: category, observed_category: category,
    basis: 'authored lesson reference' as const, scope: 'one synthetic document; not a benchmark' as const };
  const elapsed = interpreted ? 6320 : 192;
  return {
    version: 'live-classification-v1', example_id: example, document_id: subject.document.id, content_version: subject.document.content_version,
    reference_category: category, started_at: '2026-09-29T10:00:00Z', total_elapsed_ms: elapsed + 12,
    strategy: { id: 'system1', label: 'System 1 + exceptions', status: 'completed', started_after_ms: 0, finished_after_ms: elapsed, elapsed_ms: elapsed,
      components: [
        { id: 'judge', label: 'System 1 judgment', kind: 'bounded_judgment', status: 'succeeded', started_after_ms: 0, elapsed_ms: 188, queue_elapsed_ms: 10, provider, error: null },
        { id: 'policy', label: 'Runtime policy', kind: 'runtime_policy', status: 'succeeded', started_after_ms: 188, elapsed_ms: 0.2, queue_elapsed_ms: 0, provider: null, error: null },
        ...(interpreted ? [{ id: 'interpret' as const, label: 'Frontier interpretation', kind: 'frontier_interpretation' as const, status: 'succeeded' as const, started_after_ms: 190, elapsed_ms: 6090, queue_elapsed_ms: 10, provider: frontier, error: null }] : []),
      ],
      judgment: { ...provider, kind: 'choice', choice, confidence, probabilities: { [choice]: confidence, other: 1 - confidence } },
      policy: { policy_version: raw.policy_version, threshold: 0.8, guard_matched: interpreted, selected_route: interpreted ? 'interpret' : 'accept', reason: interpreted ? 'mixed_purpose' : 'accepted',
        explanation: interpreted ? 'The mixed-purpose guard requires interpretation despite high confidence.' : 'The actual mocked invoice judgment meets the configured threshold.' },
      interpretation: interpreted ? { ...frontier, kind: 'proposal', category, explanation: 'Actual mocked proposal, not the prepared recording.' } : null,
      output_category: category, output_kind: interpreted ? 'proposal' : 'accepted_category', requires_review: interpreted,
      bounded_attempts: 1, frontier_attempts: interpreted ? 1 : 0, provider_work_ms: interpreted ? 6249 : 178,
      judgment_agreement: { ...agreement, matching: choice === category ? 1 : 0, observed_category: choice }, output_agreement: agreement, error: null,
    },
    provenance: { documents: 'synthetic content-bound source', bounded_provider: 'live Jev', frontier_provider: `live ${model} when selected`,
      policy: 'executed taxonomy, 0.80 threshold, and text guard', confidence_note: 'Confidence is not accuracy.',
      timing_scope: 'Mocked browser preview; no real provider calls.', stopping_point: 'accepted category or unapproved proposal',
      quality_scope: 'One authored reference, not benchmark accuracy.', sample_count: 1, automatic_retries: 0, human_review: 'not performed', publication: 'not performed' },
    operational_writes: 0, published: false,
  };
}
