/* Generated from src/doc_discovery/schemas.py. Run npm run generate:types; do not edit. */

export type Id = string;
export type DocumentId = string;
export type ContentVersion = string;
export type Filename = string;
export type Text = string;
export type Page = number | null;
export type Section = string | null;
export type Start = number;
export type End = number;
export type Id1 = string;
export type Filename1 = string;
export type ContentVersion1 = string;
export type DocumentDate = string | null;
export type DateProvenance = 'synthetic_manifest' | 'user_confirmed' | 'unknown';
export type UploadedAt = string;
export type ExtractionStatus = 'pending' | 'readable' | 'empty' | 'scanned' | 'encrypted' | 'unreadable';
export type ExtractionError = string | null;
export type ExtractionElapsedMs = number | null;
export type Category = 'invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown';
export type CategoryProvenance = string;
export type OriginalJudgment = {
  [k: string]: unknown;
} | null;
export type HumanCorrection = {
  [k: string]: unknown;
} | null;
export type Indexed = boolean;
export type Synthetic = boolean;
export type Provider = 'jev' | 'openai' | 'fixture';
export type RequestId = string | null;
export type ConfiguredModel = string | null;
export type ReturnedModel = string | null;
export type ElapsedMs = number;
export type Usage = {
  [k: string]: unknown;
} | null;
export type RubricVersion = string;
export type Provider1 = 'jev' | 'openai' | 'fixture';
export type RequestId1 = string | null;
export type ConfiguredModel1 = string | null;
export type ReturnedModel1 = string | null;
export type ElapsedMs1 = number;
export type Usage1 = {
  [k: string]: unknown;
} | null;
export type RubricVersion1 = string;
export type Kind = 'choice';
export type Choice = string;
export type Confidence = number;
export type Provider2 = 'jev' | 'openai' | 'fixture';
export type RequestId2 = string | null;
export type ConfiguredModel2 = string | null;
export type ReturnedModel2 = string | null;
export type ElapsedMs2 = number;
export type Usage2 = {
  [k: string]: unknown;
} | null;
export type RubricVersion2 = string;
export type Kind1 = 'noul';
export type Noul = number;
export type Provider3 = 'jev' | 'openai' | 'fixture';
export type RequestId3 = string | null;
export type ConfiguredModel3 = string | null;
export type ReturnedModel3 = string | null;
export type ElapsedMs3 = number;
export type Usage3 = {
  [k: string]: unknown;
} | null;
export type RubricVersion3 = string;
export type Kind2 = 'proposal';
export type Category1 = 'invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown';
export type Explanation = string;
export type Id2 = string;
export type InputRefs = string[];
export type InputExcerpt = string;
export type Rubric = string;
export type Signal = ChoiceSignal | NoulSignal | ProposalSignal;
export type Threshold = number | null;
export type PolicyVersion = string;
export type SelectedRoute = string;
export type Explanation1 = string;
export type OmittedContext = string[];
export type PolicyElapsedMs = number | null;
export type PolicyReason = string | null;
export type Categories = ('invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown')[];
export type DateFrom = string | null;
export type DateTo = string | null;
/**
 * @maxItems 30
 */
export type DocumentIds = string[];
export type Query = string;
export type Id3 = string;
export type Phrase = string;
export type Purpose = string;
export type Intent = 'find' | 'summarize' | 'compare' | 'unsupported';
/**
 * @maxItems 3
 */
export type Tasks = [] | [SearchTask] | [SearchTask, SearchTask] | [SearchTask, SearchTask, SearchTask];
export type Explanation2 = string;
export type PassageId = string;
export type Quote = string;
export type Text1 = string;
/**
 * @minItems 1
 * @maxItems 5
 */
export type Citations =
  | [Citation]
  | [Citation, Citation]
  | [Citation, Citation, Citation]
  | [Citation, Citation, Citation, Citation]
  | [Citation, Citation, Citation, Citation, Citation];
export type Conflicting = boolean;
/**
 * @maxItems 8
 */
export type Claims =
  | []
  | [Claim]
  | [Claim, Claim]
  | [Claim, Claim, Claim]
  | [Claim, Claim, Claim, Claim]
  | [Claim, Claim, Claim, Claim, Claim]
  | [Claim, Claim, Claim, Claim, Claim, Claim]
  | [Claim, Claim, Claim, Claim, Claim, Claim, Claim]
  | [Claim, Claim, Claim, Claim, Claim, Claim, Claim, Claim];
export type MissingEvidence = string[];
export type DocumentId1 = string;
export type Filename2 = string;
export type Proposal = 'invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown';
export type Explanation3 = string;
export type InterruptId = string;
export type Revision = number;
export type Items = ReviewItem[];
export type DocumentId2 = string;
export type Action = 'accept' | 'correct' | 'exclude';
export type Category2 = ('invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown') | null;
export type InterruptId1 = string;
export type Revision1 = number;
export type Decisions = ReviewDecision[];
export type NodeName = string;
export type Label = string;
export type State = string;
export type DocumentId3 = string | null;
export type TaskId = string | null;
export type Outcome = string | null;
export type Detail = string | null;
export type Completed = number | null;
export type Expected = number | null;
export type ElapsedMs4 = number | null;
export type QueueWaitMs = number | null;
export type InputCount = number | null;
export type OutputCount = number | null;
export type RemovedCount = number | null;
/**
 * @maxItems 24
 */
