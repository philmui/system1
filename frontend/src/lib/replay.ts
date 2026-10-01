import type { Decision, EdgePayload, Event, ReviewRequest } from './api.generated';
import type { Execution } from './events';

export type ReplayStage = 'read' | 'classify' | 'route' | 'interpret' | 'collect' | 'review' | 'index' | 'done';
export type ReplayRole = 'source' | 'jev' | 'llm' | 'runtime' | 'human' | 'output';
export interface ReplayStep {
  /** The end of a prefix of the original log; playback never reorders events. */
  cursor: number;
  sequence: number;
  documentId?: string;
  instanceId: string;
  stage: ReplayStage;
  role: ReplayRole;
  kind: 'stage' | 'transfer' | 'decision' | 'review' | 'error' | 'complete';
  title: string;
  detail: string;
  badge?: string;
  source?: string;
  target?: string;
  duration: number;
}

const stages: Record<string, [ReplayStage, ReplayRole]> = {
  dispatch: ['read', 'source'], extract: ['read', 'source'], jev: ['classify', 'jev'],
  interpret: ['interpret', 'llm'], outcome: ['collect', 'runtime'], join: ['collect', 'runtime'],
  review: ['review', 'human'], index: ['index', 'output'], publish: ['index', 'output'], done: ['done', 'output'],
};
const nodeName = (id: string) => id.slice(id.lastIndexOf(':') + 1);
const categoryLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function documentFromInstance(id: string) {
  if (id.startsWith('worker:')) return id.slice(7);
  if (/:(extract|jev|interpret|outcome|publish)$/.test(id)) return id.slice(0, id.lastIndexOf(':'));
  return undefined;
}

export function eventDocumentId(event: Event) {
  if (typeof event.payload.document_id === 'string') return event.payload.document_id;
  if (event.parent_instance_id?.startsWith('worker:')) return event.parent_instance_id.slice(7);
  if (event.type === 'edge_selected') {
    const edge = event.payload as unknown as EdgePayload;
    return documentFromInstance(edge.source_instance_id) || documentFromInstance(edge.target_instance_id);
  }
  return documentFromInstance(event.instance_id);
}

/** Readable milestones, filtered to one document plus the shared batch stages.
 * Every description is derived from the event prefix, never current library metadata. */
