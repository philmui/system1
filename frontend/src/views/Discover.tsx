import { useState } from 'react';
import type { Document, SearchFilters } from '../lib/api.generated';
import { categoryLabels, label } from '../lib/api';
import { Icon } from '../components/Icon';
const examples = [
  {
    title: 'Find the right documents',
    query: 'Find invoices containing Atlas',
    note: 'A direct search with source passages',
    icon: 'search',
  },
  {
    title: 'Compare the details',
    query: 'Compare the termination notice periods in the Atlas service agreements.',
    note: 'Parallel retrieval, cited conclusions',
    icon: 'runs',
  },
  {
    title: 'Test the limits',
    query: 'What is the launch date for Project Orion?',
    note: 'See when the evidence is insufficient',
    icon: 'shield',
  },
];
export function Discover({
  busy,
  indexedCount,
  onDiscover,
}: {
  busy: boolean;
  indexedCount: number;
  onDiscover: (query: string, filters: SearchFilters) => void;
}) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({ categories: [], date_from: null, date_to: null });
  return (
    <div className="page discover-page">
      <div className="discover-intro">
        <h1>Discover</h1>
        <p>Follow a question through the graph to its sources.</p>
      </div>
      <form
        className="query-box"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) onDiscover(query.trim(), filters);
        }}
      >
        <label htmlFor="discovery-query" className="visually-hidden">
          Your question
        </label>
        <div className="query-input">
          <Icon name="sparkle" size={24} />
          <textarea
            id="discovery-query"
            placeholder="Ask about your collection…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={2000}
            rows={3}
          />
        </div>
        <div className="query-controls">
          <span>
            <span className="connected-dot" />
            Project Atlas <small>· {indexedCount} indexed sources</small>
          </span>
          <button className="primary" disabled={busy || !query.trim()}>
            Discover
            <Icon name="arrow" size={17} />
          </button>
        </div>
        <div className="query-filters">
          <label className="field">
            <span>Category</span>
            <select
              aria-label="Category"
              value={filters.categories?.[0] || ''}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  categories: event.target.value ? [event.target.value as Document['category']] : [],
                })
              }
            >
              <option value="">All indexed documents</option>
              {categoryLabels
                .filter((category) => category !== 'unknown')
                .map((category) => (
                  <option key={category} value={category}>
                    {label(category)}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Document date from</span>
            <input
              aria-label="Document date from"
              type="date"
              value={filters.date_from || ''}
              onChange={(event) => setFilters({ ...filters, date_from: event.target.value || null })}
            />
          </label>
          <label className="field">
            <span>Through (inclusive)</span>
            <input
              aria-label="Through (inclusive)"
              type="date"
              value={filters.date_to || ''}
              onChange={(event) => setFilters({ ...filters, date_to: event.target.value || null })}
            />
          </label>
        </div>
        {(filters.date_from || filters.date_to) && (
          <p className="filter-note">
            Only documents with known dates inside this inclusive range are searched.
          </p>
        )}
      </form>
      <div className="examples-heading">
        <span className="eyebrow">A few starting points</span>
        <span>Try the synthetic Atlas collection</span>
      </div>
      <div className="example-grid">
        {examples.map((example) => (
          <button className="example-card" key={example.title} onClick={() => setQuery(example.query)}>
            <Icon name={example.icon} size={22} />
            <h3>{example.title}</h3>
            <p>{example.query}</p>
            <small>
              {example.note}
              <Icon name="arrow" size={14} />
            </small>
          </button>
        ))}
      </div>
      <div className="workflow-ribbon discovery-ribbon" aria-label="Discovery workflow">
        <span className="role-jev"><Icon name="jev" />Understand</span>
        <Icon name="arrow" size={15} />
        <span className="role-runtime"><Icon name="search" />Retrieve</span>
        <Icon name="arrow" size={15} />
        <span className="role-jev"><Icon name="jev" />Screen</span>
        <Icon name="arrow" size={15} />
        <span className="role-llm"><Icon name="sparkle" />Compose</span>
        <Icon name="arrow" size={15} />
        <span className="role-jev"><Icon name="shield" />Verify</span>
      </div>
      <p className="discovery-limit">
        Search starts with lexical matches in your indexed documents. A model’s confidence is a signal; the
        source passages are the evidence.
      </p>
    </div>
  );
}