export type PassageIds = string[];
/**
 * @maxItems 8
 */
export type DraftClaims =
  | []
  | [Claim]
  | [Claim, Claim]
  | [Claim, Claim, Claim]
  | [Claim, Claim, Claim, Claim]
  | [Claim, Claim, Claim, Claim, Claim]
  | [Claim, Claim, Claim, Claim, Claim, Claim]
  | [Claim, Claim, Claim, Claim, Claim, Claim, Claim]
  | [Claim, Claim, Claim, Claim, Claim, Claim, Claim, Claim];
export type SourceInstanceId = string;
export type TargetInstanceId = string;
export type Label1 = string;
export type Kind3 = 'classification' | 'discovery';
export type Mode = 'live' | 'test-fixture';
export type Resumed = boolean;
export type Recovered = boolean;
export type InterruptId2 = string;
export type Revision2 = number;
export type Count = number;
export type Status =
  | 'queued'
  | 'running'
  | 'awaiting_review'
  | 'interrupted'
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed'
  | 'cancelled';
export type Result = {
  [k: string]: unknown;
} | null;
export type Error = string | null;
export type TimingIncomplete = boolean;
export type SchemaVersion = number;
export type EventId = string;
export type Sequence = number;
export type Timestamp = string;
export type RunId = string;
export type InstanceId = string;
export type ParentInstanceId = string | null;
export type Attempt = number;
export type Type =
  | 'run_started'
  | 'worker_created'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'decision'
  | 'edge_selected'
  | 'review_requested'
  | 'review_resumed'
  | 'run_completed';
export type Id4 = string;
export type ThreadId = string;
export type Kind4 = 'classification' | 'discovery';
export type Status1 =
  | 'queued'
  | 'running'
  | 'awaiting_review'
  | 'interrupted'
  | 'succeeded'
  | 'partially_succeeded'
  | 'failed'
  | 'cancelled';
export type Mode1 = 'live' | 'test-fixture';
export type GraphVersion = string;
export type PolicyVersion1 = string;
export type CreatedAt = string;
export type UpdatedAt = string;
export type Result1 = {
  [k: string]: unknown;
} | null;
export type LastEventSequence = number;
export type TraceUrl = string | null;
export type TelemetryStatus = string;
export type LinkedRunId = string | null;
export type Error1 = string | null;
export type Documents = Document[];
export type ExcludedUnknownDates = number;
export type Events = Event[];
export type LastEventSequence1 = number;
export type DocumentDate1 = string | null;

