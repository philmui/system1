import { classificationDecision, policyReason } from '../lib/classification';
import type { ExecutionGraphInput } from './ExecutionGraph';
import { flowAnnotation, flowNode, flowRoute, type FlowData, type FlowNode, type FlowRole, type FlowRoute } from './FlowCanvas';

/** V2 separates each publication from batch accounting. The two Publish boxes
 * are distinct invocations of the same code capability, before/after review. */
export function buildClassificationPublicationGraph({ run, execution, selected, focused, expanded, moving, speed, narrow, replayStep, documentLabel }: ExecutionGraphInput) {
  const documentId = focused.replace(/^worker:/, '');
  const all = Array.isArray(run.request.document_ids) ? run.request.document_ids as string[] : [];
  const documents = documentId ? [documentId] : all;
  const decisions = documents.flatMap(id => classificationDecision(execution, id) || []);
  const decision = documentId ? classificationDecision(execution, documentId) : undefined;
  const signal = decision?.signal.kind === 'choice' ? decision.signal : undefined;
  const directIds = documents.filter(id => classificationDecision(execution, id)?.selected_route === 'accept');
  const exceptionIds = documents.filter(id => classificationDecision(execution, id)?.selected_route === 'interpret');
  const interpreterIds = documents.filter(id => exceptionIds.includes(id) || execution.instances[`${id}:interpret`]);
  const proposalIds = documents.filter(id => execution.decisions[`${id}:interpret`]?.some(item => item.signal.kind === 'proposal'));
  const reviewed = documentId ? proposalIds.includes(documentId) || !!execution.review?.items.some(item => item.document_id === documentId) : proposalIds.length > 0;
  const threshold = decision?.threshold ?? run.configuration?.choice_threshold;
  const publication = (id: string) => execution.instances[`${id}:publish`]?.publication;
  const withdrawnIds = documents.filter(id => publication(id)?.status === 'withdrawn');
  const batchSearchableIds = all.filter(id => publication(id)?.status === 'searchable');
  const batchWithdrawnIds = all.filter(id => publication(id)?.status === 'withdrawn');
  const countDocuments = (count: number) => `${count} ${count === 1 ? 'document' : 'documents'}`;
  const nodes: FlowNode[] = [], edges: FlowRoute[] = [];
  const mapped = new Map<string, string>();
  const selections: Record<string, string> = {};
  const members = (ids: string[], step: string) => ids.map(id => `${id}:${step}`);
  const state = (ids: string[]) => {
    const values = ids.map(id => execution.instances[id]?.state || 'queued');
    for (const value of ['running', 'awaiting_review', 'queued']) if (values.includes(value)) return value;
    if (values.includes('succeeded') && values.some(value => ['failed', 'interrupted', 'cancelled'].includes(value))) return 'partially_succeeded';
    for (const value of ['failed', 'interrupted', 'cancelled']) if (values.includes(value)) return value;
    return values.length ? values.every(value => value === 'skipped') ? 'skipped' : 'succeeded' : 'queued';
  };
  const add = (id: string, title: string, role: FlowRole, x: number, y: number, width: number, height: number, ids: string[], data: Partial<FlowData>) => {
    const inspect = ids.find(item => execution.decisions[item]?.length) || ids.find(item => execution.instances[item]) || ids[0] || id;
    selections[id] = inspect;
    nodes.push(flowNode(id, { x, y }, { title, role, state: state(ids), selected: selected === inspect, ...data }, width, height));
    ids.forEach(item => mapped.set(item, id));
  };
  add('dispatch', documentId ? 'Read document' : 'Read documents', 'source', 0, 196, 158, 112, members(documents, 'extract'), { subtitle: '1 · Readable input', detail: documentId ? 'Extract source text' : `${all.length} parallel workers` });
  add('judge', 'System 1 Model', 'jev', 230, 174, 218, 156, members(documents, 'jev'), {
    subtitle: '2 · Bounded judgment', detail: 'Returns data, not an action',
    signals: signal ? [{ label: 'Category', value: signal.choice }, { label: 'Confidence', value: `${Math.round(signal.confidence * 100)}%` }] : [{ label: 'Output', value: 'category + confidence' }],
  });
  add('policy', 'Runtime policy', 'runtime', 530, 174, 244, 156, [], {
    subtitle: '3 · Choose the next action', state: decisions.length ? 'succeeded' : 'queued',
    detail: decision ? policyReason(decision) === 'mixed_purpose' ? 'Mixed-purpose guard triggered' : decision.selected_route === 'accept' ? 'Accept the bounded judgment' : 'Interpretation required' : 'Checks the judgment and guards',
    signals: [{ label: 'Threshold', value: typeof threshold === 'number' ? `${Math.round(threshold * 100)}%` : 'Recorded per decision' }, { label: 'Guards', value: 'Unknown · ties · mixed purpose' }],
  });
  selections.policy = documentId ? `${documentId}:jev` : members(documents, 'jev').find(id => execution.decisions[id]?.length) || 'judge';
  add('accept', 'Accept category', 'jev', 920, 26, 218, 144, [], {
    subtitle: 'Bounded path', detail: 'No frontier interpretation', state: directIds.length ? 'succeeded' : decision ? 'skipped' : 'queued',
    signals: [{ label: documentId ? 'Category' : 'Accepted', value: decision?.selected_route === 'accept' && signal ? signal.choice : documentId ? 'When policy passes' : `${directIds.length} documents` }],
    dimmed: !!decision && decision.selected_route !== 'accept',
  });
  selections.accept = selections.policy;
  const directPublished = directIds.filter(id => publication(id)?.status === 'searchable');
  add('publish', 'Publish document', 'output', 1220, 26, 218, 144, members(directIds, 'publish'), {
    subtitle: 'Code · independent commit',
    detail: documentId && directPublished.length ? 'Searchable now; others continue' : 'Before batch accounting or review',
    signals: [{ label: 'Searchable', value: documentId ? countDocuments(directPublished.length) : `${directPublished.length} / ${directIds.length} documents` }],
    ...(decision && decision.selected_route !== 'accept' ? { state: 'skipped', dimmed: true } : {}),
  });
  add('interpret', 'Interpret', 'llm', 920, 356, 218, 156, members(interpreterIds, 'interpret'), {
    subtitle: 'Frontier · only on exception', detail: run.mode === 'test-fixture' ? 'Simulated frontier response' : String(run.configuration?.openai_model || 'Configured frontier model'),
    signals: [{ label: 'Output', value: 'Proposal for human review' }],
    ...(decision?.selected_route === 'accept' ? { state: 'skipped', dimmed: true } : {}),
  });
  add('join', 'Collect outcomes', 'runtime', 1540, 196, 218, 156, ['join'], {
    subtitle: '4 · Batch accounting', detail: `${execution.instances.join?.completed ?? 0} / ${all.length} outcomes returned`,
    signals: [{ label: 'Published', value: `${batchSearchableIds.length} already searchable` }, { label: 'Proposals', value: 'Still require review' }],
  });
  if (expanded) {
    add('review', 'Human review', 'human', 1540, 456, 218, 132, ['review'], {
      detail: run.request.simulated_review ? 'Simulated in this recording' : 'Approve, correct, or exclude',
      ...(decision?.selected_route === 'accept' ? { state: 'skipped', dimmed: true } : {}),
    });
    add('reviewed-publish', documentId && withdrawnIds.includes(documentId) ? 'Withdraw source' : 'Publish reviewed', 'output', 1840, 456, 218, 132, members(exceptionIds, 'publish'), {
      subtitle: 'Same publication code', detail: documentId && withdrawnIds.includes(documentId) ? 'Excluded from retrieval' : 'Only after valid review authority',
      ...(decision?.selected_route === 'accept' ? { state: 'skipped', dimmed: true } : {}),
    });
    add('done', 'Batch results', 'output', 1840, 196, 218, 156, ['done'], {
      detail: 'Every outcome stays accounted for', signals: [{ label: 'Searchable', value: countDocuments(batchSearchableIds.length) }, { label: 'Excluded', value: countDocuments(batchWithdrawnIds.length) }],
    });
  }
  for (const id of documents) {
    mapped.set(`${id}:policy`, 'policy'); mapped.set(`${id}:outcome`, 'join'); mapped.set(`worker:${id}`, 'join');
    mapped.set(`${id}:interpret`, 'interpret');
    mapped.set(`${id}:publish`, classificationDecision(execution, id)?.selected_route === 'accept' ? 'publish' : expanded ? 'reviewed-publish' : 'join');
  }
  mapped.set('index', expanded ? 'done' : 'join');
  if (!expanded) { mapped.set('review', 'join'); mapped.set('done', 'join'); }
  if (narrow) {
    const positions: Record<string, [number, number]> = { dispatch: [166, 0], judge: [136, 184], policy: [123, 438], accept: [-8, 722], publish: [-8, 962], interpret: [292, 722], join: [136, 1222], review: [436, 1480], 'reviewed-publish': [436, 1702], done: [136, 1690] };
    for (const node of nodes) node.position = { x: positions[node.id][0], y: positions[node.id][1] };
  }
  const get = (id: string) => nodes.find(node => node.id === id)!;
  const route = (source: string, target: string, role: FlowRole, label: string, handles: { source?: string; target?: string } = {}, waypoints: { x: number; y: number }[] = [], labelPosition?: { x: number; y: number }) => {
    const edge = flowRoute(source, target, { role, label, waypoints, labelPosition, traversed: false, moving: false, speed }, handles);
    edges.push(edge); return edge;
  };
  if (narrow) {
    route('dispatch', 'judge', 'jev', 'Text', { source: 'bottom', target: 'top' }, [], { x: 320, y: 148 });
    route('judge', 'policy', 'runtime', 'Judgment', { source: 'bottom', target: 'top' }, [], { x: 320, y: 390 });
    route('policy', 'accept', 'jev', 'Accept', { source: 'bottom', target: 'top' }, [{ x: 245, y: 648 }, { x: 101, y: 648 }], { x: 101, y: 681 });
    route('policy', 'interpret', 'llm', 'Interpret', { source: 'bottom', target: 'top' }, [{ x: 245, y: 648 }, { x: 401, y: 648 }], { x: 401, y: 681 });
    route('accept', 'publish', 'output', 'Index independently', { source: 'bottom', target: 'top' }, [], { x: 112, y: 916 });
    route('publish', 'join', 'output', 'Published outcome', { source: 'bottom', target: 'in-high' }, [{ x: 101, y: 1261 }], { x: 18, y: 1174 });
    route('interpret', 'join', 'llm', 'Proposal', { source: 'bottom', target: 'in-right' }, [{ x: 401, y: 1300 }], { x: 431, y: 1120 });
    if (expanded) {
      route('join', 'review', 'human', 'Proposals only', { source: 'out-low', target: 'top' }, [{ x: 545, y: 1339 }], { x: 545, y: 1430 });
      route('review', 'reviewed-publish', 'human', 'Review decision', { source: 'bottom', target: 'top' }, [], { x: 560, y: 1648 });
      route('join', 'done', 'runtime', 'Reconcile batch', { source: 'bottom', target: 'top' }, [], { x: 285, y: 1590 });
      route('reviewed-publish', 'done', 'output', 'Outcome', { source: 'out-left', target: 'in-right' }, [], { x: 390, y: 1735 });
    }
  } else {
    route('dispatch', 'judge', 'jev', 'Text', {}, [], { x: 194, y: 222 });
    route('judge', 'policy', 'runtime', 'Judgment', {}, [], { x: 490, y: 222 });
    route('policy', 'accept', 'jev', 'Accept', { source: 'out-high' }, [{ x: 847, y: 213 }, { x: 847, y: 98 }], { x: 847, y: 65 });
    route('policy', 'interpret', 'llm', 'Interpret', { source: 'out-low' }, [{ x: 847, y: 291 }, { x: 847, y: 434 }], { x: 847, y: 391 });
    route('accept', 'publish', 'output', 'Index independently', {}, [], { x: 1179, y: -10 });
    route('publish', 'join', 'output', 'Published outcome', { target: 'in-high' }, [{ x: 1490, y: 98 }, { x: 1490, y: 235 }], { x: 1480, y: 60 });
    route('interpret', 'join', 'llm', 'Proposal', { target: 'in-low' }, [{ x: 1460, y: 434 }, { x: 1460, y: 313 }], { x: 1380, y: 397 });
    if (expanded) {
      route('join', 'review', 'human', 'Proposals only', { source: 'bottom', target: 'top' }, [], { x: 1710, y: 403 });
      route('review', 'reviewed-publish', 'human', 'Review decision', {}, [], { x: 1799, y: 496 });
      route('join', 'done', 'runtime', 'Reconcile batch', {}, [], { x: 1799, y: 235 });
      route('reviewed-publish', 'done', 'output', 'Outcome', { source: 'out-top', target: 'in-bottom' }, [{ x: 1949, y: 404 }], { x: 2020, y: 404 });
    }
  }
  const mark = (source: string, target: string) => {
    const edge = edges.find(item => item.source === source && item.target === target);
    if (edge?.data) edge.data.traversed = true;
    return edge;
  };
  const issue = (source: string) => {
    const existing = edges.find(item => item.source === source && item.target === 'join');
    if (existing?.data) { existing.data.label = source === 'publish' ? 'Publication failed' : 'Issue recorded'; existing.data.traversed = true; return existing; }
    const a = get(source), b = get('join');
    if (!a || !b) return undefined;
    const corridor = source === 'dispatch' ? -80 : -145;
    const waypoints = narrow ? [{ x: corridor, y: a.position.y + a.height! / 2 }, { x: corridor, y: b.position.y + b.height! / 2 }]
      : [{ x: a.position.x + a.width! / 2, y: corridor }, { x: b.position.x + b.width! / 2, y: corridor }];
    const edge = route(source, 'join', 'source', source === 'dispatch' ? 'Stop before model calls' : 'Record failed call', narrow ? { source: 'out-left' } : { source: 'out-top', target: 'top' }, waypoints,
      narrow ? { x: corridor + 50, y: 605 } : { x: 630, y: corridor - 24 });
    edge.data!.traversed = true;
    const extent = flowAnnotation(`issue-extent-${source}`, '', narrow ? corridor - 20 : 0, narrow ? 0 : corridor - 44);
    extent.style = { width: 1, height: 1, opacity: 0 }; nodes.push(extent);
    return edge;
  };
  for (const item of decisions) if (item.signal.kind === 'choice') mark('judge', 'policy');

  const project = (sourceId: string, targetId: string, sourceState?: string, label = ''): FlowRoute | undefined => {
    const doc = documents.find(id => sourceId.startsWith(`${id}:`) || targetId.startsWith(`${id}:`));
    if (!doc && (sourceId.includes(':') || targetId.includes(':'))) return undefined;
    const source = mapped.get(sourceId) || sourceId;
    const target = mapped.get(targetId) || targetId;
    if (source === target) return undefined;
    if (target === 'join' && (source === 'dispatch' || ['judge', 'interpret', 'publish'].includes(source) && sourceState === 'failed')) return issue(source);
    if (source === 'judge' && targetId.endsWith(':policy')) return mark('judge', 'policy');
    if (source === 'judge') {
      if (target === 'publish') { mark('policy', 'accept'); return mark('accept', 'publish'); }
      if (target === 'interpret') return mark('policy', 'interpret');
      if (target === 'join') return issue('judge');
    }
    if (sourceId === 'review' && targetId.endsWith(':publish')) {
      if (!expanded || documentId && !reviewed) return undefined;
      const edge = mark('review', 'reviewed-publish');
      if (edge?.data) edge.data.label = label.toLowerCase().includes('exclud') ? 'Exclude' : 'Approved';
      return edge;
    }
    if (sourceId === 'review' && targetId === 'index') return undefined;
    if (documentId && target === 'review' && !reviewed) return undefined;
    if (sourceId === 'index' && targetId === 'done') return expanded ? mark('join', 'done') : undefined;
    return mark(source, target);
  };
  for (const edge of execution.edges) project(edge.source_instance_id, edge.target_instance_id, edge.sourceState, edge.label);
  if (!documentId) {
    for (const [source, successLabel] of [['interpret', 'Proposals & issues'], ['publish', 'Published & failed']] as const) {
      const returns = execution.edges.filter(edge => edge.source_instance_id.endsWith(`:${source}`) && edge.target_instance_id.endsWith(':outcome'));
      if (returns.some(edge => edge.sourceState === 'failed') && returns.some(edge => edge.sourceState !== 'failed')) {
        const edge = edges.find(item => item.source === source && item.target === 'join');
        if (edge?.data) edge.data.label = successLabel;
      }
    }
  }
  if (replayStep) {
    const recordedEdge = execution.edges.find(edge => edge.sequence === replayStep.sequence);
    const current = replayStep.kind === 'transfer' || replayStep.stage === 'route'
      ? project(replayStep.source || '', replayStep.target || '', recordedEdge?.sourceState, recordedEdge?.label) : undefined;
    const activeId = mapped.get(replayStep.instanceId) || replayStep.instanceId;
    const active = nodes.find(node => node.id === activeId);
    const currentDocument = replayStep.documentId;
    if (active) { active.data.active = true; active.data.dimmed = false; active.data.documentLabel = currentDocument ? documentLabel || 'Current document' : 'Batch step'; }
    if (current?.data) {
      current.data.current = true; current.data.moving = moving;
      current.data.packetKey = `${run.id}-${replayStep.sequence}`;
      current.data.packetLabel = currentDocument ? String(all.indexOf(currentDocument) + 1).padStart(2, '0') : 'ALL';
      current.data.travelDuration = replayStep.duration / 1000 * .72;
    }
    if (!expanded && ['review', 'index', 'done'].includes(replayStep.stage) && activeId === 'join') selections.join = replayStep.instanceId;
  }
  return { nodes, edges, selections };
}
