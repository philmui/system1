import { useEffect, useRef, useState } from 'react';
import type { Decision, Document, Passage, Run } from '../lib/api.generated';
import type { Execution } from '../lib/events';
import { api, label, shortDate } from '../lib/api';
import { duration } from '../lib/timing';
import { displayName } from '../lib/naming';
import { Icon, Status } from './Icon';

export function DecisionInspector({
  selected,
  execution,
  run,
  onClose,
}: {
  selected: string | null;
  execution: Execution;
  run: Run;
  onClose: () => void;
}) {
  const [decisionIndex, setDecisionIndex] = useState(0);
  const instance = selected ? execution.instances[selected] : undefined;
  const descendants = selected
    ? Object.values(execution.instances)
        .filter((item) => item.parent === selected)
        .map((item) => item.id)
    : [];
  const decisions = selected
    ? Object.entries(execution.decisions)
        .filter(([id]) => id === selected || descendants.includes(id))
        .flatMap(([, values]) => values)
    : [];
  const decision = decisions[Math.min(decisionIndex, decisions.length - 1)];
  let providerRecord: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(instance?.detail || 'null');
    if (parsed && typeof parsed === 'object' && 'provider' in parsed) providerRecord = parsed;
  } catch {
    /* Plain node details are displayed above. */
  }
  return (
    <aside className="inspector" aria-label="Decision inspector" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
      <div className="inspector-heading">
        <span className="eyebrow">Step details</span>
        <button className="icon-button" aria-label="Close inspector" onClick={onClose}><Icon name="close" size={16} /></button>
      </div>
      {!selected ? (
        <div className="inspector-empty">
          <div className="empty-glyph">
            <Icon name="runs" size={25} />
          </div>
          <h3>Every decision has a trail.</h3>
          <p>
            Select a worker or a step to inspect its input, model signal, and the rule that chose what
            happened next.
          </p>
          <div className="provider-key">
            <span>
              <i className="provider-dot jev" />
              System 1 Model <small>Bounded judgments</small>
            </span>
            <span>
              <i className="provider-dot openai" />
              OpenAI <small>Interpretation & synthesis</small>
            </span>
            <span>
              <i className="provider-dot graph" />
              AgentGraph <small>Control & checkpoints</small>
            </span>
          </div>
        </div>
      ) : (
        <>
          <h3>{displayName(instance?.label || label(selected))}</h3>
          <Status value={instance?.state || 'queued'} />
          {instance?.detail && !decision && !instance.detail.startsWith('{') && (
            <p className="inspector-note">{displayName(instance.detail)}</p>
          )}
          {decisions.length > 1 && (
            <label className="field">
              <span>Recorded decision</span>
              <select
                value={Math.min(decisionIndex, decisions.length - 1)}
                onChange={(event) => setDecisionIndex(Number(event.target.value))}
              >
                {decisions.map((value, index) => (
                  <option key={value.id} value={index}>
                    {index + 1}. {value.signal.kind} → {value.selected_route}
                  </option>
                ))}
              </select>
            </label>
          )}
          {decision ? (
            <DecisionDetail decision={decision} />
          ) : (
            <div className="inspector-note">
              <p>
                {providerRecord
                  ? 'This provider returned structured output. Its query plan or cited answer is recorded with the run results.'
                  : instance
                    ? 'This stage has no provider judgment. Its status comes from a recorded execution event.'
                    : 'This stage has not executed in the visible event sequence.'}
              </p>
              {providerRecord && (
                <dl className="metadata">
                  <dt>Provider</dt>
                  <dd>
                    {providerRecord.provider === 'fixture'
                      ? 'Simulated fixture'
                      : displayName(String(providerRecord.provider))}
                  </dd>
                  <dt>Model</dt>
                  <dd>
                    {displayName(String(
                      providerRecord.returned_model || providerRecord.configured_model || 'Unavailable',
                    ))}
                  </dd>
                  <dt>Elapsed</dt>
                  <dd>
                    {providerRecord.elapsed_ms === undefined
                      ? 'Unavailable'
                      : duration(Number(providerRecord.elapsed_ms))}
                  </dd>
                  <dt>Usage</dt>
                  <dd>{providerRecord.usage ? JSON.stringify(providerRecord.usage) : 'Unavailable'}</dd>
                  <dt>Request</dt>
                  <dd className="mono">{String(providerRecord.request_id || 'Unavailable')}</dd>
                </dl>
              )}
              {instance && (
                <dl className="metadata">
                  <dt>Stage elapsed</dt>
                  <dd>{duration(instance.elapsedMs)}</dd>
                  <dt>Queue wait</dt>
                  <dd>{duration(instance.queueWaitMs)}</dd>
                  <dt>Attempt</dt>
                  <dd>{instance.attempt}</dd>
                  <dt>Instance</dt>
                  <dd className="mono">{instance.id}</dd>
                </dl>
              )}
            </div>
          )}
          <div className="inspector-footer">
            <span>Policy {run.policy_version}</span>
            <span>Graph {run.graph_version}</span>
          </div>
        </>
      )}
    </aside>
  );
}
function DecisionDetail({ decision }: { decision: Decision }) {
  const signal = decision.signal;
  return (
    <div className="decision-detail" data-testid="decision-detail">
      <section>
        <span className="section-label">Returned signal</span>
        <div className="signal-value">
          {signal.kind === 'choice'
            ? label(signal.choice)
            : signal.kind === 'noul'
              ? `${(signal.noul * 100).toFixed(1)}%`
              : label(signal.category)}
          <small>
            {signal.kind === 'choice'
              ? `${(signal.confidence * 100).toFixed(1)}% confidence`
              : signal.kind === 'noul'
                ? 'Binary judgment probability'
                : 'Proposal · requires review'}
          </small>
        </div>
        <p className="micro">
          {signal.kind === 'choice'
            ? 'Distribution-derived confidence; not calibrated correctness.'
            : signal.kind === 'noul'
              ? 'Probability of the stated binary judgment. Separate from Choice confidence.'
              : signal.explanation}
        </p>
        {signal.kind === 'choice' && (
          <div className="distribution">
            {Object.entries(signal.probabilities)
              .sort(([, a], [, b]) => b - a)
              .map(([name, probability]) => (
                <div key={name}>
                  <span>{label(name)}</span>
                  <div>
                    <i style={{ width: `${probability * 100}%` }} />
                  </div>
                  <small>{(probability * 100).toFixed(0)}%</small>
                </div>
              ))}
          </div>
        )}
      </section>
      <section>
        <span className="section-label">Applied rule</span>
        <div className="policy-card">
          <strong>
            <Icon name="arrow" size={14} />
            {label(decision.selected_route)}
          </strong>
          <p>{displayName(decision.explanation)}</p>
          {decision.threshold !== null && decision.threshold !== undefined && (
            <span>Configured threshold: {decision.threshold.toFixed(2)}</span>
          )}
        </div>
        <p className="micro">
          {decision.policy_version} · Rule elapsed: {duration(decision.policy_elapsed_ms)}
        </p>
      </section>
      <section>
        <span className="section-label">Question & rubric</span>
        <p className="rubric">{displayName(decision.rubric)}</p>
        <span className="micro">{signal.rubric_version}</span>
      </section>
      <section>
        <span className="section-label">Input evidence</span>
        <blockquote className="input-excerpt">{decision.input_excerpt || 'No excerpt recorded.'}</blockquote>
        <p className="micro">The input sent for judgment. This is not a model reasoning transcript.</p>
        {!!decision.omitted_context?.length && (
          <details>
            <summary>Omitted context ({decision.omitted_context.length})</summary>
            <ul>
              {decision.omitted_context.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section>
        <span className="section-label">Provider record</span>
        <dl className="metadata">
          <dt>Provider</dt>
          <dd>{signal.provider === 'fixture' ? 'Simulated fixture' : label(signal.provider)}</dd>
          <dt>Model</dt>
          <dd>{displayName(signal.returned_model || signal.configured_model || 'Unavailable')}</dd>
          <dt>Elapsed</dt>
          <dd>{duration(signal.elapsed_ms)}</dd>
          <dt>Request</dt>
          <dd className="mono">{signal.request_id || 'Unavailable'}</dd>
          <dt>Usage</dt>
          <dd>{signal.usage ? JSON.stringify(signal.usage) : 'Unavailable'}</dd>
          <dt>References</dt>
          <dd className="mono">{decision.input_refs.join(', ')}</dd>
        </dl>
      </section>
    </div>
  );
}

export function SourcePanel({
  documentId,
  passageId,
  quote,
  onClose,
  onUpdated,
}: {
  documentId?: string;
  passageId?: string;
  quote?: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const returnFocus = useRef(window.document.activeElement as HTMLElement | null);
  const [document, setDocument] = useState<Document | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setDocument(null);
    setError(null);
    const load = async () => {
      const target = passageId ? await api.passage(passageId) : null;
      const result = await api.document(target?.document_id || documentId!);
      if (active) {
        setDocument(result.document);
        setDate(result.document.document_date || '');
        setPassages(target ? [target] : result.passages);
      }
    };
    void load().catch(
      (caught) => active && setError(caught instanceof Error ? caught.message : 'Source unavailable.'),
    );
    return () => {
      active = false;
    };
  }, [documentId, passageId]);
  useEffect(() => {
    const previousFocus = returnFocus.current;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusable = [
          ...(panelRef.current?.querySelectorAll<HTMLElement>('button, input, select, summary, a[href]') ||
            []),
        ].filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
        const first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && window.document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && window.document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      previousFocus?.focus();
    };
  }, [onClose]);
  const save = async () => {
    if (!document) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateDate(document.id, date || null);
      setDocument(updated);
      onUpdated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save metadata.');
    } finally {
      setSaving(false);
    }
  };
  const highlighted = (text: string) => {
    const index = quote ? text.indexOf(quote) : -1;
    return index < 0 ? (
      text
    ) : (
      <>
        {text.slice(0, index)}
        <mark>{quote}</mark>
        {text.slice(index + quote!.length)}
      </>
    );
  };
  return (
    <div className="source-backdrop" onClick={onClose}>
      <section
        ref={panelRef}
        className="source-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Source passage"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="source-header">
          <span className="eyebrow">Source evidence</span>
          <button autoFocus className="icon-button" onClick={onClose} aria-label="Close source">
            <Icon name="close" />
          </button>
        </div>
        {error && (
          <div role="alert" className="error-banner">
            {error}
          </div>
        )}
        {!document && !error && <div className="loading">Loading the retained source…</div>}
        {document && (
          <>
            <div className="source-title">
              <Icon name="file" size={28} />
              <h2>{document.filename}</h2>
            </div>
            <div className="tag-row">
              <span className="category-tag">{label(document.category)}</span>
              <span className="tag">{document.synthetic ? 'Synthetic document' : 'Uploaded document'}</span>
              <Status value={document.extraction_status} />
            </div>
            <dl className="metadata source-metadata">
              <dt>Source version</dt>
              <dd className="mono">{document.content_version}</dd>
              <dt>Document date</dt>
              <dd>
                {shortDate(document.document_date)} · {label(document.date_provenance || 'unknown')}
              </dd>
              <dt>Uploaded</dt>
              <dd>{shortDate(document.uploaded_at)}</dd>
              <dt>Extraction & anchors</dt>
              <dd>{duration(document.extraction_elapsed_ms)} · before classification</dd>
              <dt>Classification</dt>
              <dd>{label(document.category_provenance || 'unclassified')}</dd>
            </dl>
            <details className="date-editor">
              <summary>Edit confirmed document date</summary>
              <p className="micro">
                Use the invoice issue date for invoices. The upload date stays separate.
              </p>
              <div className="button-row">
                <input
                  aria-label="Confirmed document date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
                <button className="secondary small" disabled={saving} onClick={save}>
                  {saving ? 'Saving…' : 'Confirm date'}
                </button>
              </div>
            </details>
            {document.extraction_error && <div className="error-banner">{document.extraction_error}</div>}
            {!passages.length && (
              <div className="empty-state">
                <h3>No readable passages</h3>
                <p>This document has no extracted evidence available for search.</p>
              </div>
            )}
            {passages.map((passage) => (
              <article className="source-passage" key={passage.id} id={`passage-${passage.id}`}>
                <div className="section-label">
                  {passage.page ? `Page ${passage.page}` : passage.section || 'Document'}
                  <span>
                    Characters {passage.start}–{passage.end}
                  </span>
                </div>
                <p>{highlighted(passage.text)}</p>
                <span className="mono micro">{passage.id}</span>
              </article>
            ))}
            {document.human_correction && (
              <details>
                <summary>Human correction record</summary>
                <pre>{JSON.stringify(document.human_correction, null, 2)}</pre>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}
