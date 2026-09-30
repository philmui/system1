# Widescreen task-development pipeline

The editable vector is [`training-pipeline.svg`](training-pipeline.svg), with a same-size PNG preview in [`training-pipeline.png`](training-pipeline.png). The canvas is 1680 × 700; every visible text element is at least 25 px, with 30 px headings. Manrope is embedded in the vector so it remains readable without a network or local font installation. The palette matches the deck's paper, ink, mint, lilac, sand, and peach colors.

The figure presents a **proposed application development and evaluation process**, not `koa-action` foundation-model training or a supported adaptation API. Direct adaptation is optional and depends on supported access. A fixed model can instead be evaluated with versioned decision definitions, context selection, and routing policy.

## What the connectors mean

- **Solid green** carries data into separate partitions. The source snapshot is grouped and split before augmentation; all three partitions receive their own records.
- **Dashed purple** carries fitted or configured artifacts. Training data do not move into validation, and validation data do not move into the locked test.
- **Solid ink** represents qualification for the next release stage. Passing offline gates admits the frozen candidate to a randomized service pilot; offline cases do not become the pilot's traffic. Rollout requires predefined pilot gates to pass.
- **Dotted brown** returns reviewed deployment feedback to a future dataset only. It has no connection to the current training, validation, or locked test.

The independent split branches and the visual difference between samples and artifacts are deliberate. A conventional train → validation → test pipeline can incorrectly suggest that one set of examples passes through every stage.

## Presenter notes

Preserve a versioned source snapshot, record order, timestamps, and links between derived examples and their origins. Inputs stop at the decision timestamp. A later event may establish a target label but cannot appear as evidence in the earlier input. For semantic endpointing, evaluate only the audio prefix available at that moment.

Group related conversations, duplicates, and generated variants before assigning partitions. Use account-level grouping or later-time cohorts according to the generalization claim. Record exclusions and transformations; cleaning, redaction, and sampling may change the observed distribution even when provenance is preserved.

Only training data fit learned preprocessing or permitted adaptation. Separate calibration fitting from threshold selection within development data. Freeze the model version, question definitions, transformations, thresholds, and workflow policy before evaluating the locked test. If final results motivate a revision, a new performance claim needs fresh untouched evidence.

Offline paired evaluation compares decisions on the same held-out snapshots, with equivalent permissions and tools. A controlled pilot is needed for consequences of changed customer dialogue and downstream work. Predeclare randomization units, handling of related cases, observation horizon, quality limits, and a minimum worthwhile cost reduction. Report resolution and automatic coverage beside whole-service cost and latency. Include retries, escalations, tools, and people under the same accounting boundary in both systems; report integration/adaptation investment separately or state its allocation explicitly.

The locked test can qualify a candidate for the pilot; it does not establish how the pilot's live workflows will perform. Production monitoring and reviewed feedback support the next development cycle without retroactively improving the current test result.

## Accessibility and verification

The SVG provides a descriptive `<title>` and `<desc>` linked through `aria-labelledby`. Connector types differ in both color and line pattern, and the legend names each type. The notes provide the complete textual account of the diagram.

The PNG was rendered from the embedded-font SVG in Chromium at its native 1680 × 700 size. All 33 visible text bounding boxes were inspected: none exceeds the canvas, and the rendered image was visually checked for clipped text, overlapping arrows, and unclear partition routing. [`generate_pipeline.py`](generate_pipeline.py) regenerates the SVG from the local Manrope font; rerender the PNG after any modification.

Suggested caption: **Separate the examples before developing the decision.** Distinct data partitions feed development and locked evaluation; only frozen artifacts progress toward a controlled service pilot. Rollout depends on passing quality, cost, and latency gates.