export function classificationReplaySteps(events: Event[], followedDocument = '', simulatedReview = false): ReplayStep[] {
  const steps: ReplayStep[] = [];
  const outcomes = new Map<string, string>();
  const failures = new Map<string, string>();
  const reviewed = new Set<string>();
  const published = new Set<string>();
  const independent = events.some(event => event.instance_id.endsWith(':publish'));
  let reviewStarted = false;
  for (const [index, event] of events.entries()) {
    const p = event.payload;
    const documentId = eventDocumentId(event);
    const name = nodeName(event.instance_id);
    const publication = p.publication as { status?: string; document_id?: string } | undefined;
    if (publication?.document_id) {
      if (publication.status === 'searchable') published.add(publication.document_id);
      if (publication.status === 'withdrawn') published.delete(publication.document_id);
    }
    if (documentId && typeof p.outcome === 'string') outcomes.set(documentId, p.outcome);
    if (documentId && event.type === 'node_failed' && name !== 'outcome' && !event.instance_id.startsWith('worker:')) {
      failures.set(documentId, event.instance_id);
    }
    if (documentId && p.state === 'succeeded' && failures.get(documentId) === event.instance_id) failures.delete(documentId);
    if (event.type === 'review_requested') {
      reviewStarted = true;
      (p as unknown as ReviewRequest).items.forEach(item => reviewed.add(item.document_id));
    }
    if (followedDocument && documentId && followedDocument !== documentId) continue;
    const currentDocument = followedDocument || documentId;
    const outcome = currentDocument ? outcomes.get(currentDocument) : undefined;
    const excluded = outcome === 'excluded';
    const failed = outcome === 'failed' || outcome === 'extraction_issue';
    const cannotIndex = excluded || failed;
    const wasReviewed = !!currentDocument && reviewed.has(currentDocument);
    const [stage, role] = stages[name] || ['collect', 'runtime'];
    const base: ReplayStep = {
      cursor: index + 1, sequence: event.sequence, documentId,
      instanceId: event.instance_id, stage, role, kind: 'stage', title: '', detail: '', duration: 240,
    };
    const add = (data: Partial<ReplayStep>) => steps.push({ ...base, ...data });
    const waiting = () => add({
      instanceId: 'join', stage: 'collect', role: 'runtime', documentId: followedDocument || undefined,
      title: cannotIndex ? 'Outcome recorded' : 'Waiting for other documents',
      detail: cannotIndex ? 'This document will not be indexed. The remaining documents continue through the batch.'
        : published.has(currentDocument || '') ? 'This document is already searchable. Other documents continue through review.'
        : simulatedReview ? 'This document is accepted. The batch waits for simulated review of other documents before indexing.'
          : 'This document is accepted. The batch waits for a person to review other documents before indexing.',
      duration: 360,
    });

    if (event.type === 'edge_selected') {
      const edge = p as unknown as EdgePayload;
      const sourceName = nodeName(edge.source_instance_id), targetName = nodeName(edge.target_instance_id);
      // Dispatch and collection bookkeeping are already represented by readable node milestones.
      if (sourceName === 'dispatch' || sourceName === 'outcome' || sourceName === 'publish') continue;
      if (followedDocument && targetName === 'review' && !wasReviewed && outcome !== 'awaiting_review') continue;
      if (followedDocument && cannotIndex && ['index', 'done'].includes(targetName)) continue;
      const [nextStage, nextRole] = stages[targetName] || ['collect', 'runtime'];
      const transfer: Partial<ReplayStep> = {
        kind: 'transfer', instanceId: edge.target_instance_id, stage: nextStage, role: nextRole,
        source: edge.source_instance_id, target: edge.target_instance_id, duration: 820,
      };
      if (sourceName === 'extract' && targetName === 'jev') add({ ...transfer,
        title: 'Text ready for classification', detail: 'The extracted text moves to the System 1 Model.' });
      else if (targetName === 'interpret') add({ ...transfer,
        title: 'Taking the interpretation route', detail: 'The acceptance rule did not pass. An LLM will propose a category for human review.' });
      else if (targetName === 'outcome') add({ ...transfer,
        title: failures.has(currentDocument || '') ? 'Returning an issue' : sourceName === 'interpret' ? 'Returning a proposal' : 'Taking the accepted route',
        detail: failures.has(currentDocument || '') ? 'The worker records the issue so the rest of the batch can continue.'
          : sourceName === 'interpret' ? simulatedReview ? 'The proposal joins the batch. This teaching recording simulates the required human review.' : 'The proposal joins the batch. A person must approve it before indexing.'
            : 'The category passed the acceptance rule. This document can skip LLM interpretation.' });
      else if (targetName === 'review') add({ ...transfer,
        title: simulatedReview ? 'Sending proposals to simulated review' : 'Sending proposals to review',
        detail: simulatedReview ? 'The batch has collected every outcome. A simulated reviewer checks the frontier proposals.' : 'The batch has collected every outcome. Unresolved proposals now go to a person.' });
      else if (targetName === 'publish') add({ ...transfer, title: 'Publish this accepted document',
        detail: sourceName === 'review' ? 'The recorded review authorizes indexing this document.' : 'The accepted category can be indexed while other documents continue.' });
      else if (targetName === 'index') add({ ...transfer,
        // An accepted document did not itself take the human-review branch.
        ...(followedDocument && sourceName === 'review' && !wasReviewed ? { kind: 'stage', source: undefined, target: undefined } : {}),
        title: independent ? 'Reconcile published outcomes' : 'Ready to index', detail: independent ? 'The runtime reconciles per-document publication. Previously published sources remain available.' : 'Every outcome is recorded and required reviews are complete. Accepted documents can be indexed.' });
      else if (targetName === 'done') add({ ...transfer,
        title: 'Publishing the results', detail: 'Indexed sources and the recorded outcomes are being made available.' });
      continue;
    }

    if (event.type === 'decision') {
      const decision = p as unknown as Decision;
      const signal = decision.signal;
      const proposal = signal.kind === 'proposal';
      const choice = signal.kind === 'choice' ? signal.choice : proposal ? signal.category : '';
      add({ kind: 'decision', title: proposal ? 'A category is proposed'
        : decision.selected_route === 'accept' ? 'Runtime accepts the bounded judgment' : 'Runtime requests frontier interpretation',
      ...(!proposal ? { stage: 'route' as const, role: 'runtime' as const, instanceId: `${currentDocument}:policy`, source: event.instance_id, target: `${currentDocument}:policy` } : {}),
      detail: decision.explanation,
      badge: choice ? `${categoryLabel(choice)}${signal.kind === 'choice' ? ` · ${(signal.confidence * 100).toFixed(0)}% confidence` : ' · proposal'}` : undefined,
      duration: proposal ? 700 : 1050 });
      continue;
    }

    if (event.type === 'node_completed' && name === 'publish' && publication) {
      add({ kind: 'complete', stage: 'index', role: 'output', title: publication.status === 'searchable' ? 'Searchable now' : 'Publication withdrawn',
        detail: publication.status === 'searchable' ? 'Indexing committed. Retrieval can use this document before the rest of the batch finishes.' : 'The recorded authorization withdrew this document from retrieval.', duration: 600 });
      continue;
    }
    if (event.type === 'node_failed' && name !== 'outcome' && !event.instance_id.startsWith('worker:')) {
      add({ kind: 'error', title: name === 'extract' ? 'No readable text' : 'Processing failed',
        detail: String(p.detail || 'The issue is recorded and this document is excluded from indexing.'), duration: 850 });
      continue;
    }

    if (event.type === 'node_started' && p.state === 'running') {
      const copy: Record<string, [string, string]> = {
        dispatch: ['Preparing the documents', 'Each document has its own worker. The batch processes documents in parallel.'],
        extract: ['Reading the document', 'Reading retained text and source references for classification.'],
        jev: ['Making a bounded judgment', 'The System 1 Model returns a category and confidence from a fixed rubric. The runtime decides what happens next.'],
        interpret: ['Interpreting the document', 'The LLM examines the ambiguity and proposes a category. A person makes the final decision.'],
        index: ['Indexing accepted documents', 'Accepted, readable documents are being added to the searchable library.'],
        publish: ['Publishing this document', 'Code commits the authorized document to the search index.'],
      };
      if (copy[name] && !(followedDocument && cannotIndex && name === 'index')) {
        add({ title: copy[name][0], detail: copy[name][1] });
      }
      continue;
    }

    if (name === 'outcome' && typeof p.outcome === 'string') {
      add({ title: failed ? 'Document could not be classified' : outcome === 'awaiting_review' ? 'Proposal collected' : 'Classification complete',
        detail: failed ? String(p.detail || 'The issue is recorded. This document will not be indexed.')
          : outcome === 'awaiting_review' ? 'This proposal is waiting for the remaining workers before human review.'
            : published.has(currentDocument || '') ? 'This document is already searchable. The batch continues independently.'
              : independent ? 'The classification outcome is retained separately from publication.' : 'This document is accepted. Indexing starts after the batch finishes and pending reviews are resolved.',
        kind: failed ? 'error' : 'stage', duration: failed ? 700 : 240 });
      continue;
    }
    if (event.type === 'node_completed' && name === 'join') {
      add({ title: 'All documents have returned', detail: 'The batch checks the collected outcomes for proposals that need human review.' });
      continue;
    }
    if (event.type === 'review_requested') {
      if (followedDocument && !wasReviewed) { if (!published.has(followedDocument)) waiting(); }
      else add({ kind: 'review', title: simulatedReview ? 'Simulating human review of the proposal' : 'A person must review the proposal',
        detail: 'Accept, correct, or exclude the proposed category before this document can be indexed.', duration: 800 });
      continue;
    }
    if (event.type === 'node_completed' && event.instance_id.startsWith('worker:') && reviewStarted && wasReviewed) {
      add({ instanceId: 'review', stage: 'review', role: 'human', kind: 'review',
        title: excluded ? 'Document excluded by the reviewer' : simulatedReview ? 'Document approved in simulated review' : 'Document approved by the reviewer',
        detail: excluded ? 'The recorded review excludes this document from indexing.' : simulatedReview ? 'A scripted teaching reviewer approved the proposed category. A live run requires a person’s decision.' : 'A person approved this document for indexing.', duration: 500 });
      continue;
    }
    if (event.type === 'review_resumed') {
      if (followedDocument && !wasReviewed && published.has(followedDocument)) continue;
      add({ instanceId: followedDocument && !wasReviewed ? 'join' : 'review', stage: wasReviewed || !followedDocument ? 'review' : 'collect',
        title: 'Review complete', detail: 'The recorded review decisions let the batch continue. Only accepted documents will be indexed.', duration: 260 });
      continue;
    }
    if (event.type === 'run_completed') {
      const result = p.result as { outcomes?: Record<string, { status: string; category: string }>; indexed_count?: number } | undefined;
      const final = followedDocument ? result?.outcomes?.[followedDocument] : undefined;
      const successful = p.status === 'succeeded' || p.status === 'partially_succeeded';
      const indexed = published.has(followedDocument) || successful && final?.status === 'accepted';
      add({ kind: successful ? 'complete' : 'error', stage: 'done', role: indexed || !followedDocument ? 'output' : 'source',
        instanceId: followedDocument && !indexed ? failures.get(followedDocument) || (excluded ? 'review' : 'join') : 'done',
        documentId: followedDocument || undefined,
        title: !successful && indexed ? `Searchable; batch ${String(p.status).replaceAll('_', ' ')}` : !successful ? `Run ${String(p.status).replaceAll('_', ' ')}`
          : followedDocument ? indexed ? 'Ready for discovery' : 'Document not indexed' : 'Batch processing complete',
        detail: !successful && indexed ? 'This document was published before the batch stopped. Its committed source remains searchable.' : !successful ? String(p.error || 'Playback has reached the end of the recorded run.')
          : followedDocument ? indexed ? 'This document is indexed and available to search. Its recorded journey is complete.'
            : final?.status === 'excluded' ? 'The reviewer excluded this document. Its outcome is preserved in the results.'
              : 'A processing issue prevented indexing. Its outcome is preserved in the results.'
            : `${result?.indexed_count ?? 0} documents were indexed. Every document’s outcome is available below.`,
        badge: final && indexed ? categoryLabel(final.category) : undefined, duration: 260 });
    }
  }
  // A recording can end while other workers are still active. Include its full
  // prefix without inventing a successful outcome for the followed document.
  if (steps.length && steps.at(-1)!.cursor < events.length) {
    const last = steps.at(-1)!;
    steps.push({ ...last, cursor: events.length, sequence: events.at(-1)!.sequence,
      kind: 'stage', source: undefined, target: undefined, title: 'End of the recording so far',
      detail: 'Return to live follow to see new activity. The recorded outcome remains visible in the graph.' });
  }
  return steps;
}

