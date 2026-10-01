import type { Event } from './api.generated';
import { reduceEvents, type Instance } from './events';

export type DiscoveryTreeId = 'judgment' | 'code-plan' | 'frontier-plan' | 'evidence' | 'sources' | 'answer';
export const discoveryTreeLinks: [DiscoveryTreeId, DiscoveryTreeId][] = [
  ['judgment', 'code-plan'], ['judgment', 'frontier-plan'], ['code-plan', 'evidence'], ['frontier-plan', 'evidence'],
  ['evidence', 'sources'], ['evidence', 'answer'], ['judgment', 'sources'],
];
export type DiscoveryTreeNode = {
  id: DiscoveryTreeId; title: string; roles: string; detail: string; status: string;
  role: 'jev' | 'llm' | 'runtime' | 'output'; selected: boolean; active: boolean; failed: boolean;
  componentIds: string[];
};
export type DiscoveryLocation = { node: DiscoveryTreeId; instance: string; attempt: number; sequence: number } | { edge: string; source: DiscoveryTreeId; target: DiscoveryTreeId; sequence: number };

/** A teaching projection of the current prefix, never a prediction from the query. */
export function discoveryTree(events: Event[]) {
  const execution = reduceEvents(events);
  const decision = execution.decisions.intent?.at(-1);
  const route = decision?.selected_route;
  const code = route === 'find', frontier = route === 'plan', unsupported = route === 'unsupported';
  const signal = decision?.signal.kind === 'choice' ? decision.signal : undefined;
  const plan = execution.instances.plan;
  const join = [...events].reverse().find(event => event.instance_id === 'join' && event.type === 'node_completed');
  const outputEdge = execution.edges.filter(edge => edge.source_instance_id === 'join').at(-1);
  const compose = outputEdge?.target_instance_id === 'synthesize';
  const returnSources = outputEdge?.target_instance_id === 'done' || unsupported;
  const instances = Object.values(execution.instances);
  const evidenceWork = instances.filter(item => /:(retrieve|screen)$/.test(item.id));
  const failures = evidenceWork.filter(item => ['failed', 'interrupted', 'cancelled'].includes(item.state));
  const result = execution.result;
  const state = (instance: Instance | undefined) => !instance ? 'Not started' : ({ queued: 'Not started', running: 'Processing', succeeded: 'Complete', skipped: 'Not used', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted' } as Record<string, string>)[instance.state] || instance.state;
  const failed = (instance: Instance | undefined) => !!instance && ['failed', 'cancelled', 'interrupted'].includes(instance.state);
  const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const evidenceCount = count(join?.payload.output_count);
  const claims = Array.isArray(result?.claims) ? result.claims.length : undefined;
  const passages = Array.isArray(result?.passages) ? result.passages.length : undefined;
  const modelWork = execution.instances.synthesize;
  const answerFailed = instances.some(item => /^(synthesize|citations|support(:|$))/.test(item.id) && failed(item));
  const answerStatus = result ? execution.status === 'succeeded' ? 'Result ready' : execution.status.replaceAll('_', ' ')
    : answerFailed ? 'Failed work' : execution.instances.support?.state === 'succeeded' ? 'Preparing results'
      : execution.instances.support ? 'Checking support' : execution.instances.citations?.state === 'succeeded' ? 'Support checks next'
        : execution.instances.citations ? 'Checking citations' : modelWork?.state === 'succeeded' ? 'Citation checks next'
          : modelWork?.state === 'skipped' ? 'Composition skipped' : modelWork?.state === 'running' ? 'Composing' : 'Not started';
  const nodes: DiscoveryTreeNode[] = [
    { id: 'judgment', title: 'Judge intent → apply policy', roles: 'System 1 Model → Runtime', role: 'jev',
      detail: !decision ? 'A bounded signal becomes a configured route.' : `${signal?.choice || 'Unknown intent'} → ${code ? 'code planning' : frontier ? 'frontier planning' : unsupported ? 'scope response' : 'inspect recorded route'}`,
      status: decision ? 'Rule applied' : execution.instances.intent?.state === 'succeeded' ? 'Applying policy' : state(execution.instances.intent), selected: !!execution.instances.intent, active: execution.instances.intent?.state === 'running', failed: failed(execution.instances.intent), componentIds: ['intent'] },
    { id: 'code-plan', title: 'Plan a keyword search', roles: 'Code', role: 'runtime', detail: 'Clear Find · use a fixed search rule',
      status: code ? state(plan) : decision ? 'Not selected' : 'Possible route', selected: code, active: code && plan?.state === 'running', failed: code && failed(plan), componentIds: code ? ['plan'] : [] },
    { id: 'frontier-plan', title: 'Plan the search', roles: 'Frontier model', role: 'llm', detail: 'Complex or uncertain · interpret the request',
      status: frontier ? state(plan) : decision ? 'Not selected' : 'Possible route', selected: frontier, active: frontier && plan?.state === 'running', failed: frontier && failed(plan), componentIds: frontier ? ['plan'] : [] },
    { id: 'evidence', title: 'Retrieve → screen → apply evidence rules', roles: 'Code → System 1 Model → Runtime', role: 'runtime',
      detail: evidenceCount === undefined ? 'Search passages; keep eligible, relevant evidence.' : `${evidenceCount} accepted passages${failures.length ? ' · task failure recorded' : ''} · ${compose ? 'compose selected' : outputEdge ? 'return sources or gap' : 'choose the output next'}`,
      status: join ? failures.length ? 'Partial work' : 'Collected' : evidenceWork.some(item => item.state === 'running') ? 'Processing' : failures.length ? 'Failed work' : evidenceWork.length ? 'Collecting' : unsupported ? 'Not used' : 'Not started',
      selected: evidenceWork.length > 0 || !!join, active: evidenceWork.some(item => item.state === 'running'), failed: failures.length > 0, componentIds: ['retrieve', 'screen'] },
    { id: 'sources', title: unsupported ? 'Return a scope response' : 'Return sources or an evidence gap', roles: 'Code', role: 'runtime',
      detail: result && returnSources ? `${passages === undefined ? 'Passage count unavailable' : `${passages} passages`} · ${result.partial ? 'partial result' : 'recorded result'}` : unsupported ? 'Unsupported intent · no search' : 'Find, or no accepted evidence · no composition',
      status: returnSources ? state(execution.instances.done) : outputEdge ? 'Not selected' : 'Possible route', selected: returnSources, active: returnSources && execution.instances.done?.state === 'running', failed: returnSources && failed(execution.instances.done), componentIds: [] },
    { id: 'answer', title: 'Compose → validate → return', roles: 'Frontier drafts · Code + System 1 check', role: 'llm',
      detail: result && compose ? `${claims === undefined ? 'Claim count unavailable' : `${claims} claims returned`}${result.partial ? ' · partial result' : ''} · inspect checks` : !compose ? 'Answer + evidence required · runtime controls output' : execution.instances.support ? 'System 1 checks support; withheld claims stay out.' : execution.instances.citations ? 'Code checks citation IDs and exact quotes.' : modelWork?.state === 'skipped' ? 'Composition skipped: evidence became unavailable.' : 'Frontier drafts from evidence; checks still apply.',
      status: compose ? answerStatus : outputEdge || unsupported ? 'Not selected' : 'Possible route',
      selected: compose, active: compose && instances.some(item => /^(synthesize|citations|support(:|$))/.test(item.id) && item.state === 'running'), failed: answerFailed, componentIds: ['compose', 'citations', 'support'] },
  ];
  const mapEdge = (source: string, target: string, planningRoute: unknown): string | undefined => {
    const planned = planningRoute === 'find' || planningRoute === 'plan';
    if (source === 'intent' && target === 'plan' && planned) return `judgment--${planningRoute === 'find' ? 'code-plan' : 'frontier-plan'}`;
    if (source === 'intent' && target === 'done') return 'judgment--sources';
    if (source === 'plan' && (target.endsWith(':retrieve') || target === 'join') && planned) return `${planningRoute === 'find' ? 'code-plan' : 'frontier-plan'}--evidence`;
    if (source === 'join' && target === 'done') return 'evidence--sources';
    if (source === 'join' && target === 'synthesize') return 'evidence--answer';
    return undefined;
  };
  const visited = new Set<string>();
  let planningRoute: unknown;
  const group = (id: string): DiscoveryTreeId | undefined => id === 'intent' ? 'judgment'
    : id === 'plan' ? planningRoute === 'find' ? 'code-plan' : planningRoute === 'plan' ? 'frontier-plan' : undefined
      : /:(retrieve|screen)$/.test(id) || id === 'join' ? 'evidence'
        : /^(synthesize|citations|support(:|$))/.test(id) && compose ? 'answer'
          : id === 'done' ? compose ? 'answer' : returnSources ? 'sources' : undefined : undefined;
  // Keep the last meaningful location through queue and worker bookkeeping.
  // Internal handoffs stay inside their grouped capability, never on another branch.
  let location: DiscoveryLocation = { node: 'judgment', instance: 'intent', attempt: 1, sequence: 0 };
  for (const event of events) {
    if (event.type === 'decision' && event.instance_id === 'intent') planningRoute = event.payload.selected_route;
    if (event.type === 'edge_selected') {
      const source = String(event.payload.source_instance_id), target = String(event.payload.target_instance_id);
      const mapped = mapEdge(source, target, planningRoute);
      if (mapped) { visited.add(mapped); const [from, to] = mapped.split('--') as [DiscoveryTreeId, DiscoveryTreeId]; location = { edge: mapped, source: from, target: to, sequence: event.sequence }; }
      else if (group(source) && group(source) === group(target)) location = { node: group(target)!, instance: target, attempt: event.attempt, sequence: event.sequence };
    } else if (['node_started', 'node_completed', 'node_failed', 'decision'].includes(event.type) && event.payload.state !== 'queued') {
      const node = group(event.instance_id);
      if (node) location = { node, instance: event.instance_id, attempt: event.attempt, sequence: event.sequence };
    }
  }
  const current = 'edge' in location ? location.edge : undefined;
  const edges = discoveryTreeLinks.filter(([source, target]) => source !== 'judgment' || target !== 'sources' || visited.has('judgment--sources')).map(([source, target]) => ({
    id: `${source}--${target}`, source, target, visited: visited.has(`${source}--${target}`), current: current === `${source}--${target}`,
  }));
  return { nodes, edges, decision, outputEdge, evidenceCount, execution, location,
    receipt: !decision ? 'System 1 returns a signal. Runtime rules select the work.' : unsupported ? 'The runtime stops an out-of-scope request before search.' : !outputEdge ? code ? 'The runtime chose a code plan. No frontier planning was needed.' : 'The runtime chose frontier planning for this request.'
      : compose ? 'The runtime permits composition because this request needs an answer and has accepted evidence.' : evidenceCount === 0 ? 'No accepted evidence: the runtime returns a gap without composing an answer.' : 'The runtime returns passages without frontier composition.',
  };
}
