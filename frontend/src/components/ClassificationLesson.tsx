/** @jsxImportSource react */
import type { Document, Event, Run } from '../lib/api.generated';
import type { Execution } from '../lib/events';
import { classificationDecision, classificationUsage, exampleKind, policyReason, policyTitles, routeLabel, type ExampleKind } from '../lib/classification';
import { readableFilename } from '../lib/replay';
import { Icon } from './Icon';

const examples: { kind: ExampleKind; title: string; lesson: string; icon: string; role: string }[] = [
  { kind: 'direct', title: 'Clear category', lesson: 'Accept without a frontier call', icon: 'jev', role: 'jev' },
  { kind: 'uncertain', title: 'Uncertain judgment', lesson: 'Ask the frontier model to interpret', icon: 'sparkle', role: 'llm' },
  { kind: 'policy', title: 'Policy exception', lesson: 'A guard can override confidence', icon: 'shield', role: 'runtime' },
];

export function ClassificationExamples({ run, documents, recording, followedInput, onPlay, onCreate, busy }: {
  run: Run; documents: Document[]; recording: Execution; followedInput: string;
  onPlay: (documentId: string) => void; onCreate: () => void; busy: boolean;
}) {
  const ids = Array.isArray(run.request.document_ids) ? run.request.document_ids as string[] : [];
  const files = new Map(documents.map(document => [document.id, document]));
  const teaching = ids.length > 0 && ids.every(id => files.get(id)?.filename.startsWith('lesson-') && files.get(id)?.synthetic);
  const groups = examples.flatMap(example => {
    const matches = ids.filter(id => exampleKind(recording, id) === example.kind);
    if (!matches.length) return [];
    const selected = followedInput.replace(/^worker:/, '');
    const id = matches.includes(selected) ? selected : matches[0];
    return [{ ...example, id, active: matches.includes(selected), filename: files.get(id)?.filename || 'Document', count: matches.length }];
  });
  return <section className="classification-lesson" aria-labelledby="classification-lesson-title">
    <div className="lesson-heading">
      <div><h2 id="classification-lesson-title">Bounded judgment. Frontier on exception.</h2>
        <p>System 1 makes a structured judgment. The runtime checks policy and calls the frontier model only when needed.</p></div>
      {!teaching && <div className="teaching-action"><button className="secondary small" onClick={onCreate} disabled={busy}><Icon name="layers" size={14} />{busy ? 'Opening examples…' : 'Run teaching examples'}</button>
        <small>4 readable documents · current provider settings</small></div>}
      {teaching && <span className="lesson-mode"><Icon name="layers" size={14} />Synthetic teaching set{run.mode === 'test-fixture' ? ' · simulated responses' : ' · live model judgments'}{run.request.simulated_review ? ' · simulated human review' : ''}</span>}
    </div>
    <div className="lesson-instruction"><strong>Choose an example to replay its decision</strong><span>Routes recorded in this run</span></div>
    {groups.length ? <div className="lesson-examples" role="group" aria-label="Recorded decision examples">
      {groups.map(example => <button key={example.kind} className={`lesson-example role-${example.role} ${example.active ? 'selected' : ''}`}
        aria-pressed={example.active} onClick={() => onPlay(example.id)} aria-label={`Replay ${example.title}: ${readableFilename(example.filename)}`}>
        <span className="lesson-example-title"><Icon name={example.icon} size={16} /><strong>{example.title}</strong><Icon name="play" size={11} /></span>
        <span className="lesson-example-purpose">{example.lesson}</span>
        <span className="lesson-example-file"><Icon name="file" size={11} /><span>{readableFilename(example.filename)}</span>{example.count > 1 && <small>+{example.count - 1}</small>}</span>
      </button>)}
    </div> : <p className="lesson-waiting" role="status">Examples appear as the runtime records each document’s route. You can follow any input below.</p>}
  </section>;
}

