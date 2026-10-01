import reference from '../data/discovery-timing-reference.json' with { type: 'json' };

/** Simulation budgets, separate from actual returned request measurements.
 * Jev's budget is rounded from a retained client-request median, not fixture sleeps.
 * Local code is modeled at 1ms; frontier budgets remain illustrative. */
export const discoveryTimingAssumptions = {
  code: 1,
  bounded: Math.round(reference.request_elapsed_ms.median),
  frontierPlan: 2400,
  frontierDraft: 4600,
};
export const discoveryTimingReference = reference;
export const discoveryAssumedPaceLabel = `Assumed pace: Code ${discoveryTimingAssumptions.code} ms · System 1 API ${discoveryTimingAssumptions.bounded} ms / request · Frontier plan 2.4 s / draft 4.6 s.`;
