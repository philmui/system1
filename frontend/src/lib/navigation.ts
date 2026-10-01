export type LearnView = 'explore' | 'compare' | 'experiment';
export type View = LearnView | 'library' | 'discover' | 'runs';
export type Scene = 'classify' | 'discover' | 'review' | 'safeguards';
export interface AppRoute {
  view: View;
  scene: Scene;
  example: string;
  runId: string | null;
  documentId: string | null;
  source: 'illustrative' | 'recorded';
}
export const isLearning = (view: View): view is LearnView => ['explore', 'compare', 'experiment'].includes(view);
export function parseLocation(hash: string): AppRoute {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const [first, second] = path.split('/');
  const params = new URLSearchParams(query);
  const view: View = first === 'workflow' ? 'explore' : first === 'documents' ? 'library'
    : ['explore', 'compare', 'experiment', 'library', 'discover', 'runs'].includes(first) ? first as View : 'explore';
  const scene: Scene = first === 'workflow' ? 'review' : ['classify', 'discover', 'review', 'safeguards'].includes(second) ? second as Scene : 'classify';
  return { view, scene, example: params.get('example') || (scene === 'discover' ? 'find' : scene === 'safeguards' ? 'guard' : 'clear'),
    runId: view === 'runs' ? second || null : params.get('run'), documentId: params.get('document'),
    source: params.get('source') === 'recorded' ? 'recorded' : 'illustrative' };
}
export function learningHref(view: LearnView, context: Partial<AppRoute> = {}): string {
  const params = new URLSearchParams();
  if (context.example) params.set('example', context.example);
  if (context.runId) params.set('run', context.runId);
  if (context.documentId) params.set('document', context.documentId);
  if (context.source) params.set('source', context.source);
  return `#${view}/${context.scene || 'classify'}${params.size ? `?${params}` : ''}`;
}
