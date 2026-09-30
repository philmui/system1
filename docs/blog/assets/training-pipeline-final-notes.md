# Final training and evaluation illustration

`training-pipeline-final.svg` is the editable source and `training-pipeline-final.png` is its rendered preview. This revision preserves the earlier `training-pipeline.svg` and PNG so earlier blog versions retain their original figure. The pastel design, accessible title and description, and data-partition boundaries are unchanged.

The final figure corrects the earlier transition from offline testing directly to release. Passing the frozen candidate's offline gates now qualifies it for a **controlled service pilot**. That pilot uses randomized assignment to compare the candidate with the defined baseline, measuring service quality, cost under the declared accounting scope, and latency. Broader rollout requires passing the predefined pilot gates. Offline replay alone cannot establish how different dialogue trajectories affect completed service outcomes or the full economic result.

Before starting the pilot, specify its assignment unit, account for related requests, and freeze the analysis and acceptance criteria. Pilot outcomes determine the rollout decision. If a failed pilot motivates changes to the model or policy, those changes form a new candidate requiring fresh evaluation; the previous pilot is not untouched evidence for the revised candidate.

The rest of the data discipline remains: preserve source records and provenance, reconstruct inputs using only information available at decision time, keep related cases in one partition, and split before augmentation. Fit on training data, select the operating point on validation data, and keep the locked test outside fitting and tuning. Reviewed deployment feedback may contribute to a future dataset version.

The figure describes a proposed task-development protocol, not a disclosed `koa-action` training recipe or a measured result. Direct adaptation is conditional on support; an application-level decision component can be fitted instead.

Suggested caption: **A proposed training and evaluation pipeline.** Separate related records before fitting, freeze the candidate, and use the locked test to qualify it for a randomized service pilot. Broader rollout depends on the pilot's quality, cost, and latency gates. Reviewed feedback contributes to the next dataset.

Render with:

```sh
rsvg-convert --width 1200 --output docs/blog/assets/training-pipeline-final.png docs/blog/assets/training-pipeline-final.svg
```
