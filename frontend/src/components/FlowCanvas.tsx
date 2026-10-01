/** @jsxImportSource react */
import { memo, useEffect, useRef } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  getSmoothStepPath,
  useNodesInitialized,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { Icon } from './Icon';
import { useMediaQuery } from '../lib/useMediaQuery';
import { FlowPaper, FlowTrail } from './FlowMotion';

export type FlowRole = 'jev' | 'llm' | 'runtime' | 'human' | 'source' | 'output' | 'muted';
export type FlowData = {
  title: string;
  role: FlowRole;
  subtitle?: string;
  detail?: string;
  state?: string;
  metric?: string;
  selected?: boolean;
  onPath?: boolean;
  showStatus?: boolean;
  active?: boolean;
  dimmed?: boolean;
  compact?: boolean;
  icon?: string;
  documentLabel?: string;
  signals?: { label: string; value: string; tone?: string }[];
};
export type FlowNode = Node<FlowData, 'component' | 'annotation'>;
export type RouteData = {
  role: FlowRole;
  traversed?: boolean;
  moving?: boolean;
  /** Decorative direction on already selected paths, separate from a document transfer. */
  flowing?: boolean;
  current?: boolean;
  dimmed?: boolean;
  label?: string;
  waypoints?: { x: number; y: number }[];
  curveControls?: [{ x: number; y: number }, { x: number; y: number }];
  labelPosition?: { x: number; y: number };
  speed?: number;
  packetLabel?: string;
  packetKey?: string;
  travelDuration?: number;
};
export type FlowRoute = Edge<RouteData, 'route'>;

const roleNames: Record<FlowRole, string> = {
  jev: 'System 1 Model', llm: 'Frontier LLM', runtime: 'Code', human: 'Human',
  source: 'Input', output: 'Output', muted: 'Output',
};
const roleIcons: Record<FlowRole, string> = {
  jev: 'jev', llm: 'sparkle', runtime: 'workflow', human: 'human',
  source: 'file', output: 'checkCircle', muted: 'box',
};
const statusNames: Record<string, string> = {
  queued: 'Ready', running: 'Processing', succeeded: 'Complete',
  awaiting_review: 'Paused', failed: 'Failed', skipped: 'Not used',
  cancelled: 'Cancelled', interrupted: 'Interrupted', partially_succeeded: 'Partial',
  outside_preview: 'Outside preview',
};

const ComponentNode = memo(({ data }: NodeProps<FlowNode>) => {
  const state = data.state || 'queued';
  return (
    <div className={`flow-node workflow-glass-node role-${data.role} state-${state} ${data.active ? 'is-active' : ''} ${data.selected ? 'is-selected' : ''} ${data.onPath ? 'is-on-path' : ''} ${data.dimmed ? 'is-dimmed' : ''} ${data.compact ? 'is-compact' : ''}`}>
      <Handle type="target" position={Position.Left} id="in" />
      <Handle type="target" position={Position.Left} id="in-high" style={{ top: '25%' }} />
      <Handle type="target" position={Position.Left} id="in-low" style={{ top: '75%' }} />
      <Handle type="target" position={Position.Right} id="in-right" />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Bottom} id="in-bottom" />
      {data.documentLabel && <span className="node-document"><Icon name="file" size={12} />{data.documentLabel}</span>}
      <div className="flow-node-header">
        <span className="component-icon"><Icon name={data.icon || roleIcons[data.role]} size={data.compact ? 16 : 21} /></span>
        {data.compact ? <strong title={data.title}>{data.title}</strong> : <span className="component-role">{data.subtitle || roleNames[data.role]}</span>}
        <span className={`flow-state state-${state}`} title={statusNames[state] || state} aria-label={statusNames[state] || state}>
          {state === 'succeeded' ? <Icon name="check" size={12} />
            : state === 'outside_preview' ? <Icon name="info" size={12} />
            : state === 'awaiting_review' ? <Icon name="pause" size={11} />
              : ['failed', 'interrupted', 'cancelled'].includes(state) ? <Icon name="alert" size={12} />
                : <i />}
        </span>
      </div>
      {!data.compact && <strong className="component-title">{data.title}</strong>}
      {data.signals && <div className="node-signals">{data.signals.map(signal => (
        <div key={signal.label}><span>{signal.label}</span><b className={signal.tone || ''}>{signal.value}</b></div>
      ))}</div>}
      {(data.detail || data.metric) && <div className="component-footer"><span title={data.detail}>{data.detail}</span>{data.metric && !data.showStatus && <b>{data.metric}</b>}</div>}
      {data.showStatus && <div className="component-meta"><span>{data.active && state === 'queued' ? 'Next step' : statusNames[state] || state}</span>{data.metric && <b>{data.metric}</b>}</div>}
      <Handle type="source" position={Position.Right} id="out" />
      <Handle type="source" position={Position.Right} id="out-high" style={{ top: '25%' }} />
      <Handle type="source" position={Position.Right} id="out-low" style={{ top: '75%' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Top} id="out-top" />
      <Handle type="source" position={Position.Left} id="out-left" />
      <Handle type="source" position={Position.Left} id="out-left-low" style={{ top: '75%' }} />
    </div>
  );
});
const AnnotationNode = memo(({ data }: NodeProps<FlowNode>) => <div className={`flow-annotation role-${data.role}`}>{data.title}</div>);

