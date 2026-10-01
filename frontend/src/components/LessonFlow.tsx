/** @jsxImportSource react */
import { useMemo } from 'react';
import type { Run, Event, MeasuredClassificationStrategy, MeasuredComponent, ProviderMeta } from '../lib/api.generated';
import { reduceEvents } from '../lib/events';
import { classificationDecision, runtimeRuleLabel } from '../lib/classification';
import { lessonState } from '../lib/lessonState';
import type { ReplayStep } from '../lib/replay';
import { useMediaQuery } from '../lib/useMediaQuery';
import { lessonLayout, type LessonLayoutMode } from '../lib/lessonLayout';
import { lessonTiming } from '../lib/lessonTiming';
import { duration } from '../lib/timing';
import { measuredMs } from '../lib/performanceReport';
import { frontierModelLabel } from '../lib/frontierModels';
import { classificationDocumentLabel, type ClassificationJourneyStep } from '../lib/classificationJourney';
import type { LiveInterpretState } from './LiveInterpret';
import { Icon } from './Icon';
import { FlowCanvas, flowNode, flowRoute, type FlowData, type FlowRole, type FlowNode, type FlowRoute } from './FlowCanvas';

interface MeasurementOverlay {
  measurement?: MeasuredClassificationStrategy;
  measurementReady?: boolean;
  measurementPending?: boolean;
  measurementError?: string;
  journey?: { step: ClassificationJourneyStep; cycle: number };
}

function followDocument(nodes: FlowNode[], edges: FlowRoute[], label: string, nodeId?: string, edgeId?: string, packetKey = '', travelDuration = 1) {
  for (const node of nodes) {
    node.data.documentLabel = node.id === nodeId ? `Document ${label} · here` : undefined;
    if (nodeId || edgeId) node.data.active = node.id === nodeId;
    node.ariaLabel = flowNode(node.id, node.position, node.data).ariaLabel;
  }
  for (const edge of edges) if (edge.data && edge.id === edgeId) Object.assign(edge.data, {
    current: true, dimmed: false, moving: true, packetLabel: label, packetKey, travelDuration,
  });
}

