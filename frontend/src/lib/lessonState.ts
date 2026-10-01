import type { Event } from './api.generated';
import { reduceEvents } from './events';
import { classificationDecision, classificationUsage } from './classification';

export function lessonState(events: Event[], documentIds: string[]) {
  const execution = reduceEvents(events);
  const published = new Set<string>();
  const publishedCategories = new Map<string, string>();
  for (const event of events) {
    const publication = event.payload.publication as { document_id?: string; status?: string; category?: string } | undefined;
    if (publication?.document_id) {
      if (publication.status === 'searchable') { published.add(publication.document_id); if (publication.category) publishedCategories.set(publication.document_id, publication.category); }
      else if (publication.status === 'withdrawn') { published.delete(publication.document_id); publishedCategories.delete(publication.document_id); }
    }
  }
  // Old logs only establish each indexed outcome in the final retained result.
  const outcomes = execution.result?.outcomes as Record<string, { status: string; category?: string }> | undefined;
  for (const [id, outcome] of Object.entries(outcomes || {})) if (outcome.status === 'accepted') { published.add(id); if (outcome.category) publishedCategories.set(id, outcome.category); }
  const status = (id: string) => {
    if (published.has(id)) return 'Searchable';
    const worker = execution.instances[`worker:${id}`];
    if (['failed', 'cancelled', 'interrupted', 'skipped'].includes(worker?.state || '')) return worker.state === 'skipped' ? 'Excluded' : 'Unresolved';
    if (worker?.state === 'awaiting_review' || execution.review?.items.some(item => item.document_id === id)) return 'Awaiting review';
    if (execution.instances[`${id}:interpret`]?.state === 'running') return 'Interpreting';
    const decision = classificationDecision(execution, id);
    if (decision?.selected_route === 'accept') return 'Category accepted';
    if (decision?.selected_route === 'interpret') return 'Interpretation selected';
    if (execution.instances[`${id}:jev`]?.state === 'running') return 'Judging';
    return 'Ready';
  };
  return { execution, published, publishedCategories, status, usage: classificationUsage(events),
    awaiting: documentIds.filter(id => status(id) === 'Awaiting review').length,
    interpreting: documentIds.filter(id => status(id) === 'Interpreting').length };
}

/** Planning can be ordinary code. Count only the provider branch selected in the prefix. */
export function discoveryFrontierAttempts(events: Event[]) {
  let planningRoute: string | undefined;
  let count = 0;
  for (const event of events) {
    if (event.type === 'decision' && event.instance_id === 'intent') planningRoute = String(event.payload.selected_route);
    if (event.type !== 'node_started' || event.payload.state !== 'running') continue;
    if (event.instance_id === 'synthesize' || event.instance_id === 'plan' && planningRoute !== undefined && planningRoute !== 'find') count++;
  }
  return count;
}
