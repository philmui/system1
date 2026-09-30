import type { Claim, Document, Passage, Run, SearchFilters } from '../lib/api.generated';
import { label } from '../lib/api';
import { Icon, Status } from './Icon';
export function Results({
  run,
  result,
  documents,
  onSource,
}: {
  run: Run;
  result?: Record<string, unknown>;
  documents: Document[];
  onSource: (documentId?: string, passageId?: string, quote?: string) => void;
}) {
  if (!result)
    return (
      <div className="results-empty">
        <Icon name="runs" size={21} />
        <div>
          <strong>Results appear as work completes.</strong>
          <p>The graph and timeline show the recorded progress so far.</p>
        </div>
      </div>
    );
  if (run.kind === 'classification') {
    const outcomes = (result.outcomes || {}) as Record<
      string,
      { document_id: string; status: string; category: string; error?: string }
    >;
    return (
      <div className="classification-results">
        <div className="results-title">
          <h3>Classification results</h3>
          <span>{String(result.indexed_count ?? 0)} indexed documents</span>
        </div>
        <div className="outcome-grid">
          {Object.values(outcomes).map((outcome) => (
            <button
              className="outcome-card"
              key={outcome.document_id}
              onClick={() => onSource(outcome.document_id)}
            >
              <Icon name="file" />
              <strong>
                {documents.find((document) => document.id === outcome.document_id)?.filename ||
                  outcome.document_id}
              </strong>
              <span className="category-tag">{label(outcome.category || 'unknown')}</span>
              <Status value={outcome.status} />
              {outcome.error && <p>{outcome.error}</p>}
              <Icon name="chevron" size={14} />
            </button>
          ))}
        </div>
      </div>
    );
  }
  const passages = (result.passages || []) as Passage[];
  const claims = (result.claims || []) as Claim[];
  const missing = (result.missing_evidence || []) as string[];
  const filters = run.request.filters as SearchFilters | undefined;
  const provenance = result.provenance as
    | { scope?: { excluded_unknown_dates?: number; candidate_cap_per_task?: number; retrieval?: string } }
    | undefined;
  const plan = result.plan as
    { explanation?: string; tasks?: { id: string; phrase: string; purpose: string }[] } | undefined;
  return (
    <div className="discovery-results">
      <div className="results-title">
        <h3>
          {claims.length
            ? 'An answer, with its evidence'
            : passages.length
              ? 'Relevant passages'
              : 'Available evidence'}
        </h3>
        <span>
          {passages.length} source passage{passages.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="search-scope">
        <span className="section-label">Searched scope</span>
        <span>
          {filters?.categories?.length ? filters.categories.map(label).join(', ') : 'All indexed categories'}
        </span>
        {(filters?.date_from || filters?.date_to) && (
          <span>
            {filters.date_from || 'Any start'} through {filters.date_to || 'Any end'} · inclusive
          </span>
        )}
        {(filters?.date_from || filters?.date_to) && (
          <span>{provenance?.scope?.excluded_unknown_dates ?? 'Unavailable'} unknown dates excluded</span>
        )}
        <span>
          Candidate cap: {provenance?.scope?.candidate_cap_per_task ?? 'Unavailable'} per task · FTS5 lexical
          search
        </span>
      </div>
      {result.message ? <p className="result-message">{String(result.message)}</p> : null}
      {result.partial ? (
        <div className="notice">
          Partial results: some work failed or evidence became unavailable. Read the recorded message and
          evidence gaps for details.
        </div>
      ) : null}
      {claims.map((claim, index) => (
        <article className={`claim ${claim.conflicting ? 'claim-conflict' : ''}`} key={index}>
          <span className="claim-number">{String(index + 1).padStart(2, '0')}</span>
          <div>
            {claim.conflicting && <span className="conflict-label">Conflicting evidence</span>}
            <p>{claim.text}</p>
            <div className="citations">
              {claim.citations.map((citation, number) => (
                <button
                  className="citation"
                  key={`${citation.passage_id}-${number}`}
                  onClick={() => onSource(undefined, citation.passage_id, citation.quote)}
                >
                  <Icon name="link" size={13} />
                  {passages.find((passage) => passage.id === citation.passage_id)?.filename ||
                    `Source ${number + 1}`}
                </button>
              ))}
            </div>
          </div>
        </article>
      ))}
      {!!missing.length && (
        <div className="notice">
          <strong>Missing evidence</strong>
          <ul>
            {missing.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="passage-grid">
        {passages.map((passage) => (
          <button className="passage-card" key={passage.id} onClick={() => onSource(undefined, passage.id)}>
            <span className="passage-file">
              <Icon name="file" size={16} />
              {passage.filename}
              <Icon name="chevron" size={14} />
            </span>
            <p>{passage.text}</p>
            <span className="micro">
              {passage.page ? `Page ${passage.page}` : passage.section || 'Document'} · Characters{' '}
              {passage.start}–{passage.end}
            </span>
          </button>
        ))}
      </div>
      {plan && (
        <details className="query-plan">
          <summary>Query plan · {plan.tasks?.length || 0} retrieval tasks</summary>
          <p>{plan.explanation}</p>
          {plan.tasks?.map((task) => (
            <div key={task.id}>
              <code>{task.phrase}</code>
              <p>{task.purpose}</p>
            </div>
          ))}
          <p className="micro">
            Search uses SQLite FTS5 lexical matching. Scope and candidate caps are recorded in the run
            configuration.
          </p>
        </details>
      )}
    </div>
  );
}
