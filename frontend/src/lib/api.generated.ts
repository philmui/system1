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
export type Id4 = string;
export type DocumentId3 = string;
export type ContentVersion2 = string;
export type AuthorizationId = string;
export type Category3 = 'invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown';
export type Status = 'searchable' | 'withdrawn';
export type CommittedAt = string;
export type NodeName = string;
export type Label = string;
export type State = string;
export type DocumentId4 = string | null;
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
export type Decisions1 = ReviewDecision[];
export type Status1 =
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
export type Id5 = string;
export type ThreadId = string;
export type Kind4 = 'classification' | 'discovery';
export type Status2 =
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
export type Documents1 = 'synthetic';
export type Providers = 'simulated';
export type Runtime = 'executed';
export type Timing = 'fixture wall time, not model performance';
export type Review = 'scripted approval';
export type Storage = 'isolated temporary store';
export type ExampleId = string;
export type Title = string;
export type Cue = string;
export type Text2 = string;
export type Passages = Passage[];
export type SourceExcerpt = string;
export type ReferenceCategory = 'invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown';
export type ExpectedReason = string;
export type ControlledSignal = boolean;
export type Documents2 = LessonDocument[];
export type Documents3 = LessonDocument[];
export type Id6 = string;
export type Title1 = string;
export type Explanation4 = string;
export type Documents4 = LessonDocument[];
export type Version = string;
export type PolicyVersion2 = string;
export type Safeguards = SafeguardLesson[];
export type ExampleId1 = 'clear' | 'policy' | 'ambiguous' | 'proposed' | 'finalized';
export type OriginalExampleId = ('clear' | 'policy' | 'ambiguous' | 'proposed' | 'finalized') | null;
export type Threshold1 = number;
export type GuardEnabled = boolean;
export type Source = 'recorded' | 'simulation' | 'executed';
export type DecisionId = string | null;
export type PolicyVersion3 = string;
export type ExampleId2 = 'clear' | 'policy' | 'ambiguous' | 'proposed' | 'finalized';
export type ContentVersion3 = string;
export type Threshold2 = number;
export type GuardEnabled1 = boolean;
export type GuardMatched = boolean;
export type SelectedRoute1 = 'accept' | 'interpret';
export type Reason = string;
export type Explanation5 = string;
export type RequiresReview = boolean;
export type SourceExcerpt1 = string;
export type ReferenceCategory1 = 'invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown';
export type ReferenceMismatch = boolean;
export type PolicyViolation = boolean;
export type Eligible = number;
export type Accepted = number;
export type Escalated = number;
export type AcceptanceCoverage = number;
export type AcceptedReferenceMistakes = number;
export type AcceptedPolicyViolations = number;
export type QualityBasis = string;
export type Version1 = string;
export type PolicyVersion4 = string;
export type NoWrite = true;
export type ProviderCalls = 0;
export type Outcomes = PolicyReceipt[];
export type ChangedFields = string[];
export type ControlledAssumption = string;
export type ExampleId3 = 'ambiguous' | 'proposed';
export type ContentVersion4 = string;
export type FrontierModel = 'gpt-4.1' | 'gpt-5.5' | 'gpt-5.6-sol';
export type TotalElapsedMs = number;
export type PolicyElapsedMs1 = number;
export type ReferenceCategory2 = 'invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown';
export type ProposalMatchesReference = boolean;
export type EvaluatedDocuments = 1;
export type QualityBasis1 = 'authored lesson reference; not benchmark accuracy';
export type TimingScope = 'interpretation preview';
export type Version2 = string;
export type ExampleId4 = 'ambiguous' | 'proposed';
export type DocumentId5 = string;
export type ContentVersion5 = string;
export type RequiresReview1 = true;
export type Published = false;
export type OperationalWrites = 0;
export type ProviderCalls1 = 1;
export type ProviderSource = 'live';
export type SignalSource = 'prepared';
export type Timing1 = 'measured provider round trip';
export type ExampleId5 = 'find' | 'compare';
export type BoundedMode = 'prepared' | 'live';
export type FrontierModel1 = 'gpt-4.1' | 'gpt-5.5' | 'gpt-5.6-sol';
export type Documents5 = 'synthetic';
export type BoundedJudgments = 'prepared' | 'live';
export type Frontier = string;
export type Runtime1 = 'executed';
export type CitationChecks = 'executed exact checks';
export type SupportChecks =
  'prepared signals; not independent verification' | 'live Jev signals; fallible semantic check';
