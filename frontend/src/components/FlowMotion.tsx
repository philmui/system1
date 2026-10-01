/** @jsxImportSource react */
import { useEffect, useRef } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';

/** Shared motion language for recorded graphs and the local workflow comparison. */
export function FlowTrail({ path, moving, speed = 1, active = true }: {
  path: string; moving: boolean; speed?: number; active?: boolean;
}) {
  const river = useRef<SVGGElement>(null);
  const animation = useRef<Animation | null>(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  useEffect(() => {
    if (!river.current || reduceMotion) return;
    // One dash period per cycle: changing speed or pausing never restarts phase.
    // The group shares its offset with both dash layers; path changes keep phase.
    const motion = river.current.animate([{ strokeDashoffset: '0px' }, { strokeDashoffset: '-32px' }], {
      duration: 1100, iterations: Infinity, easing: 'linear',
    });
    motion.pause();
    animation.current = motion;
    return () => { motion.cancel(); animation.current = null; };
  }, [reduceMotion]);
  useEffect(() => {
    const motion = animation.current;
    if (!motion) return;
    const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;
    if (motion.playbackRate !== rate) motion.updatePlaybackRate(rate);
    if (moving) motion.play();
    else { const held = motion.currentTime; motion.pause(); if (held !== null) motion.currentTime = held; }
  }, [moving, speed, reduceMotion]);
  return <g ref={river} className={`flow-trail ${active ? 'is-active-transfer' : 'is-route-history'}`} data-flow-state={reduceMotion ? 'reduced' : moving ? 'flowing' : 'paused'} aria-hidden="true">
    <path className="route-highlight" d={path} fill="none" />
    <path className="route-forward-flow" d={path} fill="none" />
    <path className="route-river-glint" d={path} fill="none" />
  </g>;
}

export function FlowPaper({ label }: { label: string }) {
  return <g className="flow-paper">
    <rect className="packet-halo" x="-24" y="-29" width="48" height="58" rx="12" />
    <path className="packet-paper" d="M-14-21H5L15-11V18Q15 21 12 21H-12Q-15 21-15 18V-18Q-15-21-14-21Z" />
    <path className="packet-fold" d="M5-21v10h10 M-8-5H6" />
    <text x="0" y="12" textAnchor="middle">{label}</text>
  </g>;
}

/** One identifiable request/evidence marker; speed and pause retain its position. */
export function FlowToken({ path, moving, stationary = false, position = '50%', speed = 1, duration = 700, label = '01' }: {
  path: string; moving: boolean; stationary?: boolean; position?: string; speed?: number; duration?: number; label?: string;
}) {
  const token = useRef<SVGGElement>(null);
  const animation = useRef<Animation | null>(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  useEffect(() => {
    if (!token.current || reduceMotion || stationary) return;
    const motion = token.current.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }], { duration: Math.max(160, duration), easing: 'linear', fill: 'both' });
    motion.pause(); animation.current = motion;
    return () => { motion.cancel(); animation.current = null; };
  }, [duration, reduceMotion, stationary]);
  useEffect(() => {
    const motion = animation.current;
    if (!motion) return;
    const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;
    if (motion.playbackRate !== rate) motion.updatePlaybackRate(rate);
    if (moving) { if (motion.playState !== 'finished') motion.play(); }
    else { const held = motion.currentTime; motion.pause(); if (held !== null) motion.currentTime = held; }
  }, [moving, speed, reduceMotion, duration]);
  return <g ref={token} className="discovery-flow-token" data-flow-state={reduceMotion ? 'reduced' : moving && !stationary ? 'flowing' : 'paused'} style={{ offsetPath: `path('${path}')`, offsetDistance: stationary || reduceMotion ? position : '0%', offsetRotate: '0deg' }} aria-hidden="true"><g transform="scale(.7)"><FlowPaper label={label} /></g></g>;
}

/** One finite sweep shares the service or handoff duration with its marker. */
export function FlowWork({ path, moving, speed, duration, className = 'tree-stage-progress' }: { path: string; moving: boolean; speed: number; duration: number; className?: string }) {
  const progress = useRef<SVGPathElement>(null);
  const animation = useRef<Animation | null>(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  useEffect(() => {
    if (!progress.current || reduceMotion) return;
    const motion = progress.current.animate([{ strokeDashoffset: '100' }, { strokeDashoffset: '0' }], { duration: Math.max(160, duration), easing: 'linear', fill: 'both' });
    motion.pause(); animation.current = motion;
    return () => { motion.cancel(); animation.current = null; };
  }, [duration, reduceMotion]);
  useEffect(() => {
    const motion = animation.current;
    if (!motion) return;
    if (motion.playbackRate !== speed) motion.updatePlaybackRate(speed);
    if (moving) { if (motion.playState !== 'finished') motion.play(); }
    else { const held = motion.currentTime; motion.pause(); if (held !== null) motion.currentTime = held; }
  }, [moving, speed, duration, reduceMotion]);
  return <path ref={progress} className={className} pathLength={100} d={path} data-flow-state={reduceMotion ? 'reduced' : moving ? 'flowing' : 'paused'} style={{ strokeDasharray: '100 100', strokeDashoffset: reduceMotion ? 50 : 100 }} />;
}
