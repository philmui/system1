import type { Event, Run } from './api.generated';
import { buildBatchTrace, batchSnapshot, defaultBatchScenario, type BatchScenario } from './batchComparison';
import { duration } from './timing';

export type LessonTimingStage = 'judgment' | 'policy' | 'interpretation' | 'publication' | 'review';
export type LessonTimingStatus = 'not_started' | 'pending' | 'recorded' | 'unavailable' | 'not_used' | 'stopped';
export type LessonTimingSource = 'provider' | 'fixture' | 'unknown_provider' | 'stage' | 'policy' | 'event_interval' | 'node_interval' | 'review_wait' | 'script_interval' | 'unavailable';
export type LessonModelProvenance = 'simulated' | 'live' | 'mixed' | 'unknown' | 'not_applicable';
type RecordedProvider = 'jev' | 'openai' | 'fixture' | 'unknown' | 'mixed';
export interface LessonTimingAttempt {
  id: string;
  attempt: number;
  started: boolean;
  state: string;
  elapsedMs: number | null;
  queueMs: number | null;
  source: LessonTimingSource;
  fixture: boolean;
  /** Explicit response evidence; absent while only the run configuration is known. */
  provider?: RecordedProvider;
  sequence: number;
}
export interface LessonStageTiming {
  id: LessonTimingStage;
  label: string;
  role: 'jev' | 'runtime' | 'llm' | 'output' | 'human';
  status: LessonTimingStatus;
  /** All observed attempts, including an orphaned retained completion. */
  attempts: number;
  startedAttempts: number;
  measuredAttempts: number;
  failedAttempts: number;
  /** Raw diagnostic interval. Fixture execution delays are NOT model latency. */
  durationMs: number | null;
  /** Safe primary metric: model stages require complete, explicitly live request timing. */
  primaryDurationMs: number | null;
  modelProvenance: LessonModelProvenance;
  /** Partial measured work, for inspection only; never total latency. */
  knownWorkMs: number | null;
  source: LessonTimingSource | 'mixed';
  display: string;
  detail: string;
  records: LessonTimingAttempt[];
}

const finiteMs = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const timestamp = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const object = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
function metadata(detail: unknown) {
  if (typeof detail !== 'string') return undefined;
  try { return object(JSON.parse(detail)); } catch { return undefined; }
}
const isModelStage = (id: LessonTimingStage) => id === 'judgment' || id === 'interpretation';
function recordedProvider(value: unknown): RecordedProvider | undefined {
  return value === 'jev' || value === 'openai' || value === 'fixture' ? value : value === undefined || value === null ? undefined : 'unknown';
}
function mergeProvider(previous: RecordedProvider | undefined, incoming: RecordedProvider | undefined) {
  return incoming === undefined ? previous : previous === undefined || previous === incoming ? incoming : 'mixed';
}
function responseSource(record: Pick<LessonTimingAttempt, 'provider' | 'fixture'>): LessonTimingSource {
  return record.provider === 'openai' || record.provider === 'jev' ? 'provider' : record.fixture ? 'fixture' : 'unknown_provider';
}
const labels: Record<LessonTimingStage, { label: string; role: LessonStageTiming['role']; unit: string }> = {
  judgment: { label: 'System 1', role: 'jev', unit: 'attempt' },
  policy: { label: 'Runtime policy', role: 'runtime', unit: 'evaluation' },
  interpretation: { label: 'Frontier', role: 'llm', unit: 'attempt' },
  publication: { label: 'Publish', role: 'output', unit: 'operation' },
  review: { label: 'Human review', role: 'human', unit: 'session' },
};

/** Readable human turnaround, distinct from subsecond provider measurements. */
export function humanWaitDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return 'Unavailable';
  if (ms === 0) return '0 s';
  if (ms < 60_000) return duration(ms);
  let seconds = Math.round(ms / 10) / 100;
  const parts: string[] = [];
  for (const [size, singular, plural] of [[86_400, 'day', 'days'], [3_600, 'hour', 'hours'], [60, 'min', 'min']] as const) {
    const count = Math.floor(seconds / size);
    if (count) parts.push(`${count} ${count === 1 ? singular : plural}`);
    seconds -= count * size;
  }
  const remainder = Math.round(seconds * 100) / 100;
  if (remainder) parts.push(`${remainder} s`);
  return parts.join(' ');
}