export function documentProgress(execution: Execution, documentId: string): string {
  const publication = execution.instances[`${documentId}:publish`]?.publication;
  if (publication?.status === 'searchable') return 'Indexed';
  if (publication?.status === 'withdrawn') return 'Excluded';
  const result = execution.result?.outcomes as Record<string, { status: string }> | undefined;
  const outcome = result?.[documentId]?.status;
  if (outcome === 'accepted' && ['succeeded', 'partially_succeeded'].includes(execution.status)) return 'Indexed';
  if (outcome === 'excluded') return 'Excluded';
  if (outcome === 'failed' || outcome === 'extraction_issue') return 'Needs attention';
  const worker = execution.instances[`worker:${documentId}`];
  if (!worker) return 'Queued';
  if (worker.state === 'awaiting_review') return 'Needs review';
  if (worker.state === 'failed') return 'Needs attention';
  if (worker.state === 'succeeded') return 'Accepted';
  if (worker.state === 'skipped') return 'Excluded';
  if (['cancelled', 'interrupted'].includes(worker.state)) return categoryLabel(worker.state);
  for (const [suffix, text] of [['interpret', 'Interpreting'], ['jev', 'Classifying'], ['extract', 'Reading']]) {
    if (execution.instances[`${documentId}:${suffix}`]?.state === 'running') return text;
  }
  return worker.state === 'queued' ? 'Queued' : 'Processing';
}

export function readableFilename(filename: string) {
  return filename.replace(/^(atlas|lesson)-/, '').replace(/\.(md|txt|pdf)$/i, '').replaceAll('-', ' ');
}

/** Discovery uses the same brief work / visible handoff rhythm as classification.
 * Cursors always advance over a prefix; routine bookkeeping isn't a visual stop. */
export function executionReplayBeats(events: Event[]) {
  const beats = events.flatMap((event, index) => {
    const duration = event.type === 'edge_selected' ? 820 : event.type === 'decision' ? 1050
      : ['review_requested', 'node_failed'].includes(event.type) ? 800
        : event.type === 'run_completed' || event.type === 'node_started' && event.payload.state === 'running' ? 240 : 0;
    return duration ? [{ cursor: index + 1, duration }] : [];
  });
  if (events.length && beats.at(-1)?.cursor !== events.length) beats.push({ cursor: events.length, duration: 240 });
  return beats;
}