export type Timing2 =
  | 'mixed: measured frontier round trips; fixture bounded durations'
  | 'measured client request stages and executed local work';
export type Storage1 = 'isolated temporary store';
export type SourcePreparation = 'prepared classification and indexing outside this discovery run';
export type Matching = 0 | 1;
export type Evaluated = 0 | 1;
export type ReferenceIntent = 'find' | 'compare';
export type ObservedIntent = string | null;
export type Basis = 'authored lesson intent; not benchmark accuracy';
export type TotalElapsedMs1 = number | null;
export type TimingScope1 = 'discovery execution; source preparation excluded';
export type CitationClaimsChecked = number | null;
export type CitationClaimsValid = number | null;
export type CitationClaimsRemoved = number | null;
export type SupportClaimsChecked = number | null;
export type SupportClaimsRetained = number | null;
export type QualityScope = 'answer quality not evaluated; citation validity and support retention are checks';
export type Version3 = string;
export type ExampleId6 = 'find' | 'compare';
export type Documents6 = LessonDocument[];
export type OperationalWrites1 = 0;
export type FrontierCalls = number;
export type PageId = 'ARC-000141' | 'ARC-000212' | 'ARC-000377' | 'ARC-000401' | 'ARC-000455' | 'ARC-000508';
export type ContentVersion6 = string;
export type Action1 = 'classify' | 'redact';
export type FrontierModel2 = 'gpt-4.1' | 'gpt-5.5' | 'gpt-5.6-sol';
export type Responsive = 'yes' | 'no' | 'uncertain';
export type PersonalInfo = 'yes' | 'no' | 'uncertain';
export type Privileged = 'yes' | 'no' | 'uncertain';
export type Explanation6 = string;
export type RedactedText = string;
/**
 * @maxItems 30
 */
export type RemovedSpans = string[];
export type Explanation7 = string;
export type Criterion = string;
export type Expected1 = string;
export type Observed1 = string;
export type Matched = boolean;
export type Version4 = string;
export type Metric = 'fictional_reference_agreement' | 'authored_pii_span_coverage';
export type Matched1 = number;
export type Total = number;
export type Checks = ReviewReferenceCheck[];
export type ExtraRemovedCharacters = number | null;
export type RewriteIntegrity = boolean | null;
export type Basis1 = string;
export type HandlerWallMs = number;
export type InputChecksMs = number;
export type ProviderMs = number;
export type CodeValidationMs = number;
export type ReferenceEvaluationMs = number;
export type TimingScope2 = string;
export type WorkflowElapsedMs = null;
export type WorkflowQuality = null;
export type Version5 = 'review-pages-v1';
export type PageId1 = 'ARC-000141' | 'ARC-000212' | 'ARC-000377' | 'ARC-000401' | 'ARC-000455' | 'ARC-000508';
export type ContentVersion7 = string;
export type Action2 = 'classify' | 'redact';
export type ProposedRoute = ('produce' | 'aside' | 'redact' | 'attorney') | null;
export type Validation = 'structured judgment' | 'exact source rewrite';
export type RequiresReview2 = true;
export type Published1 = false;
export type OperationalWrites2 = 0;
export type ProviderCalls2 = 1;
export type ProviderSource1 = 'live';
export type Timing3 = 'measured provider round trip';
export type ExampleId7 = 'clear' | 'policy' | 'ambiguous' | 'proposed' | 'finalized';
export type ContentVersion8 = string;
export type FrontierModel3 = 'gpt-4.1' | 'gpt-5.5' | 'gpt-5.6-sol';
export type ExampleId8 = 'clear' | 'policy' | 'ambiguous' | 'proposed' | 'finalized';
export type ContentVersion9 = string;
export type FrontierModel4 = 'gpt-4.1' | 'gpt-5.5' | 'gpt-5.6-sol';
export type Matching1 = 0 | 1;
export type Evaluated1 = 0 | 1;
export type ReferenceCategory3 = 'invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown';
export type ObservedCategory =
  ('invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown') | null;