export function roundedPath(points: { x: number; y: number }[]) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1], point = points[index], next = points[index + 1];
    const incoming = Math.hypot(point.x - previous.x, point.y - previous.y);
    const outgoing = Math.hypot(next.x - point.x, next.y - point.y);
    if (!incoming || !outgoing) continue;
    const radius = Math.min(16, incoming / 2, outgoing / 2);
    const before = { x: point.x - (point.x - previous.x) / incoming * radius, y: point.y - (point.y - previous.y) / incoming * radius };
    const after = { x: point.x + (next.x - point.x) / outgoing * radius, y: point.y + (next.y - point.y) / outgoing * radius };
    path += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`;
  }
  const end = points.at(-1)!;
  return `${path} L ${end.x} ${end.y}`;
}

/** One document, one traversal. The animation survives pause and speed changes. */
const TrackedPacket = memo(({ path, label, duration, moving, speed }: {
  path: string; label: string; duration: number; moving: boolean; speed: number;
}) => {
  const packet = useRef<SVGGElement>(null);
  const animation = useRef<Animation | null>(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  useEffect(() => {
    if (!packet.current || reduceMotion) return;
    const motion = packet.current.animate([{ offsetDistance: '24px' }, { offsetDistance: 'calc(100% - 24px)' }], {
      duration: duration * 1000, fill: 'forwards', easing: 'linear',
    });
    motion.pause();
    animation.current = motion;
    return () => { motion.cancel(); animation.current = null; };
  }, [duration, reduceMotion]);
  useEffect(() => {
    const motion = animation.current;
    if (!motion) return;
    if (motion.playbackRate !== speed) motion.updatePlaybackRate(speed);
    if (moving) {
      if (motion.playState !== 'finished') motion.play();
    } else { const held = motion.currentTime; motion.pause(); if (held !== null) motion.currentTime = held; }
  }, [moving, speed, path, duration, reduceMotion]);
  return <g className="edge-packet tracked-packet" ref={packet} data-testid="replay-document" aria-hidden="true"
    style={{ offsetPath: `path("${path}")`, offsetRotate: '0deg', offsetDistance: reduceMotion ? '65%' : '24px' }}>
    <FlowPaper label={label} />
  </g>;
});

const RouteEdge = memo((props: EdgeProps<FlowRoute>) => {
  const { id, data } = props;
  const [automaticPath, x, y] = getSmoothStepPath({ ...props, borderRadius: 22, offset: 28 });
  const path = data?.curveControls ? `M ${props.sourceX} ${props.sourceY} C ${data.curveControls[0].x} ${data.curveControls[0].y} ${data.curveControls[1].x} ${data.curveControls[1].y} ${props.targetX} ${props.targetY}`
    : data?.waypoints ? roundedPath([{ x: props.sourceX, y: props.sourceY }, ...data.waypoints, { x: props.targetX, y: props.targetY }]) : automaticPath;
  const labelPosition = data?.labelPosition || { x, y: y - 26 };
  const marker = `route-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  return (
    <g className={`flow-route role-${data?.role || 'runtime'} ${data?.current ? 'is-current' : ''} ${data?.traversed ? 'is-traversed' : ''} ${data?.dimmed ? 'is-dimmed' : ''}`}>
      <defs><marker id={marker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1 1l6 3-6 3" /></marker></defs>
      <BaseEdge id={id} path={path} markerEnd={`url(#${marker})`} interactionWidth={0} />
      {(data?.current || data?.traversed) && !data?.dimmed && <FlowTrail path={path} moving={!!(data.flowing ?? data.moving)} speed={data.speed} active={!!data.current} />}
      {data?.current && data.packetKey && <TrackedPacket key={data.packetKey} path={path} label={data.packetLabel || '01'}
        duration={data.travelDuration || 1.3} moving={!!data.moving} speed={data.speed || 1} />}
      {data?.label && <EdgeLabelRenderer><span className={`flow-edge-label role-${data.role} ${data.dimmed ? 'is-dimmed' : ''} ${data.traversed ? 'is-traversed' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y}px)` }}>{data.label}</span></EdgeLabelRenderer>}
    </g>
  );
});

