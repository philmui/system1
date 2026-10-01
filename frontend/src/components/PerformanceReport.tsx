/** @jsxImportSource react */
import { useId } from 'react';
import type { PerformanceReport as Report } from '../lib/performanceReport';
import { duration } from '../lib/timing';
import { displayName } from '../lib/naming';
import { Icon } from './Icon';
import { MeasurementGuide } from './MeasurementGuide';

/** One scope, three outcomes, and inspectable evidence for every component. */
export function PerformanceReport({ report, compact = false, scaleMs }: { report: Report; compact?: boolean; scaleMs?: number }) {
  const id = useId();
  const longest = Math.max(1, scaleMs || 0, ...report.components.map(item => item.elapsedMs ?? 0));
  return <section className={`performance-report ${compact ? 'is-compact' : ''}`} aria-label={displayName(report.title)}>
    <header className="performance-heading"><div><h3>{displayName(report.title)}</h3><p>{displayName(report.scope)}</p></div><Icon name="clock" size={19} /></header>
    {!compact && <MeasurementGuide />}
    <dl className="performance-summary">{[report.elapsed, report.quality, report.outcome].map((metric, index) => <div className={`performance-summary-item tone-${metric.tone || 'neutral'}`} key={index}>
      <dt>{displayName(metric.label)}</dt><dd>{displayName(metric.value)}</dd><p>{displayName(metric.detail)}</p>
    </div>)}</dl>
    <div className="performance-table-wrap"><table className="performance-components" aria-describedby={`${id}-timing-note`}>
      <caption>Component-level latency and quality</caption>
      <thead><tr><th scope="col">Component</th><th scope="col">Measured work</th><th scope="col">Quality check</th></tr></thead>
      <tbody>{report.components.map(component => <tr key={component.id} className={`role-${component.role}`}>
        <th scope="row"><span className="performance-component-name"><i aria-hidden="true" />{displayName(component.name)}</span>{component.model && <small>{component.model}</small>}</th>
        <td><span className="performance-duration">{component.elapsedMs === null ? component.timingLabel || 'Not measured' : duration(component.elapsedMs)}</span>
          {component.elapsedMs !== null && <span className="performance-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(component.elapsedMs ? 1 : 0, component.elapsedMs / longest * 100))}%` }} /></span>}</td>
        <td><strong className={`performance-quality tone-${component.quality.tone || 'neutral'}`}>{displayName(component.quality.value)}</strong><small>{displayName(component.quality.label)}</small>
          <details className="performance-evidence"><summary>Evidence<span className="sr-only"> for {displayName(component.name)}</span></summary><p>{displayName(component.quality.detail)}</p><p>{displayName(component.detail)}</p></details></td>
      </tr>)}</tbody>
    </table></div>
    <p className="performance-note" id={`${id}-timing-note`}>{displayName(report.note || 'Component work can overlap. Overall elapsed time is measured separately; confidence is not accuracy.')}</p>
  </section>;
}