export function ClassificationDecision({ run, execution, documentId, onSource }: {
  run: Run; execution: Execution; documentId: string; onSource: (id: string) => void;
}) {
  const decision = classificationDecision(execution, documentId);
  const signal = decision?.signal.kind === 'choice' ? decision.signal : undefined;
  const proposal = execution.decisions[`${documentId}:interpret`]?.at(-1)?.signal;
  const unreadable = execution.instances[`${documentId}:extract`]?.state === 'failed';
  const workerState = execution.instances[`worker:${documentId}`]?.state;
  const judgeState = execution.instances[`${documentId}:jev`]?.state || workerState;
  const stoppedJudgment = !signal && ['failed', 'cancelled', 'interrupted'].includes(judgeState || '');
  const interpretationFailed = execution.instances[`${documentId}:interpret`]?.state === 'failed';
  const model = String(run.configuration?.openai_model || 'the configured frontier model');
  if (!documentId) return <div className="decision-evidence batch-policy-note"><Icon name="workflow" size={19} /><p>Each worker gets its own judgment and policy decision. Follow one document to inspect why its route was selected.</p></div>;
  return <div className="decision-evidence" data-testid="decision-evidence">
    <div className="evidence-signal"><span className="evidence-label"><Icon name="jev" size={14} />System 1 returns</span>
      {signal ? <code><span>{signal.choice}</span><b>{Math.round(signal.confidence * 100)}% confidence</b></code> : <strong>{unreadable ? 'No judgment requested' : stoppedJudgment ? `Judgment ${judgeState}` : 'Waiting for a recorded judgment'}</strong>}
      <button className="text-button" onClick={() => onSource(documentId)}><Icon name="file" size={12} />Read this document</button>
    </div>
    <div className="evidence-policy"><span className="evidence-label"><Icon name="workflow" size={14} />Runtime decides</span>
      <strong>{decision ? policyTitles[policyReason(decision)] : unreadable ? 'Unreadable inputs stop here' : stoppedJudgment ? 'Processing stopped before a policy decision' : 'The policy decision will appear here'}</strong>
      <p>{decision ? decision.explanation : unreadable ? 'No readable text means neither model can help. The issue is recorded for this document.' : stoppedJudgment ? 'The runtime retains the processing issue and lets other workers continue.' : 'The configured threshold and additional guards determine whether a judgment is accepted.'}</p>
      {decision && typeof decision.threshold === 'number' && <small>Recorded acceptance threshold: {Math.round(decision.threshold * 100)}%</small>}
    </div>
    <div className="evidence-action"><span className="evidence-label"><Icon name={decision?.selected_route === 'interpret' ? 'sparkle' : 'checkCircle'} size={14} />Selected action</span>
      <strong>{interpretationFailed ? 'Record the failed interpretation' : decision?.selected_route === 'accept' ? 'Accept; skip frontier interpretation' : decision?.selected_route === 'interpret' ? run.mode === 'test-fixture' ? 'Request interpretation (simulated)' : `Request ${model}` : unreadable ? 'Record the extraction issue' : stoppedJudgment ? 'Record the processing issue' : 'No action selected yet'}</strong>
      <p>{interpretationFailed ? 'No interpretation was produced. This document returns an issue so the other workers can continue.' : proposal?.kind === 'proposal' ? <>Proposed category: <b>{proposal.category}</b>. {execution.review?.items.some(item => item.document_id === documentId) || execution.instances[`worker:${documentId}`]?.state === 'awaiting_review' ? 'Awaiting human review.' : run.request.simulated_review ? 'Human review is simulated in this teaching recording.' : 'Every frontier proposal requires human review.'}</>
        : decision?.selected_route === 'accept' ? 'The runtime can continue without a generated interpretation.' : decision?.selected_route === 'interpret' ? 'Interpretation produces a proposal, never automatic approval.' : 'Only the route recorded at this replay step is shown.'}</p>
      {decision && <small>{routeLabel(execution, documentId)}{run.mode === 'test-fixture' ? ' · simulated providers' : ''}</small>}
      {decision?.selected_route === 'interpret' && run.mode === 'test-fixture' && <small>Configured live model: {model}</small>}
    </div>
  </div>;
}

export function ClassificationComparison({ run, events }: { run: Run; events: Event[] }) {
  const usage = classificationUsage(events);
  return <aside className="classification-comparison" aria-label="Frontier usage comparison">
    <div><strong>Why separate judgment from interpretation?</strong><p>Reserve frontier work for exceptions. Keep bounded choices in System 1 and routing rules in the runtime.</p></div>
    <div className="comparison-counts">
      <div><span>This recording</span><strong>{usage.frontierCalls}<small> frontier calls</small></strong><span>{usage.boundedCalls} bounded calls · {usage.frontierDocuments} documents escalated</span></div>
      <Icon name="chevron" size={15} />
      <div><span>Frontier for every readable input</span><strong>{usage.readable}<small> hypothetical calls</small></strong><span>One call per readable document; no retries</span></div>
    </div>
    <small className="comparison-caveat">{run.mode === 'test-fixture' ? 'Simulated run. ' : ''}Whole recording so far. Unreadable inputs excluded. Call counts are not a cost, speed, or accuracy benchmark.</small>
  </aside>;
}