const nodeTypes = { component: ComponentNode, annotation: AnnotationNode };
const edgeTypes = { route: RouteEdge };

export function flowNode(id: string, position: { x: number; y: number }, data: FlowData, width = 198, height = 132): FlowNode {
  return { id, position, data, type: 'component', width, height, initialWidth: width, initialHeight: height, measured: { width, height },
    style: { width, height }, draggable: false, focusable: true,
    ariaLabel: `${data.title}. ${data.subtitle || roleNames[data.role]}. ${statusNames[data.state || 'queued'] || data.state}. ${data.onPath ? 'On selected route. ' : ''}${data.detail || ''} ${data.metric || ''}. ${data.documentLabel ? `${data.documentLabel}. ` : ''}Select to inspect.`,
  };
}
export function flowAnnotation(id: string, title: string, x: number, y: number, role: FlowRole = 'muted'): FlowNode {
  return { id, position: { x, y }, type: 'annotation', data: { title, role }, selectable: false, focusable: false, draggable: false, style: { width: 220, height: 20 } };
}
export function flowRoute(source: string, target: string, data: RouteData, handles?: { source?: string; target?: string }): FlowRoute {
  return { id: `${source}--${target}`, source, target, sourceHandle: handles?.source || 'out', targetHandle: handles?.target || 'in', type: 'route', data, focusable: false, selectable: false };
}

function FitCanvas({ layoutKey, minFitZoom, padding }: { layoutKey: string; minFitZoom: number; padding: number }) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);
  useEffect(() => {
    if (!initialized || !width || !height) return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding, minZoom: minFitZoom, maxZoom: 1.15, duration: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialized, fitView, width, height, layoutKey, minFitZoom, padding]);
  return null;
}

export function ComponentLegend({ compact = false }: { compact?: boolean }) {
  return <div className={`component-legend ${compact ? 'compact' : ''}`} aria-label="Component color key">
    <span className="role-jev"><i /><b>System 1 Model</b>{!compact && <small>Decides</small>}</span>
    <span className="role-runtime"><i /><b>Code</b>{!compact && <small>Routes & checks</small>}</span>
    <span className="role-llm"><i /><b>LLM</b>{!compact && <small>Generates</small>}</span>
    <span className="role-human"><i /><b>Human</b>{!compact && <small>Reviews</small>}</span>
  </div>;
}

export function FlowCanvas({ nodes, edges, onSelect, onClear, layoutKey = '', label = 'Document processing graph', minFitZoom = .7, fitPadding = .1 }: {
  nodes: FlowNode[]; edges: FlowRoute[]; onSelect: (id: string) => void; onClear?: () => void; layoutKey?: string; label?: string; minFitZoom?: number; fitPadding?: number;
}) {
  return <div className="flow-canvas" role="region" aria-label={label} onKeyDownCapture={event => {
    const id = (event.target as HTMLElement).closest('.react-flow__node')?.getAttribute('data-id');
    if (id && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(id); }
  }}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      onNodeClick={(_, node) => { if (node.type !== 'annotation') onSelect(node.id); }}
      onPaneClick={onClear} fitView fitViewOptions={{ padding: fitPadding, minZoom: minFitZoom, maxZoom: 1.15 }}
      minZoom={0.18} maxZoom={1.6} nodesConnectable={false} nodesDraggable={false}
      edgesFocusable={false} deleteKeyCode={null} selectionOnDrag={false} zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: false }}>
      <FitCanvas layoutKey={layoutKey} minFitZoom={minFitZoom} padding={fitPadding} />
      <Background color="var(--canvas-dot)" gap={24} size={1} />
      <Controls showInteractive={false} position="bottom-right" fitViewOptions={{ padding: fitPadding, minZoom: minFitZoom, maxZoom: 1.15 }} />
    </ReactFlow>
  </div>;
}
