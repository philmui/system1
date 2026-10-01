import { exampleRoute, type ExamplePage } from './reviewExample';
import { reviewLayout, roundedRoute } from './reviewLayout';

export type Strategy = 'system1' | 'frontier';
export type ReviewNodeId = 'input' | 'agent' | 'redact' | 'attorney' | 'produce' | 'aside' | 'withheld';
export type ReviewEdgeId = 'input-agent' | 'agent-redact' | 'agent-attorney' | 'agent-produce' | 'agent-aside' | 'redact-produce' | 'attorney-produce' | 'attorney-withheld' | 'attorney-redact';
export interface Scenario {
  systemSeconds: number;
  frontierSeconds: number;
  redactSeconds: number;
  wrapperSeconds: number;
  systemCost: number;
  frontierCost: number;
  redactCost: number;
}

// Editable teaching assumptions, not provider prices, measurements or quality estimates.
export const defaultScenario: Scenario = {
  systemSeconds: .35, frontierSeconds: 3.8, redactSeconds: 2.5, wrapperSeconds: .05,
  systemCost: .0001, frontierCost: .006, redactCost: .008,
};
export const scenarioFields: { key: keyof Scenario; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: 'systemSeconds', label: 'System 1 classification', unit: 'seconds / request', min: .05, max: 30, step: .05 },
  { key: 'frontierSeconds', label: 'Frontier classification', unit: 'seconds / request', min: .05, max: 30, step: .05 },
  { key: 'redactSeconds', label: 'LLM redaction', unit: 'seconds / request', min: .05, max: 30, step: .05 },
  { key: 'wrapperSeconds', label: 'AgentGraph checks', unit: 'seconds / page', min: .01, max: 5, step: .01 },
  { key: 'systemCost', label: 'System 1 classification', unit: 'USD / request', min: 0, max: 1, step: .0001 },
  { key: 'frontierCost', label: 'Frontier classification', unit: 'USD / request', min: 0, max: 1, step: .0001 },
  { key: 'redactCost', label: 'LLM redaction', unit: 'USD / request', min: 0, max: 1, step: .0001 },
];

export function validateScenario(scenario: Scenario): boolean {
  return scenarioFields.every(({ key, min, max }) => Number.isFinite(scenario[key]) && scenario[key] >= min && scenario[key] <= max);
}
export interface HumanVerdict { outcome: 'release' | 'withhold'; at: number }
export interface TraceStep {
  id: ReviewNodeId | ReviewEdgeId;
  kind: 'node' | 'edge';
  activity: string;
  start: number;
  end: number;
}
export interface ReviewWorkInterval {
  id: 'classify' | 'rules' | 'redact';
  start: number;
  end: number;
  /** Assumed service time, excluding animation holds and human waiting. */
  seconds: number;
  cost: number;
  provider?: Strategy;
}
export interface ReviewTrace {
  strategy: Strategy;
  steps: TraceStep[];
  work: ReviewWorkInterval[];
  end: number;
  decisionAt: number;
  reviewAt?: number;
  outcome: 'produce' | 'aside' | 'withheld' | 'attorney';
}

/** One service-time scale for both models; never normalize the lanes separately. */
export function reviewClockRate(scenario: Scenario): number {
  const longestMachinePath = Math.max(scenario.systemSeconds, scenario.frontierSeconds) + scenario.wrapperSeconds + scenario.redactSeconds;
  // At the default half pace, .35s vs 3.8s stays visible as .7s vs 7.6s.
  // Handoffs and short code steps have separate reading time, as in Discovery.
  return Math.max(.5, longestMachinePath / 14);
}

export function advanceReviewClock(time: number, elapsed: number, speed: number, end: number, playing = true): number {
  if (!playing) return time;
  return Math.min(end, time + Math.max(0, elapsed) * speed);
}

// Use the longer of the desktop/mobile paths so resizing never changes the clock.
// Like Find & compare, a handoff gets its own readable beat, identical in both lanes.
const handoffSeconds = new Map<ReviewEdgeId, number>();
for (const narrow of [false, true]) for (const edge of reviewLayout(narrow).edges) {
  const points = roundedRoute(edge.points).samples;
  const length = points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0);
  handoffSeconds.set(edge.id, Math.max(handoffSeconds.get(edge.id) || .8, length / 360));
}

export function reviewDecisionComparison(scenario: Scenario): string {
  const { systemSeconds: system, frontierSeconds: frontier } = scenario;
  if (Math.abs(system - frontier) < .000001) return 'Equal assumed decision time';
  return `${frontier > system ? 'Frontier' : 'System 1'} takes ${(Math.max(system, frontier) / Math.min(system, frontier)).toFixed(1)}× as long`;
}