/** A returned live strategy is independent of every prepared replay event. */
function measuredLessonGraph({ measurement, measurementReady = false, measurementPending = false, measurementError, mode }: MeasurementOverlay & { mode: LessonLayoutMode }) {
  const ready = measurementReady && !measurementPending && measurementError === undefined;
  const result = measurementReady || measurementPending || measurementError !== undefined ? undefined : measurement;
  const find = (id: MeasuredComponent['id']) => result?.components.filter(component => component.id === id).at(-1);
  const judge = find('judge'), policyStep = find('policy'), interpret = find('interpret');
  const judgment = judge?.status === 'succeeded' ? result?.judgment : undefined;
  const policy = judgment && policyStep?.status === 'succeeded' ? result?.policy : undefined;
  const direct = policy?.selected_route === 'accept';
  const exception = policy?.selected_route === 'interpret';
  const proposal = exception && interpret?.status === 'succeeded' ? result?.interpretation : undefined;
  const accepted = direct && result?.status === 'completed' && result.output_kind === 'accepted_category';
  const policyFailed = policyStep?.status === 'failed' || result?.status === 'failed' && !!judgment && !policy;
  const interpretFailed = interpret?.status === 'failed' || interpret?.status === 'succeeded' && !proposal;
  const system1 = !result || result.id === 'system1';
  const source = (component: MeasuredComponent | undefined, signal?: ProviderMeta | null) => component?.provider || signal;
  const judgeSource = source(judge, judgment), interpretSource = source(interpret, proposal);
  const providerLabel = (name: string, metadata?: ProviderMeta | null) => `${name}${metadata?.provider === 'fixture' ? ' · simulated' : metadata && ['jev', 'openai'].includes(metadata.provider) ? ' · live' : ''}`;
  const frontierName = frontierModelLabel(interpretSource?.configured_model || interpretSource?.returned_model);
  const metric = (component: MeasuredComponent | undefined, metadata?: ProviderMeta | null) => {
    if (!component || metadata?.provider === 'fixture') return undefined;
    const provider = metadata && ['jev', 'openai'].includes(metadata.provider) ? measuredMs(metadata.elapsed_ms) : null;
    // A failed live attempt has an interval, not a successful API response.
    // Successful model nodes require explicit provider timing evidence.
    const local = component.id === 'policy' || component.status === 'failed'
      ? measuredMs(component.elapsed_ms - component.queue_elapsed_ms) : null;
    const value = provider ?? local;
    return value === null ? undefined : duration(value);
  };
  const policyDetail = policy ? runtimeRuleLabel(policy.reason, policy.threshold)
    : policyFailed ? 'Policy did not complete' : 'Route not returned';
  const configs: (FlowData & { id: 'judge' | 'policy' | 'accept' | 'interpret' | 'review' | 'publish' })[] = [
    { id: 'judge', title: 'Judge', role: system1 ? 'jev' : 'llm', subtitle: providerLabel(system1 ? 'System 1 Model' : frontierModelLabel(judgeSource?.configured_model || judgeSource?.returned_model), judgeSource),
      detail: judgment ? `${judgment.choice} · ${Math.round(judgment.confidence * 100)}% confidence` : judge?.status === 'failed' ? 'Attempt failed' : measurementPending ? 'Response pending' : measurementError !== undefined ? 'Measurement unavailable' : ready ? 'Ready to run' : 'No returned judgment',
      state: judge?.status === 'failed' ? 'failed' : judgment ? 'succeeded' : 'queued', onPath: !!judge, active: judge?.status === 'failed', metric: metric(judge, judgeSource) },
    { id: 'policy', title: 'Route', role: 'runtime', subtitle: 'Runtime policy', detail: policyDetail,
      state: policy ? 'succeeded' : policyFailed ? 'failed' : 'queued', onPath: !!policy || policyFailed, active: policyFailed, metric: metric(policyStep) },
    { id: 'accept', title: 'Accept', role: 'runtime', subtitle: 'Bounded category', detail: accepted ? `Category: ${result?.output_category || judgment?.choice}` : 'No frontier call',
      state: accepted ? 'succeeded' : direct && result?.status === 'failed' ? 'failed' : exception ? 'skipped' : 'queued', onPath: !!direct, dimmed: !!exception, active: !!accepted },
    { id: 'interpret', title: 'Interpret', role: 'llm', subtitle: providerLabel(frontierName, interpretSource), detail: proposal ? `Proposal: ${proposal.category}` : interpretFailed ? 'Attempt failed · no proposal' : direct ? 'No request made' : ready ? 'If the runtime selects it' : 'No proposal returned',
      state: direct ? 'skipped' : interpretFailed ? 'failed' : proposal ? 'succeeded' : 'queued', onPath: !!exception, dimmed: !!direct, active: !!proposal || !!interpretFailed, metric: metric(interpret, interpretSource) },
    { id: 'review', title: 'Approve', role: 'human', subtitle: 'Human review', detail: proposal ? 'Approval required to publish' : direct ? 'Not required by this route' : 'Only after a valid proposal',
      state: direct ? 'skipped' : 'outside_preview', onPath: false, dimmed: !!direct, active: false },
    { id: 'publish', title: 'Publish', role: 'output', subtitle: 'Code · search index', detail: 'Makes content searchable', state: 'outside_preview', onPath: false, active: false },
  ];
  const { boxes, routes } = lessonLayout(mode);
  const nodes = configs.map(({ id, ...data }) => flowNode(id, { x: boxes[id].x, y: boxes[id].y }, { ...data, showStatus: true }, boxes[id].width, boxes[id].height));
  const traversed = new Set<string>();
  if (judgment && (policyStep || policyFailed)) traversed.add('judge--policy');
  if (direct) traversed.add('policy--accept');
  if (exception) traversed.add('policy--interpret');
  const labels: Record<string, { label: string; role: FlowRole; dimmed?: boolean }> = {
    'judge--policy': { label: 'Signal', role: 'runtime' },
    'policy--accept': { label: 'Accept', role: 'jev', dimmed: !!exception },
    'policy--interpret': { label: 'Exception', role: 'llm', dimmed: !!direct },
    'interpret--review': { label: 'Later', role: 'human', dimmed: true },
    'accept--publish': { label: 'Later', role: 'jev', dimmed: true },
    'review--publish': { label: 'If approved', role: 'human', dimmed: true },
  };
  const edges = routes.map(route => {
    const id = `${route.source}--${route.target}`;
    return flowRoute(route.source, route.target, { ...labels[id], traversed: traversed.has(id), current: false, moving: false,
      waypoints: [], curveControls: route.curveControls, labelPosition: route.labelPosition }, { source: route.sourceHandle, target: route.targetHandle });
  });
  return { nodes, edges };
}

