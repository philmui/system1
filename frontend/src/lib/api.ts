import type {
  Document,
  DocumentList,
  Event,
  Passage,
  ReviewSubmission,
  Run,
  RunSnapshot,
  SearchFilters,
} from './api.generated';
import { displayName } from './naming';

export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export interface Health {
  status: string;
  mode: 'live' | 'test-fixture';
  fts5: boolean;
  integrations: Record<string, string>;
  configuration: Record<string, unknown>;
}
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(displayName(message));
  }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      'The backend is unavailable. Check that it is running and permits this frontend origin.',
      0,
    );
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const detail =
      typeof error?.detail === 'string'
        ? error.detail
        : Array.isArray(error?.detail)
          ? error.detail.map((item: { msg?: string }) => item.msg || 'Invalid input').join('; ')
          : `Request failed (${response.status}).`;
    throw new ApiError(detail, response.status);
  }
  return response.json() as Promise<T>;
}
const pendingCommands = new Map<string, string>();
async function command<T>(path: string, body?: unknown, idempotent = false): Promise<T> {
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  const identity = `${path}:${serialized || ''}`;
  const key = idempotent ? pendingCommands.get(identity) || crypto.randomUUID() : undefined;
  if (key) pendingCommands.set(identity, key);
  try {
    const result = await request<T>(path, {
      method: 'POST',
      body: serialized,
      headers: key ? { 'Idempotency-Key': key } : undefined,
    });
    pendingCommands.delete(identity);
    return result;
  } catch (error) {
    // Retain the command key when the response was lost. A deliberate retry of
    // the same input then reopens its existing run instead of starting more work.
    if (error instanceof ApiError && error.status > 0) pendingCommands.delete(identity);
    throw error;
  }
}
export const api = {
  health: () => request<Health>('/api/health'),
  documents: (filters?: SearchFilters, includeArchived = false) => {
    const params = new URLSearchParams();
    if (includeArchived) params.set('include_archived', 'true');
    if (filters?.categories?.[0]) params.set('category', filters.categories[0]);
    if (filters?.date_from) params.set('date_from', filters.date_from);
    if (filters?.date_to) params.set('date_to', filters.date_to);
    return request<DocumentList>(`/api/documents?${params}`);
  },
  document: (id: string) => request<{ document: Document; passages: Passage[] }>(`/api/documents/${id}`),
  updateDate: (id: string, document_date: string | null) =>
    request<Document>(`/api/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ document_date }) }),
  passage: (id: string) => request<Passage>(`/api/passages/${id}`),
  upload: (files: FileList, date?: string) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('files', file));
    if (date) form.append('document_date', date);
    return request<{ documents: Document[] }>('/api/documents', { method: 'POST', body: form });
  },
  samples: () => command<{ documents: Document[] }>('/api/samples'),
  classificationSamples: () => command<{ documents: Document[] }>('/api/samples/classification'),
  cleanupDocuments: () => command<{ archived_document_ids: string[] }>('/api/documents/cleanup'),
  classify: (document_ids: string[]) => command<Run>('/api/runs/classification', { document_ids }, true),
  discover: (query: string, filters: SearchFilters) =>
    command<Run>('/api/runs/discovery', { query, filters }, true),
  runs: () => request<{ runs: Run[] }>('/api/runs'),
  cleanupRuns: () => command<{ archived_run_ids: string[] }>('/api/runs/cleanup'),
  snapshot: (id: string) => request<RunSnapshot>(`/api/runs/${id}`),
  history: (id: string, after = 0) => request<{ events: Event[] }>(`/api/runs/${id}/history?after=${after}`),
  review: (id: string, submission: ReviewSubmission) => command<Run>(`/api/runs/${id}/review`, submission),
  cancel: (id: string) => command<Run>(`/api/runs/${id}/cancel`),
  recover: (id: string) => command<Run>(`/api/runs/${id}/recover`),
  restart: (id: string) => command<Run>(`/api/runs/${id}/restart`),
};
export const categoryLabels = [
  'invoice',
  'contract',
  'policy',
  'report',
  'correspondence',
  'other',
  'unknown',
] as const;
export const terminal = (status: string) =>
  ['succeeded', 'partially_succeeded', 'failed', 'cancelled', 'interrupted'].includes(status);
export const label = (value: string) => displayName(value.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase()));
export const shortDate = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(value))
    : 'Date unknown';