export interface ApiContract {
  Passage: Passage;
  Document: Document;
  ProviderMeta: ProviderMeta;
  ChoiceSignal: ChoiceSignal;
  NoulSignal: NoulSignal;
  ProposalSignal: ProposalSignal;
  Decision: Decision;
  SearchFilters: SearchFilters;
  ClassificationRequest: ClassificationRequest;
  DiscoveryRequest: DiscoveryRequest;
  SearchTask: SearchTask;
  QueryPlan: QueryPlan;
  Citation: Citation;
  Claim: Claim;
  Answer: Answer;
  ReviewItem: ReviewItem;
  ReviewRequest: ReviewRequest;
  ReviewDecision: ReviewDecision;
  ReviewSubmission: ReviewSubmission;
  NodePayload: NodePayload;
  EdgePayload: EdgePayload;
  RunStartedPayload: RunStartedPayload;
  ReviewResumedPayload: ReviewResumedPayload;
  RunCompletedPayload: RunCompletedPayload;
  Event: Event;
  Run: Run;
  DocumentList: DocumentList;
  RunSnapshot: RunSnapshot;
  MetadataUpdate: MetadataUpdate;
}
export interface Passage {
  id: Id;
  document_id: DocumentId;
  content_version: ContentVersion;
  filename: Filename;
  text: Text;
  page: Page;
  section: Section;
  start: Start;
  end: End;
}
export interface Document {
  id: Id1;
  filename: Filename1;
  content_version: ContentVersion1;
  document_date: DocumentDate;
  date_provenance: DateProvenance;
  uploaded_at: UploadedAt;
  extraction_status: ExtractionStatus;
  extraction_error: ExtractionError;
  extraction_elapsed_ms: ExtractionElapsedMs;
  category: Category;
  category_provenance: CategoryProvenance;
  original_judgment: OriginalJudgment;
  human_correction: HumanCorrection;
  indexed: Indexed;
  synthetic: Synthetic;
}
export interface ProviderMeta {
  provider: Provider;
  request_id: RequestId;
  configured_model: ConfiguredModel;
  returned_model: ReturnedModel;
  elapsed_ms: ElapsedMs;
  usage: Usage;
  rubric_version: RubricVersion;
}
export interface ChoiceSignal {
  provider: Provider1;
  request_id: RequestId1;
  configured_model: ConfiguredModel1;
  returned_model: ReturnedModel1;
  elapsed_ms: ElapsedMs1;
  usage: Usage1;
  rubric_version: RubricVersion1;
  kind: Kind;
  choice: Choice;
  confidence: Confidence;
  probabilities: Probabilities;
}
export interface Probabilities {
  [k: string]: number;
}
export interface NoulSignal {
  provider: Provider2;
  request_id: RequestId2;
  configured_model: ConfiguredModel2;
  returned_model: ReturnedModel2;
  elapsed_ms: ElapsedMs2;
  usage: Usage2;
  rubric_version: RubricVersion2;
  kind: Kind1;
  noul: Noul;
}
export interface ProposalSignal {
  provider: Provider3;
  request_id: RequestId3;
  configured_model: ConfiguredModel3;
  returned_model: ReturnedModel3;
  elapsed_ms: ElapsedMs3;
  usage: Usage3;
  rubric_version: RubricVersion3;
  kind: Kind2;
  category: Category1;
  explanation: Explanation;
}
export interface Decision {
  id: Id2;
  input_refs: InputRefs;
  input_excerpt: InputExcerpt;
  rubric: Rubric;
  signal: Signal;
  threshold: Threshold;
  policy_version: PolicyVersion;
  selected_route: SelectedRoute;
  explanation: Explanation1;
  omitted_context: OmittedContext;
  policy_elapsed_ms: PolicyElapsedMs;
  policy_reason: PolicyReason;
}
export interface SearchFilters {
  categories: Categories;
  date_from: DateFrom;
  date_to: DateTo;
}
export interface ClassificationRequest {
  document_ids: DocumentIds;
}
export interface DiscoveryRequest {
  query: Query;
  filters: SearchFilters;
}
export interface SearchTask {
  id: Id3;
  phrase: Phrase;
  purpose: Purpose;
}
export interface QueryPlan {
  intent: Intent;
  tasks: Tasks;
  explanation: Explanation2;
}
export interface Citation {
  passage_id: PassageId;
  quote: Quote;
}
export interface Claim {
  text: Text1;
  citations: Citations;
  conflicting: Conflicting;
}
export interface Answer {
  claims: Claims;
  missing_evidence: MissingEvidence;
}
export interface ReviewItem {
  document_id: DocumentId1;
  filename: Filename2;
  proposal: Proposal;
  explanation: Explanation3;
}
export interface ReviewRequest {
  interrupt_id: InterruptId;
  revision: Revision;
  items: Items;
}
export interface ReviewDecision {
  document_id: DocumentId2;
  action: Action;
  category: Category2;
}
export interface ReviewSubmission {
  interrupt_id: InterruptId1;
  revision: Revision1;
  decisions: Decisions;
}
export interface NodePayload {
  node_name: NodeName;
  label: Label;
  state: State;
  document_id: DocumentId3;
  task_id: TaskId;
  outcome: Outcome;
  detail: Detail;
  completed: Completed;
  expected: Expected;
  elapsed_ms: ElapsedMs4;
  queue_wait_ms: QueueWaitMs;
  input_count: InputCount;
  output_count: OutputCount;
  removed_count: RemovedCount;
  passage_ids: PassageIds;
  query_plan: QueryPlan | null;
  draft_claims: DraftClaims;
}
export interface EdgePayload {
  source_instance_id: SourceInstanceId;
  target_instance_id: TargetInstanceId;
  label: Label1;
}
export interface RunStartedPayload {
  kind: Kind3;
  mode: Mode;
  resumed: Resumed;
  recovered: Recovered;
}
export interface ReviewResumedPayload {
  interrupt_id: InterruptId2;
  revision: Revision2;
  count: Count;
}
export interface RunCompletedPayload {
  status: Status;
  result: Result;
  error: Error;
  timing_incomplete: TimingIncomplete;
}
export interface Event {
  schema_version: SchemaVersion;
  event_id: EventId;
  sequence: Sequence;
  timestamp: Timestamp;
  run_id: RunId;
  instance_id: InstanceId;
  parent_instance_id: ParentInstanceId;
  attempt: Attempt;
  type: Type;
  payload: Payload;
}
export interface Payload {
  [k: string]: unknown;
}
export interface Run {
  id: Id4;
  thread_id: ThreadId;
  kind: Kind4;
  status: Status1;
  mode: Mode1;
  graph_version: GraphVersion;
  policy_version: PolicyVersion1;
  created_at: CreatedAt;
  updated_at: UpdatedAt;
  result: Result1;
  review: ReviewRequest | null;
  last_event_sequence: LastEventSequence;
  trace_url: TraceUrl;
  telemetry_status: TelemetryStatus;
  request: Request;
  configuration: Configuration;
  linked_run_id: LinkedRunId;
  error: Error1;
}
export interface Request {
  [k: string]: unknown;
}
export interface Configuration {
  [k: string]: unknown;
}
export interface DocumentList {
  documents: Documents;
  excluded_unknown_dates: ExcludedUnknownDates;
}
export interface RunSnapshot {
  run: Run;
  events: Events;
  last_event_sequence: LastEventSequence1;
}
export interface MetadataUpdate {
  document_date: DocumentDate1;
}
