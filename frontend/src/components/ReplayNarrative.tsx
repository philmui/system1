import type { ReplayStage, ReplayStep } from '../lib/replay';
import { readableFilename } from '../lib/replay';
import { displayName } from '../lib/naming';
import { Icon } from './Icon';

const stageNames: Record<ReplayStage, string> = {
  read: 'Read', classify: 'Judge', route: 'Route', interpret: 'Interpret', collect: 'Collect',
  review: 'Review', index: 'Index', done: 'Outcome',
};

export function ReplayNarrative({ step, history, filename, documentNumber, total, live, playing, onInspect }: {
  step?: ReplayStep; history: ReplayStep[]; filename?: string; documentNumber: number; total: number;
  live: boolean; playing: boolean; onInspect: (id: string) => void;
}) {
  const visited = new Set(history.map(item => item.stage));
  const path: ReplayStage[] = ['read', 'classify', 'route', ...(visited.has('interpret') ? ['interpret' as const] : []),
    'collect', ...(visited.has('review') ? ['review' as const] : []), 'index', 'done'];
  const role = step?.role || 'source';
  const status = live ? 'Recorded activity' : playing ? 'Replaying' : step?.kind === 'complete' ? 'Replay complete' : 'Paused';
  return <div className={`replay-narrative role-${role} ${step?.kind === 'error' ? 'has-issue' : ''}`} data-testid="replay-narrative">
    <div className="replay-subject">
      <span className="replay-paper" aria-hidden="true"><Icon name={filename ? 'file' : 'layers'} size={21} /><b>{filename ? String(documentNumber).padStart(2, '0') : total}</b></span>
      <div><span className="replay-kicker">{filename ? `Following document ${String(documentNumber).padStart(2, '0')} of ${total}` : `Batch overview · ${total} documents`}</span>
        <strong title={filename}>{filename ? readableFilename(filename) : 'All documents'}</strong>
        <small>{filename ? 'One document’s recorded journey' : 'Activity in recorded order'}</small>
      </div>
    </div>
    <div className="replay-explanation" aria-live="polite" aria-atomic="true">
      <div className="replay-step-meta"><span className={`replay-status ${playing ? 'is-playing' : ''}`}><i />{status}</span>
        {step?.badge && <span className="replay-decision-badge">{step.badge}</span>}
      </div>
      <strong className="replay-step-title">{displayName(step?.title || 'Follow the document, step by step')}</strong>
      <p>{displayName(step?.detail || 'Press play to see the document move through classification, the chosen route, and its outcome.')}</p>
    </div>
    <button className="quiet small replay-inspect" disabled={!step} onClick={() => step && onInspect(step.source || step.instanceId)} title="Pause and inspect this step">
      <Icon name="search" size={14} /><span>Inspect step</span>
    </button>
    <ol className="replay-stages" aria-label="Document processing stages">
      {path.map(stage => <li key={stage} className={`${step?.stage === stage ? 'is-current' : ''} ${visited.has(stage) && step?.stage !== stage ? 'is-visited' : ''}`} aria-current={step?.stage === stage ? 'step' : undefined}>
        <span>{visited.has(stage) && step?.stage !== stage ? <Icon name="check" size={11} /> : <i />}{stageNames[stage]}</span><Icon name="chevron" size={10} />
      </li>)}
    </ol>
  </div>;
}
