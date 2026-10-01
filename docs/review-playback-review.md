# Review comparison: readable transfers and honest timing

## Problem and change

The prepared Review & redact comparison previously put outgoing file transfers inside 75% of the assumed 0.05-second code interval. At the default playback scale, that left about 75 milliseconds to see the file. Attorney release and withholding transfers had zero duration. Incoming travel also used a fraction of the model's processing time, making a slower model appear to receive the file more slowly.

The comparison now follows Find & compare's separation of visible handoffs and service work. It reuses the shared `FlowPaper` and `FlowTrail` visuals, with a finite progress indicator inside the model box. Both files arrive together; the specialized System 1 Model finishes its decision while the frontier model continues processing.

- Handoffs take at least 0.8 seconds at 1× playback. Longer paths use their length to allow more reading time. The longer desktop/mobile route determines the duration, so resizing cannot change the playhead or decision state.
- Both model types use one common service-time scale. The default 0.35-second and 3.80-second assumptions appear as 0.70 and 7.60 screen seconds of model work. Their ratio is preserved at every playback speed.
- Playback time and modeled machine time are separate. File travel and short reading holds do not add to latency, cost or request counts. Model requests start on arrival at their model box. A final output appears only after the file arrives.
- A compact comparison next to playback shows the two assumed classification times, proportional bars and “Frontier takes 10.9× as long.” Each classification box shows its own elapsed decision time and progress. The timeline is labeled Animation and reports a percentage.
- The nearby explanation states that handoffs are slowed for readability and excluded from latency. Assumptions explain the service scale and the effect of redaction and human waiting.

## Adversarial review

| Challenge | Check and resolution |
| --- | --- |
| “The frontier model is slow because its file travels slowly.” | Incoming and corresponding outgoing transfers have identical durations in both lanes. Both classification requests begin together. The extra frontier time is spent inside its model box. |
| “The animation looks about three times longer, so where does 10.9× come from?” | The visible ratio explicitly compares assumed **decision time**: 0.35 s and 3.80 s. Reading holds are excluded from the displayed machine totals; the animation timeline is not labeled as workflow latency. |
| “This proves every workflow is ten times faster.” | The ratio is scoped to classification. Both redaction branches use the same frontier service time. The redaction example retains 2.90 s versus 6.35 s total machine time; human waiting adds no model latency. |
| “Changing assumptions still advertises a System 1 advantage.” | Equal and reversed assumptions update the bar lengths, values and comparison text. A 7.60-second System 1 assumption against 3.80 seconds for frontier says System 1 takes 2.0× as long. |
| “The bottom lane still teleports at the end.” | Browser verification follows its outgoing paper for multiple frames at 1×. The paper remains visible, pauses in place, retains its position after speed changes, and reaches the output before completion is shown. |
| “Attorney approval immediately produces the page.” | Release and withholding now have visible handoffs. Approval cannot bypass either lane's own checkpoint, and release of a page with PII still requires redaction. |
| “The new movement changes the answer or charges for idle time.” | Regression checks retain all 27 answer combinations, request counts, costs, backward seeks and human checkpoint behavior. Machine counters remain constant throughout handoffs. |
| “Mobile labels cross the incoming connector.” | The decision-time label moves inside the model tile in the vertical layout. Desktop, narrow focus mode and light/dark screenshots were inspected. |
| “Reduced motion hides the only way to locate the file.” | A stationary paper stays visible on the selected edge and the flow animation stops. Node state, progress and text remain available. |

These timings are editable teaching assumptions. This change makes their meaning visible; it supplies no new provider benchmark or quality claim.

## Verification

Targeted unit tests cover service ratios, every prepared route and attorney verdict, identical handoff timing across lanes, accounting, backward seeks and route geometry. Browser tests cover the moving frontier paper, pause/speed behavior, visible attorney-release travel, equal/reversed assumptions, responsive focus controls and existing review interactions. No provider calls are made by these checks.

Completed: 21 unit tests and 6 browser tests passed, along with TypeScript checking, targeted ESLint and the production build. The build retains the existing large-chunk warning for the learning workspace bundle.
