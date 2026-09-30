/** @jsxImportSource react */
import { useState } from 'react';
import type { Document, ReviewRequest, ReviewSubmission } from '../lib/api.generated';
import { categoryLabels, label } from '../lib/api';
import { Icon } from './Icon';
export function ReviewPanel({
  review,
  submitting,
  onSubmit,
  onSource,
}: {
  review: ReviewRequest;
  submitting: boolean;
  onSubmit: (submission: ReviewSubmission) => void;
  onSource: (id: string) => void;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const ready = review.items.every((item) => !!selections[item.document_id]
    && !(item.proposal === 'unknown' && selections[item.document_id] === 'accept'));
  return (
    <section className="review-panel" data-testid="review-panel">
      <div className="review-intro">
        <div className="review-icon">
          <Icon name="shield" size={24} />
        </div>
        <div>
          <h3><span className="role-human">Paused</span> · {review.items.length} {review.items.length === 1 ? 'input needs' : 'inputs need'} your review</h3>
          <p>
            Checkpoint saved. Decide on each proposal to resume the graph.
          </p>
        </div>
        <span className="tag">Revision {review.revision}</span>
      </div>
      <div className="review-items">
        {review.items.map((item) => (
          <div className="review-item" key={item.document_id}>
            <div>
              <button className="text-button" onClick={() => onSource(item.document_id)}>
                {item.filename}
                <Icon name="link" size={13} />
              </button>
              <p>{item.explanation}</p>
              <small>
                Proposed category: <strong>{label(item.proposal)}</strong>
              </small>
              {item.proposal === 'unknown' && <p className="role-human">Missing evidence cannot be approved as “Unknown.” Choose a supported category or exclude this document from search.</p>}
            </div>
            <label className="field">
              <span>Review decision</span>
              <select
                aria-label={`Review ${item.filename}`}
                value={selections[item.document_id] || ''}
                onChange={(event) =>
                  setSelections((current) => ({ ...current, [item.document_id]: event.target.value }))
                }
              >
                <option value="">Choose a decision…</option>
                {item.proposal !== 'unknown' && <option value="accept">Accept {label(item.proposal)}</option>}
                {categoryLabels
                  .filter((category) => category !== 'unknown')
                  .map((category) => (
                    <option key={category} value={`correct:${category}`}>
                      Change to {label(category)}
                    </option>
                  ))}
                <option value="exclude">Exclude from search</option>
              </select>
            </label>
          </div>
        ))}
      </div>
      <div className="review-footer">
        <span className="micro">Original judgments and your decisions are retained.</span>
        <button
          className="primary"
          disabled={!ready || submitting}
          onClick={() =>
            onSubmit({
              interrupt_id: review.interrupt_id,
              revision: review.revision,
              decisions: review.items.map((item) => {
                const selection = selections[item.document_id];
                return selection.startsWith('correct:')
                  ? {
                      document_id: item.document_id,
                      action: 'correct',
                      category: selection.split(':')[1] as Document['category'],
                    }
                  : {
                      document_id: item.document_id,
                      action: selection as 'accept' | 'exclude',
                      category: null,
                    };
              }),
            })
          }
        >
          {submitting ? 'Resuming…' : 'Submit all & resume'}
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </section>
  );
}
