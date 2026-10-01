import { useEffect, useMemo, useRef, useState } from 'react';
import type { Document, ReviewSubmission } from '../lib/api.generated';
import { api, label, terminal } from '../lib/api';
import { reduceEvents } from '../lib/events';
import { useRun } from '../lib/useRun';
import { displayName } from '../lib/naming';
import { duration, timingFromEvents } from '../lib/timing';
import { classificationReplaySteps, executionReplayBeats } from '../lib/replay';
import { ExecutionGraph } from '../components/ExecutionGraph';
import { ClassificationComparison, ClassificationExamples } from '../components/ClassificationLesson';
import { DecisionInspector } from '../components/Inspector';
import { RunEducation } from '../components/RunEducation';
import { Results } from '../components/Results';
import { ReviewPanel } from '../components/ReviewPanel';
import { PlaybackSpeed } from '../components/PlaybackSpeed';
import { Icon, Status } from '../components/Icon';
import { MeasurementGuide } from '../components/MeasurementGuide';

export function RunWorkspace({
  id,
  documents,
  onSource,
  onChanged,
  onOpen,
}: {
  id: string;
  documents: Document[];
  onSource: (documentId?: string, passageId?: string, quote?: string) => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const { run, events, connection, error, refresh } = useRun(id);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const pause = () => setPlaying(false);
    window.addEventListener('pause-workflow-playback', pause);
    return () => window.removeEventListener('pause-workflow-playback', pause);
  }, []);
  const [cursor, setCursor] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [followedInput, setFollowedInput] = useState<string | null>(null);
  const playbackClock = useRef({ cursor: -1, elapsed: 0 });
  const graphPanel = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [tab, setTab] = useState<'results' | 'timing' | 'events'>('results');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const visibleCount = live ? events.length : cursor;
  const classification = run?.kind === 'classification';
  const firstDocument = classification && Array.isArray(run.request.document_ids) ? String(run.request.document_ids[0] || '') : '';
  const input = followedInput ?? (firstDocument ? `worker:${firstDocument}` : '');
  const simulatedReview = !!run?.request.simulated_review;
  const replaySteps = useMemo(() => classification ? classificationReplaySteps(events, input.replace(/^worker:/, ''), simulatedReview) : [], [classification, events, input, simulatedReview]);
  const discoveryBeats = useMemo(() => classification ? [] : executionReplayBeats(events), [classification, events]);
  const stepCount = replaySteps.filter(step => step.cursor <= visibleCount).length;
  const replayStep = stepCount ? replaySteps[stepCount - 1] : undefined;
  const visibleEvents = useMemo(() => events.slice(0, visibleCount), [events, visibleCount]);
  const execution = useMemo(() => reduceEvents(visibleEvents), [visibleEvents]);
  const recording = useMemo(() => reduceEvents(events), [events]);
  const timing = useMemo(() => timingFromEvents(visibleEvents), [visibleEvents]);
  useEffect(() => {
    setSelected(null);
    setLive(true);
    setPlaying(false);
    setCursor(0);
    setFollowedInput(null);
    playbackClock.current = { cursor: -1, elapsed: 0 };
  }, [id]);
  useEffect(() => {
    if (!focused) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFocused(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focused]);
  useEffect(() => {
    if (!playing || live) return;
    if (cursor >= events.length) {
      setPlaying(false);
      return;
    }
    const beats = classification ? replaySteps : discoveryBeats;
    const hold = beats.filter(step => step.cursor <= cursor).at(-1)?.duration || 160;
    const next = beats.find(step => step.cursor > cursor)?.cursor ?? events.length;
    if (playbackClock.current.cursor !== cursor) playbackClock.current = { cursor, elapsed: 0 };
    const started = performance.now();
    const timeout = setTimeout(() => setCursor(next), Math.max(0, hold - playbackClock.current.elapsed) / speed);
    return () => {
      clearTimeout(timeout);
      playbackClock.current.elapsed += (performance.now() - started) * speed;
    };
  }, [playing, live, cursor, events, speed, classification, replaySteps, discoveryBeats]);
  useEffect(() => {
    if (run && (terminal(run.status) || run.status === 'awaiting_review')) onChanged();
  }, [run?.status]); // Status transitions refresh library metadata once.
  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      refresh();
      onChanged();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  };
  const inspectSource = (documentId?: string, passageId?: string, quote?: string) => {
    setPlaying(false);
    if (passageId) {
      const related = Object.entries(execution.decisions).find(([, decisions]) =>
        decisions.some((decision) => decision.input_refs.includes(passageId)),
      );
      setSelected(quote && execution.instances.synthesize ? 'synthesize' : related?.[0] || null);
    }
    onSource(documentId, passageId, quote);
  };
  const review = (submission: ReviewSubmission) => perform(() => api.review(id, submission));
  const replay = () => {
    playbackClock.current = { cursor: -1, elapsed: 0 };
    setLive(false);
    setCursor(0);
    setPlaying(true);
  };
  const followInput = (next: string) => {
    setFollowedInput(next);
    setSelected(null);
    if (classification && !live && next !== input) {
      playbackClock.current = { cursor: -1, elapsed: 0 };
      setCursor(0);
    }
  };
  const playExample = (documentId: string) => {
    const steps = classificationReplaySteps(events, documentId, simulatedReview);
    const decision = steps.findIndex(step => step.stage === 'route' || step.kind === 'error');
    playbackClock.current = { cursor: -1, elapsed: 0 };
    setFollowedInput(`worker:${documentId}`);
    setSelected(null);
    setLive(false);
    setCursor(decision > 0 ? steps[decision - 1].cursor : 0);
    setPlaying(true);
    requestAnimationFrame(() => {
      const target = window.matchMedia('(max-width: 760px)').matches
        ? graphPanel.current?.querySelector('.flow-canvas') : graphPanel.current;
      target?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  };
  const createTeachingRun = () => perform(async () => {
    const loaded = await api.classificationSamples();
    const documentIds = loaded.documents.map(document => document.id);
    const existing = (await api.runs()).runs.find(item => item.kind === 'classification' && !terminal(item.status)
      && Array.isArray(item.request.document_ids) && item.request.document_ids.length === documentIds.length
      && documentIds.every(documentId => (item.request.document_ids as string[]).includes(documentId)));
    const next = existing || await api.classify(documentIds);
    onChanged();
    onOpen(next.id);
  });
  const seek = (next: number) => {
    playbackClock.current = { cursor: -1, elapsed: 0 };
    setLive(false);
    setPlaying(false);
    setCursor(next);
  };
  if (!run)
    return (
      <div className="page">
        <div className={error ? 'error-banner' : 'loading'}>{error || 'Opening the recorded workspace…'}</div>
      </div>
    );
  const title =
    run.kind === 'classification' ? String(run.request.lesson_title || 'Document classification') : String(run.request.query || 'Discovery');
  const active = !terminal(run.status) && run.status !== 'awaiting_review';
  return (
    <div className={`run-workspace ${classification ? 'classification-workspace' : ''} ${focused ? 'focus-workflow' : ''} ${showControls ? '' : 'compact-run'}`}>
      <div className="workspace-heading" hidden={focused && !showControls}>
        <div className="workspace-title">
          <h1 title={title}>{title}</h1>
          <div className="run-meta">
            <Status value={live ? run.status : execution.status} />
            {!live && <span className="replay-label">Replay</span>}
            {simulatedReview && <span className="micro">Simulated human review</span>}
            <span className="mono">{id.slice(0, 12)}</span>
            <span className={`connection connection-${connection.toLowerCase()}`}>
              <i />
              {connection}
            </span>
          </div>
        </div>
        <div className="button-row">
          {run.trace_url && (
            <a className="secondary small" href={run.trace_url} target="_blank" rel="noreferrer">
              LangSmith trace
              <Icon name="link" size={14} />
            </a>
          )}
          {run.status === 'interrupted' && (
            <button className="primary small" disabled={busy} onClick={() => perform(() => api.recover(id))}>
              Recover run
            </button>
          )}
          {run.status === 'interrupted' && (
            <button
              className="secondary small"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  const next = await api.restart(id);
                  onOpen(next.id);
                })
              }
            >
              Start linked run
            </button>
          )}
          {(active || run.status === 'awaiting_review') && (
            <button
              className="secondary small danger-text"
              disabled={busy}
              onClick={() => perform(() => api.cancel(id))}
            >
              Cancel execution
            </button>
          )}
        </div>
      </div>
      {(error || actionError || run.error) && (
        <div className="error-banner" role="alert">
          {displayName(actionError || error || run.error || '')}
        </div>
      )}
      <div className="run-measurements" hidden={!showControls}>
        <span><Icon name="file" size={14} /><strong>{execution.workers.length}</strong> inputs</span>
        <span className="role-jev"><Icon name="jev" size={14} /><strong>{timing.jev.calls}</strong> System 1 Model requests</span>
        <span className="role-llm"><Icon name="sparkle" size={14} /><strong>{timing.openai.calls}</strong> LLM requests</span>
        <span title="Recorded elapsed time with human review and recovery gaps removed"><Icon name="clock" size={14} /><strong>{duration(timing.active)}</strong> active time</span>
        <span className="measurement-detail">{run.mode === 'test-fixture' ? 'Fixture measurements' : 'Observed measurements'}<button className="text-button" onClick={() => setTab('timing')}>Details<Icon name="chevron" size={12} /></button></span>
      </div>
      {classification && !focused && <ClassificationExamples run={run} documents={documents} recording={recording} followedInput={input}
        onPlay={playExample} onCreate={createTeachingRun} busy={busy} />}
      <div className="execution-area" ref={graphPanel}>
        <ExecutionGraph
          run={run}
          documents={documents}
          execution={execution}
          recording={recording}
          selected={selected}
          onSelect={id => { setPlaying(false); setSelected(id); }}
          moving={(live && active) || playing}
          speed={speed}
          followedInput={input}
          onFollowInput={followInput}
          replayStep={replayStep}
          replayHistory={replaySteps.slice(0, stepCount)}
          live={live}
          onInspect={id => { setPlaying(false); setSelected(id); }}
          onSource={inspectSource}
        />
      </div>
      <div className="playback-bar">
        <div className="playback-buttons">
          {classification && <button className="icon-button" aria-label="Step backward" disabled={live || stepCount === 0}
            onClick={() => seek(stepCount > 1 ? replaySteps[stepCount - 2].cursor : 0)}><Icon name="stepBack" size={15} /></button>}
          <button
            className={`icon-button ${classification ? 'replay-play-button' : ''}`}
            aria-label={playing ? 'Pause playback' : 'Play replay'}
            disabled={!events.length}
            onClick={() => {
              if (live || cursor >= events.length) {
                replay();
              } else setPlaying((value) => !value);
            }}
          >
            <Icon name={playing ? 'pause' : 'play'} size={15} />
          </button>
          <button
            className="icon-button"
            aria-label="Step forward"
            disabled={!events.length || (!live && cursor >= events.length)}
            onClick={() => {
              const at = live ? 0 : cursor;
              seek((classification ? replaySteps : discoveryBeats).find(step => step.cursor > at)?.cursor ?? events.length);
            }}
          >
            <Icon name="step" size={15} />
          </button>
          <button className="quiet small" disabled={!events.length} onClick={replay}>
            <Icon name="refresh" size={13} />
            Replay
          </button>
        </div>
        <label className="timeline">
          <span className="visually-hidden">{classification ? 'Replay step' : 'Timeline event'}</span>
          <input
            type="range"
            aria-label={classification ? 'Replay step' : 'Timeline event'}
            aria-valuetext={classification ? `Step ${stepCount} of ${replaySteps.length}${replayStep ? `: ${replayStep.title}` : ''}` : undefined}
            min="0"
            max={classification ? replaySteps.length : events.length}
            value={classification ? stepCount : visibleCount}
            disabled={!events.length}
            onChange={(event) => {
              const value = Number(event.target.value);
              seek(classification ? value ? replaySteps[value - 1].cursor : 0 : value);
            }}
          />
          <span>
            {classification ? `Step ${stepCount} / ${replaySteps.length}` : `${visibleCount} / ${events.length}`}
          </span>
        </label>
        <PlaybackSpeed value={speed} onChange={setSpeed} />
        <button className="icon-button" aria-label={showControls ? 'Collapse run controls' : 'Expand run controls'} aria-expanded={showControls} title="Show or hide run details" onClick={() => setShowControls(value => !value)}><Icon name="chevronDown" size={17} /></button>
        <button className="focus-toggle" aria-label={focused ? 'Exit graph focus' : 'Focus graph'} aria-pressed={focused} onClick={() => setFocused(value => !value)}><Icon name={focused ? 'collapse' : 'expand'} size={17} /><span>{focused ? 'Exit focus' : 'Focus graph'}</span></button>
        <button
          className={`follow-button ${live ? 'following' : ''}`}
          aria-pressed={live}
          onClick={() => {
            setLive(true);
            setPlaying(false);
          }}
        >
          <i />
          {live || !classification ? 'Live follow' : 'Return to live'}
        </button>
      </div>
      {selected && <DecisionInspector key={selected} selected={selected} execution={execution} run={run} onClose={() => setSelected(null)} />}
      {!live && (
        <p className="playback-notice">
          {classification ? 'Illustrated replay: brief work steps, visible handoffs. Node holds are not model latency; recorded timings remain in Timing & evidence.' : 'Illustrated replay · no new model calls · work waits compressed. Recorded timings remain in Timing & evidence.'}
          {classification && run.status === 'awaiting_review' && ' Return to live to review pending proposals.'}
        </p>
      )}
      {classification && !focused && <ClassificationComparison run={run} events={events} />}
      {live && run.status === 'awaiting_review' && run.review && (
        <ReviewPanel
          key={`${run.review.interrupt_id}-${run.review.revision}`}
          review={run.review}
          submitting={busy}
          onSubmit={review}
          onSource={(documentId) => onSource(documentId)}
        />
      )}
      <section className="run-bottom">
        <div className="result-tabs">
          <button className={tab === 'results' ? 'active' : ''} aria-pressed={tab === 'results'} onClick={() => setTab('results')}>
            Results & sources
          </button>
          <button className={tab === 'timing' ? 'active' : ''} aria-pressed={tab === 'timing'} onClick={() => { setPlaying(false); setTab('timing'); }}>
            Timing & evidence
          </button>
          <button className={tab === 'events' ? 'active' : ''} aria-pressed={tab === 'events'} onClick={() => setTab('events')}>
            Event timeline <span className="count">{visibleEvents.length}</span>
          </button>
          <span><Icon name="shield" size={12} />Recorded execution</span>
        </div>
        {tab === 'results' ? (
          <Results run={run} result={execution.result} documents={documents} onSource={inspectSource} />
        ) : tab === 'timing' ? (
          <><MeasurementGuide /><RunEducation events={visibleEvents} run={run} execution={execution} selected={selected} onSelect={setSelected} onSource={(passageId, quote) => inspectSource(undefined, passageId, quote)} /></>
        ) : (
          <div className="event-list" aria-label="Execution event list">
            {!visibleEvents.length && <p className="empty-state">No events at this point in playback.</p>}
            {visibleEvents.map((event) => (
              <button
                key={event.event_id}
                className={selected === event.instance_id ? 'selected' : ''}
                onClick={() => setSelected(event.instance_id)}
              >
                <span className="event-sequence">{event.sequence.toString().padStart(3, '0')}</span>
                <span className={`event-mark ${event.type}`} />
                <span>
                  <strong>{label(event.type)}</strong>
                  <small>
                    {displayName(String(event.payload.label || event.payload.selected_route || event.instance_id))}
                  </small>
                </span>
                <time>{new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}</time>
                <span className="micro">Attempt {event.attempt}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
