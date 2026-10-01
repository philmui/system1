/** @jsxImportSource react */
import { LessonDrawer } from './LessonDrawer';
import { MeasurementGuide } from './MeasurementGuide';

export function AppGuide({ onClose }: { onClose: () => void }) {
  return <LessonDrawer title="How to use this app" onClose={onClose}>
    <p>Start with a simulation to see how one document or request moves through a workflow. Choose an example, press its run button, then use pause, step, and replay to inspect the decisions.</p>
    <dl className="app-guide-sections"><dt>Explore</dt><dd><a href="#explore/classify" onClick={onClose}>Classify documents</a> follows a category decision. <a href="#explore/discover?example=find" onClick={onClose}>Find &amp; compare</a> follows a search or an answer. <a href="#explore/review" onClick={onClose}>Review &amp; redact</a> compares page review workflows. Simulations use prepared responses and make no model calls.</dd>
      <dt>Live models</dt><dd>Choose Live models (Live requests in Review), select a model, then press Run. This makes real requests and may incur provider charges. The route appears after the request returns; replay does not call the model again.</dd>
      <dt>Compare</dt><dd>Choose Illustrative workload to run both approaches on one simulated clock. Change assumptions to explore workload and capacity effects. This recorded batch shows retained evidence; its hypothetical alternative has not been measured.</dd>
      <dt>Experiment</dt><dd>Change a threshold, guard, or document wording. The policy simulation updates automatically. The model judgment stays prepared; no model request or publication occurs.</dd>
      <dt>Documents &amp; Runs</dt><dd>Documents imports sources and starts classification for selected files. Runs retains actual executions for review and replay. These workspace actions are separate from teaching simulations.</dd></dl>
    <MeasurementGuide />
  </LessonDrawer>;
}
