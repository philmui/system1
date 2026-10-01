import { useEffect, useMemo, useRef, useState } from 'react';
import type { Document, Run } from '../lib/api.generated';
import type { Execution, Instance } from '../lib/events';
import { label, terminal } from '../lib/api';
import { duration } from '../lib/timing';
import { useMediaQuery } from '../lib/useMediaQuery';
import { documentProgress, readableFilename, type ReplayStep } from '../lib/replay';
import { routeLabel } from '../lib/classification';
import { Icon } from './Icon';
import { ReplayNarrative } from './ReplayNarrative';
import { buildClassificationGraph } from './ClassificationGraph';
import { ClassificationDecision } from './ClassificationLesson';
import { ComponentLegend, FlowCanvas, flowAnnotation, flowNode, flowRoute, type FlowNode, type FlowRole, type FlowRoute } from './FlowCanvas';

function stateOf(instances: (Instance | undefined)[], status: string) {
  const states = instances.filter(Boolean).map(instance => instance!.state);
  if (!states.length) return terminal(status) ? 'skipped' : 'queued';
  if (states.includes('running')) return 'running';
  if (states.includes('awaiting_review')) return 'awaiting_review';
  if (states.includes('queued')) return 'queued';
  if (states.every(state => state === 'succeeded')) return 'succeeded';
  if (states.includes('succeeded')) return 'partially_succeeded';
  return states[0];
}
function measuredMedian(instances: (Instance | undefined)[]) {
  const observed = instances.filter((instance): instance is Instance => !!instance && instance.state !== 'queued');
  const values = observed.flatMap(instance => {
    try {
      const metadata = JSON.parse(instance?.detail || '{}');
      return instance.state === 'succeeded' && ['openai', 'jev'].includes(metadata.provider) && typeof metadata.elapsed_ms === 'number' && Number.isFinite(metadata.elapsed_ms) && metadata.elapsed_ms >= 0 ? [metadata.elapsed_ms as number] : [];
    } catch { return []; }
  }).sort((a, b) => a - b);
  if (!values.length || values.length !== observed.length) return undefined;
  const mid = Math.floor(values.length / 2);
  return `${duration(values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2)}${values.length > 1 ? ' med.' : ''}`;
}
export interface ExecutionGraphInput {
  run: Run; execution: Execution; selected: string | null; focused: string;
  expanded: boolean; moving: boolean; speed: number; narrow?: boolean;
  replayStep?: ReplayStep; documentLabel?: string;
}

