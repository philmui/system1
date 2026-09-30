import { exampleRoute, type ExamplePage } from './reviewExample';

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
  workSeconds: number;
  cost: number;
  provider?: Strategy;
}
export interface ReviewTrace {
  strategy: Strategy;
  steps: TraceStep[];
  end: number;
  decisionAt: number;
  reviewAt?: number;
  outcome: 'produce' | 'aside' | 'withheld' | 'attorney';
}

/** Presentation holds stay brief. Modeled work and costs retain their original values. */
export function illustratedWorkSeconds(seconds: number) {
  return Math.min(.95, .18 + Math.log1p(Math.max(0, seconds)) * .34);
}

/** Transfer animations are shared presentation time, excluded from machine-time totals. */
export function buildReviewTrace(page: ExamplePage, strategy: Strategy, scenario: Scenario, verdict?: HumanVerdict): ReviewTrace {
  const steps: TraceStep[] = [];
  let cursor = 0;
  const add = (id: TraceStep['id'], kind: TraceStep['kind'], activity: string, seconds: number, workSeconds = 0, cost = 0, provider?: Strategy) => {
    steps.push({ id, kind, activity, start: cursor, end: cursor + seconds, workSeconds, cost, provider });
    cursor += seconds;
  };
  const move = (edge: ReviewEdgeId, activity: string) => add(edge, 'edge', activity, .72);
  const stop = (id: ReviewNodeId, activity: string) => steps.push({ id, kind: 'node', activity, start: cursor, end: Infinity, workSeconds: 0, cost: 0 });
  add('input', 'node', 'Reading the page', .18);
  move('input-agent', 'Passing page to classification');
  const decisionSeconds = strategy === 'system1' ? scenario.systemSeconds : scenario.frontierSeconds;
  add('agent', 'node', 'Making three decisions', illustratedWorkSeconds(decisionSeconds), decisionSeconds, strategy === 'system1' ? scenario.systemCost : scenario.frontierCost, strategy);
  const decisionAt = cursor;
  add('agent', 'node', 'Checking answers and applying rules', .5, scenario.wrapperSeconds);
  const route = exampleRoute(page);
  let outcome: ReviewTrace['outcome'] = route === 'redact' ? 'produce' : route;
  let reviewAt: number | undefined;
  const redact = () => {
    add('redact', 'node', 'Redacting personal information', illustratedWorkSeconds(scenario.redactSeconds), scenario.redactSeconds, scenario.redactCost, 'frontier');
    move('redact-produce', 'Delivering the redacted page');
  };
  if (route === 'attorney') {
    move('agent-attorney', 'Pausing for an attorney');
    reviewAt = cursor;
    if (verdict) {
      // A shared verdict cannot bypass either lane's own review checkpoint.
      const releaseAt = Math.max(verdict.at, cursor + .3);
      add('attorney', 'node', 'Awaiting an attorney', releaseAt - cursor);
      if (verdict.outcome === 'withhold') {
        outcome = 'withheld';
        move('attorney-withheld', 'Withholding the page');
      } else {
        outcome = 'produce';
        if (page.pii !== 'no') {
          move('attorney-redact', 'Released for PII redaction');
          redact();
        } else move('attorney-produce', 'Delivering the released page');
      }
    }
  } else if (route === 'redact') {
    move('agent-redact', 'Sending only this exception to the LLM');
    redact();
  } else move(`agent-${route}`, route === 'aside' ? 'Setting the page aside' : 'Delivering the cleared page');
  stop(outcome, { produce: 'Ready to produce', aside: 'Set aside', withheld: 'Withheld by attorney', attorney: 'Awaiting an attorney' }[outcome]);
  return { strategy, steps, end: cursor, decisionAt, reviewAt, outcome };
}

export function traceSnapshot(trace: ReviewTrace, time: number) {
  const now = Math.max(0, time);
  const current = trace.steps.find(step => now >= step.start && now < step.end) || trace.steps[0];
  const complete = trace.steps.filter(step => now >= step.end);
  const reachedNodes = new Set(trace.steps.filter(step => step.kind === 'node' && now >= step.start).map(step => step.id as ReviewNodeId));
  const visitedEdges = new Set(complete.filter(step => step.kind === 'edge').map(step => step.id as ReviewEdgeId));
  const machineSeconds = trace.steps.reduce((sum, step) => {
    if (!step.workSeconds) return sum;
    const progress = Math.max(0, Math.min(1, (now - step.start) / (step.end - step.start)));
    return sum + step.workSeconds * progress;
  }, 0);
  return {
    current, reachedNodes, visitedEdges, machineSeconds,
    progress: Number.isFinite(current.end) ? Math.min(1, (now - current.start) / (current.end - current.start)) : 0,
    answersVisible: now >= trace.decisionAt,
    cost: complete.reduce((sum, step) => sum + step.cost, 0),
    systemCalls: complete.filter(step => step.provider === 'system1').length,
    frontierCalls: complete.filter(step => step.provider === 'frontier').length,
    awaiting: current.id === 'attorney',
    finished: now >= trace.end && trace.outcome !== 'attorney',
    redacted: complete.some(step => step.id === 'redact'),
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
