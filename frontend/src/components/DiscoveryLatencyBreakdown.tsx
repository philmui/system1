/** @jsxImportSource react */
import { useMemo } from 'react';
import type { RunSnapshot } from '../lib/api.generated';
import { discoveryServiceBreakdown, type ServiceWork } from '../lib/discoveryJourney';
import { duration } from '../lib/timing';
import { Icon } from './Icon';

const kinds = [{ key: 'code', label: 'Code', role: 'runtime', unit: 'operations' }, { key: 'bounded', label: 'System 1', role: 'jev', unit: 'requests' }, { key: 'frontier', label: 'Frontier', role: 'llm', unit: 'requests' }] as const;
const value = (work: ServiceWork) => !work.count ? 'Not used' : work.ms === null ? 'Not measured' : work.ms === 0 ? '0 ms' : duration(work.ms);

/** Aggregate service work is explicitly separate from wall time and replay position. */
export function DiscoveryLatencyBreakdown({ snapshot, unavailable = false }: { snapshot: RunSnapshot; unavailable?: boolean }) {
  const breakdown = useMemo(() => discoveryServiceBreakdown(snapshot), [snapshot]);
  const provenance = breakdown.all.missing ? 'Incomplete timing' : breakdown.all.source === 'assumed' ? 'Assumed' : breakdown.all.source === 'recorded' ? 'Recorded' : breakdown.all.source === 'mixed' ? 'Mixed timing' : 'Timing unavailable';
  const total = unavailable || !breakdown.all.count ? '—' : value(breakdown.all);
  const complete = !unavailable && breakdown.comparable;
  return <section className="discovery-latency" aria-label="Whole run service latency breakdown">
    <div className="discovery-latency-heading"><span>{unavailable ? 'Awaiting recorded run' : `${provenance} · whole ${breakdown.all.source === 'assumed' ? 'example' : 'recording'}`}</span></div>
    <dl className={`workflow-timing-total discovery-latency-total${breakdown.all.ms === null || unavailable || !breakdown.all.count ? ' is-unavailable' : ''}`}>
      <dt><Icon name="clock" size={16} />Total service work</dt><dd>{total}</dd>
    </dl>
    <div className="workflow-timing-composition discovery-latency-bar" aria-hidden="true">{complete && kinds.map(kind => <span className={`role-${kind.role}`} key={kind.key} style={{ width: `${100 * breakdown.groups[kind.key].knownMs / breakdown.all.knownMs}%` }} />)}</div>
    <dl className="discovery-latency-values" aria-label="Contributions to total service work">{kinds.map(kind => {
      const work = breakdown.groups[kind.key];
      const unit = kind.unit === 'requests' && work.source === 'assumed' ? 'simulated steps' : kind.unit === 'requests' && work.source === 'mixed' ? 'steps (mixed)' : kind.unit;
      const average = unavailable || !work.count || work.ms === null ? '' : `${work.ms === 0 ? '0 ms' : duration(work.ms / work.count)} avg / ${kind.unit === 'operations' ? 'operation' : 'request'}`;
      return <div key={kind.key} className={`role-${kind.role}`}><dt><i aria-hidden="true" />{kind.label}</dt><dd>{unavailable ? '—' : value(work)}</dd><div className="discovery-latency-meta"><small>{unavailable ? 'Not available yet' : `${work.count} ${unit}`}</small><small className="discovery-request-average">{average}</small></div></div>;
    })}</dl>
    <small className="discovery-latency-note">Request times include network time. Parallel calls can overlap; totals are not elapsed time or accuracy.</small>
  </section>;
}
