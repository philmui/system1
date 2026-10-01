/**
 * A deterministic workload illustration, not a benchmark or provider price list.
 * Both strategies share inputs, review rules, capacities and one work clock.
 * Rendering/playback never participates in this scheduler or its accounting.
 */
import type { Event } from './api.generated';
import { classificationUsage } from './classification';
export type BatchStrategy = 'disaggregated' | 'frontier';
export type PublicationPolicy = 'batch' | 'independent';
export type BatchCapability = 'bounded' | 'frontier_classify' | 'frontier_interpret' | 'policy' | 'validate' | 'review' | 'publish';
export type BatchResource = 'bounded' | 'frontier' | 'code' | 'human';
export type BatchDocumentState = 'queued' | 'processing' | 'review' | 'ready' | 'searchable';

export interface BatchScenario {
  version: 'classification-workload-v1';
  documents: number;
  exceptions: number;
  arrivalInterval: number;
  boundedSeconds: number;
  frontierClassifySeconds: number;
  frontierInterpretSeconds: number;
  codeSeconds: number;
  publishSeconds: number;
  reviewSeconds: number;
  boundedCapacity: number;
  frontierCapacity: number;
  codeCapacity: number;
  reviewCapacity: number;
  boundedRetries: number;
  frontierRetries: number;
  interpretationRetries: number;
  boundedCost: number | null;
  frontierClassifyCost: number | null;
  frontierInterpretCost: number | null;
  codeCost: number | null;
  publication: PublicationPolicy;
}

export const defaultBatchScenario: BatchScenario = {
  version: 'classification-workload-v1', documents: 100, exceptions: 20,
  arrivalInterval: 0, boundedSeconds: .25, frontierClassifySeconds: 2.8,
  frontierInterpretSeconds: 3.2, codeSeconds: .04, publishSeconds: .08,
  // A teaching assumption about human turnaround, not script execution speed.
  reviewSeconds: 15 * 60, boundedCapacity: 8, frontierCapacity: 4,
  codeCapacity: 8, reviewCapacity: 2, boundedRetries: 0, frontierRetries: 0, interpretationRetries: 0,
  boundedCost: .0001, frontierClassifyCost: .006, frontierInterpretCost: .007,
  codeCost: .00001, publication: 'batch',
};

type NumericField = Exclude<keyof BatchScenario, 'version' | 'publication'>;
export interface BatchAssumptionField { key: NumericField; label: string; unit: string; min: number; max: number; step: number; nullable?: boolean }
export const batchAssumptionFields: BatchAssumptionField[] = [
  { key: 'documents', label: 'Readable documents', unit: 'virtual documents', min: 0, max: 200, step: 1 },
  { key: 'exceptions', label: 'Interpretation / review cases', unit: 'same documents in both lanes', min: 0, max: 200, step: 1 },
  { key: 'boundedCapacity', label: 'Bounded capacity', unit: 'concurrent requests', min: 1, max: 32, step: 1 },
  { key: 'frontierCapacity', label: 'Frontier capacity', unit: 'concurrent requests per strategy', min: 1, max: 32, step: 1 },
  { key: 'codeCapacity', label: 'Code capacity', unit: 'concurrent operations', min: 1, max: 32, step: 1 },
  { key: 'reviewCapacity', label: 'Review capacity', unit: 'concurrent reviews', min: 1, max: 32, step: 1 },
  { key: 'arrivalInterval', label: 'Document arrivals', unit: 'seconds between arrivals · 0 = together', min: 0, max: 30, step: .1 },
  { key: 'boundedSeconds', label: 'Bounded judgment', unit: 'seconds / attempt', min: 0, max: 60, step: .05 },
  { key: 'frontierClassifySeconds', label: 'Frontier classification', unit: 'seconds / attempt', min: 0, max: 60, step: .1 },
  { key: 'frontierInterpretSeconds', label: 'Frontier interpretation', unit: 'seconds / attempt', min: 0, max: 60, step: .1 },
  { key: 'codeSeconds', label: 'Policy / validation', unit: 'seconds / operation', min: 0, max: 10, step: .01 },
  { key: 'publishSeconds', label: 'Publish', unit: 'seconds / document', min: 0, max: 10, step: .01 },
  { key: 'reviewSeconds', label: 'Assumed human review wait', unit: 'seconds / review · 900 = 15 min · not a response-time estimate', min: 0, max: 7 * 24 * 60 * 60, step: 1 },
  { key: 'boundedRetries', label: 'Bounded retries', unit: 'additional attempts per judgment', min: 0, max: 3, step: 1 },
  { key: 'frontierRetries', label: 'Frontier classification retries', unit: 'additional attempts per baseline classification', min: 0, max: 3, step: 1 },
  { key: 'interpretationRetries', label: 'Frontier interpretation retries', unit: 'additional attempts per exception', min: 0, max: 3, step: 1 },
  { key: 'boundedCost', label: 'Bounded judgment cost', unit: 'USD / attempt · blank = unknown', min: 0, max: 10, step: .0001, nullable: true },
  { key: 'frontierClassifyCost', label: 'Frontier classification cost', unit: 'USD / attempt · blank = unknown', min: 0, max: 10, step: .001, nullable: true },
  { key: 'frontierInterpretCost', label: 'Frontier interpretation cost', unit: 'USD / attempt · blank = unknown', min: 0, max: 10, step: .001, nullable: true },
  { key: 'codeCost', label: 'Code operation cost', unit: 'USD / operation · blank = unknown', min: 0, max: 10, step: .00001, nullable: true },
];