/** Component groups share one route; individual requests remain inspectable. */
export function buildExecutionGraph({ run, execution, selected, focused, expanded, moving, speed, narrow = false, replayStep, documentLabel }: ExecutionGraphInput) {
  const classification = run.kind === 'classification';
  if (classification) return buildClassificationGraph({ run, execution, selected, focused, expanded, moving, speed, narrow, replayStep, documentLabel });
  const focusedDocument = focused.replace(/^worker:/, '');
  const workers = focused ? execution.workers.filter(id => id === focused) : execution.workers;
  const instances = Object.values(execution.instances);
  const children = instances.filter(instance => instance.parent && workers.includes(instance.parent));
  const ids = (suffix: string) => children.filter(instance => instance.id.endsWith(suffix)).map(instance => instance.id);
  const nodes: FlowNode[] = [], edges: FlowRoute[] = [];
  const mapped = new Map<string, string>();
  const selections: Record<string, string> = {};
  const expected = classification && Array.isArray(run.request.document_ids) ? run.request.document_ids.length : execution.workers.length;
  const add = (id: string, title: string, role: FlowRole, x: number, y: number, detail: string, members = [id], subtitle?: string) => {
    const values = members.map(member => execution.instances[member]);
    const first = members.find(member => execution.decisions[member]?.length) || members.find(member => execution.instances[member]) || id;
    nodes.push(flowNode(id, { x, y }, { title, role, state: stateOf(values, execution.status), detail, subtitle,
      metric: role === 'jev' || role === 'llm' ? measuredMedian(values) : undefined,
      selected: !!selected && (selected === id || members.includes(selected)),
    }));
    selections[id] = first;
    members.forEach(member => mapped.set(member, id));
    mapped.set(id, id);
  };
  const interpretations = ids(':interpret');
  const judgmentIds = ids(':jev');
  const requestText = (count: number) => `${count} request${count === 1 ? '' : 's'}`;
  if (classification) {
    const detailed = expanded && !!focused;
    const shift = detailed ? 260 : 0;
    const endShift = detailed ? 520 : 0;
    add('dispatch', focused ? 'Read document' : 'Read documents', 'source', 0, 270, focused ? 'Extract readable text' : `${workers.length} of ${expected} inputs`, focused && !detailed ? [`${focusedDocument}:extract`] : detailed ? ['dispatch'] : ['dispatch', ...ids(':extract')], focused ? 'Document input' : 'Input · parallel workers');
    if (detailed) add(`${focusedDocument}:extract`, 'Extract text', 'runtime', 260, 270, 'Readable content', ids(':extract'));
    else ids(':extract').forEach(id => mapped.set(id, 'dispatch'));
    const judgeId = detailed ? `${focusedDocument}:jev` : 'judge';
    const interpretId = detailed ? `${focusedDocument}:interpret` : 'interpret';
    add(judgeId, 'System 1 Model', 'jev', 285 + shift, 270, 'Apply the classification rubric', judgmentIds, focused ? 'Bounded decision' : `Bounded decision · ${requestText(judgmentIds.length)}`);
    add(interpretId, 'Interpret', 'llm', 560 + shift, 490, 'Propose a category for review', interpretations, focused ? 'Frontier LLM' : `Frontier LLM · ${requestText(interpretations.length)}`);
    if (detailed) add(`${focusedDocument}:outcome`, 'Worker outcome', 'runtime', 840 + shift, 270, 'Accepted, proposed, or failed', ids(':outcome'));
    else ids(':outcome').forEach(id => mapped.set(id, 'join'));
    add('join', 'Collect outcomes', 'runtime', 840 + endShift, 270, `${execution.instances.join?.completed ?? 0} / ${execution.instances.join?.expected ?? expected} returned`);
    add('review', 'Human review', 'human', 840 + endShift, 490, execution.review ? `${execution.review.items.length} decisions needed` : 'Approve, correct, or exclude');
    add('index', 'Index sources', 'output', 1115 + endShift, 270, 'Accepted, readable documents');
    add('done', 'Results', 'output', 1115 + endShift, 490, 'Ready for discovery');
    nodes.push(flowAnnotation('inputs-caption', detailed ? '01 / READ & EXTRACT' : '01 / READ', 0, 213));
    nodes.push(flowAnnotation('judge-caption', '02 / CLASSIFY', 285 + shift, 213, 'jev'));
    nodes.push(flowAnnotation('runtime-caption', '03 / RESOLVE', 840 + endShift, 213, 'runtime'));
    nodes.push(flowAnnotation('output-caption', '04 / MAKE SEARCHABLE', 1115 + endShift, 213, 'output'));
    // Edges are recorded before their target starts. Map those targets up front
    // so the document is visible during the transfer, not only after arrival.
    const documentIds = focused ? [focusedDocument] : workers.map(id => id.replace(/^worker:/, ''));
    for (const id of documentIds) {
      mapped.set(`${id}:extract`, detailed ? `${id}:extract` : 'dispatch');
      mapped.set(`${id}:jev`, judgeId);
      mapped.set(`${id}:interpret`, interpretId);
      mapped.set(`${id}:outcome`, detailed ? `${id}:outcome` : 'join');
    }
  } else {
    const retrieval = ids(':retrieve'), screens = ids(':screen');
    const retrieveId = expanded && focused ? retrieval[0] || 'retrieve' : 'retrieve';
    const screenId = expanded && focused ? screens[0] || 'screen' : 'screen';
    add('intent', 'Understand', 'jev', 0, 140, 'Find · summarize · compare');
    add('plan', 'Search plan', execution.instances.plan?.label === 'One lexical search' ? 'runtime' : 'llm', 250, 140,
      execution.instances.plan?.label === 'One lexical search' ? 'One lexical search' : 'Focused retrieval tasks');
    add(retrieveId, 'Retrieve', 'runtime', 500, 140, `${workers.length} parallel task${workers.length === 1 ? '' : 's'}`, retrieval, 'Service · lexical search');
    add(screenId, 'Screen evidence', 'jev', 750, 140, 'Bounded relevance judgment', screens);
    add('join', 'Collect evidence', 'runtime', 1000, 140, 'Merge & deduplicate');
    add('synthesize', 'Compose answer', 'llm', 750, 430, 'Only for complex requests');
    add('citations', 'Check citations', 'runtime', 1000, 430, 'Exact IDs & quotations');
    add('support', 'Check support', 'jev', 1250, 430, 'One judgment per claim', ['support', ...instances.filter(instance => instance.id.startsWith('support:claim-')).map(instance => instance.id)]);
    add('done', 'Results', 'output', 1250, 140, 'Sources & supported claims');
    // A handoff is logged before its destination starts. Keep those endpoints
    // visible while the paper is travelling, including the first worker step.
    for (const worker of workers) {
      const taskId = execution.instances[worker]?.taskId || worker.replace(/^worker:/, '');
      mapped.set(`${taskId}:retrieve`, retrieveId);
      mapped.set(`${taskId}:screen`, screenId);
    }
    // Node roles already name the vertical journey. Desktop column captions
    // would otherwise widen fitView to 1,470 px on a narrow screen.
    if (!narrow) {
      nodes.push(flowAnnotation('request-caption', '01 / REQUEST', 0, -55, 'jev'));
      nodes.push(flowAnnotation('evidence-caption', '02 / EVIDENCE', 500, -55, 'runtime'));
      nodes.push(flowAnnotation('answer-caption', '03 / GROUNDED RESULTS', 1250, -55, 'output'));
    }
  }
  const groupFor = (suffix: string, fallback: string) => mapped.get(ids(suffix)[0]) || (focused && classification ? mapped.get(`${focusedDocument}${suffix}`) : undefined) || fallback;
  const judge = groupFor(':jev', 'judge'), interpret = groupFor(':interpret', 'interpret');
  const extraction = groupFor(':extract', expanded && focused ? 'extract' : 'dispatch'), outcome = groupFor(':outcome', expanded && focused ? 'outcome' : 'join');
  const retrieval = groupFor(':retrieve', 'retrieve'), screen = groupFor(':screen', 'screen');
  if (narrow) {
    const positions: Record<string, [number, number]> = classification
      ? expanded && focused
        ? { dispatch: [0, 0], [extraction]: [0, 192], [judge]: [0, 390], [interpret]: [265, 600], [outcome]: [0, 840], join: [0, 1032], review: [265, 1245], index: [0, 1245], done: [0, 1450] }
        : { dispatch: [0, 0], [judge]: [0, 200], [interpret]: [265, 410], join: [0, 650], review: [265, 870], index: [0, 870], done: [0, 1090] }
      : { intent: [0, 0], plan: [0, 190], [retrieval]: [0, 380], [screen]: [0, 570], join: [0, 760], synthesize: [265, 760], citations: [265, 960], support: [265, 1160], done: [0, 1160] };
    for (const node of nodes) if (positions[node.id]) node.position = { x: positions[node.id][0], y: positions[node.id][1] };
  }
  const existing = new Map(nodes.map(node => [node.id, node]));
  const addEdge = (source: string, target: string, text = '', traversed = false, sequence = 0) => {
    source = mapped.get(source) || source; target = mapped.get(target) || target;
    if (source === target || !existing.has(source) || !existing.has(target)) return;
    const a = existing.get(source)!, b = existing.get(target)!;
    const ax = a.position.x, ay = a.position.y, bx = b.position.x, by = b.position.y;
    let handles: { source?: string; target?: string } = {};
    let waypoints: { x: number; y: number }[] | undefined;
    let labelPosition: { x: number; y: number } | undefined;
    if (narrow) {
      if (classification && (source === 'dispatch' || source === extraction) && target === outcome) {
        handles = { source: 'out-left' };
        waypoints = [{ x: -42, y: ay + 66 }, { x: -42, y: by + 66 }];
        text = '';
      } else if (classification && source === judge && target === interpret) {
        waypoints = [{ x: 237, y: ay + 66 }, { x: 237, y: by + 66 }];
        text = '';
      } else if (classification && source === interpret && target === outcome) {
        handles = { source: 'bottom', target: 'in-right' };
        waypoints = [{ x: ax + 99, y: by + 66 }];
        text = '';
      } else if (classification && source === 'join' && target === 'review') {
        handles = { source: 'out-low' };
        waypoints = [{ x: 237, y: ay + 99 }, { x: 237, y: by + 66 }];
        text = '';
      } else if (classification && source === 'review' && target === 'index') {
        handles = { source: 'out-left-low', target: 'in-right' };
        waypoints = [{ x: 223, y: ay + 99 }, { x: 223, y: by + 66 }];
        text = '';
      } else if (!classification && source === 'support' && target === 'done') {
        handles = { source: 'out-left', target: 'in-right' };
        waypoints = [];
        labelPosition = { x: 232, y: ay + 39 };
        text = 'Supported';
      } else if (!classification && ((source === 'intent' && target === 'done') || ((source === 'plan' || source === retrieval) && target === 'join'))) {
        handles = { source: 'out-left' };
        waypoints = [{ x: -42, y: ay + 66 }, { x: -42, y: by + 66 }];
        text = '';
      } else if (ax === bx && by > ay) {
        handles = { source: 'bottom', target: 'top' };
        waypoints = [];
        labelPosition = { x: ax + 141, y: (ay + 132 + by) / 2 };
      } else if (by === ay && bx > ax) {
        waypoints = [];
        labelPosition = { x: (ax + 198 + bx) / 2, y: ay - 15 };
        if (target === 'synthesize') text = 'Complex';
      }
    } else if (source === judge && target === interpret) {
      handles = { source: 'out-low' };
      waypoints = [{ x: ax + 238, y: ay + 99 }, { x: ax + 238, y: by + 66 }];
      labelPosition = { x: ax + 286, y: ay + 160 };
      text = 'Ambiguous';
    } else if (source === interpret && (target === 'join' || target === outcome)) {
      handles = { target: 'in-low' };
      waypoints = [{ x: bx - 38, y: ay + 66 }, { x: bx - 38, y: by + 99 }];
      labelPosition = { x: bx - 90, y: by + 160 };
      text = 'Proposal';
    } else if ((source === 'dispatch' || source === extraction) && target === outcome) {
      handles = { source: 'out-top', target: 'top' };
      waypoints = [{ x: ax + 99, y: 135 }, { x: bx + 99, y: 135 }];
      labelPosition = { x: (ax + bx) / 2 + 99, y: 109 };
      text = 'Extraction issue';
    } else if (source === 'join' && target === 'review') {
      handles = { source: 'bottom', target: 'top' };
      waypoints = [];
      labelPosition = { x: ax + 149, y: ay + 160 };
      text = 'Review';
    } else if (source === 'review' && target === 'index') {
      handles = { target: 'in-low' };
      waypoints = [{ x: bx - 38, y: ay + 66 }, { x: bx - 38, y: by + 99 }];
      labelPosition = { x: bx - 85, y: by + 160 };
      text = 'Resume';
    } else if (source === 'index' && target === 'done') {
      handles = { source: 'bottom', target: 'top' };
      waypoints = [];
      labelPosition = { x: ax + 147, y: ay + 160 };
      text = 'Publish';
    } else if (!classification && source === 'join' && target === 'synthesize') {
      handles = { source: 'bottom', target: 'top' };
      waypoints = [{ x: ax + 99, y: 347 }, { x: bx + 99, y: 347 }];
      labelPosition = { x: (ax + bx) / 2 + 99, y: 321 };
      text = 'Complex request';
    } else if (!classification && source === 'support' && target === 'done') {
      handles = { source: 'out-top', target: 'in-bottom' };
      waypoints = [];
      labelPosition = { x: ax + 151, y: 352 };
      text = 'Supported';
    } else if (!classification && source === 'intent' && target === 'done') {
      handles = { source: 'out-top', target: 'top' };
      waypoints = [{ x: ax + 99, y: 15 }, { x: bx + 99, y: 15 }];
      labelPosition = { x: 695, y: -13 };
      text = 'Outside scope';
    } else if (!classification && (source === 'plan' || source === retrieval) && target === 'join') {
      handles = { source: 'out-top', target: 'top' };
      waypoints = [{ x: ax + 99, y: 15 }, { x: bx + 99, y: 15 }];
      labelPosition = { x: (ax + bx) / 2 + 99, y: -13 };
      text = source === 'plan' ? 'No tasks' : 'Retrieval issue';
    } else if (ay === by && bx > ax) {
      waypoints = [];
      labelPosition = { x: (ax + 198 + bx) / 2, y: ay + 40 };
    }
    const role = source === interpret ? 'llm' : source === 'review' ? 'human' : b.data.role;
    const current = !classification && traversed && !terminal(execution.status) && sequence >= (execution.edges.at(-1)?.sequence || 0) - 2;
    const workerIndex = execution.workers.indexOf(focused);
    const workerRoute = workerIndex >= 0 && [source, target].some(id => id === retrieval || id === screen);
    const edge = flowRoute(source, target, { role, label: text, traversed, speed, waypoints, labelPosition,
      current, moving: current && moving, packetKey: current ? `${run.id}-${sequence}` : undefined,
      packetLabel: workerRoute ? String(workerIndex + 1).padStart(2, '0') : 'ALL', travelDuration: .66,
    }, handles);
    const prior = edges.findIndex(value => value.id === edge.id);
    if (prior < 0) edges.push(edge); else if (traversed) {
      if (!edge.data!.label) edge.data!.label = edges[prior].data?.label;
      edges[prior] = edge;
    }
  };
  if (classification) {
    if (expanded && focused) addEdge('dispatch', extraction);
    addEdge(extraction, judge);
    addEdge(judge, outcome, 'Accepted');
    addEdge(judge, interpret, 'Ambiguous');
    addEdge(interpret, outcome, 'Proposal');
    if (expanded && focused) addEdge(outcome, 'join');
    addEdge('join', 'review', 'Review');
    addEdge('join', 'index', 'Accepted');
    addEdge('review', 'index', 'Resume');
    addEdge('index', 'done', 'Publish');
  } else {
    addEdge('intent', 'plan'); addEdge('plan', retrieval); addEdge(retrieval, screen); addEdge(screen, 'join');
    addEdge('join', 'done', 'Direct'); addEdge('join', 'synthesize', 'Complex request');
    addEdge('synthesize', 'citations', 'Draft'); addEdge('citations', 'support', 'Valid'); addEdge('support', 'done', 'Supported');
  }
  execution.edges.forEach(edge => addEdge(edge.source_instance_id, edge.target_instance_id, '', true, edge.sequence));
  if (focused && classification && execution.decisions[judgmentIds[0]]?.at(-1)?.selected_route === 'accept') {
    nodes.filter(node => node.id === interpret || node.id === 'review').forEach(node => { node.data.dimmed = true; });
    edges.filter(edge => [interpret, 'review'].includes(edge.source) || [interpret, 'review'].includes(edge.target)).forEach(edge => { edge.data!.dimmed = true; });
  }
  if (focused && classification && ['failed', 'skipped'].includes(execution.instances[focused]?.state)) {
    nodes.filter(node => ['index', 'done'].includes(node.id)).forEach(node => { node.data.dimmed = true; });
    edges.filter(edge => ['index', 'done'].includes(edge.target)).forEach(edge => { edge.data!.dimmed = true; });
  }
  if (classification && replayStep) {
    const source = mapped.get(replayStep.source || '') || replayStep.source;
    const target = mapped.get(replayStep.target || '') || replayStep.target;
    const route = edges.find(edge => edge.source === source && edge.target === target);
    if (route?.data && replayStep.kind === 'transfer') {
      route.data.current = true;
      route.data.dimmed = false;
      route.data.moving = moving;
      route.data.packetKey = `${run.id}-${replayStep.sequence}`;
      const doc = focusedDocument || replayStep.documentId;
      const all = Array.isArray(run.request.document_ids) ? run.request.document_ids : [];
      route.data.packetLabel = doc ? String(all.indexOf(doc) + 1).padStart(2, '0') : 'ALL';
      route.data.travelDuration = replayStep.duration / 1000 * .72;
    }
    const at = nodes.find(node => node.id === (mapped.get(replayStep.instanceId) || replayStep.instanceId));
    if (at) {
      at.data.active = true;
      at.data.dimmed = false;
      at.data.documentLabel = documentLabel || (replayStep.documentId ? 'Current document' : 'Batch step');
    }
    // A provider failure also returns an outcome; it did not pass acceptance.
    if (execution.instances[`${focusedDocument || replayStep.documentId}:jev`]?.state === 'failed') {
      const failureRoute = edges.find(edge => edge.source === judge && edge.target === outcome);
      if (failureRoute?.data) failureRoute.data.label = 'Issue recorded';
    }
  } else if (focused && !classification) {
    const work = children.filter(instance => instance.parent === focused);
    const current = work.find(instance => instance.state === 'running') || work.at(-1);
    const currentId = execution.instances[focused]?.state === 'awaiting_review' ? 'review'
      : ['succeeded', 'partially_succeeded'].includes(execution.status) ? 'done'
        : current ? mapped.get(current.id) : undefined;
    const at = nodes.find(node => node.id === currentId);
    if (at) at.data.documentLabel = current && execution.workers.includes(focused) && ['retrieve', 'screen'].includes(current.node)
      ? `Input ${String(execution.workers.indexOf(focused) + 1).padStart(2, '0')}` : 'Shared step';
  }
  return { nodes: narrow ? nodes.filter(node => node.type !== 'annotation') : nodes, edges, selections };
}

