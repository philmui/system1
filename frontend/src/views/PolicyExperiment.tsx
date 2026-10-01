/** @jsxImportSource react */
import { displayName } from '../lib/naming';
import { useEffect, useState } from 'react';
import lessonData from '../data/lessons.json' with { type: 'json' };
import type { Decision, LessonCatalogue, PolicyExperimentRequest, PolicyExperimentResponse, PolicyReceipt } from '../lib/api.generated';
import { API_BASE } from '../lib/api';
import { Icon } from '../components/Icon';
import { LessonDrawer } from '../components/LessonDrawer';
import { ExperimentCoverageView, ExperimentReceipt, type Receipt } from '../components/ExperimentEvidence';

const catalogue = lessonData as unknown as LessonCatalogue;
const examples = catalogue.classification.documents;
export function PolicyExperiment({ example, onChoose, onExplore, onSafeguards }: {
  example: string; onChoose: (id: string) => void; onExplore: (id: string) => void; onSafeguards: () => void;
}) {
  const selected = examples.find(item => item.example_id === example) || examples[0];
  const [threshold, setThreshold] = useState(0.8);
  const [guardEnabled, setGuardEnabled] = useState(true);
  const [reload, setReload] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [variant, setVariant] = useState<{ base: string; example: string } | null>(null);
  const [reply, setReply] = useState<{ key: string; value: PolicyExperimentResponse } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const simulatedDocument = examples.find(item => item.example_id === (variant?.base === selected.example_id ? variant.example : selected.example_id)) || selected;
  const request: PolicyExperimentRequest = { example_id: simulatedDocument.example_id as PolicyExperimentRequest['example_id'], original_example_id: selected.example_id as PolicyExperimentRequest['example_id'], threshold, guard_enabled: guardEnabled };
  const serialized = JSON.stringify(request);
  const key = `${serialized}:${reload}`;
  const result = reply?.key === key ? reply.value : undefined;
  const error = failure?.key === key ? failure.message : undefined;

  useEffect(() => {
    const controller = new AbortController();
    // Coalesce slider movement. Both the abort signal and request identity prevent
    // a previous document or setting from replacing the current simulated result.
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/lessons/experiment`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: serialized, signal: controller.signal,
        });
        if (!response.ok) throw new Error(`The policy service returned ${response.status}.`);
        const value = await response.json() as PolicyExperimentResponse;
        if (value.version !== catalogue.version || value.policy_version !== catalogue.policy_version) throw new Error('Lesson and policy service versions differ. Reload after restarting the backend.');
        if (!controller.signal.aborted) setReply({ key, value });
      } catch (caught) {
        if (!controller.signal.aborted) setFailure({ key, message: caught instanceof Error ? caught.message : 'The policy service is unavailable.' });
      }
    }, 120);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [key, serialized]);

  const recorded = catalogue.classification.snapshot.events.find(event => event.type === 'decision' && event.instance_id === `${selected.document.id}:jev`)?.payload as unknown as Decision | undefined;
  const original: Receipt | undefined = recorded?.signal.kind === 'choice' ? {
    signal: recorded.signal, reason: recorded.policy_reason || 'unavailable',
    selected_route: recorded.selected_route as PolicyReceipt['selected_route'], requires_review: recorded.selected_route === 'interpret',
  } : undefined;
  const pair = selected.example_id === 'proposed' || selected.example_id === 'finalized';
  const changes = result?.changed_fields || [];
  const originalVariant = simulatedDocument.example_id !== selected.example_id ? selected : undefined;
  const reset = () => { setThreshold(0.8); setGuardEnabled(true); setVariant(null); setReload(value => value + 1); };

  return <section className="policy-experiment" aria-labelledby="policy-experiment-title">
    <header className="experiment-heading"><div><span className="experiment-eyebrow">Experiment with a decision</span><h1 id="policy-experiment-title">Change one rule. See the route.</h1><p>The judgment stays fixed while the runtime evaluates your policy.</p></div><span className="experiment-simulation"><Icon name="sliders" size={15} />Simulation · does not change this run</span></header>
    <p className="page-task-guide">Choose a document, then change the threshold or guard. Your simulation updates automatically. Compare its route and reference checks with the original recording; no model calls are made.</p>

    <div className="experiment-examples" role="group" aria-label="Experiment document">
      {examples.map(item => <button key={item.example_id} aria-pressed={selected.example_id === item.example_id} onClick={() => onChoose(item.example_id)}><Icon name="file" size={16} /><span>{item.title}</span></button>)}
    </div>

    <div className="experiment-layout">
      <aside className="experiment-controls" aria-label="Hypothetical policy controls">
        <div className="experiment-control-heading"><h2>Your policy</h2><button className="text-button" onClick={reset}><Icon name="refresh" size={14} />Reset</button></div>
        <label className="experiment-threshold" htmlFor="experiment-threshold"><span>Acceptance threshold</span><output htmlFor="experiment-threshold">{Math.round(threshold * 100)}%</output></label>
        <input id="experiment-threshold" type="range" min="0" max="100" step="1" value={Math.round(threshold * 100)} onChange={event => setThreshold(Number(event.target.value) / 100)} aria-valuetext={`${Math.round(threshold * 100)} percent acceptance threshold`} />
        <div className="experiment-range-labels"><span>0%</span><button onClick={() => setThreshold(0.8)}>Recorded: 80%</button><span>100%</span></div>
        <label className="experiment-guard"><span><strong>Proposed terms guard</strong><small>Review email discussing unfinished terms</small></span><input type="checkbox" checked={guardEnabled} onChange={event => setGuardEnabled(event.target.checked)} /></label>
        {pair && <div className="experiment-variant-control"><span>Document wording</span><div role="group" aria-label="Prepared agreement variant">{['proposed', 'finalized'].map(id => <button key={id} aria-pressed={simulatedDocument.example_id === id} onClick={() => setVariant({ base: selected.example_id, example: id })}>{id === 'proposed' ? 'Proposed' : 'Finalized'}</button>)}</div></div>}
        <div className="experiment-source-preview"><div><Icon name="file" size={15} /><strong>{simulatedDocument.title}</strong></div><blockquote>{simulatedDocument.source_excerpt}</blockquote><button className="text-button" onClick={() => setSourceOpen(true)}>View document<Icon name="arrow" size={13} /></button></div>
        {pair && <div className="experiment-controlled"><Icon name="link" size={15} /><span>Both agreement variants keep the prepared judgment at <strong>contract · 96%</strong>.</span></div>}
      </aside>

      <div className="experiment-results">
        <div className="experiment-receipts"><ExperimentReceipt title="Original recording" receipt={result?.original || original} /><ExperimentReceipt title="Your simulation" receipt={result?.simulated} pending={!error && !result} /></div>
        <div className="experiment-change" role="status" aria-live="polite">
          {error ? <><Icon name="alert" size={16} /><div><strong>Connect the backend to evaluate this change.</strong><small>{error} The original recording is still available.</small></div><button className="secondary small" onClick={() => setReload(value => value + 1)}>Retry</button></>
            : result ? <><Icon name={result.original.selected_route !== result.simulated.selected_route ? 'runs' : 'checkCircle'} size={17} /><span>{changes.length ? `Changed: ${changes.join(' + ')}. ` : 'Recorded policy restored. '}{result.original.selected_route !== result.simulated.selected_route ? 'The runtime selected a different route.' : 'The selected route stays the same.'}</span></>
              : <><Icon name="workflow" size={16} /><span>Evaluating the current settings…</span></>}
        </div>
        {result && <ExperimentCoverageView original={result.original_coverage} simulated={result.simulated_coverage} />}
        {result && <details className="experiment-inspect"><summary>Why this route?</summary><p>{displayName(result.simulated.explanation)}</p><p>The proposed terms guard matches email headers, agreement language, and unfinished terms. It does not establish legal validity.</p><p>{displayName(result.controlled_assumption)}</p><dl><dt>Policy</dt><dd>{result.policy_version}</dd><dt>Scenario</dt><dd>{result.version}</dd><dt>Original decision</dt><dd>{result.original.decision_id}</dd><dt>Provider calls</dt><dd>0 · this simulation</dd><dt>Writes</dt><dd>None · original run and settings unchanged</dd></dl><p>{displayName(result.simulated_coverage.quality_basis)} Confidence is a model signal, not measured correctness.</p></details>}
      </div>
    </div>
    <footer className="experiment-next"><button className="secondary" onClick={() => onExplore(simulatedDocument.example_id)}><Icon name="play" size={16} />Open this document</button><button className="text-button" onClick={onSafeguards}>Explore a safeguard<Icon name="arrow" size={15} /></button></footer>
    {sourceOpen && <LessonDrawer title={simulatedDocument.title} onClose={() => setSourceOpen(false)}><p className="experiment-source-provenance">Fictional retained source · {simulatedDocument.document.content_version.slice(0, 12)}</p>{pair && <div className="experiment-variant-change"><strong>{originalVariant ? 'Changed from the original wording' : 'Agreement wording used by the guard'}</strong>{originalVariant && <blockquote><del>{originalVariant.source_excerpt}</del></blockquote>}<blockquote><mark>{simulatedDocument.source_excerpt}</mark></blockquote><p>The two prepared signals are deliberately held equal. The actual text guard determines the changed route.</p></div>}<pre className="experiment-full-source">{simulatedDocument.text}</pre></LessonDrawer>}
  </section>;
}
