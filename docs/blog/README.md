# Building Prod with `koa-action`, Agent Graph and AgentScript

Read the [current article, version 09](09-building-prod.md), or open the [styled HTML reading copy](index.html). Its throughline is **disaggregated intelligence for reliable enterprise agents**: System One supplies bounded interpretation, Agent Graph coordinates the work, AgentScript authors the controls, and frontier reasoning remains available for difficult exceptions.

A product-aftercare case connects the explanation to the illustrations and [slide version 05](../slides/05-disaggregated-intelligence.html). A customer requests a headphone exchange and the return of a separately purchased cable. Authentication branches visibly, each supported request reaches its own handler, and the workflow preserves every active obligation while enforcing service authority.

The architecture and task-development workflow are proposals grounded in the supplied sources. No `koa-action` API, customer deployment, training run or measured saving is invented. Reliability, latency and whole-case operating cost must be evaluated together.

## Nine preserved drafts

| Version | Main development |
| --- | --- |
| [01](01-building-prod.md) | Initial Salesforce architecture and source-grounded scope. |
| [02](02-building-prod.md) | Concrete routing contract and service trace. |
| [03](03-building-prod.md) | Decision-time leakage controls and training pipeline. |
| [04](04-building-prod.md) | Outcome definitions, bounded fallback and separate component/workflow experiments. |
| [05](05-building-prod.md) | More coherent service narrative and diagnostic failure example. |
| [06](06-building-prod.md) | Reframed around disaggregated intelligence, reliability and cost. |
| [07](07-building-prod.md) | Review corrections, economic accounting and precise acceptance criteria. |
| [08](08-building-prod.md) | Pictorial return comparison, loyalty policy, per-node authority and bounded reasoning. |
| [09 — current](09-building-prod.md) | Shared authentication branches, whole-item/exchange/component routing, AND/OR/IF task relationships and a consistent Agentforce allocation throughline. |

The [revision record](revision-log.md) links drafts to their critiques and editorial decisions. [Integrity hashes](draft-integrity.json) identify the retained files. Versions 01–08 and their referenced SVGs are preserved. Earlier reading copies remain for [07](07-reading-copy.html) and [08](08-reading-copy.html), together with [the first 08 before its pictorial redesign](reviews/08-before-illustrated-redesign.md).

## Current illustrations

The new pastel vector figures use separate filenames so earlier articles retain their original pictures. Their short labels carry the main workflow, with detailed rules in the article, notes and [branching specification](../diagrams/returns-branching-spec.md).

- Figure 1: [Shared front desk and authentication branches](../diagrams/returns-comparison-access.svg).
- Figure 2: [Whole-item, exchange and kit-component routes](../diagrams/returns-comparison-routing.svg).
- Figure 3: [Whole-item return policy and shipping](../diagrams/returns-whole-item-policy.svg).
- Figure 4: [Bounded reasoning gate](../diagrams/returns-reasoning-gate.svg).
- Figure 5: [Training and validation pipeline](assets/training-pipeline-final.svg).

Slide 05 uses the same explanations and a companion PowerPoint with reusable vector components. The [diagram directory](../diagrams/README.md) records the illustrations and available export formats. The earlier [architecture](assets/disaggregated-intelligence.svg), [service workflow](assets/service-workflow.svg) and return figures remain with the drafts that introduced them.

## Evidence and review

All fifteen original web resources were read across the [Salesforce](research/salesforce-sources.md), [LangChain](research/langchain-sources.md) and [TypeSafe](research/typesafe-sources.md) research notes. The [scope record](research/editorial-scope.md) explains why unrelated gait/JEPA instructions did not become invented results. The [new source check](../slides/research/v5-throughline-source-check.md) verifies the product-role and historical-attribution boundaries used in version 09.

The installed `codex:adversarial-review` plugin has separate preserved records for versions [01](reviews/01-codex-adversarial.txt), [06](reviews/06-codex-adversarial.txt) and the [version 08 pictorial revision](../diagrams/returns-pictorial-codex-review.txt). Version 09’s [editorial notes](reviews/09-editorial-notes.md) describe the new changes. Current review outcomes and artifact checks are recorded in [verification](verification.md); earlier approvals do not stand in for review of the new revision.

## Rebuild the reading copy

```sh
uv run --script docs/blog/render_blog.py
```

The renderer pins its Markdown dependency and reads version 09. The HTML uses local SVGs and no remote scripts or fonts. Wide figures and tables are contained in scrollable regions for narrow screens. The new figures embed their display fonts; companion outlined exports, where available, retain typography in vector tools without those fonts.