/** A focused teaching projection. States always come from the visible event prefix. */
export function buildLessonGraph({ run, events, documentId, current, mode, live, measurement, measurementReady, measurementPending, measurementError, journey }: {
  run: Run; events: Event[]; documentId: string; current?: ReplayStep; mode: LessonLayoutMode; live?: LiveInterpretState;
} & MeasurementOverlay) {
    const documentLabel = classificationDocumentLabel(run.request.document_ids, documentId);
    if (measurement || measurementReady || measurementPending || measurementError !== undefined) {
      const graph = measuredLessonGraph({ measurement, measurementReady, measurementPending, measurementError, mode });
      const validResult = measurement && !measurementReady && !measurementPending && measurementError === undefined;
      const step = validResult ? journey?.step : undefined;
      const finalNode = graph.nodes.find(node => node.data.active)?.id;
      followDocument(graph.nodes, graph.edges, documentLabel, step?.node || (step?.edge ? undefined : measurementReady ? 'judge' : finalNode), step?.edge,
        `${documentId}:${journey?.cycle}:${step?.edge}`, (step?.duration || 1000) / 1000);
      return graph;
    }
    const execution = reduceEvents(events);
    const decision = classificationDecision(execution, documentId);
    const signal = decision?.signal.kind === 'choice' ? decision.signal : undefined;
    const direct = decision?.selected_route === 'accept';
    const prefix = `${documentId}:`;
    const nodeState = (name: string) => execution.instances[`${prefix}${name}`]?.state || 'queued';
    const publicationState = lessonState(events, [documentId]);
    const searchable = publicationState.published.has(documentId);
    const publishedCategory = publicationState.publishedCategories.get(documentId);
    const proposal = execution.decisions[`${prefix}interpret`]?.at(-1)?.signal;
    const pending = execution.review?.items.some(item => item.document_id === documentId) || execution.instances[`worker:${documentId}`]?.state === 'awaiting_review';
    const wasReviewed = events.some(event => event.type === 'review_requested' && (event.payload.items as { document_id: string }[] | undefined)?.some(item => item.document_id === documentId));
    const excluded = execution.instances[`worker:${documentId}`]?.state === 'skipped';
    const reviewAuthorized = events.some(event => event.type === 'review_resumed' &&
      (event.payload.decisions as { document_id: string; action: string }[] | undefined)?.some(item => item.document_id === documentId && ['accept', 'correct'].includes(item.action)))
      || wasReviewed && execution.instances[`worker:${documentId}`]?.state === 'succeeded';
    const workerState = execution.instances[`worker:${documentId}`]?.state;
    const stoppedReview = wasReviewed && workerState && ['cancelled', 'interrupted', 'failed'].includes(workerState) ? workerState : undefined;
    const humanState = direct || excluded ? 'skipped' : reviewAuthorized ? 'succeeded' : stoppedReview || (pending ? 'awaiting_review' : 'queued');
    const { boxes, routes } = lessonLayout(mode);
    const timing = lessonTiming(run, events, documentId);
    const configs: { id: keyof typeof boxes; title: string; role: FlowRole; subtitle: string; detail: string; state: string; onPath: boolean; dimmed?: boolean }[] = [
      { id: 'judge', title: 'Judge', role: 'jev', subtitle: 'System 1 Model', detail: signal ? `${signal.choice} · ${Math.round(signal.confidence * 100)}%` : 'Category + confidence', state: nodeState('jev'), onPath: nodeState('jev') !== 'queued' },
      { id: 'policy', title: 'Route', role: 'runtime', subtitle: 'Runtime policy', detail: decision?.policy_reason === 'mixed_purpose' ? 'Proposed-terms guard' : decision ? direct ? 'Acceptance rule passed' : 'Interpretation required' : 'Threshold + guards', state: decision ? 'succeeded' : 'queued', onPath: !!decision },
      { id: 'accept', title: 'Accept', role: 'runtime', subtitle: 'Bounded category', detail: 'No frontier call', state: direct ? 'succeeded' : decision ? 'skipped' : 'queued', onPath: !!direct, dimmed: !!decision && !direct },
      { id: 'interpret', title: 'Interpret', role: 'llm', subtitle: 'Frontier model', detail: proposal?.kind === 'proposal' ? `Proposal: ${proposal.category}` : 'Propose a category', state: direct ? 'skipped' : nodeState('interpret'), onPath: !!decision && !direct, dimmed: direct },
      { id: 'review', title: excluded ? 'Excluded' : 'Approve', role: 'human', subtitle: 'Human review', detail: excluded ? 'Publication denied' : run.request.simulated_review ? 'Simulated checkpoint' : 'Approve, edit, or exclude', state: humanState, onPath: !!decision && !direct, dimmed: direct },
      { id: 'publish', title: searchable ? 'Searchable' : 'Publish', role: 'output', subtitle: 'Code · search index', detail: searchable ? `Category: ${publishedCategory || 'accepted'}` : excluded ? 'Not authorized' : run.graph_version.includes('v2') ? 'After authorization' : 'After batch review', state: excluded ? 'skipped' : searchable ? 'succeeded' : nodeState('publish'), onPath: !!decision && !excluded, dimmed: excluded },
    ];
    const stageNode: Record<string, string> = { classify: 'judge', route: 'policy', interpret: 'interpret', review: 'review', index: 'publish', done: 'publish' };
    const batchAccounting = run.graph_version === 'atlas-classification-v2' && current?.instanceId === 'index';
    const active = current && !batchAccounting && !(current.stage === 'done' && !searchable) ? stageNode[current.stage] : undefined;
    const nodes = configs.map(config => flowNode(config.id, { x: boxes[config.id].x, y: boxes[config.id].y }, { ...config, showStatus: true, active: config.id === active,
      metric: config.id === 'accept' || config.id === 'review' && timing.simulatedReview ? undefined : timing.nodes[config.id].primaryDurationMs !== null ? timing.nodes[config.id].display : undefined,
    }, boxes[config.id].width, boxes[config.id].height));
    const edge = (source: string, target: string, role: FlowRole, label: string, traversed: boolean, dimmed = false) => {
      const route = routes.find(item => item.source === source && item.target === target)!;
      return flowRoute(source, target, { role, label, traversed, dimmed, waypoints: [], curveControls: route.curveControls, labelPosition: route.labelPosition },
        { source: route.sourceHandle, target: route.targetHandle });
    };
    const edges = [
      edge('judge', 'policy', 'runtime', 'Signal', !!decision),
      edge('policy', 'accept', 'jev', 'Accept', !!direct, !!decision && !direct),
      edge('policy', 'interpret', 'llm', 'Exception', !!decision && !direct, !!direct),
      edge('interpret', 'review', 'human', 'Proposal', wasReviewed, !!direct),
      edge('accept', 'publish', 'jev', 'Publish', !!direct && !!searchable, !!decision && !direct),
      edge('review', 'publish', 'human', 'Approved', humanState === 'succeeded' && !!searchable, !!direct),
    ];
    if (live && live.status !== 'idle') {
      // This separate real request stops at interpretation. Approval and
      // publication remain context, never work borrowed from the recording.
      const proposal = live.status === 'complete' ? live.response.proposal : undefined;
      for (const node of nodes) {
        node.data.active = node.id === 'interpret';
        if (node.id === 'judge') { node.data.subtitle = 'System 1 Model · prepared'; node.data.metric = undefined; }
        if (node.id === 'interpret') Object.assign(node.data, {
          subtitle: `${frontierModelLabel(proposal?.configured_model || proposal?.returned_model)} · live`, state: proposal ? 'succeeded' : live.status === 'failed' ? 'failed' : 'running',
          detail: proposal ? `Proposal: ${proposal.category}` : live.status === 'failed' ? 'Request failed' : 'Waiting for response',
          metric: proposal ? duration(proposal.elapsed_ms) : undefined, onPath: true, dimmed: false,
        });
        if (node.id === 'review') Object.assign(node.data, { title: 'Approve', detail: proposal ? 'Approval required to publish' : 'Only after a valid proposal', state: 'outside_preview', metric: undefined, active: false, onPath: false, dimmed: false });
        if (node.id === 'publish') Object.assign(node.data, { title: 'Publish', detail: 'Makes content searchable', state: 'outside_preview', metric: undefined, active: false, onPath: false, dimmed: false });
        node.ariaLabel = flowNode(node.id, node.position, node.data).ariaLabel;
      }
      for (const route of edges) if (route.data) {
        route.data.traversed = ['judge--policy', 'policy--interpret'].includes(route.id);
        route.data.current = false;
        route.data.moving = false;
        if (['interpret--review', 'accept--publish', 'review--publish'].includes(route.id)) {
          route.data.label = route.id === 'review--publish' ? 'If approved' : 'Later';
          route.data.dimmed = true;
        }
      }
      return { nodes, edges };
    }
    let activeEdge: string | undefined;
    if (current?.kind === 'decision' && current.stage === 'route') activeEdge = 'judge--policy';
    if (current?.kind === 'transfer') {
      if (current.target?.endsWith(':interpret')) activeEdge = 'policy--interpret';
      else if (current.target?.endsWith(':accept')) activeEdge = 'policy--accept';
      else if (current.target?.endsWith(':outcome') && current.source?.endsWith(':jev')) activeEdge = 'policy--accept';
      else if (current.target === 'review') activeEdge = 'interpret--review';
      else if (current.target?.endsWith(':publish') || current.target === 'index' && run.graph_version !== 'atlas-classification-v2') activeEdge = direct ? 'accept--publish' : 'review--publish';
    }
    // Batch bookkeeping never moves an already published page backwards.
    const restingNode = searchable ? 'publish' : wasReviewed || excluded ? 'review' : proposal ? 'interpret' : direct ? 'accept' : decision ? 'policy' : 'judge';
    const focusedNode = activeEdge ? undefined : searchable || batchAccounting || current?.stage === 'collect' || current?.stage === 'done' ? restingNode : active || restingNode;
    followDocument(nodes, edges, documentLabel, focusedNode, activeEdge, `${documentId}:${current?.sequence}`, (current?.duration || 700) / 1000);
    return { nodes, edges };
}

