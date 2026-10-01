/** @jsxImportSource react */
import type { ExperimentCoverage, PolicyReceipt } from '../lib/api.generated';
import { Icon } from './Icon';

const ruleLabels: Record<string, string> = {
  accepted: 'Threshold met · no guard',
  below_threshold: 'Below acceptance threshold',
  mixed_purpose: 'Proposed terms guard',
  unknown: 'Insufficient evidence',
  tied: 'Tied category signals',
};
export type Receipt = Pick<PolicyReceipt, 'signal' | 'reason' | 'selected_route' | 'requires_review'>;

export function ExperimentReceipt({ title, receipt, pending = false }: { title: string; receipt?: Receipt; pending?: boolean }) {
  const interpret = receipt?.selected_route === 'interpret';
  return <article className={`experiment-receipt ${receipt ? interpret ? 'route-interpret' : 'route-accept' : ''}`}>
    <header><span>{title}</span><small>{title === 'Original recording' ? 'Retained decision' : 'No model call'}</small></header>
    {receipt ? <>
      <div className="experiment-judgment"><Icon name="jev" size={23} /><strong>{receipt.signal.choice}</strong><span>{Math.round(receipt.signal.confidence * 100)}% confidence</span></div>
      <div className="experiment-rule"><Icon name="workflow" size={18} /><div><small>Runtime rule</small><strong>{ruleLabels[receipt.reason] || receipt.reason}</strong></div></div>
      <div className="experiment-route"><span className="experiment-route-line" aria-hidden="true" /><Icon name={interpret ? 'sparkle' : 'checkCircle'} size={24} /><div><strong>{interpret ? 'Interpret' : 'Accept category'}</strong><span>{interpret ? 'Frontier proposal → human approval' : 'No frontier interpretation'}</span></div></div>
      <small className="experiment-publication-note">{interpret ? 'A proposal cannot publish itself.' : 'Acceptance permits indexing; this simulation publishes nothing.'}</small>
    </> : <div className="experiment-receipt-placeholder"><Icon name="workflow" size={24} /><strong>{pending ? 'Evaluating this rule…' : 'Simulation unavailable'}</strong><span>{pending ? 'Same backend policy · no provider call' : 'Connect the backend to try this change.'}</span></div>}
  </article>;
}

export function ExperimentCoverageView({ original, simulated }: { original: ExperimentCoverage; simulated: ExperimentCoverage }) {
  return <section className="experiment-coverage" aria-labelledby="experiment-coverage-title">
    <div><h2 id="experiment-coverage-title">Across these {simulated.eligible} examples</h2><span>Prepared references · not an accuracy benchmark</span></div>
    <div className="experiment-coverage-grid">
      <div><span>Accepted without review</span><strong>{original.accepted}<Icon name="arrow" size={17} />{simulated.accepted}<small>/ {simulated.eligible}</small></strong></div>
      <div><span>Sent to interpretation</span><strong>{original.escalated}<Icon name="arrow" size={17} />{simulated.escalated}<small>/ {simulated.eligible}</small></strong></div>
      <div className={simulated.accepted_reference_mistakes ? 'experiment-risk' : ''}><span>Accepted category mismatches</span><strong>{original.accepted_reference_mistakes}<Icon name="arrow" size={17} />{simulated.accepted_reference_mistakes}<small>/ {simulated.accepted} accepted</small></strong></div>
      <div className={simulated.accepted_policy_violations ? 'experiment-risk' : ''}><span>Required reviews bypassed</span><strong>{original.accepted_policy_violations}<Icon name="arrow" size={17} />{simulated.accepted_policy_violations}<small>/ {simulated.accepted} accepted</small></strong></div>
    </div>
  </section>;
}
