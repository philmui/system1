"""Versioned public contracts; JSON schema also generates the browser types."""

from datetime import UTC, date, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Category = Literal["invoice", "contract", "policy", "report", "correspondence", "other", "unknown"]
FrontierModel = Literal["gpt-4.1", "gpt-5.5", "gpt-5.6-sol"]
RunStatus = Literal[
    "queued",
    "running",
    "awaiting_review",
    "interrupted",
    "succeeded",
    "partially_succeeded",
    "failed",
    "cancelled",
]
TERMINAL = {"succeeded", "partially_succeeded", "failed", "cancelled", "interrupted"}
GRAPH_VERSION = "atlas-v1"
CLASSIFICATION_GRAPH_VERSION = "atlas-classification-v2"
POLICY_VERSION = "atlas-policy-v1"


def now() -> str:
    return datetime.now(UTC).isoformat()


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Passage(Model):
    id: str
    document_id: str
    content_version: str
    filename: str
    text: str
    page: int | None = None
    section: str | None = None
    start: int
    end: int


class Document(Model):
    id: str
    filename: str
    content_version: str
    document_date: date | None = None
    date_provenance: Literal["synthetic_manifest", "user_confirmed", "unknown"] = "unknown"
    uploaded_at: str = Field(default_factory=now)
    extraction_status: Literal["pending", "readable", "empty", "scanned", "encrypted", "unreadable"] = (
        "pending"
    )
    extraction_error: str | None = None
    extraction_elapsed_ms: float | None = Field(default=None, ge=0)
    category: Category = "unknown"
    category_provenance: str = "unclassified"
    original_judgment: dict[str, Any] | None = None
    human_correction: dict[str, Any] | None = None
    indexed: bool = False
    synthetic: bool = False


class ProviderMeta(Model):
    provider: Literal["jev", "openai", "fixture"]
    request_id: str | None = None
    configured_model: str | None = None
    returned_model: str | None = None
    elapsed_ms: float = Field(ge=0)
    usage: dict[str, Any] | None = None
    rubric_version: str = "atlas-rubric-v1"


class ChoiceSignal(ProviderMeta):
    kind: Literal["choice"] = "choice"
    choice: str
    confidence: float = Field(ge=0, le=1)
    probabilities: dict[str, float]

    @model_validator(mode="after")
    def distribution(self):
        if not self.probabilities or self.choice not in self.probabilities:
            raise ValueError("Choice missing from distribution")
        if any(not 0 <= p <= 1 for p in self.probabilities.values()):
            raise ValueError("Invalid probability")
        if abs(sum(self.probabilities.values()) - 1) > 0.03:
            raise ValueError("Distribution must sum to one")
        if self.probabilities[self.choice] < max(self.probabilities.values()):
            raise ValueError("Choice must have maximum probability")
        return self


class NoulSignal(ProviderMeta):
    kind: Literal["noul"] = "noul"
    noul: float = Field(ge=0, le=1)


class ProposalSignal(ProviderMeta):
    kind: Literal["proposal"] = "proposal"
    category: Category
    explanation: str


Signal = Annotated[ChoiceSignal | NoulSignal | ProposalSignal, Field(discriminator="kind")]


class Decision(Model):
    id: str
    input_refs: list[str]
    input_excerpt: str
    rubric: str
    signal: Signal
    threshold: float | None = None
    policy_version: str = POLICY_VERSION
    selected_route: str
    explanation: str
    omitted_context: list[str] = Field(default_factory=list)
    policy_elapsed_ms: float | None = Field(default=None, ge=0)
    policy_reason: str | None = None