/** Playback seconds drive motion; work intervals carry the separate modeled latency. */
export function buildReviewTrace(page: ExamplePage, strategy: Strategy, scenario: Scenario, verdict?: HumanVerdict): ReviewTrace {
  const steps: TraceStep[] = [];
  const work: ReviewWorkInterval[] = [];
  let cursor = 0;
  const add = (id: TraceStep['id'], kind: TraceStep['kind'], activity: string, seconds: number) => {
    steps.push({ id, kind, activity, start: cursor, end: cursor + seconds });
    cursor += seconds;
  };
  const move = (edge: ReviewEdgeId, activity: string) => add(edge, 'edge', activity, handoffSeconds.get(edge)!);
  const stop = (id: ReviewNodeId, activity: string) => steps.push({ id, kind: 'node', activity, start: cursor, end: Infinity });
  const recordWork = (id: ReviewWorkInterval['id'], node: ReviewNodeId, activity: string, seconds: number, cost = 0, provider?: Strategy) => {
    const duration = provider ? seconds / reviewClockRate(scenario) : Math.max(.16, seconds / reviewClockRate(scenario));
    work.push({ id, start: cursor, end: cursor + duration, seconds, cost, provider });
    add(node, 'node', activity, duration);
  };
  add('input', 'node', 'Page ready to classify', .3);
  move('input-agent', 'Passing the page to classification');
  const decisionSeconds = strategy === 'system1' ? scenario.systemSeconds : scenario.frontierSeconds;
  recordWork('classify', 'agent', strategy === 'system1' ? 'Specialized model · making three decisions' : 'Frontier model · making three decisions', decisionSeconds, strategy === 'system1' ? scenario.systemCost : scenario.frontierCost, strategy);
  const decisionAt = cursor;
  const route = exampleRoute(page);
  recordWork('rules', 'agent', 'Checking answers and applying rules', scenario.wrapperSeconds);
  let outcome: ReviewTrace['outcome'] = route === 'redact' ? 'produce' : route;
  let reviewAt: number | undefined;
  const redact = (incoming: 'agent-redact' | 'attorney-redact') => {
    move(incoming, 'Passing the page to the frontier model for redaction');
    recordWork('redact', 'redact', 'Frontier model · redacting personal information', scenario.redactSeconds, scenario.redactCost, 'frontier');
    move('redact-produce', 'Delivering the redacted page');
  };
  if (route === 'attorney') {
    move('agent-attorney', 'Passing the page to an attorney');
    reviewAt = cursor;
    if (verdict) {
      // A shared verdict cannot bypass either lane's own review checkpoint.
      const releaseAt = Math.max(verdict.at, cursor);
      add('attorney', 'node', 'Awaiting an attorney', releaseAt - cursor);
      if (verdict.outcome === 'withhold') {
        outcome = 'withheld';
        move('attorney-withheld', 'Withholding the page');
      } else {
        outcome = 'produce';
        if (page.pii !== 'no') {
          redact('attorney-redact');
        } else move('attorney-produce', 'Delivering the released page');
      }
    }
  } else if (route === 'redact') {
    redact('agent-redact');
  } else move(`agent-${route}`, route === 'aside' ? 'Setting the page aside' : 'Delivering the cleared page');
  stop(outcome, { produce: 'Ready to produce', aside: 'Set aside', withheld: 'Withheld by attorney', attorney: 'Awaiting an attorney' }[outcome]);
  return { strategy, steps, work, end: cursor, decisionAt, reviewAt, outcome };
}

export function traceSnapshot(trace: ReviewTrace, time: number) {
  const now = Math.max(0, time);
  const current = now === 0 ? trace.steps[0] : trace.steps.find(step => now >= step.start && now < step.end) || trace.steps[0];
  const complete = trace.steps.filter(step => now >= step.end);
  const completedWork = trace.work.filter(interval => now >= interval.end);
  const startedWork = now > 0 ? trace.work.filter(interval => now >= interval.start) : [];
  const reachedNodes = new Set(trace.steps.filter(step => step.kind === 'node' && now >= step.start).map(step => step.id as ReviewNodeId));
  const visitedEdges = new Set(complete.filter(step => step.kind === 'edge').map(step => step.id as ReviewEdgeId));
  const machineSeconds = trace.work.reduce((sum, interval) => sum + interval.seconds * Math.max(0, Math.min(1, (now - interval.start) / (interval.end - interval.start))), 0);
  const activeWork = trace.work.find(interval => now >= interval.start && now < interval.end);
  return {
    current, reachedNodes, visitedEdges, machineSeconds, activeWork,
    progress: Number.isFinite(current.end) && current.end > current.start ? Math.min(1, (now - current.start) / (current.end - current.start)) : 0,
    answersVisible: now >= trace.decisionAt,
    cost: completedWork.reduce((sum, interval) => sum + interval.cost, 0),
    systemCalls: startedWork.filter(interval => interval.provider === 'system1').length,
    frontierCalls: startedWork.filter(interval => interval.provider === 'frontier').length,
    awaiting: current.id === 'attorney',
    finished: now >= trace.end && trace.outcome !== 'attorney',
    redacted: completedWork.some(interval => interval.id === 'redact'),
    result: now >= trace.end ? trace.outcome : null,
  };
}

export function nextTraceStep(traces: ReviewTrace[], time: number): number {
  const marks = traces.flatMap(trace => trace.steps.map(step => step.start));
  return Math.min(...marks.filter(mark => mark > time + .001), Math.max(...traces.map(trace => trace.end)));
}

export function money(value: number): string {
  return `$${value.toFixed(4)}`;
}
