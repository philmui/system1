import { classificationDecision, policyReason } from '../lib/classification';
import { buildClassificationPublicationGraph } from './ClassificationPublicationGraph';
import type { ExecutionGraphInput } from './ExecutionGraph';
import { flowAnnotation, flowNode, flowRoute, type FlowData, type FlowNode, type FlowRole, type FlowRoute } from './FlowCanvas';

/** The policy box exposes the recorded deterministic decision, not a model call.
 * The accept box exposes the direct outcome. Neither creates a backend event. */
export function buildClassificationGraph({ run, execution, selected, focused, expanded, moving, speed, narrow, replayStep, documentLabel }: ExecutionGraphInput) {
  if (run.graph_version === 'atlas-classification-v2') return buildClassificationPublicationGraph({ run, execution, selected, focused, expanded, moving, speed, narrow, replayStep, documentLabel });
  const documentId = focused.replace(/^worker:/, '');
  const all = Array.isArray(run.request.document_ids) ? run.request.document_ids as string[] : [];
  const documents = documentId ? [documentId] : all;
  const decision = documentId ? classificationDecision(execution, documentId) : undefined;
  const decisions = documents.flatMap(id => classificationDecision(execution, id) || []);
  const direct = decisions.filter(item => item.selected_route === 'accept');
  const signal = decision?.signal.kind === 'choice' ? decision.signal : undefined;
  const threshold = decision?.threshold ?? run.configuration?.choice_threshold;
  const reviewed = documentId && (execution.decisions[`${documentId}:interpret`]?.length || execution.review?.items.some(item => item.document_id === documentId));
  const worker = execution.instances[`worker:${documentId}`];
  const cannotIndex = !!documentId && ['failed', 'skipped', 'cancelled', 'interrupted'].includes(worker?.state || '');
  const map = new Map<string, string>();
  const selections: Record<string, string> = {};
  const nodes: FlowNode[] = [], edges: FlowRoute[] = [];
  const state = (members: string[]) => {
    const values = members.flatMap(id => execution.instances[id]?.state || []);
    for (const value of ['running', 'awaiting_review', 'queued']) if (values.includes(value)) return value;
    if (values.includes('succeeded') && values.some(value => ['failed', 'interrupted', 'cancelled'].includes(value))) return 'partially_succeeded';
    for (const value of ['failed', 'interrupted', 'cancelled']) if (values.includes(value)) return value;
    return values.length ? 'succeeded' : 'queued';
  };
  const add = (id: string, title: string, role: FlowRole, x: number, y: number, width: number, height: number, members: string[], data: Partial<FlowData>) => {
    const inspect = members.find(member => execution.decisions[member]?.length) || members.find(member => execution.instances[member]) || members[0] || id;
    selections[id] = inspect;
    nodes.push(flowNode(id, { x, y }, { title, role, state: state(members), selected: selected === inspect, ...data }, width, height));
    members.forEach(member => map.set(member, id));
  };
  const members = (step: string) => documents.map(id => `${id}:${step}`);
  const frontierModel = String(run.configuration?.openai_model || 'Configured frontier model');
  add('dispatch', documentId ? 'Read document' : 'Read documents', 'source', 0, 188, 158, 112, members('extract'), {
    subtitle: '1 · Readable input', detail: documentId ? 'Extract source text' : `${all.length} parallel workers`,
  });
  add('judge', 'System 1 Model', 'jev', 230, 166, 218, 156, members('jev'), {
    subtitle: '2 · Bounded judgment', detail: 'Returns data, not an action',
    signals: signal ? [{ label: 'Category', value: signal.choice }, { label: 'Confidence', value: `${Math.round(signal.confidence * 100)}%` }]
      : [{ label: 'Output', value: 'category + confidence' }],
  });
  add('policy', 'Runtime policy', 'runtime', 530, 166, 244, 156, [], {
    subtitle: '3 · Choose the next action', state: decisions.length ? 'succeeded' : 'queued',
    detail: decision ? policyReason(decision) === 'mixed_purpose' ? 'Mixed-purpose guard triggered' : decision.selected_route === 'accept' ? 'Accept the bounded judgment' : 'Interpretation required' : 'Checks the judgment and guards',
    signals: [{ label: 'Threshold', value: typeof threshold === 'number' ? `${Math.round(threshold * 100)}%` : 'Recorded per decision' }, { label: 'Guards', value: 'Unknown · ties · mixed purpose' }],
  });
  selections.policy = documentId ? `${documentId}:jev` : members('jev').find(id => execution.decisions[id]?.length) || 'judge';
  add('accept', 'Accept category', 'jev', 920, 38, 218, 134, [], {
    subtitle: 'Bounded path', detail: 'No frontier call', state: direct.length ? 'succeeded' : decision ? 'skipped' : 'queued',
    signals: [{ label: documentId ? 'Category' : 'Accepted', value: signal && decision?.selected_route === 'accept' ? signal.choice : documentId ? 'When policy passes' : `${direct.length} documents` }],
    dimmed: !!decision && decision.selected_route !== 'accept',
  });
  selections.accept = selections.policy;
  add('interpret', 'Interpret', 'llm', 920, 346, 218, 156, members('interpret'), {
    subtitle: 'Frontier · only on exception', detail: run.mode === 'test-fixture' ? 'Simulated frontier response' : frontierModel,
    signals: [{ label: 'Output', value: 'Proposal for human review' }],
    ...(decision?.selected_route === 'accept' ? { state: 'skipped', dimmed: true } : {}),
  });
  add('join', 'Collect outcomes', 'runtime', 1280, 166, 218, 156, ['join'], {
    subtitle: '4 · Runtime continuation', detail: `${execution.instances.join?.completed ?? 0} / ${all.length} outcomes returned`,
    signals: [{ label: 'Direct', value: 'Accepted category' }, { label: 'Interpreted', value: 'Proposal, then review' }],
  });
  if (expanded) {
    add('review', 'Human review', 'human', 1280, 416, 218, 132, ['review'], {
      detail: run.request.simulated_review ? 'Simulated in this recording' : 'Approve, correct, or exclude', dimmed: !!decision && !reviewed && decision.selected_route === 'accept',
      ...((documentId && decision?.selected_route === 'accept') ? { state: 'skipped' } : {}),
    });
    add('index', 'Index sources', 'output', 1610, 166, 218, 132, ['index'], { detail: 'Only accepted, readable inputs', dimmed: cannotIndex });
    add('done', 'Results', 'output', 1610, 416, 218, 132, ['done'], { detail: 'Ready for discovery', dimmed: cannotIndex });
  }
  for (const id of documents) {
    map.set(`${id}:policy`, 'policy');
    map.set(`${id}:outcome`, 'join');
    map.set(`worker:${id}`, 'join');
  }
  if (!expanded) for (const id of ['review', 'index', 'done']) map.set(id, 'join');
  if (narrow) {
    const positions: Record<string, [number, number]> = {
      dispatch: [166, 0], judge: [136, 180], policy: [123, 420],
      accept: [-8, 702], interpret: [284, 702], join: [136, 960],
      review: [416, 1210], index: [136, 1210], done: [136, 1430],
    };
    for (const node of nodes) node.position = { x: positions[node.id][0], y: positions[node.id][1] };
  }
  const get = (id: string) => nodes.find(node => node.id === id)!;
  const route = (source: string, target: string, role: FlowRole, label: string, sourceHandle = 'out', targetHandle = 'in') => {
    const a = get(source), b = get(target);
    let from = sourceHandle, to = targetHandle;
    let waypoints: { x: number; y: number }[] = [];
    let labelPosition: { x: number; y: number };
    if (narrow) {
      if (source === 'policy') {
        from = 'bottom'; to = 'top';
        const y = a.position.y + a.height! + 56;
        waypoints = [{ x: a.position.x + a.width! / 2, y }, { x: b.position.x + b.width! / 2, y }];
        labelPosition = { x: b.position.x + b.width! / 2, y: y + 26 };
      } else if (target === 'join') {
        from = 'bottom'; to = source === 'accept' ? 'in-high' : 'in-right';
        const y = b.position.y + (source === 'accept' ? b.height! / 4 : b.height! / 2);
        waypoints = [{ x: a.position.x + a.width! / 2, y }];
        labelPosition = { x: a.position.x + a.width! / 2, y: b.position.y - 40 };
      } else if (source === 'join' && target === 'review') {
        from = 'out'; to = 'top';
        waypoints = [{ x: b.position.x + b.width! / 2, y: a.position.y + a.height! / 2 }];
        labelPosition = { x: b.position.x + b.width! / 2, y: b.position.y - 56 };
      } else if (source === 'review' && target === 'index') {
        from = 'out-left'; to = 'in-right';
        labelPosition = { x: (a.position.x + b.position.x + b.width!) / 2, y: a.position.y + a.height! / 2 - 20 };
      } else {
        from = 'bottom'; to = 'top';
        const y = (a.position.y + a.height! + b.position.y) / 2;
        if (a.position.x + a.width! / 2 !== b.position.x + b.width! / 2) waypoints = [{ x: a.position.x + a.width! / 2, y }, { x: b.position.x + b.width! / 2, y }];
        labelPosition = { x: b.position.x + b.width! / 2 + 74, y };
      }
    } else if (source === 'policy') {
      from = target === 'accept' ? 'out-high' : 'out-low';
      const x = 847;
      waypoints = [{ x, y: a.position.y + a.height! * (target === 'accept' ? .25 : .75) }, { x, y: b.position.y + b.height! / 2 }];
      labelPosition = { x, y: target === 'accept' ? 72 : 386 };
    } else if (target === 'join' && ['accept', 'interpret'].includes(source)) {
      to = source === 'accept' ? 'in-high' : 'in-low';
      const x = 1210;
      waypoints = [{ x, y: a.position.y + a.height! / 2 }, { x, y: b.position.y + b.height! * (source === 'accept' ? .25 : .75) }];
      labelPosition = { x, y: source === 'accept' ? 73 : 391 };
    } else if (source === 'review' && target === 'index') {
      to = 'in-low';
      waypoints = [{ x: 1554, y: a.position.y + a.height! / 2 }, { x: 1554, y: b.position.y + b.height! * .75 }];
      labelPosition = { x: 1554, y: 373 };
    } else if (a.position.x === b.position.x) {
      from = 'bottom'; to = 'top';
      labelPosition = { x: a.position.x + a.width! / 2 + 74, y: (a.position.y + a.height! + b.position.y) / 2 };
    } else {
      const startY = a.position.y + a.height! / 2, endY = b.position.y + b.height! / 2;
      if (startY !== endY) {
        const x = (a.position.x + a.width! + b.position.x) / 2;
        waypoints = [{ x, y: startY }, { x, y: endY }];
      }
      labelPosition = { x: (a.position.x + a.width! + b.position.x) / 2, y: a.position.y + a.height! / 2 - 31 };
    }
    edges.push(flowRoute(source, target, { role, label, waypoints, labelPosition, traversed: false, moving: false, speed }, { source: from, target: to }));
  };
  route('dispatch', 'judge', 'jev', 'Text');
  route('judge', 'policy', 'runtime', 'Judgment');
  route('policy', 'accept', 'jev', 'Accept');
  route('policy', 'interpret', 'llm', 'Escalate');
  route('accept', 'join', 'jev', 'Accepted');
  route('interpret', 'join', 'llm', 'Proposal');
  if (expanded) {
    route('join', 'review', 'human', 'Proposals');
    route('join', 'index', 'output', 'Accepted');
    route('review', 'index', 'human', 'Approved');
    route('index', 'done', 'output', 'Publish');
  }
  const mark = (source: string, target: string) => {
    const edge = edges.find(item => item.source === source && item.target === target);
    if (edge?.data) edge.data.traversed = true;
    return edge;
  };
  const issueRoute = (source: string) => {
    if (source === 'interpret') {
      const edge = edges.find(item => item.source === 'interpret' && item.target === 'join')!;
      edge.data!.label = 'Issue recorded';
      edge.data!.traversed = true;
      return edge;
    }
    const existing = edges.find(item => item.source === source && item.target === 'join');
    if (existing) return existing;
    const a = get(source), b = get('join');
    const lane = source === 'dispatch' ? -72 : -134;
    const waypoints = narrow ? [{ x: lane, y: a.position.y + a.height! / 2 }, { x: lane, y: b.position.y + b.height! / 2 }]
      : [{ x: a.position.x + a.width! / 2, y: lane }, { x: b.position.x + b.width! / 2, y: lane }];
    const edge = flowRoute(source, 'join', { role: 'source', label: source === 'dispatch' ? 'Stop before model calls' : 'Record failed call', traversed: true, waypoints,
      labelPosition: narrow ? { x: 40, y: source === 'dispatch' ? 595 : 665 } : { x: 650, y: lane - 24 } }, narrow ? { source: 'out-left' } : { source: 'out-top', target: 'top' });
    edges.push(edge);
    const extent = flowAnnotation(`issue-extent-${source}`, '', narrow ? lane - 20 : 0, narrow ? 0 : lane - 44);
    extent.style = { width: 1, height: 1, opacity: 0 };
    nodes.push(extent);
    return edge;
  };
  // Split the logged judgment-to-outcome edge at the policy boundary. The
  // runtime's decision is proof of the signal transfer, not another request.
  for (const item of decisions) if (item.signal.kind === 'choice') mark('judge', 'policy');
  for (const edge of execution.edges) {
    const doc = documents.find(id => edge.source_instance_id.startsWith(`${id}:`));
    if (!doc && (edge.source_instance_id.includes(':') || edge.target_instance_id.includes(':'))) continue;
    let source = map.get(edge.source_instance_id) || edge.source_instance_id;
    let target = map.get(edge.target_instance_id) || edge.target_instance_id;
    if (target === 'join' && (source === 'dispatch' || edge.sourceState === 'failed' && ['judge', 'interpret'].includes(source))) {
      issueRoute(source);
      continue;
    }
    if (source === 'judge') {
      const prior = edge.decision || (doc ? classificationDecision(execution, doc) : undefined);
      if (!prior) { if (target === 'join') issueRoute(source); continue; }
      source = 'policy';
      if (target === 'join') target = 'accept';
    }
    if (documentId && ((target === 'review' && !reviewed) || (['index', 'done'].includes(target) && cannotIndex) || (source === 'review' && !reviewed))) continue;
    mark(source, target);
  }
  if (documents.some(id => classificationDecision(execution, id)?.selected_route === 'accept' && execution.instances[`${id}:outcome`])) mark('accept', 'join');
  let current: FlowRoute | undefined;
  if (replayStep) {
    let source = map.get(replayStep.source || '') || replayStep.source;
    let target = map.get(replayStep.target || '') || replayStep.target;
    const recordedEdge = execution.edges.find(edge => edge.sequence === replayStep.sequence);
    const failedTransfer = target === 'join' && (source === 'dispatch' || recordedEdge?.sourceState === 'failed'
      || source === 'judge' && !(recordedEdge?.decision || classificationDecision(execution, documentId || replayStep.documentId || '')));
    if (replayStep.kind === 'transfer' && source === 'judge' && !failedTransfer) {
      source = 'policy';
      if (target === 'join') target = 'accept';
    }
    if (replayStep.kind === 'transfer' && failedTransfer && source) {
      current = issueRoute(source);
    } else if (replayStep.kind === 'transfer' || replayStep.stage === 'route') {
      current = edges.find(edge => edge.source === source && edge.target === target);
    }
    let activeId = map.get(replayStep.instanceId) || replayStep.instanceId;
    if (target === 'accept') activeId = 'accept';
    const at = nodes.find(node => node.id === activeId);
    const currentDocument = documentId || replayStep.documentId;
    if (at) { at.data.active = true; at.data.dimmed = false; at.data.documentLabel = currentDocument ? documentLabel || 'Current document' : 'Batch step'; }
    if (current?.data) {
      current.data.current = true;
      current.data.moving = moving;
      current.data.packetKey = `${run.id}-${replayStep.sequence}`;
      current.data.packetLabel = currentDocument ? String(all.indexOf(currentDocument) + 1).padStart(2, '0') : 'ALL';
      current.data.travelDuration = replayStep.duration / 1000 * .72;
    }
    if (!expanded && ['review', 'index', 'done'].includes(replayStep.stage)) selections.join = replayStep.instanceId;
  }
  if (!documentId) {
    const returns = execution.edges.filter(edge => edge.source_instance_id.endsWith(':interpret') && edge.target_instance_id.endsWith(':outcome'));
    if (returns.some(edge => edge.sourceState === 'failed') && returns.some(edge => edge.sourceState !== 'failed')) {
      const branch = edges.find(edge => edge.source === 'interpret' && edge.target === 'join');
      if (branch?.data) branch.data.label = 'Proposals & issues';
    }
  }
  return { nodes, edges, selections };
}
