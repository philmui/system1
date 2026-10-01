import { expect, test } from '@playwright/test';
import type { Event, Run } from '../src/lib/api.generated';
import { reduceEvents } from '../src/lib/events';
import { classificationReplaySteps } from '../src/lib/replay';
import { buildExecutionGraph, type ExecutionGraphInput } from '../src/components/ExecutionGraph';
import type { FlowNode } from '../src/components/FlowCanvas';

const run = { id: 'run', kind: 'classification', graph_version: 'atlas-classification-v2', mode: 'test-fixture', configuration: { choice_threshold: .8 }, request: { document_ids: ['a', 'b'], simulated_review: true } } as unknown as Run;
type Entry = [Event['type'], string, Record<string, unknown>];
const log = (entries: Entry[]): Event[] => entries.map(([type, instance_id, payload], index) => ({ type, instance_id, payload, sequence: index + 1, event_id: `${index + 1}`, run_id: 'run', parent_instance_id: null, schema_version: 1, attempt: 1, timestamp: '2026-09-29T00:00:00Z' }));
const node = (name: string, state: string, doc = 'a') => ({ node_name: name, state, label: name, document_id: doc });
const edge = (source: string, target: string, label = '') => ({ source_instance_id: source, target_instance_id: target, label });
const decision = (route: 'accept' | 'interpret' = 'accept') => ({ signal: { kind: 'choice', choice: 'invoice', confidence: route === 'accept' ? .97 : .58 }, selected_route: route, policy_reason: route === 'accept' ? 'accepted' : 'below_threshold', threshold: .8, explanation: 'Recorded policy result.' });
const direct: Entry[] = [
  ['node_completed', 'a:extract', node('extract', 'succeeded')],
  ['edge_selected', 'a:extract', edge('a:extract', 'a:jev')],
  ['node_completed', 'a:jev', node('jev', 'succeeded')],
  ['decision', 'a:jev', decision()],
  ['edge_selected', 'a:jev', edge('a:jev', 'a:publish')],
];
const commit = (doc = 'a', status = 'searchable'): Entry => ['node_completed', `${doc}:publish`, { ...node('publish', 'succeeded', doc), publication: { id: `pub:${doc}`, document_id: doc, status, category: 'invoice', committed_at: '2026-09-29T00:00:01Z' } }];
const graph = (entries: Entry[], changes: Partial<ExecutionGraphInput> = {}) => buildExecutionGraph({ run, execution: reduceEvents(log(entries)), focused: 'worker:a', expanded: true, selected: null, moving: false, speed: 1, ...changes });

test('a V2 accepted route publishes before batch accounting, and only a commit is searchable', () => {
  const before = graph(direct);
  expect(before.edges.find(item => item.id === 'policy--accept')?.data?.traversed).toBe(true);
  expect(before.edges.find(item => item.id === 'accept--publish')?.data?.traversed).toBe(true);
  expect(before.nodes.find(item => item.id === 'publish')?.data.signals).toEqual([{ label: 'Searchable', value: '0 documents' }]);
  expect(before.nodes.find(item => item.id === 'join')?.data.state).toBe('queued');
  const after = graph([...direct, commit()]);
  expect(after.nodes.find(item => item.id === 'publish')?.data.signals).toEqual([{ label: 'Searchable', value: '1 document' }]);
  expect(after.nodes.find(item => item.id === 'publish')?.data.detail).toContain('Searchable now');
  expect(after.nodes.find(item => item.id === 'join')?.data.state).toBe('queued');
  expect(after.edges.find(item => item.id === 'publish--join')?.data?.traversed).toBe(false);
  expect(after.nodes.find(item => item.id === 'done')?.data.state).toBe('queued');
  const returned = graph([...direct, commit(), ['edge_selected', 'a:publish', edge('a:publish', 'a:outcome')]]);
  expect(returned.edges.find(item => item.id === 'publish--join')?.data?.traversed).toBe(true);
});

test('a handoff into a not-yet-started publisher follows the accepted branch and retains pause', () => {
  const events = log(direct);
  const replayStep = classificationReplaySteps(events, 'a').at(-1)!;
  const result = graph(direct, { replayStep, moving: false });
  expect(result.edges.find(item => item.id === 'accept--publish')?.data).toMatchObject({ current: true, moving: false, packetLabel: '01' });
  expect(result.nodes.find(item => item.id === 'publish')?.data.active).toBe(true);
  expect(result.edges.find(item => item.id === 'policy--interpret')?.data?.traversed).toBe(false);
});

const proposal: Entry[] = [
  ['node_completed', 'a:jev', node('jev', 'succeeded')], ['decision', 'a:jev', decision('interpret')],
  ['edge_selected', 'a:jev', edge('a:jev', 'a:interpret')],
  ['node_completed', 'a:interpret', node('interpret', 'succeeded')],
  ['decision', 'a:interpret', { signal: { kind: 'proposal', category: 'report' }, selected_route: 'review', explanation: 'Review this proposal.' }],
  ['edge_selected', 'a:interpret', edge('a:interpret', 'a:outcome')],
  ['node_completed', 'join', { ...node('join', 'succeeded'), completed: 2, expected: 2 }],
  ['edge_selected', 'join', edge('join', 'review')],
  ['review_requested', 'review', { items: [{ document_id: 'a', filename: 'a.md', proposal: 'report' }], revision: 1, interrupt_id: 'review-1' }],
];

