/** @jsxImportSource react */
import { useEffect, useState } from 'react';
import type { LiveInterpretResponse } from '../lib/api.generated';
import type { LiveLessonState } from '../lib/useLiveLesson';
import { interpretationPerformance } from '../lib/classificationPerformance';
import { displayName } from '../lib/naming';
import { frontierModelLabel } from '../lib/frontierModels';
import { PerformanceReport } from './PerformanceReport';
import { Icon } from './Icon';

export type LiveInterpretState = LiveLessonState<LiveInterpretResponse>;

export function LiveElapsed({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => setElapsed(Math.max(0, performance.now() - startedAt));
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [startedAt]);
  return <span className="live-elapsed" aria-hidden="true">{(elapsed / 1000).toFixed(1)} s elapsed</span>;
}

export function LiveInterpret({ state, inFlight, onRun, onLeave }: { state: LiveInterpretState; inFlight: boolean; onRun: () => void; onLeave: () => void }) {
  const proposal = state.status === 'complete' ? state.response.proposal : undefined;
  return <section className="live-frontier-panel" aria-label="Live frontier interpretation">
    <div className="live-frontier-heading"><div><span className="eyebrow">{state.status === 'idle' ? 'Try the real frontier step' : `Live frontier step · ${frontierModelLabel(proposal?.configured_model || proposal?.returned_model)}`}</span>
      <p>{state.status === 'idle' ? 'Send this synthetic document to the selected frontier model and measure its response.' : 'Prepared System 1 judgment · executed policy · real frontier request'}</p></div>
      {state.status === 'idle' ? <button className="primary" disabled={inFlight} onClick={onRun}><Icon name="sparkle" size={16} />{inFlight ? 'Finishing prior request…' : 'Run interpretation'}</button>
        : <button className="quiet small" onClick={onLeave}>Return to prepared replay</button>}</div>
    {state.status === 'idle' && <small>One API request using the server’s OpenAI key. Normal API charges apply.</small>}
    {state.status === 'pending' && <div className="live-frontier-progress"><span role="status">Waiting for the frontier response…</span><LiveElapsed startedAt={state.startedAt} /><small>Elapsed time is real. Leaving this view does not cancel an accepted request.</small></div>}
    {state.status === 'failed' && <div className="live-frontier-error"><p role="alert">{displayName(state.message)}</p><p>No proposal was substituted. Nothing was published.</p><button className="secondary small" disabled={inFlight} onClick={onRun}>Retry interpretation</button></div>}
    {proposal && state.status === 'complete' && <><PerformanceReport report={interpretationPerformance(state.response)} />
      <details className="live-frontier-explanation"><summary>Category proposal: {proposal.category}</summary><p>{proposal.explanation}</p></details>
      <details><summary>Request evidence</summary><dl className="lesson-facts"><dt>Measurement</dt><dd>Server-observed request round trip, including network and parsing. One sample; not a latency benchmark.</dd><dt>Approval</dt><dd>This preview creates no review task and cannot publish. Start a normal classification run for an operational review.</dd><dt>Source version</dt><dd>{state.status === 'complete' && state.response.content_version}</dd><dt>Request</dt><dd>{proposal.request_id}</dd><dt>Token usage</dt><dd>{proposal.usage ? JSON.stringify(proposal.usage) : 'Unavailable'}</dd></dl></details></>}
  </section>;
}
