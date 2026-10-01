import { useState, type ComponentProps } from 'react';
import type { LiveDiscoveryResponse } from '../lib/api.generated';
import { api } from '../lib/api';
import { useLiveLesson } from '../lib/useLiveLesson';
import { useFrontierModel } from '../lib/useFrontierModel';
import { FrontierModelSelect } from '../components/FrontierModelSelect';
import { DiscoveryJourney } from '../components/DiscoveryJourney';
import { Icon } from '../components/Icon';
import { ExploreLesson } from './ExploreLesson';

export function DiscoveryLesson({ task, ...props }: ComponentProps<typeof ExploreLesson> & { task: 'find' | 'compare' }) {
  const live = useLiveLesson<LiveDiscoveryResponse>();
  const [frontierModel, selectFrontierModel] = useFrontierModel();
  const [experience, setExperience] = useState<'simulation' | 'live'>(() => typeof window !== 'undefined' && window.sessionStorage.getItem('discovery-experience') === 'live' ? 'live' : 'simulation');
  const run = () => { void live.start(() => api.discoverLesson(task, 'live', frontierModel)); };
  const result = live.state.status === 'complete' ? live.state.response : undefined;
  if (props.recorded) return <ExploreLesson {...props} />;
  return <div className="discovery-lesson">
    <div className="lesson-experience-choice" role="group" aria-label="Discovery mode">{(['simulation', 'live'] as const).map(mode => <button key={mode} className="secondary small" aria-pressed={experience === mode} disabled={live.inFlight} onClick={() => { live.leave(); setExperience(mode); window.sessionStorage.setItem('discovery-experience', mode); }}>{mode === 'simulation' ? 'Simulation' : 'Live models'}</button>)}<span>{experience === 'simulation' ? 'Prepared responses · no model calls · no setup needed' : 'Real model requests · provider charges apply'}</span></div>
    <p className="page-task-guide">{experience === 'simulation' ? 'Choose a request, then Run simulation. Follow the route and open View results at its output.' : 'Choose a request, then Run Find or Run Compare. Replay the returned route without another model call.'}</p>
    <section className="discovery-workbench" aria-label="Discovery workflow">
      {experience === 'live' && <header className="discovery-run-toolbar">
        <div className="discovery-request"><span className="eyebrow">Following one request</span><h2>{String(props.snapshot.run.request.query)}</h2></div>
        {experience === 'live' && <div className="discovery-run-actions">
          <FrontierModelSelect value={frontierModel} disabled={live.inFlight} onChange={model => { selectFrontierModel(model); live.leave(); }} />
          <button className="primary" disabled={live.inFlight} onClick={run}><Icon name="play" size={16} />{live.inFlight ? 'Running…' : `Run ${task === 'compare' ? 'Compare' : 'Find'}`}</button>
        </div>}
      </header>}
      <DiscoveryJourney snapshot={result?.snapshot || props.snapshot} documents={result?.documents || props.documents}
        liveState={live.state} autoPlay={!!result} simulation={experience === 'simulation'} requestTitle={String(props.snapshot.run.request.query)} onPrepared={live.leave} />
    </section>
    <footer className="discovery-lesson-footer"><span>Synthetic sources · {experience === 'simulation' ? 'prepared simulation · no model calls' : result ? 'returned execution · illustrated replay' : 'live calls on Run · provider charges apply'}</span>
      <div><button className="text-button" onClick={props.next}>{props.nextLabel}<Icon name="arrow" size={14} /></button><button className="text-button" onClick={props.onExperiment}>Explore a safeguard</button></div></footer>
  </div>;
}