export function validateBatchScenario(scenario: BatchScenario): string | null {
  if (scenario.version !== 'classification-workload-v1') return 'This workload version is not supported.';
  if (!['batch', 'independent'].includes(scenario.publication)) return 'Choose a supported publication rule.';
  for (const field of batchAssumptionFields) {
    const value = scenario[field.key];
    if (value === null && field.nullable) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < field.min || value > field.max || (field.step === 1 && !Number.isInteger(value))) {
      return `${field.label} must be ${field.step === 1 ? 'a whole number ' : ''}between ${field.min} and ${field.max}.`;
    }
  }
  return scenario.exceptions > scenario.documents ? 'Review cases cannot exceed readable documents.' : null;
}

export interface BatchDocument { id: string; ordinal: number; kind: 'routine' | 'exception'; arrivalAt: number }
export interface BatchStep {
  id: string;
  documentId: string;
  capability: BatchCapability;
  resource: BatchResource;
  readyAt: number;
  start: number;
  end: number;
  cost: number | null;
  attempt?: number;
}
export interface BatchDocumentTrace extends BatchDocument {
  steps: BatchStep[];
  decisionAt: number;
  reviewReadyAt: number | null;
  authorizedAt: number;
  publishedAt: number;
}
export interface BatchTrace {
  strategy: BatchStrategy;
  scenario: BatchScenario;
  documents: BatchDocumentTrace[];
  steps: BatchStep[];
  end: number;
  firstSearchableAt: number | null;
}

interface Stage { capability: BatchCapability; resource: BatchResource; seconds: number; cost: number | null; attempt?: number }
interface ScheduledTask { documentIndex: number; stageIndex: number; readyAt: number }

