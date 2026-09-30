import { displayName } from '../lib/naming';
import { useMemo } from 'react';
import type { Claim, Decision, Event, NodePayload, QueryPlan, Run } from '../lib/api.generated';
import type { Execution } from '../lib/events';
import { duration, timingFromEvents, type ComponentKind } from '../lib/timing';
import { Icon } from './Icon';
const names: Record<ComponentKind, string> = {
  jev: 'System 1 Model',
  openai: 'OpenAI',
  retrieval: 'Extraction / retrieval / indexing',
  policy: 'Application policy',
  workflow: 'AgentGraph control',
};
export function RunEducation({
  events,
  run,
  execution,
  selected,
  onSelect,
  onSource,
}: {
  events: Event[];
  run: Run;
  execution: Execution;
  selected: string | null;
  onSelect: (id: string) => void;
  onSource: (id: string, quote?: string) => void;
}) {
  const timing = useMemo(() => timingFromEvents(events), [events]);
  const latest = new Map<string, NodePayload>();
  for (const event of events)
    if (['node_completed', 'node_failed'].includes(event.type))
      latest.set(event.instance_id, event.payload as unknown as NodePayload);
  const payloads = [...latest.entries()];
  const measuredTotal = Math.max(
    1,
    timing.active || 1,
    ...timing.spans.map((span) => span.start + span.observed),
  );
  const rows = [
    ...new Set(
      timing.spans
        .filter((span) => span.component !== 'policy')
        .map((span) => (span.parentId?.startsWith('worker:') ? span.parentId : names[span.component])),
    ),
  ];
  const sumField = (suffix: string, field: 'input_count' | 'output_count') => {
    const values = payloads.filter(
      ([id, payload]) => id.endsWith(suffix) && payload[field] !== null && payload[field] !== undefined,
    );
    return values.length ? values.reduce((sum, [, payload]) => sum + (payload[field] || 0), 0) : null;
  };
  const result = execution.result;
  const plan = latest.get('plan')?.query_plan || (result?.plan as QueryPlan | undefined);
  const drafts = latest.get('synthesize')?.draft_claims || [];
  const draftCount = latest.get('synthesize')?.output_count ?? (drafts.length > 0 ? drafts.length : null);
  const screened = new Map<string, Decision>();
  for (const event of events)
    if (event.type === 'decision' && event.instance_id.endsWith(':screen')) {
      const decision = event.payload as unknown as Decision;
      screened.set(`${event.instance_id}:${decision.input_refs.join(',')}`, decision);
    }
  const screenedCount =
    screened.size > 0
      ? [...screened.values()].filter((decision) => decision.selected_route === 'keep').length
      : payloads.some(([id, node]) => id.endsWith(':screen') && node.state === 'succeeded')
        ? 0
        : null;
  const admission = events[0]
    ? Math.max(0, new Date(events[0].timestamp).getTime() - new Date(run.created_at).getTime())
    : null;
  const simpleFind = plan?.intent === 'find' || result?.intent === 'find';
  const discovery = run.kind === 'discovery';
  const steps: { id: string; title: string; count: number | null | undefined; note: string }[] = discovery
    ? [
        { id: 'plan', title: 'Search plan', count: plan?.tasks.length, note: 'Bounded lexical tasks' },
        {
          id: execution.workers[0] || 'plan',
          title: 'Candidate hits',
          count: sumField(':retrieve', 'output_count'),
          note: 'Before semantic screening',
        },
        {
          id: execution.workers[0] ? `${execution.workers[0].replace('worker:', '')}:screen` : 'join',
          title: 'Screened passages',
          count: screenedCount,
          note: 'System 1 Model relevance gate',
        },
        {
          id: 'join',
          title: 'Merged evidence',
          count: latest.get('join')?.output_count ?? (result?.passages as unknown[] | undefined)?.length,
          note: 'Screened, deduplicated passages',
        },
        { id: 'synthesize', title: 'Draft claims', count: draftCount, note: 'Generated; not yet validated' },
        {
          id: 'citations',
          title: 'Cited claims',
          count: latest.get('citations')?.output_count,
          note: latest.get('citations')?.removed_count
            ? `${latest.get('citations')?.removed_count} invalid claims removed`
            : 'IDs & quotations checked',
        },
        {
          id: 'support',
          title: 'Supported claims',
          count: latest.get('support')?.output_count ?? (result?.claims as Claim[] | undefined)?.length,
          note: latest.get('support')?.removed_count
            ? `${latest.get('support')?.removed_count} claims withheld`
            : 'Fallible System 1 Model support check',
        },
        {
          id: 'done',
          title: 'Final result',
          count: result
            ? result.intent === 'find'
              ? ((result.passages as unknown[] | undefined)?.length ?? 0)
              : ((result.claims as unknown[] | undefined)?.length ?? 0)
            : null,
          note: result?.intent === 'find' ? 'Source passages; no narrative' : 'Claims & evidence gaps',
        },
      ]
    : [
        {
          id: 'dispatch',
          title: 'Documents',
          count: execution.workers.length,
          note: 'One worker per input, including extraction issues',
        },
        {
          id: 'join',
          title: 'Worker outcomes',
          count: latest.get('join')?.completed,
          note: 'Accepted, proposed, or failed',
        },
        {
          id: 'review',
          title: 'Review decisions',
          count: events.filter((event) => event.type === 'review_resumed').at(-1)?.payload.count as
            number | undefined,
          note: execution.review ? 'Checkpoint awaits a person' : 'Original judgments retained',
        },
        {
          id: 'index',
          title: 'Indexed documents',
          count: latest.get('index')?.output_count ?? (result?.indexed_count as number | undefined),
          note: 'Accepted readable sources only',
        },
      ];
  const jevRequests = timing.spans.filter(span => span.component === 'jev');
  const jevLabel = (id: string, parent?: string) => id.startsWith('support:claim-') ? `Claim ${id.split('-').at(-1)} · support` : id === 'intent' ? 'Query intent' : id.endsWith(':screen') ? `${parent?.replace('worker:', '') || 'Task'} · relevance` : parent ? `Document ${execution.workers.indexOf(parent) + 1} · category` : 'Category judgment';
  const finished = ['succeeded', 'partially_succeeded', 'failed', 'cancelled', 'interrupted'].includes(
    execution.status,
  );
  const skipped = (id: string) =>
    (simpleFind && ['synthesize', 'citations', 'support'].includes(id)) ||
    (finished && !execution.instances[id]);
  const skipReason = simpleFind
    ? 'Skipped · find returns passages directly'
    : ['failed', 'cancelled', 'interrupted'].includes(execution.status)
      ? 'Not reached before execution stopped'
      : result?.intent === 'unsupported'
        ? 'Skipped · request outside scope'
        : 'Skipped · no work or accepted evidence';
  return (
    <section className="education-panel" aria-label="Latency and result formation">
      <div className="education-heading">
        <div>
          <h2>Measured work</h2>
        </div>
        <span className="tag">
          {run.mode === 'test-fixture' ? 'Simulated · artificial provider delays' : 'Observed execution'}
        </span>
      </div>
      <div className="formation-strip">
        {steps.map((step, index) => (
          <button
            key={`${step.id}-${index}`}
            className={`formation-step ${skipped(step.id) ? 'formation-skipped' : ''} ${selected === step.id ? 'selected' : ''}`}
            onClick={() => onSelect(step.id)}
          >
            <span className="formation-order">{String(index + 1).padStart(2, '0')}</span>
            <strong>
              {step.count === null || step.count === undefined ? '—' : step.count}
              <small>{step.title}</small>
            </strong>
            <span>{skipped(step.id) ? skipReason : step.note}</span>
          </button>
        ))}
      </div>
      <div className="timing-summary">
        <div>
          <span>Recorded wall time</span>
          <strong>{duration(timing.wall)}</strong>
          <small>Backend start → visible event</small>
        </div>
        <div>
          <span>Active wall time</span>
          <strong>{duration(timing.active)}</strong>
          <small>Review & recovery gaps excluded</small>
        </div>
        <div className="jev-summary">
          <span>
            <i />
            System 1 Model
          </span>
          <strong>{duration(timing.jev.total)}</strong>
          <small>
            {timing.jev.calls} attempts · {timing.jev.measured} measured · median{' '}
            {duration(timing.jev.median)}
          </small>
        </div>
        <div>
          <span>OpenAI request time</span>
          <strong>{duration(timing.openai.total)}</strong>
          <small>
            {timing.openai.calls} attempts · {timing.openai.measured} measured
          </small>
        </div>
      </div>
      <div className="jev-requests" aria-label="System 1 Model request timings">
        <div className="jev-requests-heading"><span className="section-label">System 1 Model · request by request</span><span>{jevRequests.length > 8 ? `First 8 of ${jevRequests.length}; all attempts in the timing table` : 'Click a request to inspect its judgment'}</span></div>
        {!jevRequests.length && <p className="micro">System 1 Model request timings will appear as work executes.</p>}
        <div className="jev-request-grid">{jevRequests.slice(0, 8).map(span => <button key={span.id} className={`jev-request ${selected === span.instanceId ? 'selected' : ''}`} onClick={() => onSelect(span.instanceId)} title={displayName(span.label)}>
          <span>{jevLabel(span.instanceId, span.parentId)}</span><strong>{duration(span.measurement === 'provider' ? span.elapsed : null)}</strong><small>{span.state === 'succeeded' ? span.measurement === 'provider' ? 'Measured request' : 'Timing unavailable' : span.state === 'running' ? 'Pending · no final duration' : span.state.replaceAll('_', ' ')} · attempt {span.attempt}</small>
        </button>)}</div>
      </div>
      <div className="timing-chart">
        <div className="timing-chart-header">
          <span className="section-label">
            {timing.timingIncomplete ? 'Incomplete execution interval' : 'Execution lanes · active time'}
          </span>
          <span>
            0<small>{timing.timingIncomplete ? 'Active time unavailable' : duration(measuredTotal)}</small>
          </span>
        </div>
        {timing.timingIncomplete && (
          <p className="notice">
            Active wall time is unavailable because the previous process stopped without a recorded boundary.
            Its downtime cannot be separated from execution. Measured component timings remain available
            below.
          </p>
        )}
        {rows.length === 0 && (
          <p className="micro">
            Execution spans appear when recorded work starts. Pending timings remain unavailable.
          </p>
        )}
        {!timing.timingIncomplete &&
          rows.map((row) => {
            const spans = timing.spans.filter(
              (span) =>
                (span.parentId?.startsWith('worker:') ? span.parentId : names[span.component]) === row &&
                span.component !== 'policy',
            );
            const rowLabel = row.startsWith('worker:')
              ? execution.instances[row]?.documentId
                ? `Document ${execution.workers.indexOf(row) + 1}`
                : `Retrieval task ${execution.workers.indexOf(row) + 1}`
              : row;
            return (
              <div className="timing-lane" key={row}>
                <span title={row}>{rowLabel}</span>
                <div className="timing-track">
                  {spans.map((span) => (
                    <button
                      key={span.id}
                      aria-label={`${displayName(span.label)}: ${duration(span.elapsed)}; attempt ${span.attempt}`}
                      title={`${displayName(span.label)}\nObserved stage interval: ${duration(span.observed)}\n${duration(span.elapsed)} ${span.measurement === 'provider' ? 'provider request elapsed' : span.measurement === 'stage' ? 'whole stage elapsed' : 'measurement unavailable'}\nQueue wait: ${duration(span.queue)}\nAttempt ${span.attempt}`}
                      className={`timing-span span-${span.component} ${span.state === 'running' ? 'pending' : ''} ${selected === span.instanceId ? 'selected' : ''}`}
                      style={{
                        left: `${(span.start / measuredTotal) * 100}%`,
                        width: `${Math.max(0.65, (span.observed / measuredTotal) * 100)}%`,
                      }}
                      onClick={() => onSelect(span.instanceId)}
                    >
                      <span>
                        {displayName(span.label)} · {duration(span.elapsed)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        <div className="timing-legend">
          {Object.entries(names)
            .filter(([kind]) => kind !== 'policy')
            .map(([kind, name]) => (
              <span key={kind}>
                <i className={`span-${kind}`} />
                {name}
              </span>
            ))}
        </div>
      </div>
      <div className="timing-notes">
        <p>
          <strong>Read the lanes horizontally.</strong> Bars use recorded stage start and finish events;
          overlapping stages ran concurrently. Their widths include orchestration overhead around provider
          requests. Unfilled intervals can include unmeasured checkpointing, event persistence, scheduling,
          and trace delivery. System 1 Model and OpenAI totals sum measured request elapsed time, including network time; they
          overlap and must not be added to wall time.
        </p>
        <p>
          Human review:{' '}
          {timing.awaitingReview
            ? 'awaiting a response; duration pending'
            : timing.review > 0
              ? duration(timing.review)
              : 'no completed pause'}
          . Deterministic policy:{' '}
          {duration(
            timing.spans.some((span) => span.component === 'policy')
              ? timing.spans
                  .filter((span) => span.component === 'policy')
                  .reduce((sum, span) => sum + (span.elapsed || 0), 0)
              : null,
          )}{' '}
          across {timing.spans.filter((span) => span.component === 'policy').length} recorded rules. Recovery
          suspension:{' '}
          {timing.awaitingRecovery
            ? 'awaiting recovery; duration pending'
            : timing.suspended > 0
              ? duration(timing.suspended)
              : 'no completed suspension'}
          . Admission wait before the first start: {duration(admission)}. Wall time excludes upload, HTTP
          request handling before run creation, and browser rendering. Replay preserves these measurements.
          Very short bars use a minimum clickable width.
        </p>
      </div>
      {!!timing.spans.length && (
        <details className="timing-details">
          <summary>Inspect component timings and queue waits</summary>
          <div className="timing-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Component / step</th>
                  <th>Request or stage elapsed</th>
                  <th>Queue wait</th>
                  <th>Attempt</th>
                </tr>
              </thead>
              <tbody>
                {timing.spans.map((span) => (
                  <tr key={span.id}>
                    <td>
                      <button className="text-button" onClick={() => onSelect(span.instanceId)}>
                        {displayName(span.label)}
                      </button>
                      <small>{names[span.component]}</small>
                    </td>
                    <td>
                      {duration(span.elapsed)}
                      {span.measured && (
                        <small>
                          {span.measurement === 'provider'
                            ? 'Provider request elapsed'
                            : span.measurement === 'policy'
                              ? 'Deterministic rule elapsed'
                              : 'Whole stage elapsed, including its overhead'}
                        </small>
                      )}
                      {!span.measured && span.state !== 'running' && (
                        <small>Observed span {duration(span.observed)}; no reported measurement</small>
                      )}
                    </td>
                    <td>{duration(span.queue)}</td>
                    <td>{span.attempt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {(plan || drafts.length > 0) && (
        <div className="formation-artifacts">
          {plan && (
            <details open={selected === 'plan'}>
              <summary>
                <Icon name="search" size={13} />
                Recorded query plan · {plan.tasks.length} tasks
              </summary>
              <p>{plan.explanation}</p>
              {plan.tasks.map((task) => (
                <div key={task.id}>
                  <code>{task.phrase}</code>
                  <span>{task.purpose}</span>
                </div>
              ))}
            </details>
          )}
          {drafts.length > 0 && (
            <details open={selected === 'synthesize'}>
              <summary>
                <Icon name="file" size={13} />
                Unvalidated draft · {drafts.length} proposed claims
              </summary>
              <p>
                These are recorded proposals before citation and support checks. Use the final results for
                retained claims.
              </p>
              {drafts.map((claim, index) => (
                <div key={index}>
                  <strong>Draft {index + 1}</strong>
                  <p>{claim.text}</p>
                  <div className="citations">
                    {claim.citations.map((citation, i) => (
                      <button
                        className="citation"
                        key={i}
                        onClick={() => onSource(citation.passage_id, citation.quote)}
                      >
                        Inspect cited passage {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </section>
  );
}
