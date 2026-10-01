import { useRef, useState } from 'react';
import type { Document, SearchFilters } from '../lib/api.generated';
import { categoryLabels, label, shortDate } from '../lib/api';
import { Icon, Status } from '../components/Icon';
export function Library({
  documents,
  busy,
  selected,
  onSelected,
  onSamples,
  onCleanup,
  onUpload,
  onClassify,
  onSource,
  filters,
  onFilters,
  excludedDates,
}: {
  documents: Document[];
  busy: boolean;
  selected: string[];
  onSelected: (ids: string[]) => void;
  onSamples: () => void;
  onCleanup: () => void;
  onUpload: (files: FileList, date: string) => void;
  onClassify: () => void;
  onSource: (id: string) => void;
  filters: SearchFilters;
  onFilters: (filters: SearchFilters) => void;
  excludedDates: number;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadDate, setUploadDate] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const indexed = documents.filter((document) => document.indexed).length;
  const reviewed = documents.filter((document) => document.human_correction).length;
  return (
    <div className="page library-page">
      <div className="page-heading">
        <div>
          <h1>Documents <span className="heading-count">{documents.length}</span></h1>
          <p><span className="role-jev">{indexed} indexed</span><span className="inline-divider">/</span><span className="role-human">{reviewed} reviewed</span></p>
        </div>
        <button className="primary" disabled={busy} onClick={() => fileInput.current?.click()}>
          <Icon name="upload" />
          Import documents
        </button>
      </div>
      <p className="page-task-guide">Import documents to upload and start classification. For existing files, select them in the collection and choose Classify selected. Load the example corpus to try synthetic sources. Only published documents become searchable. <a href="#explore/classify">Try a simulation first</a>.</p>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
        className="visually-hidden"
        aria-label="Upload documents"
        onChange={(event) => {
          if (event.target.files?.length) onUpload(event.target.files, uploadDate);
          event.target.value = '';
        }}
      />
      <div className="workflow-ribbon" aria-label="Classification workflow">
        <span className="role-source"><Icon name="file" />Documents</span><Icon name="arrow" size={15} />
        <span className="role-jev"><Icon name="jev" />System 1 Model decides</span><Icon name="arrow" size={15} />
        <span className="role-runtime"><Icon name="workflow" />AgentGraph routes</span><Icon name="arrow" size={15} />
        <span className="role-output"><Icon name="checkCircle" />Indexed sources</span>
        <span className="ribbon-exception"><span className="role-llm"><Icon name="sparkle" size={14} />LLM</span><Icon name="arrow" size={12} /><span className="role-human"><Icon name="human" size={14} />Review</span><small>on ambiguity</small></span>
      </div>
      <section className="library-section">
        <div className="section-toolbar">
          <div>
            <h2>
              Collection
            </h2>
          </div>
          <div className="button-row">
            {documents.some(document => !document.indexed) && <button className="quiet small" disabled={busy} onClick={onCleanup}>Clear unsuccessful documents</button>}
            <button className="secondary" onClick={() => setFilterOpen((value) => !value)}>
              Filters{filters.categories?.length || filters.date_from || filters.date_to ? ' · Active' : ''}
            </button>
            <button className="secondary" disabled={busy} onClick={onSamples}>
              <Icon name="sparkle" size={16} />
              Load example corpus
            </button>
            <button className="primary" disabled={busy || !selected.length} onClick={onClassify}>
              Classify {selected.length ? `(${selected.length})` : 'selected'}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>
        {filterOpen && (
          <div className="filter-bar">
            <label className="field">
              <span>Category</span>
              <select
                value={filters.categories?.[0] || ''}
                onChange={(event) =>
                  onFilters({
                    ...filters,
                    categories: event.target.value ? [event.target.value as Document['category']] : [],
                  })
                }
              >
                <option value="">All categories</option>
                {categoryLabels.map((category) => (
                  <option key={category} value={category}>
                    {label(category)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Document date from</span>
              <input
                type="date"
                value={filters.date_from || ''}
                onChange={(event) => onFilters({ ...filters, date_from: event.target.value || null })}
              />
            </label>
            <label className="field">
              <span>Through (inclusive)</span>
              <input
                type="date"
                value={filters.date_to || ''}
                onChange={(event) => onFilters({ ...filters, date_to: event.target.value || null })}
              />
            </label>
            <button
              className="quiet"
              onClick={() => onFilters({ categories: [], date_from: null, date_to: null })}
            >
              Clear filters
            </button>
          </div>
        )}
        {(filters.date_from || filters.date_to) && (
          <p className="filter-note">
            Inclusive document-date filter · {excludedDates} documents with unknown dates excluded.
          </p>
        )}
        {!documents.length ? (
          <div className="library-empty">
            <div className="document-illustration" aria-hidden="true">
              <div className="paper paper-back" />
              <div className="paper paper-front">
                <span />
                <span />
                <span />
                <i>
                  <Icon name="check" size={20} />
                </i>
              </div>
            </div>
            <h2>Add documents to the graph.</h2>
            <p>Import your documents or start with the synthetic Atlas collection.</p>
            <button className="primary" disabled={busy} onClick={onSamples}>
              <Icon name="sparkle" size={17} />
              Explore Project Atlas
            </button>
            <span className="micro">13 readable synthetic documents · Agreements, invoices, policies & more</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="document-table">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all documents"
                      checked={
                        documents.length > 0 && documents.every((document) => selected.includes(document.id))
                      }
                      onChange={(event) =>
                        onSelected(
                          event.target.checked ? documents.slice(0, 30).map((document) => document.id) : [],
                        )
                      }
                    />
                  </th>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Document date</th>
                  <th>Collection status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id} className={selected.includes(document.id) ? 'row-selected' : ''}>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select ${document.filename}`}
                        checked={selected.includes(document.id)}
                        onChange={(event) =>
                          onSelected(
                            event.target.checked
                              ? [...selected, document.id].slice(0, 30)
                              : selected.filter((id) => id !== document.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <button className="document-name" onClick={() => onSource(document.id)}>
                        <span className={`file-icon ${document.category}`}>
                          <Icon name="file" size={19} />
                        </span>
                        <span>
                          <strong>{document.filename}</strong>
                          <small>
                            {document.synthetic ? 'Synthetic' : 'Uploaded'} ·{' '}
                            {document.extraction_status === 'readable'
                              ? 'Text extracted'
                              : label(document.extraction_status)}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={`category-tag category-${document.category}`}>
                        {label(document.category)}
                      </span>
                      <small className="cell-note">
                        {label(document.category_provenance || 'unclassified')}
                      </small>
                    </td>
                    <td>
                      <span>{shortDate(document.document_date)}</span>
                      <small className="cell-note">{label(document.date_provenance || 'unknown')}</small>
                    </td>
                    <td>
                      <Status
                        value={
                          document.indexed
                            ? 'indexed'
                            : document.extraction_status === 'readable'
                              ? 'not_indexed'
                              : document.extraction_status
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open ${document.filename}`}
                        onClick={() => onSource(document.id)}
                      >
                        <Icon name="chevron" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="library-footnote">
          <span>Text, Markdown, and text-based PDF · Up to 30 documents per run</span>
          <label>
            Optional confirmed date for new imports{' '}
            <input
              aria-label="Date for new imports"
              type="date"
              value={uploadDate}
              onChange={(event) => setUploadDate(event.target.value)}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
