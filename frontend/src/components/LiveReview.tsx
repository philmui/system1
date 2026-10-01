/** @jsxImportSource react */
import type { LiveReviewResponse } from '../lib/api.generated';
import { api } from '../lib/api';
import type { ExamplePage } from '../lib/reviewExample';
import { reviewPerformance } from '../lib/reviewPerformance';
import { displayName } from '../lib/naming';
import { useLiveLesson, type LiveLessonState } from '../lib/useLiveLesson';
import { useFrontierModel } from '../lib/useFrontierModel';
import { defaultFrontierModel, type FrontierModel } from '../lib/frontierModels';
import { FrontierModelSelect } from './FrontierModelSelect';
import { LiveElapsed } from './LiveInterpret';
import { Icon } from './Icon';
import { PerformanceReport } from './PerformanceReport';

type ReviewState = LiveLessonState<LiveReviewResponse>;
const routeNames = { produce: 'Propose production', aside: 'Set aside', redact: 'Draft PII redaction', attorney: 'Attorney review' };

export function LiveReviewPanel({ page, classification, redaction, onClassify, onRedact, frontierModel = defaultFrontierModel, onModelChange }: {
  page: ExamplePage; classification: ReviewState; redaction: ReviewState;
  onClassify: () => void; onRedact: () => void;
  frontierModel?: FrontierModel; onModelChange?: (model: FrontierModel) => void;
}) {
  const busy = classification.status === 'pending' || redaction.status === 'pending';
  const panels = [
    { action: 'classify', title: 'Classify the page', button: 'Classify page', state: classification, run: onClassify, enabled: true },
    { action: 'redact', title: 'Generate a redaction draft', button: 'Generate redaction', state: redaction, run: onRedact, enabled: !!page.redacted },
  ];
  return <section className="live-review-panel" aria-label={`Live frontier review of ${page.title}`}>
    {onModelChange && <FrontierModelSelect value={frontierModel} disabled={busy} onChange={onModelChange} />}
    <div className="live-review-source"><span className="eyebrow">Fictional source · {page.id}</span><h2>{page.title}</h2><pre>{page.text}</pre></div>
    <div className="live-review-actions">{panels.map(panel => {
      const result = panel.state.status === 'complete' ? panel.state.response : undefined;
      return <section key={panel.action} className="live-frontier-panel" aria-label={panel.title}>
        <div className="live-frontier-heading"><div><span className="eyebrow">Live frontier {panel.action === 'classify' ? 'judgment' : 'generation'}</span><h3>{panel.title}</h3></div>
          <button className="primary" disabled={busy || !panel.enabled} onClick={panel.run}><Icon name="sparkle" size={16} />{result ? `Run ${panel.action === 'classify' ? 'classification' : 'redaction'} again` : panel.button}</button></div>
        {!panel.enabled ? <p>Select Cutoff approvals to try redaction.</p> : panel.state.status === 'idle' && <p>One real API request. Normal API charges apply; response time is measured when it returns.</p>}
        {panel.state.status === 'pending' && <div className="live-frontier-progress"><span role="status">Waiting for the frontier response…</span><LiveElapsed startedAt={panel.state.startedAt} /><small>Browser waiting time; the completed request measurement appears after the response.</small></div>}
        {panel.state.status === 'failed' && <div className="live-frontier-error"><p role="alert">{displayName(panel.state.message)}</p><p>No prepared answer was substituted. Nothing was released.</p></div>}
        {result && <>
          <PerformanceReport report={reviewPerformance(result)} compact />
          {result.judgment && <><dl className="live-review-judgments"><div><dt>Relevant</dt><dd>{result.judgment.responsive}</dd></div><div><dt>Personal information</dt><dd>{result.judgment.personal_info}</dd></div><div><dt>Potential privilege</dt><dd>{result.judgment.privileged}</dd></div></dl><p>{result.judgment.explanation}</p><p className="live-review-route">Runtime rule → {result.proposed_route ? routeNames[result.proposed_route] : 'Unavailable'}. Preview cannot authorize release.</p></>}
          {result.redaction && <><pre className="live-review-draft">{result.redaction.redacted_text}</pre><p>{result.redaction.explanation}</p><p>Code checked the declared replacements against the source. PII completeness is not certified; an attorney must inspect the draft.</p></>}
          <details><summary>Request evidence</summary><dl className="lesson-facts"><dt>Timing</dt><dd>Server-observed request round trip, including network and parsing. One sample, not a model benchmark.</dd><dt>Provider</dt><dd>{result.metadata.provider}</dd><dt>Request</dt><dd>{result.metadata.request_id || 'Unavailable'}</dd><dt>Source version</dt><dd>{result.content_version}</dd><dt>Usage</dt><dd>{result.metadata.usage ? JSON.stringify(result.metadata.usage) : 'Unavailable'}</dd><dt>Publication</dt><dd>No operational run, approval, or publication was created. Prepared comparison values remain separate assumptions.</dd></dl></details>
        </>}
      </section>;
    })}</div>
    <p className="live-review-limit">Switching pages does not cancel a request already accepted by the server. Live outputs stay separate from the prepared comparison.</p>
  </section>;
}

/** Key by page identity at the parent: a late result cannot replace another page. */
export function LiveReview({ page }: { page: ExamplePage }) {
  const classification = useLiveLesson<LiveReviewResponse>();
  const redaction = useLiveLesson<LiveReviewResponse>();
  const [frontierModel, selectFrontierModel] = useFrontierModel();
  return <LiveReviewPanel page={page} classification={classification.state} redaction={redaction.state}
    frontierModel={frontierModel} onModelChange={model => { selectFrontierModel(model); classification.leave(); redaction.leave(); }}
    onClassify={() => void classification.start(() => api.reviewLesson(page.id, page.content_version, 'classify', frontierModel))}
    onRedact={() => void redaction.start(() => api.reviewLesson(page.id, page.content_version, 'redact', frontierModel))} />;
}
