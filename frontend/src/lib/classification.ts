import type { Decision, Event } from './api.generated';
import type { Execution } from './events';

export type PolicyReason = 'accepted' | 'below_threshold' | 'mixed_purpose' | 'unknown' | 'tied' | 'exception';
export type ExampleKind = 'direct' | 'uncertain' | 'policy' | 'unknown' | 'unreadable';

export function classificationDecision(execution: Execution, documentId: string) {
  return execution.decisions[`${documentId}:jev`]?.filter(item => item.signal.kind === 'choice').at(-1);
}

/** Prefer the recorded policy reason. Older recordings carry the same rule in prose. */
export function policyReason(decision: Decision): PolicyReason {
  const known: PolicyReason[] = ['accepted', 'below_threshold', 'mixed_purpose', 'unknown', 'tied'];
  if (known.includes(decision.policy_reason as PolicyReason)) return decision.policy_reason as PolicyReason;
  if (decision.selected_route === 'accept') return 'accepted';
  const explanation = decision.explanation.toLowerCase();
  if (explanation.includes('insufficient') || explanation.startsWith('unknown')) return 'unknown';
  if (explanation.includes('tied')) return 'tied';
  if (explanation.includes('proposed agreement') || explanation.includes('mixed-purpose')) return 'mixed_purpose';
  if (explanation.includes('below') && explanation.includes('threshold')) return 'below_threshold';
  return 'exception';
}

export const policyTitles: Record<PolicyReason, string> = {
  accepted: 'Threshold passed; no guard triggered',
  below_threshold: 'Confidence is below the threshold',
  mixed_purpose: 'The mixed-purpose guard overrides confidence',
  unknown: '“Unknown” cannot be accepted automatically',
  tied: 'An exact tie needs interpretation',
  exception: 'The recorded policy requires interpretation',
};

export function exampleKind(execution: Execution, documentId: string): ExampleKind | undefined {
  if (['failed', 'skipped', 'cancelled', 'interrupted'].includes(execution.instances[`worker:${documentId}`]?.state || '')) return undefined;
  const decision = classificationDecision(execution, documentId);
  if (decision) {
    if (decision.selected_route === 'accept') return 'direct';
    const reason = policyReason(decision);
    return reason === 'mixed_purpose' ? 'policy' : reason === 'unknown' ? 'unknown' : 'uncertain';
  }
  if (execution.instances[`${documentId}:extract`]?.state === 'failed') return 'unreadable';
}

export function routeLabel(execution: Execution, documentId: string) {
  const decision = classificationDecision(execution, documentId);
  if (execution.instances[`${documentId}:interpret`]) return 'Frontier called';
  if (decision?.selected_route === 'accept') return 'System 1 only';
  if (decision?.selected_route === 'interpret') return 'Frontier requested';
  if (execution.instances[`${documentId}:extract`]?.state === 'failed') return 'No model calls';
  if (execution.instances[`${documentId}:jev`]?.state === 'failed') return 'Model call failed';
  return 'Route not recorded yet';
}

/** Calls are attempts, documents are distinct inputs. The comparison never mixes them. */
export function classificationUsage(events: Event[]) {
  const readable = new Set<string>(), frontierDocuments = new Set<string>();
  let boundedCalls = 0, frontierCalls = 0;
  for (const event of events) {
    if (event.type === 'node_completed' && event.instance_id.endsWith(':extract') && event.payload.state === 'succeeded') {
      readable.add(event.instance_id.slice(0, -8));
    }
    if (event.type === 'node_started' && event.payload.state === 'running') {
      if (event.instance_id.endsWith(':jev')) boundedCalls++;
      if (event.instance_id.endsWith(':interpret')) {
        frontierCalls++;
        frontierDocuments.add(event.instance_id.slice(0, -10));
      }
    }
  }
  return { readable: readable.size, boundedCalls, frontierCalls, frontierDocuments: frontierDocuments.size };
}