export type Basis2 = 'authored lesson reference';
export type Scope = 'one synthetic document; not a benchmark';
export type PolicyVersion5 = string;
export type Threshold3 = number;
export type GuardMatched1 = boolean;
export type SelectedRoute2 = 'accept' | 'interpret';
export type Reason1 = string;
export type Explanation8 = string;
export type Id7 = 'judge' | 'policy' | 'interpret';
export type Label2 = string;
export type Kind5 = 'bounded_judgment' | 'runtime_policy' | 'frontier_interpretation';
export type Status3 = 'succeeded' | 'failed';
export type StartedAfterMs = number;
export type ElapsedMs5 = number;
export type QueueElapsedMs = number;
export type Error2 = string | null;
export type Id8 = 'system1' | 'frontier_first';
export type Label3 = string;
export type Status4 = 'completed' | 'failed';
export type StartedAfterMs1 = number;
export type FinishedAfterMs = number;
export type ElapsedMs6 = number;
export type Components = MeasuredComponent[];
export type OutputCategory =
  ('invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown') | null;
export type OutputKind = 'accepted_category' | 'proposal' | 'unavailable';
export type RequiresReview3 = boolean | null;
export type BoundedAttempts = number;
export type FrontierAttempts = number;
export type ProviderWorkMs = number;
export type Error3 = string | null;
export type Documents7 = 'synthetic content-bound source';
export type BoundedProvider = 'live Jev';
export type FrontierProvider = string;
export type Policy = 'same taxonomy, 0.80 threshold, and text guard';
export type ConfidenceNote = string;
export type TimingScope3 = string;
export type StoppingPoint = 'accepted category or unapproved proposal';
export type QualityScope1 = string;
export type SampleCount = 1;
export type MaxInFlightProviderRequests = number;
export type AutomaticRetries = 0;
export type HumanReview = 'not performed';
export type Publication1 = 'not performed';
export type Version6 = string;
export type ComparisonId = string;
export type ExampleId9 = 'clear' | 'policy' | 'ambiguous' | 'proposed' | 'finalized';
export type DocumentId6 = string;
export type ContentVersion10 = string;
export type ReferenceCategory4 = 'invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown';
export type StartedAt = string;
export type TotalElapsedMs2 = number;
/**
 * @minItems 2
 * @maxItems 2
 */
export type Strategies = [MeasuredClassificationStrategy, MeasuredClassificationStrategy];
export type OperationalWrites3 = 0;
export type Published2 = false;
export type Documents8 = 'synthetic content-bound source';
export type BoundedProvider1 = 'live Jev';
export type FrontierProvider1 = string;
export type Policy1 = 'executed taxonomy, 0.80 threshold, and text guard';
export type ConfidenceNote1 = string;
export type TimingScope4 = string;
export type StoppingPoint1 = 'accepted category or unapproved proposal';
export type QualityScope2 = string;
export type SampleCount1 = 1;
export type AutomaticRetries1 = 0;
export type HumanReview1 = 'not performed';
export type Publication2 = 'not performed';
export type Version7 = string;
export type ExampleId10 = 'clear' | 'policy' | 'ambiguous' | 'proposed' | 'finalized';
export type DocumentId7 = string;
export type ContentVersion11 = string;
export type ReferenceCategory5 = 'invoice' | 'contract' | 'policy' | 'report' | 'correspondence' | 'other' | 'unknown';
export type StartedAt1 = string;
export type TotalElapsedMs3 = number;
export type OperationalWrites4 = 0;
export type Published3 = false;

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
  Publication: Publication;
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
  LessonProvenance: LessonProvenance;
  LessonDocument: LessonDocument;
  ClassificationLesson: ClassificationLesson;
  DiscoveryLesson: DiscoveryLesson;
  SafeguardLesson: SafeguardLesson;
  LessonCatalogue: LessonCatalogue;
  PolicyExperimentRequest: PolicyExperimentRequest;
  PolicyReceipt: PolicyReceipt;
  ExperimentCoverage: ExperimentCoverage;
  PolicyExperimentResponse: PolicyExperimentResponse;
  LiveInterpretRequest: LiveInterpretRequest;
  InterpretationPreviewMetrics: InterpretationPreviewMetrics;
  LiveInterpretResponse: LiveInterpretResponse;
  LiveDiscoveryRequest: LiveDiscoveryRequest;
  LiveDiscoveryProvenance: LiveDiscoveryProvenance;
  DiscoveryIntentAgreement: DiscoveryIntentAgreement;
  LiveDiscoveryMetrics: LiveDiscoveryMetrics;
  LiveDiscoveryResponse: LiveDiscoveryResponse;
  LiveReviewRequest: LiveReviewRequest;
  LiveReviewJudgment: LiveReviewJudgment;
  LiveRedactionDraft: LiveRedactionDraft;
  ReviewReferenceCheck: ReviewReferenceCheck;
  ReviewReferenceResult: ReviewReferenceResult;
  ReviewActionMetrics: ReviewActionMetrics;
  LiveReviewResponse: LiveReviewResponse;
  LiveClassificationComparisonRequest: LiveClassificationComparisonRequest;
  LiveClassificationRequest: LiveClassificationRequest;
  AuthoredReferenceAgreement: AuthoredReferenceAgreement;
  MeasuredPolicyDecision: MeasuredPolicyDecision;
  MeasuredComponent: MeasuredComponent;
  MeasuredClassificationStrategy: MeasuredClassificationStrategy;
  ClassificationComparisonProvenance: ClassificationComparisonProvenance;
  LiveClassificationComparisonResponse: LiveClassificationComparisonResponse;
  LiveClassificationProvenance: LiveClassificationProvenance;
  LiveClassificationResponse: LiveClassificationResponse;
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
/**
 * A durable search-index commit, authorized by a recorded decision or review.
 */