function documentStages(document: BatchDocument, strategy: BatchStrategy, scenario: BatchScenario): Stage[] {
  const stages: Stage[] = [];
  const attempts = (capability: BatchCapability, resource: BatchResource, seconds: number, cost: number | null, retries: number) => {
    for (let attempt = 1; attempt <= retries + 1; attempt++) stages.push({ capability, resource, seconds, cost, attempt });
  };
  if (strategy === 'disaggregated') attempts('bounded', 'bounded', scenario.boundedSeconds, scenario.boundedCost, scenario.boundedRetries);
  else attempts('frontier_classify', 'frontier', scenario.frontierClassifySeconds, scenario.frontierClassifyCost, scenario.frontierRetries);
  stages.push({ capability: 'policy', resource: 'code', seconds: scenario.codeSeconds, cost: scenario.codeCost });
  if (document.kind === 'exception') {
    if (strategy === 'disaggregated') {
      attempts('frontier_interpret', 'frontier', scenario.frontierInterpretSeconds, scenario.frontierInterpretCost, scenario.interpretationRetries);
      stages.push({ capability: 'validate', resource: 'code', seconds: scenario.codeSeconds, cost: scenario.codeCost });
    }
    stages.push({ capability: 'review', resource: 'human', seconds: scenario.reviewSeconds, cost: 0 });
  }
  if (scenario.publication === 'independent') stages.push({ capability: 'publish', resource: 'code', seconds: scenario.publishSeconds, cost: scenario.codeCost });
  return stages;
}

/** Exceptions are distributed reproducibly through the same arrival order in both lanes. */
export function virtualBatchDocuments(scenario: BatchScenario): BatchDocument[] {
  return Array.from({ length: scenario.documents }, (_, index) => ({
    id: `virtual:${String(index + 1).padStart(3, '0')}`,
    ordinal: index + 1,
    kind: Math.floor((index + 1) * scenario.exceptions / scenario.documents) > Math.floor(index * scenario.exceptions / scenario.documents) ? 'exception' : 'routine',
    arrivalAt: index * scenario.arrivalInterval,
  }));
}

/** Earliest-ready scheduling with stable document-order ties and finite resource pools. */
export function buildBatchTrace(strategy: BatchStrategy, scenario: BatchScenario): BatchTrace {
  const invalid = validateBatchScenario(scenario);
  if (invalid) throw new Error(invalid);
  const documents = virtualBatchDocuments(scenario);
  const stages = documents.map(document => documentStages(document, strategy, scenario));
  const perDocument: BatchStep[][] = documents.map(() => []);
  const steps: BatchStep[] = [];
  const pools: Record<BatchResource, number[]> = {
    bounded: Array(scenario.boundedCapacity).fill(0), frontier: Array(scenario.frontierCapacity).fill(0),
    code: Array(scenario.codeCapacity).fill(0), human: Array(scenario.reviewCapacity).fill(0),
  };
  const pending: ScheduledTask[] = documents.map((document, documentIndex) => ({ documentIndex, stageIndex: 0, readyAt: document.arrivalAt }));
  const schedule = () => {
    while (pending.length) {
      // A resource is reserved only for the earliest start among all ready tasks.
      // Newly unlocked tasks compete before any later-start reservation is made.
      let winner = 0, startAt = Infinity, slotIndex = 0;
      pending.forEach((task, index) => {
        const pool = pools[stages[task.documentIndex][task.stageIndex].resource];
        const slot = pool.indexOf(Math.min(...pool));
        const start = Math.max(task.readyAt, pool[slot]);
        const previous = pending[winner];
        if (start < startAt || (start === startAt && (task.readyAt < previous.readyAt || (task.readyAt === previous.readyAt && task.documentIndex < previous.documentIndex)))) {
          winner = index; startAt = start; slotIndex = slot;
        }
      });
      const task = pending.splice(winner, 1)[0];
      const stage = stages[task.documentIndex][task.stageIndex];
      const step: BatchStep = {
        id: `${documents[task.documentIndex].id}:${task.stageIndex}`, documentId: documents[task.documentIndex].id,
        capability: stage.capability, resource: stage.resource, readyAt: task.readyAt,
        start: startAt, end: startAt + stage.seconds, cost: stage.cost, attempt: stage.attempt,
      };
      pools[stage.resource][slotIndex] = step.end;
      steps.push(step); perDocument[task.documentIndex].push(step);
      if (task.stageIndex + 1 < stages[task.documentIndex].length) pending.push({ documentIndex: task.documentIndex, stageIndex: task.stageIndex + 1, readyAt: step.end });
    }
  };
  schedule();
  if (scenario.publication === 'batch' && documents.length) {
    const barrier = Math.max(...steps.map(step => step.end));
    documents.forEach((_, documentIndex) => {
      const stageIndex = stages[documentIndex].length;
      stages[documentIndex].push({ capability: 'publish', resource: 'code', seconds: scenario.publishSeconds, cost: scenario.codeCost });
      pending.push({ documentIndex, stageIndex, readyAt: barrier });
    });
    schedule();
  }
  const traces: BatchDocumentTrace[] = documents.map((document, index) => {
    const documentSteps = perDocument[index];
    const authorization = documentSteps.find(step => step.capability === 'review') || documentSteps.find(step => step.capability === 'policy')!;
    return {
      ...document, steps: documentSteps, decisionAt: documentSteps.find(step => step.capability === 'policy')!.end,
      reviewReadyAt: documentSteps.find(step => step.capability === 'review')?.readyAt ?? null,
      authorizedAt: authorization.end, publishedAt: documentSteps.find(step => step.capability === 'publish')!.end,
    };
  });
  return { strategy, scenario: { ...scenario }, documents: traces, steps,
    end: Math.max(0, ...traces.map(document => document.publishedAt)),
    firstSearchableAt: traces.length ? Math.min(...traces.map(document => document.publishedAt)) : null,
  };
}