class SearchFilters(Model):
    categories: list[Category] = Field(default_factory=list)
    date_from: date | None = None
    date_to: date | None = None

    @model_validator(mode="after")
    def ordered(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must be before date_to")
        return self


class ClassificationRequest(Model):
    document_ids: list[str] = Field(max_length=30)


class DiscoveryRequest(Model):
    query: str = Field(min_length=1, max_length=2000)
    filters: SearchFilters = Field(default_factory=SearchFilters)


class SearchTask(Model):
    id: str
    phrase: str = Field(min_length=1, max_length=200)
    purpose: str


class QueryPlan(Model):
    intent: Literal["find", "summarize", "compare", "unsupported"]
    tasks: list[SearchTask] = Field(max_length=3)
    explanation: str


class Citation(Model):
    passage_id: str
    quote: str


class Claim(Model):
    text: str
    citations: list[Citation] = Field(min_length=1, max_length=5)
    conflicting: bool = False


class Answer(Model):
    claims: list[Claim] = Field(max_length=8)
    missing_evidence: list[str]


class ReviewItem(Model):
    document_id: str
    filename: str
    proposal: Category
    explanation: str


class ReviewRequest(Model):
    interrupt_id: str
    revision: int
    items: list[ReviewItem]


class ReviewDecision(Model):
    document_id: str
    action: Literal["accept", "correct", "exclude"]
    category: Category | None = None


class ReviewSubmission(Model):
    interrupt_id: str
    revision: int
    decisions: list[ReviewDecision]


class Publication(Model):
    """A durable search-index commit, authorized by a recorded decision or review."""

    id: str
    document_id: str
    content_version: str
    authorization_id: str
    category: Category
    status: Literal["searchable", "withdrawn"]
    committed_at: str


class NodePayload(Model):
    node_name: str
    label: str
    state: str = "running"
    document_id: str | None = None
    task_id: str | None = None
    outcome: str | None = None
    detail: str | None = None
    completed: int | None = None
    expected: int | None = None
    elapsed_ms: float | None = Field(default=None, ge=0)
    queue_wait_ms: float | None = Field(default=None, ge=0)
    input_count: int | None = Field(default=None, ge=0)
    output_count: int | None = Field(default=None, ge=0)
    removed_count: int | None = Field(default=None, ge=0)
    passage_ids: list[str] = Field(default_factory=list, max_length=24)
    query_plan: QueryPlan | None = None
    draft_claims: list[Claim] = Field(default_factory=list, max_length=8)
    publication: Publication | None = None


class EdgePayload(Model):
    source_instance_id: str
    target_instance_id: str
    label: str


class RunStartedPayload(Model):
    kind: Literal["classification", "discovery"]
    mode: Literal["live", "test-fixture"]
    resumed: bool = False
    recovered: bool = False


class ReviewResumedPayload(Model):
    interrupt_id: str
    revision: int
    count: int = Field(ge=0)
    decisions: list[ReviewDecision] = Field(default_factory=list)


class RunCompletedPayload(Model):
    status: RunStatus
    result: dict[str, Any] | None = None
    error: str | None = None
    timing_incomplete: bool = False


EVENT_PAYLOAD_MODELS = {
    "worker_created": NodePayload,
    "node_started": NodePayload,
    "node_completed": NodePayload,
    "node_failed": NodePayload,
    "edge_selected": EdgePayload,
    "decision": Decision,
    "review_requested": ReviewRequest,
    "run_started": RunStartedPayload,
    "review_resumed": ReviewResumedPayload,
    "run_completed": RunCompletedPayload,
}


class Event(Model):
    schema_version: int = 1
    event_id: str
    sequence: int
    timestamp: str = Field(default_factory=now)
    run_id: str
    instance_id: str
    parent_instance_id: str | None = None
    attempt: int = 1
    type: Literal[
        "run_started",
        "worker_created",
        "node_started",
        "node_completed",
        "node_failed",
        "decision",
        "edge_selected",
        "review_requested",
        "review_resumed",
        "run_completed",
    ]
    payload: dict[str, Any]

    @model_validator(mode="after")
    def payload_contract(self):
        EVENT_PAYLOAD_MODELS[self.type].model_validate(self.payload)
        return self


class Run(Model):
    id: str
    thread_id: str
    kind: Literal["classification", "discovery"]
    status: RunStatus = "queued"
    mode: Literal["live", "test-fixture"]
    graph_version: str = GRAPH_VERSION
    policy_version: str = POLICY_VERSION
    created_at: str = Field(default_factory=now)
    updated_at: str = Field(default_factory=now)
    result: dict[str, Any] | None = None
    review: ReviewRequest | None = None
    last_event_sequence: int = 0
    trace_url: str | None = None
    telemetry_status: str = "disabled"
    request: dict[str, Any]
    configuration: dict[str, Any] = Field(default_factory=dict)
    linked_run_id: str | None = None
    error: str | None = None


class DocumentList(Model):
    documents: list[Document]
    excluded_unknown_dates: int = 0


class RunSnapshot(Model):
    run: Run
    events: list[Event]
    last_event_sequence: int


class MetadataUpdate(Model):
    document_date: date | None