export interface Publication {
  id: Id4;
  document_id: DocumentId3;
  content_version: ContentVersion2;
  authorization_id: AuthorizationId;
  category: Category3;
  status: Status;
  committed_at: CommittedAt;
}
export interface NodePayload {
  node_name: NodeName;
  label: Label;
  state: State;
  document_id: DocumentId4;
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
  publication: Publication | null;
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
  decisions: Decisions1;
}
export interface RunCompletedPayload {
  status: Status1;
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
  id: Id5;
  thread_id: ThreadId;
  kind: Kind4;
  status: Status2;
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
export interface LessonProvenance {
  documents: Documents1;
  providers: Providers;
  runtime: Runtime;
  timing: Timing;
  review: Review;
  storage: Storage;
}
export interface LessonDocument {
  example_id: ExampleId;
  title: Title;
  cue: Cue;
  document: Document;
  text: Text2;
  passages: Passages;
  source_excerpt: SourceExcerpt;
  reference_category: ReferenceCategory;
  expected_reason: ExpectedReason;
  controlled_signal: ControlledSignal;
}
export interface ClassificationLesson {
  snapshot: RunSnapshot;
  documents: Documents2;
}
export interface DiscoveryLesson {
  documents: Documents3;
  find: RunSnapshot;
  compare: RunSnapshot;
  empty: RunSnapshot;
  unsupported: RunSnapshot;
}
export interface SafeguardLesson {
  id: Id6;
  title: Title1;
  explanation: Explanation4;
  snapshot: RunSnapshot;
  documents: Documents4;
  observed: Observed;
}
export interface Observed {
  [k: string]: boolean | number | string;
}
export interface LessonCatalogue {
  version: Version;
  policy_version: PolicyVersion2;
  provenance: LessonProvenance;
  classification: ClassificationLesson;
  discovery: DiscoveryLesson;
  safeguards: Safeguards;
}
export interface PolicyExperimentRequest {
  example_id: ExampleId1;
  original_example_id: OriginalExampleId;
  threshold: Threshold1;
  guard_enabled: GuardEnabled;
}
export interface PolicyReceipt {
  source: Source;
  decision_id: DecisionId;
  policy_version: PolicyVersion3;
  example_id: ExampleId2;
  content_version: ContentVersion3;
  signal: ChoiceSignal;
  threshold: Threshold2;
  guard_enabled: GuardEnabled1;
  guard_matched: GuardMatched;
  selected_route: SelectedRoute1;
  reason: Reason;
  explanation: Explanation5;
  requires_review: RequiresReview;
  source_excerpt: SourceExcerpt1;
  reference_category: ReferenceCategory1;
  reference_mismatch: ReferenceMismatch;
  policy_violation: PolicyViolation;
}
export interface ExperimentCoverage {
  eligible: Eligible;
  accepted: Accepted;
  escalated: Escalated;
  acceptance_coverage: AcceptanceCoverage;
  accepted_reference_mistakes: AcceptedReferenceMistakes;
  accepted_policy_violations: AcceptedPolicyViolations;
  quality_basis: QualityBasis;
}
export interface PolicyExperimentResponse {
  version: Version1;
  policy_version: PolicyVersion4;
  no_write: NoWrite;
  provider_calls: ProviderCalls;
  original: PolicyReceipt;
  simulated: PolicyReceipt;
  original_coverage: ExperimentCoverage;
  simulated_coverage: ExperimentCoverage;
  outcomes: Outcomes;
  changed_fields: ChangedFields;
  controlled_assumption: ControlledAssumption;
}
export interface LiveInterpretRequest {
  example_id: ExampleId3;
  content_version: ContentVersion4;
  frontier_model: FrontierModel;
}
export interface InterpretationPreviewMetrics {
  total_elapsed_ms: TotalElapsedMs;
  policy_elapsed_ms: PolicyElapsedMs1;
  reference_category: ReferenceCategory2;
  proposal_matches_reference: ProposalMatchesReference;
  evaluated_documents: EvaluatedDocuments;
  quality_basis: QualityBasis1;
  timing_scope: TimingScope;
}
export interface LiveInterpretResponse {
  version: Version2;
  example_id: ExampleId4;
  document_id: DocumentId5;
  content_version: ContentVersion5;
  proposal: ProposalSignal;
  policy: PolicyReceipt;
  requires_review: RequiresReview1;
  published: Published;
  operational_writes: OperationalWrites;
  provider_calls: ProviderCalls1;
  provider_source: ProviderSource;
  signal_source: SignalSource;
  timing: Timing1;
  metrics: InterpretationPreviewMetrics | null;
}
export interface LiveDiscoveryRequest {
  example_id: ExampleId5;
  bounded_mode: BoundedMode;
  frontier_model: FrontierModel1;
}
export interface LiveDiscoveryProvenance {
  documents: Documents5;
  bounded_judgments: BoundedJudgments;
  frontier: Frontier;
  runtime: Runtime1;
  citation_checks: CitationChecks;
  support_checks: SupportChecks;
  timing: Timing2;
  storage: Storage1;
  source_preparation: SourcePreparation;
}
export interface DiscoveryIntentAgreement {
  matching: Matching;
  evaluated: Evaluated;
  reference_intent: ReferenceIntent;
  observed_intent: ObservedIntent;
  basis: Basis;
}
export interface LiveDiscoveryMetrics {
  total_elapsed_ms: TotalElapsedMs1;
  timing_scope: TimingScope1;
  intent_agreement: DiscoveryIntentAgreement;
  citation_claims_checked: CitationClaimsChecked;
  citation_claims_valid: CitationClaimsValid;
  citation_claims_removed: CitationClaimsRemoved;
  support_claims_checked: SupportClaimsChecked;
  support_claims_retained: SupportClaimsRetained;
  quality_scope: QualityScope;
}
export interface LiveDiscoveryResponse {
  version: Version3;
  example_id: ExampleId6;
  snapshot: RunSnapshot;
  documents: Documents6;
  operational_writes: OperationalWrites1;
  frontier_calls: FrontierCalls;
  provenance: LiveDiscoveryProvenance;
  metrics: LiveDiscoveryMetrics | null;
}
export interface LiveReviewRequest {
  page_id: PageId;
  content_version: ContentVersion6;
  action: Action1;
  frontier_model: FrontierModel2;
}
export interface LiveReviewJudgment {
  responsive: Responsive;
  personal_info: PersonalInfo;
  privileged: Privileged;
  explanation: Explanation6;
}
export interface LiveRedactionDraft {
  redacted_text: RedactedText;
  removed_spans: RemovedSpans;
  explanation: Explanation7;
}
export interface ReviewReferenceCheck {
  criterion: Criterion;
  expected: Expected1;
  observed: Observed1;
  matched: Matched;
}
export interface ReviewReferenceResult {
  version: Version4;
  metric: Metric;
  matched: Matched1;
  total: Total;
  checks: Checks;
  extra_removed_characters: ExtraRemovedCharacters;
  rewrite_integrity: RewriteIntegrity;
  basis: Basis1;
}
export interface ReviewActionMetrics {
  handler_wall_ms: HandlerWallMs;
  input_checks_ms: InputChecksMs;
  provider_ms: ProviderMs;
  code_validation_ms: CodeValidationMs;
  reference_evaluation_ms: ReferenceEvaluationMs;
  reference: ReviewReferenceResult;
  timing_scope: TimingScope2;
  workflow_elapsed_ms: WorkflowElapsedMs;
  workflow_quality: WorkflowQuality;
}
export interface LiveReviewResponse {
  version: Version5;
  page_id: PageId1;
  content_version: ContentVersion7;
  action: Action2;
  metadata: ProviderMeta;
  judgment: LiveReviewJudgment | null;
  proposed_route: ProposedRoute;
  redaction: LiveRedactionDraft | null;
  validation: Validation;
  requires_review: RequiresReview2;
  published: Published1;
  operational_writes: OperationalWrites2;
  provider_calls: ProviderCalls2;
  provider_source: ProviderSource1;
  timing: Timing3;
  metrics: ReviewActionMetrics | null;
}
export interface LiveClassificationComparisonRequest {
  example_id: ExampleId7;
  content_version: ContentVersion8;
  frontier_model: FrontierModel3;
}
/**
 * A single live strategy; no frontier-first baseline request.
 */
export interface LiveClassificationRequest {
  example_id: ExampleId8;
  content_version: ContentVersion9;
  frontier_model: FrontierModel4;
}
export interface AuthoredReferenceAgreement {
  matching: Matching1;
  evaluated: Evaluated1;
  reference_category: ReferenceCategory3;
  observed_category: ObservedCategory;
  basis: Basis2;
  scope: Scope;
}
export interface MeasuredPolicyDecision {
  policy_version: PolicyVersion5;
  threshold: Threshold3;
  guard_matched: GuardMatched1;
  selected_route: SelectedRoute2;
  reason: Reason1;
  explanation: Explanation8;
}
export interface MeasuredComponent {
  id: Id7;
  label: Label2;
  kind: Kind5;
  status: Status3;
  started_after_ms: StartedAfterMs;
  elapsed_ms: ElapsedMs5;
  queue_elapsed_ms: QueueElapsedMs;
  provider: ProviderMeta | null;
  error: Error2;
}
export interface MeasuredClassificationStrategy {
  id: Id8;
  label: Label3;
  status: Status4;
  started_after_ms: StartedAfterMs1;
  finished_after_ms: FinishedAfterMs;
  elapsed_ms: ElapsedMs6;
  components: Components;
  judgment: ChoiceSignal | null;
  policy: MeasuredPolicyDecision | null;
  interpretation: ProposalSignal | null;
  output_category: OutputCategory;
  output_kind: OutputKind;
  requires_review: RequiresReview3;
  bounded_attempts: BoundedAttempts;
  frontier_attempts: FrontierAttempts;
  provider_work_ms: ProviderWorkMs;
  judgment_agreement: AuthoredReferenceAgreement;
  output_agreement: AuthoredReferenceAgreement;
  error: Error3;
}
export interface ClassificationComparisonProvenance {
  documents: Documents7;
  bounded_provider: BoundedProvider;
  frontier_provider: FrontierProvider;
  policy: Policy;
  confidence_note: ConfidenceNote;
  timing_scope: TimingScope3;
  stopping_point: StoppingPoint;
  quality_scope: QualityScope1;
  sample_count: SampleCount;
  max_in_flight_provider_requests: MaxInFlightProviderRequests;
  automatic_retries: AutomaticRetries;
  human_review: HumanReview;
  publication: Publication1;
}
export interface LiveClassificationComparisonResponse {
  version: Version6;
  comparison_id: ComparisonId;
  example_id: ExampleId9;
  document_id: DocumentId6;
  content_version: ContentVersion10;
  reference_category: ReferenceCategory4;
  started_at: StartedAt;
  total_elapsed_ms: TotalElapsedMs2;
  strategies: Strategies;
  provenance: ClassificationComparisonProvenance;
  operational_writes: OperationalWrites3;
  published: Published2;
}
export interface LiveClassificationProvenance {
  documents: Documents8;
  bounded_provider: BoundedProvider1;
  frontier_provider: FrontierProvider1;
  policy: Policy1;
  confidence_note: ConfidenceNote1;
  timing_scope: TimingScope4;
  stopping_point: StoppingPoint1;
  quality_scope: QualityScope2;
  sample_count: SampleCount1;
  automatic_retries: AutomaticRetries1;
  human_review: HumanReview1;
  publication: Publication2;
}
export interface LiveClassificationResponse {
  version: Version7;
  example_id: ExampleId10;
  document_id: DocumentId7;
  content_version: ContentVersion11;
  reference_category: ReferenceCategory5;
  started_at: StartedAt1;
  total_elapsed_ms: TotalElapsedMs3;
  strategy: MeasuredClassificationStrategy;
  provenance: LiveClassificationProvenance;
  operational_writes: OperationalWrites4;
  published: Published3;
}
