import type { Event, LiveDiscoveryResponse } from './api.generated';
import { measuredMs, referenceAgreement, unevaluated, type ComponentMetric, type MetricValue, type PerformanceReport } from './performanceReport';
import { duration } from './timing';

function metadata(event: Event): Record<string, unknown> {
  try { const value: unknown = JSON.parse(String(event.payload.detail || '{}')); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; } catch { return {}; }
}
function checks(event: Event | undefined, label: string, detail: string): MetricValue {
  return referenceAgreement(Number(event?.payload.output_count ?? NaN), Number(event?.payload.input_count ?? NaN), label, detail);
}

/** Full returned execution only; this report never follows the animation cursor. */
export function discoveryPerformance(result: LiveDiscoveryResponse): PerformanceReport {
  const events = [...new Map(result.snapshot.events.map(event => [event.sequence, event])).values()].sort((a, b) => a.sequence - b.sequence);
  const terminal = [...events].reverse().find(event => event.type === 'run_completed');
  const start = events.find(event => event.type === 'run_started');
  const wall = result.metrics ? measuredMs(result.metrics.total_elapsed_ms) : terminal && start ? measuredMs(Date.parse(terminal.timestamp) - Date.parse(start.timestamp)) : null;
  const finished = events.filter(event => ['node_completed', 'node_failed'].includes(event.type));
  const citations = [...finished].reverse().find(event => event.instance_id === 'citations');
  const support = [...finished].reverse().find(event => event.instance_id === 'support');
  const intent = [...events].reverse().find(event => event.type === 'decision' && event.instance_id === 'intent');
  const signal = intent?.payload.signal as { choice?: string; provider?: string } | undefined;
  const expectedIntent = result.example_id;
  const intentQuality = signal?.choice ? referenceAgreement(Number(signal.choice === expectedIntent), 1,
    `${signal.provider === 'fixture' ? 'Prepared ' : ''}intent agreement`, `Observed intent: ${signal.choice}. Authored intent for this lesson: ${expectedIntent}. One synthetic request; not a held-out evaluation.`) : unevaluated('Intent agreement', 'No completed intent judgment is available.');
  const citationQuality = checks(citations, 'Draft claims with valid citations', 'Code checked every cited passage ID and exact quotation span per draft claim. This fraction measures citation integrity, not factual accuracy or answer completeness. No draft claims means no evaluation.');
  const components: ComponentMetric[] = [];
  const add = (id: string, name: string, role: ComponentMetric['role'], matches: (event: Event) => boolean, quality: MetricValue, code = false) => {
    const records = [...new Map(finished.filter(matches).map(event => [`${event.instance_id}:${event.attempt}`, event])).values()];
    const attempted = records.filter(event => event.payload.state !== 'skipped');
    const values = attempted.map(event => {
      const meta = metadata(event);
      const knownLive = role === 'jev' ? result.provenance.bounded_judgments === 'live' : role === 'llm' && result.provenance.frontier.startsWith('live ');
      return code ? measuredMs(event.payload.elapsed_ms) : ['jev', 'openai'].includes(String(meta.provider)) ? measuredMs(meta.elapsed_ms)
        : knownLive && event.type === 'node_failed' && meta.provider !== 'fixture' ? measuredMs(event.payload.elapsed_ms) : null;
    });
    const elapsedMs = values.length && values.every(value => value !== null) ? values.reduce<number>((sum, value) => sum + value!, 0) : null;
    const prepared = attempted.some(event => metadata(event).provider === 'fixture');
    const models = [...new Set(attempted.map(event => { const meta = metadata(event); return meta.returned_model || meta.configured_model; }).filter((model): model is string => typeof model === 'string'))];
    const queues = attempted.map(event => measuredMs(event.payload.queue_wait_ms));
    const queue = queues.length && queues.every(value => value !== null) ? queues.reduce<number>((sum, value) => sum + value!, 0) : null;
    const failures = attempted.filter(event => event.type === 'node_failed').length;
    const started = events.some(event => event.type === 'node_started' && event.payload.state === 'running' && matches(event));
    components.push({ id, name, role, elapsedMs, model: models.join(', ') || undefined,
      timingLabel: prepared ? 'Prepared' : !attempted.length && !started ? 'Not used' : 'Incomplete timing', quality,
      detail: `${attempted.length} completed or failed ${code ? 'operations' : 'request attempts'}${failures ? `; ${failures} failed` : ''}. ${code ? 'Recorded code-step intervals.' : 'Live provider round trips are included; prepared delays are excluded.'} ${failures ? 'Failed live requests use their recorded attempt interval, not a successful response time.' : ''} ${queue === null ? '' : `Recorded queue wait: ${duration(queue)}.`} Parallel component work is not batch wall time.` });
  };
  const unscored = (label: string) => unevaluated(label, 'No independent reference labels are available for these outputs. Confidence and acceptance by a runtime rule do not establish accuracy.');
  add('intent', 'Judge intent · System 1', 'jev', event => event.instance_id === 'intent', intentQuality);
  const codePlan = finished.some(event => event.instance_id === 'plan' && event.payload.label === 'One lexical search');
  add('plan', codePlan ? 'Plan retrieval · Code' : 'Plan retrieval · Frontier', codePlan ? 'runtime' : 'llm', event => event.instance_id === 'plan', unscored('Plan quality'), codePlan);
  add('retrieve', 'Retrieve · Code', 'runtime', event => event.instance_id.endsWith(':retrieve'), unscored('Retrieval accuracy'), true);
  add('screen', 'Screen evidence · System 1', 'jev', event => event.instance_id.endsWith(':screen'), unscored('Relevance accuracy'));
  add('compose', 'Compose · Frontier', 'llm', event => event.instance_id === 'synthesize', citationQuality);
  add('citations', 'Validate citations · Code', 'runtime', event => event.instance_id === 'citations', citationQuality, true);
  add('support', 'Check support · System 1', 'jev', event => event.instance_id.startsWith('support:claim-'), unscored('Semantic support accuracy'));
  const decisions = events.filter(event => event.type === 'decision');
  const policyTimes = decisions.map(event => measuredMs(event.payload.policy_elapsed_ms));
  components.splice(1, 0, { id: 'policy', name: 'Route · Runtime policy', role: 'runtime', elapsedMs: policyTimes.length && policyTimes.every(value => value !== null) ? policyTimes.reduce<number>((sum, value) => sum + value!, 0) : null,
    quality: { label: 'Recorded evaluations', value: String(decisions.length), detail: 'Actual routing and acceptance decisions. This count is not a policy-accuracy score.' }, detail: 'Sum of recorded policy evaluation intervals across intent, evidence, and support decisions.' });
  const run = result.snapshot.run;
  const claims = Array.isArray(run.result?.claims) ? run.result.claims.length : 0;
  const passages = Array.isArray(run.result?.passages) ? run.result.passages.length : 0;
  const outputs = expectedIntent === 'find' ? `${passages} passages` : `${claims} claims`;
  return {
    title: expectedIntent === 'find' ? 'Find execution report' : 'Compare policies execution report',
    scope: `Whole returned execution · ${result.frontier_calls} frontier attempts · ${result.provenance.bounded_judgments} bounded judgments`,
    elapsed: { label: 'Overall workflow elapsed', value: wall === null ? 'Not recorded' : duration(wall), detail: 'Run start to terminal event, including queues and checks. Source preparation is excluded; replay speed changes no measurements.' },
    quality: unevaluated(expectedIntent === 'find' ? 'Overall retrieval accuracy' : 'Overall answer accuracy', 'No independent evaluation set for final results. Component checks below measure narrower criteria.'),
    outcome: { label: 'Returned result', value: run.status === 'succeeded' || run.status === 'partially_succeeded' ? outputs : run.status, detail: `${run.status === 'succeeded' ? 'Completed' : run.status} execution.${support ? ` ${support.payload.output_count} of ${support.payload.input_count} claims retained by the fallible support check.` : ' No narrative answer was generated.'}`, tone: run.status === 'succeeded' ? 'neutral' : 'caution' },
    components,
    note: `Component bars show accumulated service work, which may overlap; their sum is not overall latency. ${result.provenance.support_checks}. Citation integrity is not semantic accuracy.`,
  };
}