export function batchDocumentSnapshot(document: BatchDocumentTrace, time: number) {
  const now = Math.max(0, time);
  const current = document.steps.find(step => step.start <= now && step.end > now);
  const next = document.steps.find(step => step.start > now);
  const completed = document.steps.filter(step => step.end <= now);
  let state: BatchDocumentState;
  if (now >= document.publishedAt) state = 'searchable';
  else if (document.reviewReadyAt !== null && now >= document.reviewReadyAt && now < document.authorizedAt) state = 'review';
  else if (current) state = 'processing';
  else if (now >= document.authorizedAt) state = 'ready';
  else state = 'queued';
  return { state, current, next, completed, progress: current ? Math.min(1, (now - current.start) / (current.end - current.start)) : 0 };
}

export function batchSnapshot(trace: BatchTrace, time: number) {
  const now = Math.max(0, time);
  const counts: Record<BatchDocumentState, number> = { queued: 0, processing: 0, review: 0, ready: 0, searchable: 0 };
  trace.documents.forEach(document => { counts[batchDocumentSnapshot(document, now).state]++; });
  const started = trace.steps.filter(step => step.start <= now);
  const completed = trace.steps.filter(step => step.end <= now);
  const boundedCalls = started.filter(step => step.resource === 'bounded').length;
  const frontierCalls = started.filter(step => step.resource === 'frontier').length;
  const unknownCost = started.some(step => step.cost === null);
  return {
    counts, boundedCalls, frontierCalls, totalCalls: boundedCalls + frontierCalls,
    frontierDocuments: new Set(started.filter(step => step.capability === 'frontier_interpret').map(step => step.documentId)).size,
    acceptedWithoutReview: trace.documents.filter(document => document.kind === 'routine' && document.decisionAt <= now).length,
    cost: unknownCost ? null : started.reduce((sum, step) => sum + (step.cost ?? 0), 0),
    machineSeconds: trace.steps.filter(step => step.resource !== 'human').reduce((sum, step) => sum + Math.max(0, Math.min(now, step.end) - step.start), 0),
    reviewWorkSeconds: trace.steps.filter(step => step.resource === 'human').reduce((sum, step) => sum + Math.max(0, Math.min(now, step.end) - step.start), 0),
    completedOperations: completed.length,
    firstSearchableAt: trace.firstSearchableAt !== null && now >= trace.firstSearchableAt ? trace.firstSearchableAt : null,
    completionAt: now >= trace.end ? trace.end : null,
  };
}