function summarize(id: LessonTimingStage, records: LessonTimingAttempt[], requested: boolean, unused: boolean, terminal: boolean): LessonStageTiming {
  const { label, role, unit } = labels[id];
  const measured = records.filter(record => record.elapsedMs !== null);
  const pending = records.some(record => record.state === 'running' || record.state === 'awaiting_review') || (!records.length && requested && !terminal);
  const stopped = records.some(record => ['cancelled', 'interrupted', 'stopped'].includes(record.state));
  const knownWorkMs = measured.length ? measured.reduce((sum, record) => sum + record.elapsedMs!, 0) : null;
  const durationMs = !pending && measured.length === records.length && records.length > 0 ? knownWorkMs : null;
  const sources = [...new Set(measured.map(record => record.source))];
  const source = sources.length > 1 ? 'mixed' : sources[0] || 'unavailable';
  const provenance = [...new Set(records.map(record => record.provider === 'mixed' ? 'mixed'
    : record.provider === 'openai' || record.provider === 'jev' ? 'live' : record.fixture ? 'simulated' : 'unknown'))];
  const modelProvenance: LessonModelProvenance = !isModelStage(id) ? 'not_applicable' : provenance.length > 1 ? 'mixed' : provenance[0] || 'unknown';
  const primaryDurationMs = !isModelStage(id) || modelProvenance === 'live' && records.every(record => record.source === 'provider') ? durationMs : null;
  const failedAttempts = records.filter(record => ['failed', 'cancelled', 'interrupted', 'stopped'].includes(record.state)).length;
  const status: LessonTimingStatus = pending ? 'pending' : durationMs !== null ? 'recorded' : stopped ? 'stopped'
    : records.length || terminal && requested ? 'unavailable' : unused ? 'not_used' : 'not_started';
  let display = status === 'pending' ? id === 'review' ? 'Awaiting review' : records.length ? 'Pending' : 'Queued'
    : status === 'not_used' ? id === 'review' ? 'Not required' : 'Not used'
      : status === 'not_started' ? 'Not yet' : status === 'stopped' ? 'Stopped' : id === 'review' ? humanWaitDuration(durationMs) : duration(durationMs);
  let detail = records.length ? `${records.length} ${unit}${records.length === 1 ? '' : 's'}` : status === 'not_used' ? 'Direct route' : 'No completed timing';
  if (failedAttempts) detail += ` · ${failedAttempts} failed or stopped`;
  if (records.length && measured.length < records.length) detail += ` · ${measured.length}/${records.length} timed`;
  if (isModelStage(id) && records.length) {
    if (modelProvenance === 'simulated') {
      if (!pending && !stopped) display = failedAttempts ? 'Simulated attempts' : 'Simulated response';
      detail = `${records.length} ${unit}${records.length === 1 ? '' : 's'}${failedAttempts ? ` · ${failedAttempts} failed or stopped` : ''} · no live API call`;
    } else if (status === 'recorded' && primaryDurationMs === null) display = 'Unmeasured';
    if (modelProvenance === 'mixed') detail += ' · mixed response sources';
    if (modelProvenance === 'unknown') detail += ' · provider unidentified';
  }
  return { id, label, role, status, attempts: records.length, startedAttempts: records.filter(record => record.started).length,
    measuredAttempts: measured.length, failedAttempts, durationMs, primaryDurationMs, modelProvenance, knownWorkMs, source, display, detail, records };
}

interface ActiveAttempt extends LessonTimingAttempt { startedAt: number | null }
interface ReviewSession extends ActiveAttempt { interruptId?: string; revision?: number }

/**
 * Only the selected document and the supplied event prefix contribute timings.
 * Run status/results and library metadata are deliberately never consulted.
 */