export function ExecutionGraph({ run, execution, recording, selected, onSelect, moving, documents, speed, followedInput, onFollowInput, replayStep, replayHistory, live, onInspect, onSource }: {
  run: Run; documents: Document[]; execution: Execution; selected: string | null;
  recording: Execution;
  onSelect: (id: string | null) => void; moving: boolean; speed: number;
  followedInput: string; onFollowInput: (id: string) => void; replayStep?: ReplayStep; replayHistory: ReplayStep[];
  live: boolean; onInspect: (id: string) => void;
  onSource: (id: string) => void;
}) {
  const narrow = useMediaQuery('(max-width: 760px)');
  const [expanded, setExpanded] = useState(false);
  const focused = followedInput;
  const classification = run.kind === 'classification';
  const tray = useRef<HTMLDivElement>(null);
  const inputs = classification && Array.isArray(run.request.document_ids)
    ? run.request.document_ids.map(id => `worker:${id}`) : execution.workers;
  const workerName = (id: string) => {
    const instance = execution.instances[id];
    return documents.find(document => document.id === (instance?.documentId || id.replace(/^worker:/, '')))?.filename || recording.instances[id]?.filename || instance?.label || 'Input';
  };
  const subject = focused || (replayStep?.documentId ? `worker:${replayStep.documentId}` : '');
  const documentLabel = subject ? `${String(inputs.indexOf(subject) + 1).padStart(2, '0')} · ${readableFilename(workerName(subject))}` : undefined;
  // Changing playback controls must not recreate nodes: React Flow temporarily
  // removes edges while measuring new nodes, which would restart the paper.
  const diagram = useMemo(() => buildExecutionGraph({ run, execution, selected, focused, expanded, moving: true, speed: 1, narrow, replayStep, documentLabel }), [run, execution, selected, focused, expanded, narrow, replayStep, documentLabel]);
  const flowing = moving && execution.status !== 'awaiting_review' && !terminal(execution.status);
  const animatedEdges = useMemo(() => diagram.edges.map(edge => ({ ...edge, data: edge.data ? { ...edge.data,
    flowing, moving: moving && (edge.data.current || edge.data.moving), speed,
  } : undefined })), [diagram.edges, moving, flowing, speed]);
  const focus = (id: string) => { onFollowInput(id); if (!classification) onSelect(id || null); };
  useEffect(() => {
    const element = tray.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (element && tray.current) tray.current.scrollTo({ left: Math.max(0, element.offsetLeft - tray.current.offsetLeft - tray.current.clientWidth / 2 + element.offsetWidth / 2) });
  }, [focused, narrow]);
  return <div className={`graph-wrap ${classification ? 'classification-graph' : ''} ${expanded ? 'graph-detail' : ''}`} data-testid="execution-graph">
    <div className="canvas-toolbar"><span className="runtime-boundary-label"><Icon name="workflow" size={15} />{classification ? 'Follow the routing decision' : 'AgentGraph'}</span>{!classification && <ComponentLegend />}<div className="button-row">
      {classification && <div className="replay-view-toggle" role="group" aria-label="Replay view">
        <button aria-pressed={!!focused} onClick={() => { if (!focused) focus(inputs[0] || ''); }}><Icon name="file" size={13} />Follow document</button>
        <button aria-pressed={!focused} onClick={() => focus('')}><Icon name="layers" size={13} />Batch overview</button>
      </div>}
      <label className="input-picker"><Icon name="file" size={13} /><select aria-label="Follow input" value={focused} onChange={event => focus(event.target.value)}>
        <option value="">All {inputs.length} inputs</option>{inputs.map(id => <option key={id} value={id}>{workerName(id)}</option>)}
      </select></label>
      <button className={`quiet small ${expanded ? 'active' : ''}`} aria-pressed={expanded} onClick={() => { if (!expanded && !focused && inputs[0]) focus(inputs[0]); setExpanded(value => !value); }}><Icon name="layers" size={14} />{classification ? expanded ? 'Decision view' : 'Full workflow' : `${expanded ? 'Collapse' : 'Expand'} workers`}</button>
    </div></div>
    {inputs.length > 0 && <details className={classification ? 'recorded-inputs' : 'discovery-inputs'} open={!classification}>
      <summary>All {inputs.length} documents <span>· routes in the recording</span></summary>
      <div className="run-input-tray" aria-label="Run inputs" ref={tray}>
      {inputs.map((id, index) => <button className={`input-trace-button ${focused === id ? 'selected' : ''} ${!focused && subject === id ? 'is-current' : ''}`} key={id} data-worker-id={id} aria-pressed={focused === id} aria-label={`Follow ${workerName(id)}`} title={workerName(id)} onClick={() => focus(classification ? id : focused === id ? '' : id)}>
        <Icon name="file" size={classification ? 17 : 13} /><small>{String(index + 1).padStart(2, '0')}</small><span className={classification ? 'input-trace-info' : ''}>{classification ? <><strong>{readableFilename(workerName(id))}</strong><small>{routeLabel(recording, id.replace(/^worker:/, ''))}</small></> : readableFilename(workerName(id))}</span><i className={`state-${execution.instances[id]?.state || 'queued'}`} aria-label={label(execution.instances[id]?.state || 'queued')} />
      </button>)}
    </div></details>}
    {classification && <ReplayNarrative step={replayStep} history={replayHistory} filename={subject ? workerName(subject) : undefined}
      documentNumber={inputs.indexOf(subject) + 1} total={inputs.length} live={live} playing={!live && moving} onInspect={onInspect} />}
    <FlowCanvas nodes={diagram.nodes} edges={animatedEdges} onSelect={id => onInspect(diagram.selections[id] || id)} layoutKey={`${expanded}-${focused}-${run.kind}-${narrow}`} minFitZoom={classification ? .3 : .7} />
    {classification && !expanded && <div className="runtime-continuation" aria-label="After outcomes are collected"><span>After collection</span><span><Icon name="human" size={13} />{run.request.simulated_review ? 'Human review (simulated here)' : 'People review frontier proposals'}</span><Icon name="chevron" size={12} /><span>Index accepted documents</span><Icon name="chevron" size={12} /><span>Publish results</span><small>{subject ? documentProgress(execution, subject.replace(/^worker:/, '')) : 'Shared batch steps'}</small></div>}
    <div className="canvas-footnote"><span><Icon name={classification ? 'layers' : 'file'} size={12} />{classification ? `${execution.instances.join?.completed ?? 0} / ${inputs.length} outcomes returned · documents run in parallel` : focused ? 'Following one input · pan to explore shared steps' : 'Select an input · pan & zoom to explore'}</span><span>{classification && <><i className="route-key current" />Current step</>}<i className="route-key" />Recorded path<i className="route-key available" />Available route</span></div>
    {classification && <ClassificationDecision run={run} execution={execution} documentId={subject.replace(/^worker:/, '')} onSource={onSource} />}
  </div>;
}
