import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Document, Run, SearchFilters } from './lib/api.generated';
import { api, API_BASE, label, shortDate, type Health } from './lib/api';
import { Icon, Status } from './components/Icon';
import { AppGuide } from './components/AppGuide';
import { SourcePanel } from './components/Inspector';
import { Library } from './views/Library';
import { Discover } from './views/Discover';
import { useTheme } from './lib/theme';
import { isLearning, learningHref, parseLocation, type View } from './lib/navigation';

const RunWorkspace = lazy(() => import('./views/RunWorkspace').then(module => ({ default: module.RunWorkspace })));
const LearningWorkspace = lazy(() => import('./views/LearningWorkspace').then(module => ({ default: module.LearningWorkspace })));
const locationState = () => parseLocation(window.location.hash);
export default function App() {
  const { theme, setTheme } = useTheme();
  const refreshVersion = useRef(0);
  const [route, setRoute] = useState(locationState);
  const lastLearning = useRef(parseLocation(window.sessionStorage.getItem('learning-context') || '#explore/classify'));
  const [health, setHealth] = useState<Health | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({ categories: [], date_from: null, date_to: null });
  const [excludedDates, setExcludedDates] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<{ documentId?: string; passageId?: string; quote?: string } | null>(
    null,
  );
  const [settings, setSettings] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const handler = () => setRoute(locationState());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    const pauseForDetails = (event: Event) => {
      if (event.target instanceof HTMLDetailsElement && event.target.open)
        window.dispatchEvent(new Event('pause-workflow-playback'));
    };
    const pauseWhenHidden = () => { if (document.hidden) window.dispatchEvent(new Event('pause-workflow-playback')); };
    document.addEventListener('toggle', pauseForDetails, true);
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => { document.removeEventListener('toggle', pauseForDetails, true); document.removeEventListener('visibilitychange', pauseWhenHidden); };
  }, []);
  useEffect(() => {
    if (isLearning(route.view)) {
      lastLearning.current = route;
      window.sessionStorage.setItem('learning-context', learningHref(route.view, route));
    }
  }, [route]);
  const navigate = (view: View, id?: string) => {
    window.location.hash = `${view}${id ? `/${id}` : ''}`;
  };
  const refresh = useCallback(() => {
    const version = ++refreshVersion.current;
    void Promise.all([api.health(), api.documents(undefined, true), api.runs()])
      .then(([nextHealth, nextDocuments, nextRuns]) => {
        if (version !== refreshVersion.current) return;
        setHealth(nextHealth);
        setAllDocuments(nextDocuments.documents);
        setRuns(nextRuns.runs);
      })
      .catch((caught) => {
        if (version === refreshVersion.current)
          setError(caught instanceof Error ? caught.message : 'Could not connect to the backend.');
      });
    void api
      .documents(filters)
      .then((result) => {
        if (version !== refreshVersion.current) return;
        setDocuments(result.documents);
        setExcludedDates(result.excluded_unknown_dates || 0);
      })
      .catch((caught) => {
        if (version === refreshVersion.current)
          setError(caught instanceof Error ? caught.message : 'Could not load documents.');
      });
  }, [filters]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The request failed.');
    } finally {
      setBusy(false);
    }
  };
  const showSource = (documentId?: string, passageId?: string, quote?: string) =>
    setSource({ documentId, passageId, quote });
  const closeSource = useCallback(() => setSource(null), []);
  const pending = runs.filter((run) => run.status === 'awaiting_review').length;
  const displayedMode = route.runId ? runs.find(run => run.id === route.runId)?.mode : health?.mode;
  return (
    <div className={`app-shell education-shell ${isLearning(route.view) ? 'learning-active' : 'workspace-active'}`}>
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
      <aside className="sidebar">
        <a className="brand" href="#explore/classify" aria-label="Document Discovery Studio home" title="Document Discovery Studio">
          <span className="brand-mark">
            <Icon name="workflow" size={24} />
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          {(['explore', 'compare', 'experiment'] as const).map(view => <a href={learningHref(view, isLearning(route.view) ? route : lastLearning.current)} key={view} aria-current={route.view === view ? 'page' : undefined} className={route.view === view ? 'active' : ''}>
            <Icon name={view === 'explore' ? 'workflow' : view === 'compare' ? 'layers' : 'sliders'} size={20} /><small>{label(view)}</small>
          </a>)}
        </nav>
        <span className="workspace-nav-label">Workspace</span>
        <nav className="main-nav workspace-nav" aria-label="Workspace">
          {(['library', 'runs'] as const).map((view) => (
            <a href={view === 'library' ? '#documents' : '#runs'} key={view} aria-label={view === 'library' ? 'Documents' : 'Runs'} aria-current={route.view === view ? 'page' : undefined} title={view === 'library' ? 'Documents' : 'Runs'} className={route.view === view ? 'active' : ''}>
              <Icon name={view} size={19} />
              <small>{view === 'library' ? 'Documents' : 'Runs'}</small>
              {view === 'runs' && pending > 0 && <span className="pending-count" aria-label={`${pending} awaiting review`}>{pending}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="readiness-button" aria-label="Integration readiness" title={health ? 'Integration readiness' : 'Backend unavailable'} onClick={() => setSettings((value) => !value)}>
            <Icon name="sliders" size={19} />
            <i className={health ? 'connected-dot' : 'disconnected-dot'} />
          </button>
        </div>
      </aside>
      <main className="main-content" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb">
            <span className="studio-name">Discovery Studio</span>
            <Icon name="chevron" size={12} />
            <strong>{isLearning(route.view) ? label(route.view) : 'Your workspace'}</strong>
            {route.runId && (
              <>
                <Icon name="chevron" size={12} />
                <span>Run {route.runId.slice(0, 8)}</span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <button className="quiet small app-help" aria-label="How to use" onClick={() => { window.dispatchEvent(new Event('pause-workflow-playback')); setGuideOpen(true); }}><Icon name="info" size={16} /><span>How to use</span></button>
            <span className={`mode-label ${isLearning(route.view) && !route.runId || displayedMode === 'test-fixture' ? 'simulated' : ''}`}>
              <i />{isLearning(route.view) && !route.runId ? 'Interactive lessons' : displayedMode ? (displayedMode === 'test-fixture' ? 'Simulated' : 'Live providers') : route.runId ? 'Recorded run' : 'Connecting'}
            </span>
            <div className="theme-toggle" role="group" aria-label="Color scheme">
              <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')} title="Dark mode"><Icon name="moon" size={13} /><span>Dark</span></button>
              <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')} title="Light mode"><Icon name="sun" size={14} /><span>Light</span></button>
            </div>
          </div>
        </header>
        {guideOpen && <AppGuide onClose={() => setGuideOpen(false)} />}
        {error && (!isLearning(route.view) || settings) && (
          <div className="global-error error-banner" role="alert">
            <span>{error}</span>
            <button
              className="quiet small"
              onClick={() => {
                setError(null);
                refresh();
              }}
            >
              Retry
            </button>
            <button className="icon-button" onClick={() => setError(null)} aria-label="Dismiss error">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
        {settings && (
          <section className="readiness-panel">
            <div className="section-toolbar">
              <div>
                <span className="eyebrow">Configuration readiness</span>
                <h2>Connected components</h2>
              </div>
              <button className="icon-button" aria-label="Close readiness" onClick={() => setSettings(false)}>
                <Icon name="close" />
              </button>
            </div>
            <p>
              Configuration checks do not establish provider availability. A live run verifies reachability.
            </p>
            <div className="readiness-grid">
              {Object.entries(health?.integrations || {}).map(([name, value]) => (
                <div key={name}>
                  <strong>{label(name)}</strong>
                  <Status value={String(value)} />
                </div>
              ))}
              <div>
                <strong>SQLite FTS5</strong>
                <Status value={health?.fts5 ? 'available' : 'unavailable'} />
              </div>
            </div>
            <p className="micro">Backend: {API_BASE || `${window.location.origin}/api`}</p>
            <p className="micro">
              {health?.mode === 'test-fixture'
                ? 'Simulated mode uses deterministic provider fixtures. The documents are synthetic separately from the provider mode.'
                : 'Live mode sends selected document context to configured providers. Provider failures never substitute fixtures.'}
            </p>
          </section>
        )}
        {isLearning(route.view) && <Suspense fallback={<div className="loading">Opening lesson…</div>}><LearningWorkspace route={route} /></Suspense>}
        {route.view === 'library' && (
          <Library
            documents={documents}
            busy={busy}
            selected={selected}
            onSelected={setSelected}
            onCleanup={() => act(async () => {
              const result = await api.cleanupDocuments();
              setSelected(ids => ids.filter(id => !result.archived_document_ids.includes(id)));
              setToast(result.archived_document_ids.length
                ? `Removed ${result.archived_document_ids.length} unsuccessful documents from the collection. Run history is retained.`
                : 'No unsuccessful documents to clear. Active and pending review documents are retained.');
            })}
            onSamples={() =>
              act(async () => {
                const result = await api.samples();
                setSelected(
                  result.documents
                    .filter((document) => !document.indexed)
                    .slice(0, 30)
                    .map((document) => document.id),
                );
                setToast('Project Atlas loaded. Select documents and start classification.');
              })
            }
            onUpload={(files, date) =>
              act(async () => {
                const uploaded = await api.upload(files, date);
                const run = await api.classify(uploaded.documents.map((document) => document.id));
                setSelected([]);
                navigate('runs', run.id);
              })
            }
            onClassify={() =>
              act(async () => {
                const run = await api.classify(selected);
                setSelected([]);
                navigate('runs', run.id);
              })
            }
            onSource={(id) => showSource(id)}
            filters={filters}
            onFilters={setFilters}
            excludedDates={excludedDates}
          />
        )}
        {route.view === 'discover' && (
          <Discover
            busy={busy}
            indexedCount={allDocuments.filter((document) => document.indexed).length}
            onDiscover={(query, selectedFilters) =>
              act(async () => {
                const run = await api.discover(query, selectedFilters);
                navigate('runs', run.id);
              })
            }
          />
        )}
        {route.view === 'runs' &&
          (route.runId ? (
            <Suspense fallback={<div className="loading">Opening run…</div>}><div className="run-learning-link"><a className="text-button" href={learningHref('explore', { scene: runs.find(item => item.id === route.runId)?.kind === 'discovery' ? 'discover' : 'classify', runId: route.runId })}><Icon name="workflow" size={15} />Explore this run</a><a className="text-button" href={learningHref('explore', lastLearning.current)}>Return to lesson</a></div><RunWorkspace
              key={route.runId}
              id={route.runId}
              documents={allDocuments}
              onSource={showSource}
              onChanged={refresh}
              onOpen={(id) => navigate('runs', id)}
            /></Suspense>
          ) : (
            <div className="page">
              <div className="page-heading">
                <div>
                  <h1>Runs <span className="heading-count">{runs.length}</span></h1>
                  <p>Open a run to inspect its status, sources, and decisions. Replay shows recorded work without another model call.</p>
                </div>
                {runs.some(run => ['failed', 'partially_succeeded'].includes(run.status)) && <button className="secondary small" disabled={busy} onClick={() => act(async () => {
                  const result = await api.cleanupRuns();
                  setToast(`Cleared ${result.archived_run_ids.length} failed or partial runs. Their recorded history is retained.`);
                })}>Clear unsuccessful runs</button>}
              </div>
              {runs.length ? (
                <div className="runs-grid">
                  {[...runs].sort((a, b) => {
                    const aLesson = typeof a.request.lesson_order === 'number' ? a.request.lesson_order : Infinity;
                    const bLesson = typeof b.request.lesson_order === 'number' ? b.request.lesson_order : Infinity;
                    return aLesson === bLesson ? 0 : aLesson - bLesson;
                  }).map((run) => (
                    <button className="run-card" key={run.id} onClick={() => navigate('runs', run.id)}>
                      <div>
                        <span className="run-card-icon">
                          <Icon name={run.kind === 'classification' ? 'library' : 'search'} />
                        </span>
                        <span className="micro">{run.request.lesson_order ? `Example ${run.request.lesson_order} · ` : ''}{run.mode === 'test-fixture' ? 'Simulated' : 'Live'}</span>
                      </div>
                      <h3>
                        {run.kind === 'classification'
                          ? String(run.request.lesson_title || 'Document classification')
                          : String(run.request.query || 'Discovery')}
                      </h3>
                      {typeof run.request.lesson_summary === 'string' && <p className="run-lesson-summary">{run.request.lesson_summary}</p>}
                      {run.kind === 'classification' && <span className="micro">{Array.isArray(run.request.document_ids) ? run.request.document_ids.length : 0} documents{run.request.simulated_review ? ' · review also simulated' : ''}</span>}
                      <p>
                        {shortDate(run.created_at)} · {run.id.slice(0, 8)}
                      </p>
                      <div>
                        <Status value={run.status} />
                        <Icon name="arrow" size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state big-empty">
                  <Icon name="runs" size={36} />
                  <h2>No runs yet.</h2>
                  <p>
                    Classify a document or ask your collection a question to create a visible execution
                    record.
                  </p>
                  <button className="primary" onClick={() => navigate('library')}>
                    Open your library
                    <Icon name="arrow" size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
      </main>
      {toast && (
        <div role="status" className="toast">
          <Icon name="check" size={16} />
          {toast}
        </div>
      )}
      {source && <SourcePanel {...source} onClose={closeSource} onUpdated={refresh} />}
    </div>
  );
}