export function lessonTiming(run: Run, events: Event[], documentId: string) {
  const ordered = [...new Map(events.map(event => [event.sequence, event])).values()].sort((a, b) => a.sequence - b.sequence);
  const records: Record<LessonTimingStage, Map<string, ActiveAttempt>> = {
    judgment: new Map(), policy: new Map(), interpretation: new Map(), publication: new Map(), review: new Map(),
  };
  const fixtureRun = run.mode === 'test-fixture';
  let route: 'accept' | 'interpret' | undefined;
  let terminal = false;
  let publicationRequested = false;
  let firstReadAt: number | null = null;
  let firstPublishedAt: number | null = null;
  let review: ReviewSession | undefined;
  let reviewAction: string | undefined;
  let lastPublication: string | undefined;

  for (const event of ordered) {
    const payload = event.payload;
    const at = timestamp(event.timestamp);
    const kind: LessonTimingStage | undefined = event.instance_id === `${documentId}:jev` ? 'judgment'
      : event.instance_id === `${documentId}:interpret` ? 'interpretation' : event.instance_id === `${documentId}:publish` ? 'publication' : undefined;
    if (event.type === 'node_started' && event.instance_id === `${documentId}:extract` && payload.state === 'running' && firstReadAt === null) firstReadAt = at;
    if (event.type === 'run_started') terminal = false;
    if (event.type === 'edge_selected' && payload.target_instance_id === `${documentId}:publish`) publicationRequested = true;

    if (kind && (event.type === 'node_started' && payload.state === 'running' || event.type === 'node_completed' || event.type === 'node_failed')) {
      const id = `${event.instance_id}:${event.attempt}`;
      const existing = records[kind].get(id);
      const record: ActiveAttempt = existing || { id, attempt: event.attempt, started: false, startedAt: null, state: 'running', elapsedMs: null, queueMs: null, source: 'unavailable', fixture: fixtureRun, sequence: event.sequence };
      record.queueMs = finiteMs(payload.queue_wait_ms) ?? record.queueMs;
      if (event.type === 'node_started') {
        // Repeated SSE delivery must not reopen a completed attempt.
        record.started = true;
        if (record.startedAt === null) record.startedAt = at;
      } else {
        record.state = event.type === 'node_failed' ? 'failed' : typeof payload.state === 'string' ? payload.state : 'succeeded';
        const provider = kind === 'judgment' || kind === 'interpretation' ? metadata(payload.detail) : undefined;
        const providerMs = finiteMs(provider?.elapsed_ms);
        const stageMs = finiteMs(payload.elapsed_ms);
        record.provider = mergeProvider(record.provider, recordedProvider(provider?.provider));
        record.fixture = record.provider === 'fixture' || record.provider === undefined && fixtureRun;
        if (providerMs !== null) { record.elapsedMs = providerMs; record.source = responseSource(record); }
        else if (stageMs !== null && !['provider', 'fixture', 'unknown_provider'].includes(record.source)) { record.elapsedMs = stageMs; record.source = 'stage'; }
        else if (kind === 'publication' && record.startedAt !== null) {
          const committedAt = timestamp(object(payload.publication)?.committed_at);
          const endedAt = committedAt ?? at;
          if (endedAt !== null && endedAt >= record.startedAt) { record.elapsedMs = endedAt - record.startedAt; record.source = committedAt !== null ? 'event_interval' : 'node_interval'; }
        }
      }
      records[kind].set(id, record);
    }

    if (event.type === 'decision' && (kind === 'judgment' || kind === 'interpretation')) {
      const signal = object(payload.signal);
      const providerMs = finiteMs(signal?.elapsed_ms);
      if (kind === 'judgment' && (payload.selected_route === 'accept' || payload.selected_route === 'interpret')) route = payload.selected_route;
      // The retained response can supply missing provider timing for the same
      // attempt, but is never counted as a second model request.
      if (signal) {
        const id = `${event.instance_id}:${event.attempt}`;
        const existing = records[kind].get(id);
        const provider = mergeProvider(existing?.provider, recordedProvider(signal.provider));
        const fixture = provider === 'fixture' || provider === undefined && fixtureRun;
        records[kind].set(id, { id, attempt: event.attempt, started: false, startedAt: null, queueMs: null, sequence: event.sequence,
          elapsedMs: null, source: 'unavailable', ...existing, state: 'succeeded',
          ...(providerMs !== null ? { elapsedMs: providerMs, source: responseSource({ provider, fixture }) } : {}), provider, fixture });
      }
      if (kind === 'judgment') {
        const id = `policy:${typeof payload.id === 'string' ? payload.id : `${event.instance_id}:${event.attempt}`}`;
        const elapsedMs = finiteMs(payload.policy_elapsed_ms);
        records.policy.set(id, { id, attempt: event.attempt, started: true, startedAt: at, state: 'succeeded', elapsedMs, queueMs: null,
          source: elapsedMs === null ? 'unavailable' : 'policy', fixture: false, sequence: event.sequence });
      }
    }

    const publication = object(payload.publication);
    if (event.type === 'node_completed' && publication?.document_id === documentId) {
      lastPublication = typeof publication.status === 'string' ? publication.status : undefined;
      if (lastPublication === 'searchable' && firstPublishedAt === null) firstPublishedAt = timestamp(publication.committed_at);
    }
    if (event.type === 'review_requested' && Array.isArray(payload.items) && payload.items.some(item => object(item)?.document_id === documentId)) {
      const interruptId = typeof payload.interrupt_id === 'string' ? payload.interrupt_id : undefined;
      const revision = typeof payload.revision === 'number' ? payload.revision : undefined;
      const id = `review:${interruptId || 'request'}:${revision ?? event.sequence}`;
      if (!records.review.has(id)) {
        review = { id, attempt: records.review.size + 1, started: true, startedAt: at, state: 'awaiting_review', elapsedMs: null, queueMs: null,
          source: 'unavailable', fixture: run.request.simulated_review === true, sequence: event.sequence, interruptId, revision };
        records.review.set(id, review);
      }
    }
    if (event.type === 'review_resumed' && review) {
      const matches = !(review.interruptId && typeof payload.interrupt_id === 'string' && review.interruptId !== payload.interrupt_id)
        && !(review.revision !== undefined && typeof payload.revision === 'number' && review.revision !== payload.revision);
      if (matches) {
        review.state = 'succeeded';
        const disposition = Array.isArray(payload.decisions) ? payload.decisions.map(object).find(item => item?.document_id === documentId) : undefined;
        reviewAction = typeof disposition?.action === 'string' ? disposition.action : undefined;
        if (at !== null && review.startedAt !== null && at >= review.startedAt) { review.elapsedMs = at - review.startedAt; review.source = review.fixture ? 'script_interval' : 'review_wait'; }
        review = undefined;
      }
    }
    if (event.type === 'run_completed') {
      terminal = true;
      for (const group of Object.values(records)) for (const record of group.values()) {
        if (record.state === 'running' || record.state === 'awaiting_review') record.state = payload.status === 'cancelled' || payload.status === 'interrupted' ? payload.status : 'stopped';
      }
      review = undefined;
    }
  }
  const stages = Object.fromEntries((Object.keys(labels) as LessonTimingStage[]).map(id => [id, summarize(id, [...records[id].values()],
    id === 'interpretation' ? route === 'interpret' : id === 'publication' ? publicationRequested || route === 'accept' : false,
    (id === 'interpretation' || id === 'review') && route === 'accept', terminal)])) as Record<LessonTimingStage, LessonStageTiming>;
  // Retain the recorded interval for diagnostics, but never present a script's
  // milliseconds as a measurement of a human response.
  const simulatedReview = run.request.simulated_review === true;
  if (simulatedReview && stages.review.records.length) {
    if (stages.review.status === 'pending') stages.review.display = 'Awaiting simulated approval';
    else if (stages.review.records.every(record => record.state === 'succeeded')) stages.review.display = reviewAction === 'exclude' ? 'Simulated exclusion'
      : reviewAction === 'accept' || reviewAction === 'correct' ? 'Simulated approval' : 'Simulated review complete';
    stages.review.detail = 'No human response measured';
    stages.review.primaryDurationMs = null;
  }
  const fixture = fixtureRun || [...records.judgment.values(), ...records.interpretation.values()].some(record => record.fixture);
  const modelStages = [stages.judgment, stages.interpretation].filter(stage => stage.attempts > 0);
  const modelProvenances = [...new Set(modelStages.map(stage => stage.modelProvenance))];
  const simulated = modelProvenances.length === 1 && modelProvenances[0] === 'simulated' || modelProvenances.length === 0 && fixtureRun;
  const mixed = modelProvenances.length > 1 || modelProvenances.includes('mixed');
  return {
    stages, nodes: { judge: stages.judgment, policy: stages.policy, interpret: stages.interpretation, publish: stages.publication, review: stages.review },
    route, fixture, simulatedReview, publicationStatus: lastPublication,
    documentToSearchableMs: firstReadAt !== null && firstPublishedAt !== null && firstPublishedAt >= firstReadAt ? firstPublishedAt - firstReadAt : null,
    provenance: mixed ? 'Mixed response sources · inspect each step' : simulated ? 'Prepared replay · no live model calls' : 'Recorded timings · selected document',
    illustration: illustrativeDocumentLatency(route),
  };
}