test('reviewed publication uses its own invocation without marking automatic acceptance', () => {
  const waiting = graph(proposal);
  expect(waiting.edges.find(item => item.id === 'interpret--join')?.data?.traversed).toBe(true);
  expect(waiting.edges.find(item => item.id === 'join--review')?.data?.traversed).toBe(true);
  expect(waiting.edges.find(item => item.id === 'review--reviewed-publish')?.data?.traversed).toBe(false);
  expect(waiting.nodes.find(item => item.id === 'publish')?.data.dimmed).toBe(true);
  const approved = graph([...proposal, ['review_resumed', 'review', { count: 1 }], ['edge_selected', 'review', edge('review', 'a:publish', 'Validated review authorizes publication')], commit()]);
  expect(approved.edges.find(item => item.id === 'review--reviewed-publish')?.data).toMatchObject({ traversed: true, label: 'Approved' });
  expect(approved.edges.find(item => item.id === 'policy--accept')?.data?.traversed).toBe(false);
  expect(approved.nodes.find(item => item.id === 'reviewed-publish')?.data.state).toBe('succeeded');
  expect(approved.nodes.find(item => item.id === 'done')?.data.signals?.[0].value).toBe('1 document');
  const excluded = graph([...proposal, ['edge_selected', 'review', edge('review', 'a:publish', 'Validated review excludes document')], commit('a', 'withdrawn')]);
  expect(excluded.nodes.find(item => item.id === 'reviewed-publish')?.data.title).toBe('Withdraw source');
  expect(excluded.edges.find(item => item.id === 'review--reviewed-publish')?.data?.label).toBe('Exclude');
  expect(excluded.nodes.find(item => item.id === 'done')?.data.signals?.[0].value).toBe('0 documents');
});

test('publication failure and interpretation failure are accounted for without becoming searchable', () => {
  const failed = graph([...direct, ['node_failed', 'a:publish', node('publish', 'failed')], ['edge_selected', 'a:publish', edge('a:publish', 'a:outcome', 'Publication failed')]]);
  expect(failed.nodes.find(item => item.id === 'publish')?.data.state).toBe('failed');
  expect(failed.nodes.find(item => item.id === 'publish')?.data.signals?.[0].value).toBe('0 documents');
  expect(failed.edges.find(item => item.id === 'publish--join')?.data?.label).toBe('Publication failed');
  const mixed = graph([
    ['node_failed', 'a:interpret', node('interpret', 'failed')], ['edge_selected', 'a:interpret', edge('a:interpret', 'a:outcome')],
    ['node_completed', 'b:interpret', node('interpret', 'succeeded', 'b')], ['edge_selected', 'b:interpret', edge('b:interpret', 'b:outcome')],
  ], { focused: '' });
  expect(mixed.nodes.find(item => item.id === 'interpret')?.data.state).toBe('partially_succeeded');
  expect(mixed.edges.find(item => item.id === 'interpret--join')?.data?.label).toBe('Proposals & issues');
});

test('failure bypasses remain failed paths after a later successful decision and V1 stays unchanged', () => {
  const result = graph([
    ['node_failed', 'a:jev', node('jev', 'failed')], ['edge_selected', 'a:jev', edge('a:jev', 'a:outcome')], ...direct,
  ]);
  expect(result.edges.find(item => item.id === 'judge--join')?.data?.label).toBe('Record failed call');
  expect(result.edges.find(item => item.id === 'accept--publish')?.data?.traversed).toBe(true);
  const legacy = graph([], { run: { ...run, graph_version: 'atlas-classification-v1' } });
  expect(legacy.nodes.some(item => item.id === 'publish')).toBe(false);
  expect(legacy.nodes.some(item => item.id === 'index')).toBe(true);
  expect(legacy.edges.some(item => item.id === 'accept--join')).toBe(true);
});

function port(node: FlowNode, handle: string) {
  const { x, y } = node.position; const w = node.width!, h = node.height!;
  const offsets: Record<string, [number, number]> = { out: [w, h / 2], in: [0, h / 2], 'out-high': [w, h / 4], 'out-low': [w, h * .75], 'in-high': [0, h / 4], 'in-low': [0, h * .75], 'in-right': [w, h / 2], 'out-left': [0, h / 2], bottom: [w / 2, h], 'in-bottom': [w / 2, h], top: [w / 2, 0], 'out-top': [w / 2, 0] };
  return { x: x + offsets[handle][0], y: y + offsets[handle][1] };
}
for (const narrow of [false, true]) for (const expanded of [false, true]) test(`V2 ${narrow ? 'vertical' : 'horizontal'} ${expanded ? 'full' : 'compact'} connections avoid unrelated nodes`, () => {
  const cases: Entry[][] = [[], [['node_failed', 'a:extract', node('extract', 'failed')], ['edge_selected', 'a:extract', edge('a:extract', 'a:outcome')]], [['node_failed', 'a:jev', node('jev', 'failed')], ['edge_selected', 'a:jev', edge('a:jev', 'a:outcome')]]];
  for (const entries of cases) {
    const { nodes, edges } = graph(entries, { narrow, expanded });
    for (const edge of edges) {
      const source = nodes.find(node => node.id === edge.source)!, target = nodes.find(node => node.id === edge.target)!;
      const points = [port(source, edge.sourceHandle!), ...edge.data!.waypoints!, port(target, edge.targetHandle!)];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        expect(a.x === b.x || a.y === b.y, `${edge.id} has a diagonal segment`).toBe(true);
        for (const node of nodes.filter(node => node.type === 'component' && ![edge.source, edge.target].includes(node.id))) {
          const { x, y } = node.position;
          const hit = a.x === b.x ? a.x > x - 12 && a.x < x + node.width! + 12 && Math.max(a.y, b.y) > y - 14 && Math.min(a.y, b.y) < y + node.height! + 14
            : a.y > y - 14 && a.y < y + node.height! + 14 && Math.max(a.x, b.x) > x - 12 && Math.min(a.x, b.x) < x + node.width! + 12;
          expect(hit, `${edge.id} crosses ${node.id}`).toBe(false);
        }
      }
    }
  }
});