export function nextBatchTime(traces: BatchTrace[], time: number): number {
  const duration = Math.max(0, ...traces.map(trace => trace.end));
  return Math.min(duration, ...traces.flatMap(trace => trace.steps.flatMap(step => [step.start, step.end])).filter(value => value > time + .000001));
}

export interface BatchPlaybackSegment {
  workStart: number;
  workEnd: number;
  presentationStart: number;
  presentationEnd: number;
  machineActive: boolean;
}

/**
 * One monotonic clock for both strategies. Machine activity is the UNION of
 * both lanes, so a human wait in one lane cannot accelerate the other lane's
 * active work. Only gaps with no machine work in either lane get the waiting
 * rate. This changes presentation, never the scheduler or recorded metrics.
 * Short scenarios keep their natural duration; neither class is slowed down.
 */
export function createBatchPlaybackClock(
  traces: readonly BatchTrace[],
  { machineSeconds = 14, waitingSeconds = 4 }: { machineSeconds?: number; waitingSeconds?: number } = {},
) {
  if (![machineSeconds, waitingSeconds].every(value => Number.isFinite(value) && value > 0)) throw new Error('Presentation budgets must be positive finite seconds.');
  const workDuration = Math.max(0, ...traces.map(trace => trace.end));
  const intervals = traces.flatMap(trace => trace.steps.filter(step => step.resource !== 'human' && step.end > step.start)
    .map(step => ({ start: Math.max(0, step.start), end: Math.min(workDuration, step.end) })))
    .filter(interval => interval.end > interval.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  const segments: BatchPlaybackSegment[] = [];
  const append = (workStart: number, workEnd: number, machineActive: boolean) => {
    if (workEnd > workStart) segments.push({ workStart, workEnd, machineActive, presentationStart: 0, presentationEnd: 0 });
  };
  let cursor = 0;
  for (const interval of merged) {
    append(cursor, interval.start, false);
    append(interval.start, interval.end, true);
    cursor = interval.end;
  }
  append(cursor, workDuration, false);
  const activeWork = merged.reduce((sum, interval) => sum + interval.end - interval.start, 0);
  const waitingWork = Math.max(0, workDuration - activeWork);
  const machineRate = activeWork ? Math.min(1, machineSeconds / activeWork) : 1;
  const waitingRate = waitingWork ? Math.min(1, waitingSeconds / waitingWork) : 1;
  let duration = 0;
  for (const segment of segments) {
    segment.presentationStart = duration;
    duration += (segment.workEnd - segment.workStart) * (segment.machineActive ? machineRate : waitingRate);
    segment.presentationEnd = duration;
  }
  const clamp = (value: number, end: number) => Number.isNaN(value) ? 0 : Math.min(end, Math.max(0, value));
  const workToPresentation = (time: number) => {
    const at = clamp(time, workDuration);
    if (at === workDuration) return duration;
    const segment = segments.find(value => at < value.workEnd);
    return segment ? segment.presentationStart + (at - segment.workStart) / (segment.workEnd - segment.workStart) * (segment.presentationEnd - segment.presentationStart) : 0;
  };
  const presentationToWork = (time: number) => {
    const at = clamp(time, duration);
    if (at === duration) return workDuration;
    const segment = segments.find(value => at < value.presentationEnd);
    return segment ? segment.workStart + (at - segment.presentationStart) / (segment.presentationEnd - segment.presentationStart) * (segment.workEnd - segment.workStart) : 0;
  };
  return { duration, workDuration, segments, workToPresentation, presentationToWork };
}

/** A percentage is undefined when the comparison baseline is zero. */
export function relativeBatchDifference(baseline: number, alternative: number): number | null {
  return baseline === 0 ? null : (baseline - alternative) / baseline;
}

export function batchMoney(value: number | null): string { return value === null ? 'Unavailable' : `$${value.toFixed(4)}`; }
export function batchSeconds(value: number | null): string { return value === null ? 'Not yet' : `${value.toFixed(2)} s`; }

/** Whole-recording evidence. Never consult mutable library metadata for replay facts. */
export function recordedBatchEvidence(events: Event[]) {
  const ordered = [...new Map(events.map(event => [event.sequence, event])).values()].sort((a, b) => a.sequence - b.sequence);
  const usage = classificationUsage(ordered);
  const documents = new Map<string, { id: string; title: string; readable: boolean; route?: string; reason?: string; frontierCalls: number; searchable: boolean | null }>();
  const publications = new Map<string, { status: string; at: number }>();
  const runStart = ordered.find(event => event.type === 'run_started');
  const startedAt = runStart ? Date.parse(runStart.timestamp) : NaN;
  let legacySearchable: number | null = null;
  let firstPublication = Infinity;
  for (const event of ordered) {
    const payload = event.payload;
    const id = typeof payload.document_id === 'string' ? payload.document_id
      : event.instance_id.endsWith(':extract') ? event.instance_id.slice(0, -8)
        : event.instance_id.endsWith(':jev') ? event.instance_id.slice(0, -4)
          : event.instance_id.endsWith(':interpret') ? event.instance_id.slice(0, -10) : null;
    if (id) {
      const document = documents.get(id) || { id, title: typeof payload.label === 'string' && event.type === 'worker_created' ? payload.label : id, readable: false, frontierCalls: 0, searchable: null };
      if (event.type === 'worker_created' && typeof payload.label === 'string') document.title = payload.label;
      if (event.type === 'node_completed' && event.instance_id.endsWith(':extract') && payload.state === 'succeeded') document.readable = true;
      if (event.type === 'decision' && event.instance_id.endsWith(':jev')) {
        if (typeof payload.selected_route === 'string') document.route = payload.selected_route;
        if (typeof payload.policy_reason === 'string') document.reason = payload.policy_reason;
      }
      if (event.type === 'node_started' && event.instance_id.endsWith(':interpret') && payload.state === 'running') document.frontierCalls++;
      documents.set(id, document);
    }
    if (event.type === 'node_completed' && typeof payload.publication === 'object' && payload.publication !== null) {
      const publication = payload.publication as Record<string, unknown>;
      if (typeof publication.document_id === 'string' && typeof publication.status === 'string') {
        const at = Date.parse(String(publication.committed_at));
        publications.set(publication.document_id, { status: publication.status, at });
        if (publication.status === 'searchable' && Number.isFinite(at)) firstPublication = Math.min(firstPublication, at);
      }
    }
    // Old graphs recorded only the completed batch index operation. Its count is
    // valid evidence, but its timestamp is not a per-document commit timestamp.
    if (event.type === 'node_completed' && event.instance_id === 'index' && payload.state === 'succeeded' && typeof payload.output_count === 'number') legacySearchable = payload.output_count;
  }
  for (const [id, publication] of publications) {
    const document = documents.get(id);
    if (document) document.searchable = publication.status === 'searchable';
  }
  const completed = [...ordered].reverse().find(event => event.type === 'run_completed');
  const endedAt = completed ? Date.parse(completed.timestamp) : NaN;
  const searchables = [...publications.values()].filter(publication => publication.status === 'searchable');
  const result = completed?.payload.result;
  const finalIndexed = result && typeof result === 'object' && 'indexed_count' in result && typeof result.indexed_count === 'number' ? result.indexed_count : null;
  return {
    ...usage, documents: [...documents.values()], complete: !!completed,
    eventRange: ordered.length ? `${ordered[0].sequence}–${ordered.at(-1)!.sequence}` : 'No events',
    searchable: publications.size ? searchables.length : legacySearchable ?? finalIndexed,
    firstSearchableSeconds: Number.isFinite(startedAt) && Number.isFinite(firstPublication) && firstPublication >= startedAt ? (firstPublication - startedAt) / 1000 : null,
    completionSeconds: Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt >= startedAt ? (endedAt - startedAt) / 1000 : null,
  };
}
