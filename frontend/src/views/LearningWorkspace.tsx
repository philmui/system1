import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import rawCatalogue from '../data/lessons.json' with { type: 'json' };
import type { LessonCatalogue, LessonDocument, RunSnapshot } from '../lib/api.generated';
import { api } from '../lib/api';
import { learningHref, type AppRoute, type Scene } from '../lib/navigation';
import { ExploreLesson } from './ExploreLesson';
import { DiscoveryLesson } from './DiscoveryLesson';
import { Icon } from '../components/Icon';

const ReviewWorkflow = lazy(() => import('./ReviewWorkflow').then(module => ({ default: module.ReviewWorkflow })));
const PolicyExperiment = lazy(() => import('./PolicyExperiment').then(module => ({ default: module.PolicyExperiment })));
const CompareStrategies = lazy(() => import('./CompareStrategies').then(module => ({ default: module.CompareStrategies })));
const catalogue = rawCatalogue as unknown as LessonCatalogue;
const sceneTitles: Record<Scene, string> = { classify: 'Classify documents', discover: 'Find & compare', review: 'Review & redact', safeguards: 'Explore a safeguard' };

export function LearningWorkspace({ route }: { route: AppRoute }) {
  const [recorded, setRecorded] = useState<{ snapshot: RunSnapshot; documents: LessonDocument[] } | null>(null);
  const [error, setError] = useState('');
  const autoplay = useRef(false);
  const [replaySelection, setReplaySelection] = useState(0);
  useEffect(() => {
    if (!route.runId) { setRecorded(null); setError(''); return; }
    let active = true;
    setRecorded(null); setError('');
    void api.snapshot(route.runId).then(async snapshot => {
      const ids = Array.isArray(snapshot.run.request.document_ids) ? snapshot.run.request.document_ids as string[]
        : [...new Set(((snapshot.run.result?.passages || []) as { document_id: string }[]).map(p => p.document_id))];
      const items = await Promise.all(ids.map(async id => {
        const { document, passages } = await api.document(id);
        return { example_id: id, title: document.filename, cue: 'Recorded document', document, passages,
          text: passages.map(p => p.text).join('\n\n'), source_excerpt: passages[0]?.text || '', reference_category: 'unknown' as const, expected_reason: '', controlled_signal: false };
      }));
      if (active) setRecorded({ snapshot, documents: items });
    }).catch(caught => { if (active) setError(caught instanceof Error ? caught.message : 'This recording is unavailable.'); });
    return () => { active = false; };
  }, [route.runId]);
  const go = (view: 'explore' | 'compare' | 'experiment', updates: Partial<AppRoute> = {}) => { window.location.hash = learningHref(view, { ...route, ...updates }); };
  const choose = (example: string) => { autoplay.current = true; setReplaySelection(value => value + 1); go(route.view === 'experiment' ? 'experiment' : 'explore', { example, documentId: recorded ? example : null }); };
  const lesson = recorded || catalogue.classification;
  const safeguard = catalogue.safeguards.find(item => item.id === route.example) || catalogue.safeguards[0];
  const example = recorded ? route.documentId || lesson.documents[0]?.example_id : route.example;
  const sceneSelect = (scene: Scene) => { autoplay.current = false; go('explore', { scene, example: scene === 'discover' ? 'find' : 'clear', runId: null, documentId: null }); };
  return <div className={`learning-workspace ${route.view === 'explore' && route.scene === 'discover' && !route.runId ? 'is-discovery-explore' : ''}`}>
    <header className="learning-heading"><div><span className="eyebrow">Disaggregated intelligence</span><h1>{route.view === 'compare' ? 'Compare strategies' : route.view === 'experiment' ? 'Change one decision' : sceneTitles[route.scene]}</h1></div>
      <div className="learning-context"><span className="lesson-mode-pill"><i />{route.runId ? 'Recorded run' : 'Synthetic examples'}</span>
        {route.view === 'explore' && <label className="scene-picker"><span className="sr-only">Choose a scene</span><select aria-label="Choose a scene" value={route.scene} onChange={event => sceneSelect(event.target.value as Scene)}>
          <option value="classify">Classify documents</option><option value="discover">Find & compare</option><option value="review">Review & redact</option>
        </select></label>}
      </div></header>
    {route.runId && <div className="recording-context"><Icon name="runs" size={15} /><span>Exploring {route.runId.slice(0, 8)}</span><a href={`#runs/${route.runId}`}>Full run</a><button className="text-button" onClick={() => go('explore', { scene: 'classify', example: 'clear', runId: null, documentId: null })}>Teaching examples</button></div>}
    {error ? <div className="empty-state"><Icon name="alert" /><h2>Could not open this recording</h2><p>{error}</p><a className="secondary" href="#runs">Back to runs</a></div>
      : route.runId && !recorded ? <div className="loading">Opening retained decisions…</div>
          : route.scene === 'review' && route.view !== 'experiment' ? <><p className="scene-caption">Choose a page and run the simulation to compare both approaches. Human review pauses each page until you give a verdict.</p><Suspense fallback={<div className="loading">Opening review…</div>}><ReviewWorkflow key={route.view} initialExperience="illustration" /></Suspense></>
          : route.view === 'explore' && route.scene === 'classify' ? <ExploreLesson key={`${lesson.snapshot.run.id}:${example}:${replaySelection}`} snapshot={lesson.snapshot} documents={lesson.documents} example={example} onChoose={choose} autoPlay={autoplay.current} recorded={!!recorded} allowLiveRun
            next={() => recorded ? go('compare', { source: 'recorded' }) : choose(example === 'clear' ? 'ambiguous' : example === 'ambiguous' ? 'proposed' : 'clear')}
            nextLabel={recorded ? 'Compare this recording' : example === 'clear' ? 'Try a mixed-purpose report' : example === 'ambiguous' ? 'See proposed agreement terms' : 'Follow a clear invoice'}
            onCompare={() => go('compare', { source: 'recorded' })} onExperiment={() => go('experiment')} />
            : route.view === 'explore' && route.scene === 'discover' ? <>
              {!recorded && <div className="discovery-example-choices" role="group" aria-label="Discovery tasks"><button className={`secondary ${route.example !== 'compare' ? 'active' : ''}`} aria-pressed={route.example !== 'compare'} onClick={() => choose('find')}><Icon name="search" />Find a policy<span>No narrative needed</span></button><button className={`secondary ${route.example === 'compare' ? 'active' : ''}`} aria-pressed={route.example === 'compare'} onClick={() => choose('compare')}><Icon name="sparkle" />Compare policies<span>Compose with evidence</span></button><a className="text-button" href="#discover">Search your documents<Icon name="arrow" size={14} /></a></div>}
              <DiscoveryLesson key={`${route.example}:${replaySelection}`} task={route.example === 'compare' ? 'compare' : 'find'} snapshot={recorded?.snapshot || (route.example === 'compare' ? catalogue.discovery.compare : catalogue.discovery.find)} documents={recorded?.documents || catalogue.discovery.documents} example={catalogue.discovery.documents[0].example_id} onChoose={() => {}} autoPlay={autoplay.current} recorded={!!recorded}
                next={() => recorded ? go('explore', { scene: 'discover', example: 'compare', runId: null, documentId: null }) : choose(route.example === 'compare' ? 'find' : 'compare')} nextLabel={recorded ? 'Try the prepared comparison lesson' : route.example === 'compare' ? 'Try direct retrieval' : 'Try a comparison request'} onCompare={() => go('compare')}
                onExperiment={() => go('experiment', { scene: 'safeguards', example: 'invalid-citation', runId: null })} />
            </> : route.view === 'experiment' && route.scene === 'classify' && !recorded ? <Suspense fallback={<div className="loading">Opening policy controls…</div>}><PolicyExperiment example={route.example} onChoose={id => go('experiment', { example: id })} onExplore={id => go('explore', { example: id, documentId: null })} onSafeguards={() => go('experiment', { scene: 'safeguards', example: 'guard' })} /></Suspense>
              : route.view === 'experiment' && route.scene === 'safeguards' ? <>
                <p className="page-task-guide">Choose a safeguard, then Run simulation to inspect its recorded outcome. Pause or step through the rule and the selected route. These prepared recordings make no model calls.</p>
                <div className="safeguard-choices" role="group" aria-label="Choose a safeguard">{catalogue.safeguards.map(item => <button key={item.id} className="secondary" aria-pressed={item.id === safeguard.id} onClick={() => { autoplay.current = false; go('experiment', { example: item.id, documentId: null }); }}><Icon name="shield" size={17} />{item.title}</button>)}</div>
                <div className="safeguard-context"><strong>{safeguard.title}</strong><p>{safeguard.explanation}</p><details><summary>Recorded safeguard result</summary><dl className="lesson-facts">{Object.entries(safeguard.observed).map(([key, value]) => <div key={key}><dt>{key === 'passed' ? 'Safeguard behaved as expected' : key.replaceAll('_', ' ')}</dt><dd>{String(value)}</dd></div>)}</dl><p className="micro">Whole isolated recording. A safeguard passing does not mean the affected document succeeded.</p></details></div>
                <ExploreLesson key={`${safeguard.id}:${route.documentId}:${replaySelection}`} autoPlay={autoplay.current} snapshot={safeguard.snapshot} documents={safeguard.documents} example={(safeguard.documents.find(item => item.document.id === route.documentId) || safeguard.documents.find(item => item.example_id === 'proposed' || item.example_id === 'ambiguous') || safeguard.documents[0])?.example_id} onChoose={id => { autoplay.current = true; setReplaySelection(value => value + 1); go('experiment', { documentId: safeguard.documents.find(item => item.example_id === id)?.document.id || null }); }} next={() => go('experiment', { scene: 'classify', example: 'proposed', documentId: null })} nextLabel="Try changing the policy" compareLabel="Compare a normal workload" onCompare={() => go('compare', { scene: 'classify', example: 'clear', source: 'recorded', documentId: null })} onExperiment={() => go('experiment', { scene: 'classify', example: 'proposed', documentId: null })} />
              </> : route.view === 'compare' && route.scene === 'classify' ? <Suspense fallback={<div className="loading">Opening strategy comparison…</div>}><CompareStrategies
                embedded recorded={{ run: lesson.snapshot.run, events: lesson.snapshot.events, documentNames: Object.fromEntries(lesson.documents.map(item => [item.document.id, item.title])) }}
                source={route.source} onSourceChange={source => go('compare', { source })} selectedDocumentId={route.documentId || lesson.documents.find(item => item.example_id === example)?.document.id}
                onSelectDocument={documentId => { if (!documentId.startsWith('virtual:')) go('compare', { documentId }); }} publication={lesson.snapshot.run.graph_version.includes('v2') ? 'independent' : 'batch'} onExplore={documentId => go('explore', { documentId: documentId || route.documentId, example: lesson.documents.find(item => item.document.id === documentId)?.example_id || route.example })} /></Suspense>
                : <div className="lesson-context-choice"><Icon name="layers" size={32} /><h2>{route.view === 'compare' ? 'Choose a strategy comparison' : 'Choose a policy experiment'}</h2><p>{recorded ? 'This recording stays unchanged. Policy experiments use a separate prepared example.' : `Current scene: ${sceneTitles[route.scene]}. Keep exploring, or open a supported classification lesson.`}</p><a className="primary" href={learningHref(route.view === 'compare' ? 'compare' : 'experiment', { scene: 'classify', example: 'proposed' })}>Open classification</a><a className="secondary" href={learningHref('explore', route)}>Return to this scene</a></div>}
  </div>;
}

export { catalogue as lessonCatalogue };
