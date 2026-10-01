import type { FlowRole } from '../components/FlowCanvas';

export interface MetricValue {
  label: string;
  value: string;
  detail: string;
  tone?: 'positive' | 'caution' | 'neutral';
}

export interface ComponentMetric {
  id: string;
  name: string;
  role: FlowRole;
  elapsedMs: number | null;
  timingLabel?: string;
  quality: MetricValue;
  detail: string;
  model?: string;
}

export interface PerformanceReport {
  title: string;
  scope: string;
  elapsed: MetricValue;
  quality: MetricValue;
  outcome: MetricValue;
  components: ComponentMetric[];
  note?: string;
}

export function referenceAgreement(matched: number, total: number, label: string, detail: string): MetricValue {
  if (!Number.isInteger(total) || !Number.isInteger(matched) || total <= 0 || matched < 0 || matched > total) {
    return { label, value: 'Not evaluated', detail, tone: 'neutral' };
  }
  return { label, value: `${matched} / ${total}`, detail, tone: matched === total ? 'positive' : 'caution' };
}

export const unevaluated = (label: string, detail: string): MetricValue => ({ label, value: 'Not evaluated', detail, tone: 'neutral' });

export function measuredMs(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
