# Pipeline illustration

`training-pipeline.svg` is the editable vector source. `training-pipeline.png` is the matching rendered preview. The SVG includes an accessible title and a complete text description; labels and arrow styles keep the meaning readable without relying on color.

The figure depicts a proposed process for task adaptation and evaluation. It does not claim that Salesforce exposes a `koa-action` training API, uses a particular pretraining objective, or has completed this experiment. Where direct adaptation is unavailable, the fitted component can be an application-level decision model.

Three data arrows leave the split, one for each partition. Two separate horizontal arrows carry learned artifacts from fitting into validation and frozen artifacts into testing. The locked test has a single outgoing arrow to the release decision. It has no arrow to model fitting, calibration, or threshold selection. Production observations can enter only a future version of the development corpus after review. New performance claims after further tuning need new untouched evidence.

The source snapshot, order, schema, source offsets, and provenance are preserved. Each model input is reconstructed from the conversation prefix and trusted state snapshot available at that decision timestamp. Later actions, outcomes, and resolution notes may inform adjudicated labels, but cannot become input features. This boundary is necessary even when related records are correctly grouped into separate partitions. Cleaning and redaction must still be recorded, because they can change the observable distribution. Related cases and derived examples stay together; the group and time boundaries should match the intended generalization claim. Training-only augmentation occurs after the split. There is deliberately no arbitrary train/test percentage.

Suggested caption: **A proposed pipeline for `koa-action` task adaptation and validation.** Preserve a versioned source snapshot, then assign related records to separate partitions before augmentation. Model inputs contain only the conversation prefix and trusted state available at decision time; later outcomes may supply labels only. Fit learned components on training data, calibrate and select thresholds on development data, and evaluate a frozen workflow on the locked test. Release depends on predefined criteria. Reviewed production feedback contributes to later datasets, while the current test remains outside the fitting path.

Render with:

```sh
rsvg-convert --width 1200 --output docs/blog/assets/training-pipeline.png docs/blog/assets/training-pipeline.svg
```