/** A separate one-document scenario with no queue; never based on fixture latency. */
export function illustrativeDocumentLatency(route: 'accept' | 'interpret' | undefined, assumptions: Partial<BatchScenario> = {}) {
  if (!route) return null;
  const scenario = { ...defaultBatchScenario, ...assumptions, documents: 1, exceptions: route === 'interpret' ? 1 : 0, arrivalInterval: 0, publication: 'independent' as const };
  const strategy = (name: 'disaggregated' | 'frontier') => {
    const trace = buildBatchTrace(name, scenario);
    const snapshot = batchSnapshot(trace, trace.end);
    const work = (resource: 'bounded' | 'frontier' | 'code' | 'human') => trace.steps.filter(step => step.resource === resource).reduce((sum, step) => sum + (step.end - step.start) * 1000, 0);
    const codeWork = (capability: 'policy' | 'validate' | 'publish') => trace.steps.filter(step => step.capability === capability).reduce((sum, step) => sum + (step.end - step.start) * 1000, 0);
    const boundedMs = work('bounded'), frontierMs = work('frontier'), codeMs = work('code');
    return { timeToSearchableMs: trace.end * 1000, automatedMs: boundedMs + frontierMs + codeMs, boundedMs, frontierMs, codeMs, reviewWaitMs: work('human'),
      policyMs: codeWork('policy'), validationMs: codeWork('validate'), publicationMs: codeWork('publish'),
      boundedAttempts: snapshot.boundedCalls, frontierAttempts: snapshot.frontierCalls, modelAttempts: snapshot.totalCalls };
  };
  const system1 = strategy('disaggregated'), frontier = strategy('frontier');
  return { version: scenario.version, route, assumedReviewMs: scenario.reviewSeconds * 1000, system1, frontier, differenceMs: frontier.timeToSearchableMs - system1.timeToSearchableMs,
    frontierCallsAvoided: frontier.frontierAttempts - system1.frontierAttempts };
}

export function lessonTimingSource(stage: LessonStageTiming, fixture: boolean, simulatedReview: boolean): string {
  if (stage.id === 'review') return simulatedReview ? 'Script execution interval; human response not measured' : 'Recorded human review wait';
  if (isModelStage(stage.id)) {
    if (stage.modelProvenance === 'simulated') return 'Fixture execution delay; no live model call';
    if (stage.modelProvenance === 'mixed') return 'Mixed response provenance; model latency unavailable';
    if (stage.modelProvenance === 'unknown') return 'Provider identity unavailable; model latency unmeasured';
    if (stage.source === 'provider') return 'Measured live provider request';
    return stage.source === 'stage' ? 'Recorded stage interval; provider latency unmeasured' : 'Live request; latency unmeasured';
  }
  if (stage.source === 'stage') return fixture ? 'Fixture stage measurement' : 'Recorded stage measurement';
  if (stage.source === 'policy') return 'Measured runtime evaluation';
  if (stage.source === 'event_interval') return 'Recorded start-to-commit interval';
  if (stage.source === 'node_interval') return 'Recorded node event interval; no commit time';
  if (stage.source === 'mixed') return 'Mixed recorded timing sources';
  return 'No completed measurement';
}
