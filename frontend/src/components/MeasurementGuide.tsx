/** @jsxImportSource react */
/** Shared definitions keep model reports and simulations interpretable. */
export function MeasurementGuide() {
  return <details className="measurement-guide"><summary>How to read latency &amp; quality</summary>
    <dl><dt>Latency</dt><dd>Elapsed time is how long the whole request took, including queue waits. Service time is work by one component. Parallel work can overlap, so adding component times does not give elapsed time. 1,000 ms = 1 s.</dd>
      <dt>Quality</dt><dd>A fraction shows matches / evaluated examples. A result of 1 / 1 means one example matched its reference; it does not establish 100% accuracy on other documents. Check which task, source, and reference were evaluated.</dd>
      <dt>Confidence</dt><dd>A model’s confidence is its judgment signal. It is separate from correctness measured against a reference.</dd>
      <dt>Comparisons</dt><dd>Compare the same task and sources, and read sample sizes and timing scope. Simulations use assumed timings and outcomes; they do not measure real model accuracy. “Not measured” is different from zero.</dd></dl>
  </details>;
}
