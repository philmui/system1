# Version 1: Salesforce and source accuracy

Reviewed `01-building-prod.md` against the five Salesforce references and the public Agent Script specification. The proposed-integration framing, LangGraph comparison, and absence of borrowed performance claims are sound. No invented AgentScript syntax appears.

## Required revisions

1. **Explain availability versus mandatory execution.** The control section currently risks making an action gate sound like a complete execution guarantee. Add a concise explanation: AgentScript's `available when` determines which actions the model may choose; checks that must run belong in deterministic procedures, and the service performing a consequential action revalidates its authorization. Availability alone cannot ensure that the model selects an action or finishes the workflow.
2. **Replace “account identity should come from a trusted lookup.”** A successful account lookup identifies a record but does not authenticate the caller. Use “verified account context should come from a trusted verification service,” or an equivalent formulation that preserves the distinction.
3. **Do not assign an undocumented probability contract to `koa-action` noul.** The brief supplies the name, but the Salesforce sources do not specify its type, range, or calibration. If explaining the TypeSafe meaning for comparison, label that provenance explicitly and state that the corresponding `koa-action` contract needs confirmation. Prefer one unobtrusive sentence over an extended caveat.
4. **Make confidence conditional on an actual interface.** “A model's returned confidence” implies that this proposed integration exposes confidence. Use “If the decision interface provides a confidence score…” before explaining validation and routing coverage.

## Useful optional refinement

The public AgentScript repository provides language tooling and compilation, while execution requires Salesforce's managed environment. One sentence can prevent readers from mistaking the open-source repo for a self-hostable runtime. Do not add installation details or a long security checklist.

## Keep

Keep the concrete service example, traceable division of responsibilities, backend eligibility checks, and clear labeling of hypothetical outcomes. These preserve a readable engineering blog while qualifying the important guarantees.