export function LessonFlow({ run, events, documentId, current, playing, speed, onInspect, live, measurement, measurementReady, measurementPending, measurementError, journey }: {
  run: Run; events: Event[]; documentId: string; current?: ReplayStep; playing: boolean; speed: number; onInspect: () => void; live?: LiveInterpretState;
} & MeasurementOverlay) {
  const phone = useMediaQuery('(max-width: 600px)');
  const compact = useMediaQuery('(max-width: 1279px)');
  const mode = phone ? 'narrow' : compact ? 'compact' : 'wide';
  const measured = !!(measurement || measurementReady || measurementPending || measurementError !== undefined);
  const preview = measured || !!live && live.status !== 'idle';
  const diagram = useMemo(() => buildLessonGraph({ run, events, documentId, current, mode, live, measurement, measurementReady, measurementPending, measurementError, journey }), [run, events, documentId, current, mode, live, measurement, measurementReady, measurementPending, measurementError, journey]);
  const flowing = playing && !diagram.nodes.some(node => node.data.state === 'awaiting_review');
  const edges = useMemo(() => diagram.edges.map(edge => ({ ...edge, data: edge.data ? { ...edge.data, flowing: measured ? flowing && !!edge.data.current : flowing, moving: playing && !!edge.data.current, speed } : undefined })), [diagram.edges, flowing, playing, speed, measured]);
  const caption = journey?.step || (!preview ? current : undefined);
  return <>{caption && <div className="classification-journey-caption" role="status"><span><Icon name="file" size={18} />Document {classificationDocumentLabel(run.request.document_ids, documentId)}</span><div><strong>{caption.title}</strong><p>{caption.detail}</p></div></div>}
    <div className={`lesson-flow lesson-classification-flow layout-${mode}`}><FlowCanvas nodes={diagram.nodes} edges={edges} onSelect={onInspect} layoutKey={`lesson-${mode}`} minFitZoom={.3} fitPadding={.08} label="A document's judgment, routing, interpretation, approval and publication" /></div>
    <div className="lesson-route-key"><span><i />{preview ? measured ? 'Measured route' : 'Interpretation preview' : 'Accented borders follow the selected route'}</span><span><b>✓</b> Complete</span>{preview ? <span><Icon name="info" size={13} />Outside preview: approval &amp; publication</span> : <span>Publication follows authorization</span>}</div></>;
}
