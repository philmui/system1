# Editable vector diagrams

Each `.diagram.json` is an editable layout source containing nodes, connectors, labels, groups, and accessibility text. `render.py` renders those layouts using only the Python standard library:

```sh
uv run python docs/diagrams/render.py
```

The resulting SVGs have a white background, restrained semantic colors, visible text labels, and accessible `<title>` and `<desc>` elements. Color supplements the labels. The diagrams can be opened directly in a browser or imported into a vector editor.

All five exports were rendered to PNG with `rsvg-convert` and visually inspected during implementation. The inspection checked text, arrow endpoints, clipping, group labels, and overlap. Runtime screenshots, when present in `../screenshots/`, are separate records of the application UI.

- `architecture.svg` follows commands, model calls, state writes, events, and telemetry.
- `classification.svg` follows one worker and the parent review branch.
- `discovery.svg` follows the query plan through evidence gates.
- `fan-out-join.svg` distinguishes node definitions from runtime instances.
- `api-sse-review.svg` follows commands and messages over time; top to bottom is execution order.

## Disaggregated intelligence: branching product requests

The current teaching sequence begins with [shared access gates](returns-comparison-access.svg), then follows [whole-item returns, exchanges and kit-component requests](returns-comparison-routing.svg). The two views contrast repeated frontier-model proposals with bounded System One judgment coordinated by Agent Graph and configured through AgentScript. Both architectures retain the same service authority.

The [whole-item policy](returns-whole-item-policy.svg) and [reasoning gate](returns-reasoning-gate.svg) expand two separate parts of that flow. A [reusable vector library](returns-branching-component-library.svg) supplies the key illustrated objects. Detailed rules stay in the [branching contract](returns-branching-spec.md) and [worked blog 09](../blog/09-building-prod.md), with matching teaching material in [slide 05](../slides/05-disaggregated-intelligence.html).

See the [illustration guide](returns-illustrations.md), [design rationale](returns-branching-design.md) and [current verification](returns-branching-verification.md). The diagram insets intentionally retain a simple pastel palette; the version 05 presentation frame follows the supplied Salesforce styling reference.

The earlier [three-picture sequence](returns-illustrations-04.md), its SVGs, [blog 08](../blog/08-building-prod.md), [slide 04](../slides/04-disaggregated-intelligence.html) and review reports are preserved. The original text-first designs remain in `archive/returns-text-first`. These teaching illustrations have separate generators from the five application-architecture diagrams above.
