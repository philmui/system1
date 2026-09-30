# Disaggregated intelligence illustration

`disaggregated-intelligence.svg` is the editable vector source; `disaggregated-intelligence.png` is its rendered preview. This 1200 × 650 figure uses the training pipeline's pastel palette and type system. The SVG has an accessible title and description; the composition uses labels rather than color alone to distinguish responsibilities.

The hero figure explains a proposed architecture with four roles. `koa-action` provides constrained judgments; a reasoning model handles open-ended interpretation; backend services establish trusted facts and execute authorized transactions; human review addresses consequential ambiguity where the configured policy requires it. AgentScript is configuration for the runtime. It is not another reasoning model. Agent Graph maintains workflow state and explicit transitions among connected capabilities.

The large boundary depicts coordination rather than deployment. A backend service or reviewer need not run inside Salesforce infrastructure. The cards do not imply four calls on every request: each case selects the path it needs. The dashed arrow denotes configuration, while the solid outgoing arrow denotes the completed case contributing observations to evaluation. The illustration claims neither an existing native `koa-action` integration nor a performance gain. Cost control is an architectural objective to test on complete cases.

Suggested caption: **A proposed composition of specialized capabilities.** AgentScript defines the controls and Agent Graph coordinates each case. Bounded judgments, open-ended reasoning, trusted backend actions, and human review have distinct responsibilities. Evaluate reliability and total cost across the complete workflow.

Render with:

```sh
rsvg-convert --width 1200 --output docs/blog/assets/disaggregated-intelligence.png docs/blog/assets/disaggregated-intelligence.svg
```
