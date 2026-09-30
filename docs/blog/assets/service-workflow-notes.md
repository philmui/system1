# Service workflow illustration

`service-workflow.svg` is the editable vector source; `service-workflow.png` is its matching preview. It uses the same pastel palette, typography, stroke weights, and accessible SVG labeling as the training pipeline. Labels carry the meaning independently of color.

The path is an illustrative application design, not a deployed product result or an API specification. A mixed classification creates a proposal. Agent Graph preserves both tasks and follows AgentScript-authored paths. The example assumes the customer selects billing first and the account verification and authorization checks pass; backend checks remain independent of the classifier's confidence. The state rail keeps the pending outage visible until the application resumes it. Unclear input requires clarification.

The drawing intentionally avoids `route=mixed` or invented service signatures. It shows a supported architectural pattern without implying that `koa-action` exposes a particular output schema or has a documented native integration.

Suggested caption: **An illustrative service path.** `koa-action` proposes a mixed intent; Agent Graph retains both tasks and follows AgentScript-defined controls. Authorized billing information supports the explanation, while the outage remains pending for the next step.

Render with:

```sh
rsvg-convert --width 1200 --output docs/blog/assets/service-workflow.png docs/blog/assets/service-workflow.svg
```
