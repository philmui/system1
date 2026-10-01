"""Read-only educational records and isolated, authoritative policy experiments.

The catalogue is generated offline by real fixture workflows in a temporary store.
Serving the catalogue never executes a workflow, changes user data, or contacts a provider.
Explicit live commands call the selected frontier model on allowed prepared sources.
Fixture adapters stay inside isolated teaching stores and never replace live failures.
"""

import asyncio
import hashlib
import json
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from tempfile import TemporaryDirectory
from time import perf_counter
from typing import Literal
from uuid import NAMESPACE_URL, uuid5

from fastapi import APIRouter, HTTPException, Request
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from pydantic import Field

from .events import Events
from .ingestion import anchors, ingest
from .live_lessons import (
    check_live_origin,
    frontier_label,
    live_frontier,
    live_lesson_slot,
    live_provider_error,
)
from .policies import TAXONOMY, classification_route, mixed_purpose, select_context
from .providers.common import ProviderError
from .providers.jev import MODEL_LIMITS, JevProvider
from .providers.openai import ClassificationProposal, OpenAIProvider
from .schemas import (
    POLICY_VERSION,
    Answer,
    Category,
    ChoiceSignal,
    Citation,
    Claim,
    Document,
    Event,
    FrontierModel,
    Model,
    Passage,
    ProposalSignal,
    QueryPlan,
    ReviewSubmission,
    RunSnapshot,
    SearchTask,
)
from .settings import ROOT, Settings
from .storage import Storage
from .teaching import teaching_manifest

VERSION = "disaggregated-lessons-v3"
FOLDER = ROOT / "data" / "education-examples"
CATALOGUE_PATH = ROOT / "frontend" / "src" / "data" / "lessons.json"
FIND_QUERY = "Find the access policy"
COMPARE_QUERY = "Compare the 2025 and 2026 access policies: access duration and required approval"
ExampleId = Literal["clear", "policy", "ambiguous", "proposed", "finalized"]


class LessonProvenance(Model):
    documents: Literal["synthetic"] = "synthetic"
    providers: Literal["simulated"] = "simulated"
    runtime: Literal["executed"] = "executed"
    timing: Literal["fixture wall time, not model performance"] = "fixture wall time, not model performance"
    review: Literal["scripted approval"] = "scripted approval"
    storage: Literal["isolated temporary store"] = "isolated temporary store"


class LessonDocument(Model):
    example_id: str
    title: str
    cue: str
    document: Document
    text: str
    passages: list[Passage]
    source_excerpt: str
    reference_category: Category
    expected_reason: str
    controlled_signal: bool = False


class ClassificationLesson(Model):
    snapshot: RunSnapshot
    documents: list[LessonDocument]


class DiscoveryLesson(Model):
    documents: list[LessonDocument]
    find: RunSnapshot
    compare: RunSnapshot
    empty: RunSnapshot
    unsupported: RunSnapshot


class SafeguardLesson(Model):
    id: str
    title: str
    explanation: str
    snapshot: RunSnapshot
    documents: list[LessonDocument]
    observed: dict[str, bool | int | str]


class LessonCatalogue(Model):
    version: str
    policy_version: str
    provenance: LessonProvenance
    classification: ClassificationLesson
    discovery: DiscoveryLesson
    safeguards: list[SafeguardLesson]


class PolicyExperimentRequest(Model):
    example_id: ExampleId = "proposed"
    original_example_id: ExampleId | None = None
    threshold: float = Field(default=0.8, ge=0, le=1, allow_inf_nan=False)
    guard_enabled: bool = True


class PolicyReceipt(Model):
    source: Literal["recorded", "simulation", "executed"] = "simulation"
    decision_id: str | None = None
    policy_version: str = POLICY_VERSION
    example_id: ExampleId
    content_version: str
    signal: ChoiceSignal
    threshold: float
    guard_enabled: bool
    guard_matched: bool
    selected_route: Literal["accept", "interpret"]
    reason: str
    explanation: str
    requires_review: bool
    source_excerpt: str
    reference_category: Category
    reference_mismatch: bool
    policy_violation: bool


class ExperimentCoverage(Model):
    eligible: int
    accepted: int
    escalated: int
    acceptance_coverage: float
    accepted_reference_mistakes: int
    accepted_policy_violations: int
    quality_basis: str = "Prepared reference categories and default review policy; not a model evaluation."


class PolicyExperimentResponse(Model):
    version: str
    policy_version: str
    no_write: Literal[True] = True
    provider_calls: Literal[0] = 0
    original: PolicyReceipt
    simulated: PolicyReceipt
    original_coverage: ExperimentCoverage
    simulated_coverage: ExperimentCoverage
    outcomes: list[PolicyReceipt]
    changed_fields: list[str]
    controlled_assumption: str


class LiveInterpretRequest(Model):
    example_id: Literal["ambiguous", "proposed"]
    content_version: str = Field(pattern=r"^[a-f0-9]{64}$")
    frontier_model: FrontierModel = "gpt-5.5"


class InterpretationPreviewMetrics(Model):
    total_elapsed_ms: float = Field(ge=0)
    policy_elapsed_ms: float = Field(ge=0)
    reference_category: Category
    proposal_matches_reference: bool
    evaluated_documents: Literal[1] = 1
    quality_basis: Literal["authored lesson reference; not benchmark accuracy"] = (
        "authored lesson reference; not benchmark accuracy"
    )
    timing_scope: Literal["interpretation preview"] = "interpretation preview"


class LiveInterpretResponse(Model):
    version: str
    example_id: Literal["ambiguous", "proposed"]
    document_id: str
    content_version: str
    proposal: ProposalSignal
    policy: PolicyReceipt
    requires_review: Literal[True] = True
    published: Literal[False] = False
    operational_writes: Literal[0] = 0
    provider_calls: Literal[1] = 1
    provider_source: Literal["live"] = "live"
    signal_source: Literal["prepared"] = "prepared"
    timing: Literal["measured provider round trip"] = "measured provider round trip"
    metrics: InterpretationPreviewMetrics | None = None


class LiveDiscoveryRequest(Model):
    example_id: Literal["find", "compare"]
    bounded_mode: Literal["prepared", "live"] = "prepared"
    frontier_model: FrontierModel = "gpt-5.5"


class LiveDiscoveryProvenance(Model):
    documents: Literal["synthetic"] = "synthetic"
    bounded_judgments: Literal["prepared", "live"] = "prepared"
    frontier: str = "live GPT-5.5 when selected"
    runtime: Literal["executed"] = "executed"
    citation_checks: Literal["executed exact checks"] = "executed exact checks"
    support_checks: Literal[
        "prepared signals; not independent verification",
        "live Jev signals; fallible semantic check",
    ] = (
        "prepared signals; not independent verification"
    )
    timing: Literal[
        "mixed: measured frontier round trips; fixture bounded durations",
        "measured client request stages and executed local work",
    ] = (
        "mixed: measured frontier round trips; fixture bounded durations"
    )
    storage: Literal["isolated temporary store"] = "isolated temporary store"
    source_preparation: Literal["prepared classification and indexing outside this discovery run"] = (
        "prepared classification and indexing outside this discovery run"
    )


class DiscoveryIntentAgreement(Model):
    matching: Literal[0, 1]
    evaluated: Literal[0, 1]
    reference_intent: Literal["find", "compare"]
    observed_intent: str | None
    basis: Literal["authored lesson intent; not benchmark accuracy"] = (
        "authored lesson intent; not benchmark accuracy"
    )


class LiveDiscoveryMetrics(Model):
    total_elapsed_ms: float | None = Field(default=None, ge=0)
    timing_scope: Literal["discovery execution; source preparation excluded"] = (
        "discovery execution; source preparation excluded"
    )
    intent_agreement: DiscoveryIntentAgreement
    citation_claims_checked: int | None = Field(default=None, ge=0)
    citation_claims_valid: int | None = Field(default=None, ge=0)
    citation_claims_removed: int | None = Field(default=None, ge=0)
    support_claims_checked: int | None = Field(default=None, ge=0)
    support_claims_retained: int | None = Field(default=None, ge=0)
    quality_scope: Literal["answer quality not evaluated; citation validity and support retention are checks"] = (
        "answer quality not evaluated; citation validity and support retention are checks"
    )


class LiveDiscoveryResponse(Model):
    version: str
    example_id: Literal["find", "compare"]
    snapshot: RunSnapshot
    documents: list[LessonDocument]
    operational_writes: Literal[0] = 0
    frontier_calls: int = Field(ge=0)
    provenance: LiveDiscoveryProvenance = Field(default_factory=LiveDiscoveryProvenance)
    metrics: LiveDiscoveryMetrics | None = None


@lru_cache(maxsize=1)
def scenario_manifest() -> dict:
    manifest = json.loads((FOLDER / "manifest.json").read_text())
    prior = {item["filename"]: item for item in teaching_manifest()["documents"]}
    for item in manifest["documents"]:
        item.update({**prior.get(item["filename"], {}), **item})
        raw = (ROOT / "data" / item["folder"] / item["filename"]).read_bytes()
        item["content_version"] = hashlib.sha256(raw).hexdigest()
        item["text"] = raw.decode("utf-8")
        if not item["source_excerpt"]:
            item["source_excerpt"] = {
                "policy": "This standing policy applies to every member of Atlas Observatory.",
            }[item["example_id"]]
        elif item["example_id"] == "clear":
            item["source_excerpt"] = "Total due: USD 750. Please remit payment against invoice T-1042."
        if item["source_excerpt"] not in item["text"]:
            raise ValueError("Lesson source evidence must be an exact retained text excerpt")
    return manifest


def scenario(example_id: str) -> dict:
    return next(item for item in scenario_manifest()["documents"] if item["example_id"] == example_id)


def lesson_fixture(document: Document) -> dict | None:
    """Prepared signals require the retained synthetic source identity and content."""
    return next(
        (
            item for item in scenario_manifest()["documents"]
            if document.synthetic
            and item["filename"] == document.filename
            and item["content_version"] == document.content_version
        ),
        None,
    )


def prepared_signal(item: dict, metadata: dict | None = None) -> ChoiceSignal:
    """One content fixture for the isolated provider and no-call experiment."""
    probability = 0.96 if item["confidence"] >= 0.8 else 0.52
    probabilities = {name: (1 - probability) / (len(TAXONOMY) - 1) for name in TAXONOMY}
    probabilities[item["choice"]] = probability
    return ChoiceSignal(
        **(
            metadata
            or {
                "provider": "fixture",
                "request_id": f"prepared:{VERSION}:{item['example_id']}",
                "configured_model": "deterministic-fixture-v1",
                "returned_model": "deterministic-fixture-v1",
                "elapsed_ms": 0,
            }
        ),
        choice=item["choice"],
        confidence=item["confidence"],
        probabilities=probabilities,
    )


def policy_receipt(item: dict, threshold: float, guard_enabled: bool) -> PolicyReceipt:
    signal = prepared_signal(item)
    matched = mixed_purpose(item["text"])
    route = classification_route(signal, threshold, ambiguity=guard_enabled and matched)
    accepted = route.name == "accept"
    return PolicyReceipt(
        example_id=item["example_id"],
        content_version=item["content_version"],
        signal=signal,
        threshold=threshold,
        guard_enabled=guard_enabled,
        guard_matched=matched,
        selected_route=route.name,
        reason=route.reason,
        explanation=route.explanation,
        requires_review=not accepted,
        source_excerpt=item["source_excerpt"],
        reference_category=item["reference_category"],
        reference_mismatch=accepted and signal.choice != item["reference_category"],
        policy_violation=accepted and matched,
    )


def coverage(receipts: list[PolicyReceipt]) -> ExperimentCoverage:
    accepted = sum(item.selected_route == "accept" for item in receipts)
    return ExperimentCoverage(
        eligible=len(receipts),
        accepted=accepted,
        escalated=len(receipts) - accepted,
        acceptance_coverage=accepted / len(receipts) if receipts else 0,
        accepted_reference_mistakes=sum(item.reference_mismatch for item in receipts),
        accepted_policy_violations=sum(item.policy_violation for item in receipts),
    )


def evaluate_experiment(request: PolicyExperimentRequest) -> PolicyExperimentResponse:
    items = scenario_manifest()["documents"][:5]
    original = []
    recording = lesson_catalogue().classification
    for item in items:
        document = next(doc for doc in recording.documents if doc.example_id == item["example_id"])
        decision = next(
            event.payload
            for event in recording.snapshot.events
            if event.type == "decision" and event.instance_id == f"{document.document.id}:jev"
        )
        # Preserve the actual retained signal, rule, and decision identity on the
        # original side. The experiment never rewrites its historical recording.
        original.append(
            policy_receipt(item, decision["threshold"], True).model_copy(
                update={
                    "source": "recorded",
                    "decision_id": decision["id"],
                    "policy_version": decision["policy_version"],
                    "content_version": document.document.content_version,
                    "signal": ChoiceSignal.model_validate(decision["signal"]),
                    "selected_route": decision["selected_route"],
                    "reason": decision["policy_reason"],
                    "explanation": decision["explanation"],
                    "requires_review": decision["selected_route"] == "interpret",
                    "source_excerpt": document.source_excerpt,
                }
            )
        )
    simulated = [policy_receipt(item, request.threshold, request.guard_enabled) for item in items]
    chosen = next(index for index, item in enumerate(items) if item["example_id"] == request.example_id)
    original_id = request.original_example_id or request.example_id
    original_index = next(index for index, item in enumerate(items) if item["example_id"] == original_id)
    return PolicyExperimentResponse(
        version=VERSION,
        policy_version=POLICY_VERSION,
        original=original[original_index],
        simulated=simulated[chosen],
        original_coverage=coverage(original),
        simulated_coverage=coverage(simulated),
        outcomes=simulated,
        changed_fields=(["threshold"] if request.threshold != 0.8 else [])
        + (["mixed-purpose guard"] if not request.guard_enabled else [])
        + (["document variant"] if original_id != request.example_id else []),
        controlled_assumption="Prepared signals stay fixed. Proposed and finalized agreements both use contract at 0.96 to isolate the text guard. Live content changes require a new judgment.",
    )


@lru_cache(maxsize=1)
def lesson_catalogue() -> LessonCatalogue:
    return LessonCatalogue.model_validate_json(CATALOGUE_PATH.read_text())


router = APIRouter(prefix="/api/lessons", tags=["educational lessons"])


@router.get("", response_model=LessonCatalogue)
def get_lessons():
    return lesson_catalogue()


@router.post("/experiment", response_model=PolicyExperimentResponse)
def experiment(request: PolicyExperimentRequest):
    return evaluate_experiment(request)


@router.post("/interpret", response_model=LiveInterpretResponse)
async def live_interpret(body: LiveInterpretRequest, request: Request):
    """One explicit production-provider call; no run, Jev request, review or publication."""
    preview_started = perf_counter()
    check_live_origin(request)
    item = scenario(body.example_id)
    prepared = next(
        document
        for document in lesson_catalogue().classification.documents
        if document.example_id == body.example_id
    )
    if (
        body.content_version != item["content_version"]
        or prepared.document.content_version != item["content_version"]
    ):
        raise HTTPException(409, "The prepared source changed. Reload this lesson before interpreting it.")
    policy_started = perf_counter()
    receipt = policy_receipt(item, threshold=0.8, guard_enabled=True).model_copy(
        update={"source": "executed"}
    )
    policy_elapsed_ms = (perf_counter() - policy_started) * 1000
    if receipt.selected_route != "interpret":
        raise HTTPException(409, "The default runtime policy does not select interpretation for this source.")
    _, passages = anchors(prepared.document, [(None, item["text"])])
    context = select_context(passages)
    try:
        async with live_lesson_slot(request), live_frontier(request, body.frontier_model) as provider:
            proposal = await provider.interpret(prepared.document, context)
    except ProviderError as error:
        raise live_provider_error(error) from None
    return LiveInterpretResponse(
        version=VERSION,
        example_id=body.example_id,
        document_id=prepared.document.id,
        content_version=prepared.document.content_version,
        proposal=proposal,
        policy=receipt,
        metrics=InterpretationPreviewMetrics(
            total_elapsed_ms=(perf_counter() - preview_started) * 1000,
            policy_elapsed_ms=policy_elapsed_ms,
            reference_category=item["reference_category"],
            proposal_matches_reference=proposal.category == item["reference_category"],
        ),
    )


@router.post("/discover", response_model=LiveDiscoveryResponse)
async def live_discover(body: LiveDiscoveryRequest, request: Request):
    check_live_origin(request)
    async with live_frontier(request, body.frontier_model) as provider:
        if body.example_id == "compare" or body.bounded_mode == "live":
            if provider.initialization_error:
                raise live_provider_error(provider.initialization_error)
            if not provider.client:
                raise live_provider_error(
                    ProviderError(
                        "openai", "missing_key", "OPENAI_API_KEY is missing; live execution cannot call OpenAI."
                    )
                )
        if body.bounded_mode == "live":
            bounded = JevProvider(provider.settings)
            try:
                if bounded.initialization_error:
                    raise live_provider_error(bounded.initialization_error)
                if not bounded.client:
                    raise live_provider_error(
                        ProviderError(
                            "jev", "missing_key", "TYPESAFE_API_KEY is missing; live execution cannot call Jev."
                        )
                    )
                if provider.settings.typesafe_default_model not in MODEL_LIMITS:
                    raise HTTPException(503, "The configured Jev model has no verified request limits in this adapter.")
            finally:
                await bounded.close()
        async with live_lesson_slot(request):
            return await execute_live_discovery(body.example_id, provider.settings, body.bounded_mode)


class LessonJev(JevProvider):
    """Only instantiated inside the offline temporary-store recorder."""

    def __init__(self, settings):
        if settings.app_mode != "test-fixture":
            raise ValueError("Lesson adapters cannot run in live mode")
        super().__init__(settings)

    async def classify(self, document, context):
        item = lesson_fixture(document)
        if item:
            return prepared_signal(item, await self._fixture_meta())
        return await super().classify(document, context)


class LessonFrontier(OpenAIProvider):
    def __init__(self, settings):
        if settings.app_mode != "test-fixture":
            raise ValueError("Lesson adapters cannot run in live mode")
        super().__init__(settings)
        self.fault: str | None = None
        self.fault_document: str | None = None

    async def interpret(self, document, context):
        if document.id == self.fault_document:
            if self.fault == "timeout":
                raise ProviderError("openai", "timeout", "Simulated provider timeout.", retryable=True)
            if self.fault == "invalid-proposal":
                # Exercise the same structured proposal schema used by the live adapter.
                ClassificationProposal.model_validate(
                    {"category": "purchase-order", "explanation": "Injected invalid category"}
                )
        item = lesson_fixture(document)
        if item and "proposal" in item:
            return ProposalSignal(
                **(await self._fixture_meta()),
                category=item["proposal"],
                explanation=item["proposal_explanation"],
            )
        return await super().interpret(document, context)

    async def plan(self, query, intent, scope):
        if query == COMPARE_QUERY:
            metadata = await self._fixture_meta()
            return QueryPlan(
                intent="compare",
                tasks=[
                    SearchTask(
                        id="task-1",
                        phrase="access duration",
                        purpose="Find access duration in both policy versions",
                    ),
                    SearchTask(
                        id="task-2",
                        phrase="access approval",
                        purpose="Find approval requirements in both policy versions",
                    ),
                ],
                explanation="Prepared frontier plan: retrieve duration and approval evidence from both accepted policy versions.",
            ), metadata
        return await super().plan(query, intent, scope)

    async def answer(self, query, passages):
        if query != COMPARE_QUERY:
            return await super().answer(query, passages)
        metadata = await self._fixture_meta()
        by_name = {passage.filename: passage for passage in passages}
        names = ["access-policy-2025.md", "access-policy-2026.md"]
        if not all(name in by_name for name in names):
            return Answer(
                claims=[], missing_evidence=["Both policy versions are needed for this prepared comparison."]
            ), metadata
        before, after = (by_name[name] for name in names)
        first = Claim(
            text="Visiting researcher access changed from 30 days in 2025 to 14 days in 2026.",
            citations=[
                Citation(
                    passage_id=before.id,
                    quote="The 2025 access policy grants visiting researchers access for 30 days.",
                ),
                Citation(
                    passage_id=after.id,
                    quote="The 2026 access policy grants visiting researchers access for 14 days.",
                ),
            ],
        )
        second = Claim(
            text="The 2026 policy adds security officer approval to the project lead approval required in 2025.",
            citations=[
                Citation(
                    passage_id=before.id,
                    quote="The 2025 access policy requires project lead approval before access begins.",
                ),
                Citation(
                    passage_id=after.id,
                    quote="The 2026 access policy requires project lead and security officer approval before access begins.",
                ),
            ],
        )
        if self.fault == "invalid-citation":
            first.citations[0].quote = "Access lasts for 999 days."
        return Answer(claims=[first, second], missing_evidence=[]), metadata


def isolated_settings(path: Path) -> Settings:
    return Settings(
        _env_file=None,
        app_data_dir=path,
        app_mode="test-fixture",
        typesafe_api_key=None,
        openai_api_key=None,
        langsmith_api_key=None,
        langsmith_tracing=False,
        langsmith_trace_synthetic_text=False,
        jev_choice_threshold=0.8,
        jev_relevance_threshold=0.7,
        jev_support_threshold=0.8,
        max_concurrency=4,
    )


def load_lesson_document(storage: Storage, settings: Settings, item: dict, identity: str) -> Document:
    return ingest(
        storage,
        settings,
        item["filename"],
        item["text"].encode(),
        synthetic=True,
        id=str(uuid5(NAMESPACE_URL, f"{VERSION}:{identity}:{item['example_id']}:{item['content_version']}")),
    )


def retained_document(storage: Storage, item: dict, document: Document) -> LessonDocument:
    return LessonDocument(
        example_id=item["example_id"],
        title=item["title"],
        cue=item["cue"],
        document=storage.get_document(document.id),
        text=storage.read_text(document.id),
        passages=storage.passages(document.id),
        source_excerpt=item["source_excerpt"],
        reference_category=item["reference_category"],
        expected_reason=item["expected_reason"],
        controlled_signal=item["controlled_signal"],
    )


async def execute_live_discovery(
    example_id: Literal["find", "compare"],
    live_settings: Settings,
    bounded_mode: Literal["prepared", "live"] = "prepared",
) -> LiveDiscoveryResponse:
    """Prepare sources separately, then execute the actual selected discovery capabilities."""
    from .workflows.engine import WorkflowEngine

    with TemporaryDirectory(prefix="live-discovery-lesson-") as temporary:
        settings = isolated_settings(Path(temporary)).model_copy(
            update={
                "openai_model": live_settings.openai_model,
                "provider_timeout_seconds": live_settings.provider_timeout_seconds,
            }
        )
        storage = Storage(settings.app_data_dir)
        try:
            async with AsyncSqliteSaver.from_conn_string(
                str(settings.app_data_dir / "checkpoints.db")
            ) as saver:
                await saver.setup()
                engine = WorkflowEngine(settings, storage, Events(storage), saver)
                await engine.jev.close()
                engine.jev = LessonJev(settings)
                try:
                    items = scenario_manifest()["documents"][5:]
                    documents = [
                        load_lesson_document(storage, settings, item, "Live policy sources") for item in items
                    ]
                    # Prepare publication through the same bounded policy and atomic indexing path.
                    source_run, _ = storage.create_run(
                        "classification",
                        "test-fixture",
                        {
                            "document_ids": [doc.id for doc in documents],
                            "lesson_version": VERSION,
                        },
                        settings.public_config(),
                    )
                    await engine.execute(source_run.id)
                    if storage.get_run(source_run.id).status != "succeeded" or any(
                        not storage.get_document(doc.id).indexed for doc in documents
                    ):
                        raise HTTPException(500, "The isolated policy sources could not be prepared.")
                finally:
                    await engine.close()

                execution_settings = settings
                if bounded_mode == "live":
                    execution_settings = settings.model_copy(
                        update={
                            "app_mode": "live",
                            "typesafe_api_key": live_settings.typesafe_api_key,
                            "typesafe_default_model": live_settings.typesafe_default_model,
                            "openai_api_key": live_settings.openai_api_key,
                            "max_concurrency": live_settings.max_concurrency,
                        }
                    )
                # A fresh engine keeps its provider mode and telemetry honest. Source
                # preparation is excluded from this run's timing and provider counts.
                engine = WorkflowEngine(execution_settings, storage, Events(storage), saver)
                try:
                    if bounded_mode == "prepared":
                        await engine.jev.close()
                        engine.jev = LessonJev(execution_settings)
                        await engine.openai.close()
                        engine.openai = OpenAIProvider(
                            live_settings.model_copy(update={"app_mode": "live"})
                        )
                    query = FIND_QUERY if example_id == "find" else COMPARE_QUERY
                    run, _ = storage.create_run(
                        "discovery",
                        execution_settings.app_mode,
                        {
                            "query": query,
                            "filters": {"categories": ["policy"]},
                            "lesson_version": VERSION,
                            "bounded_judgments": bounded_mode,
                            "frontier_provider": f"live {frontier_label(live_settings.openai_model)}",
                        },
                        execution_settings.public_config(),
                    )
                    await engine.execute(run.id)
                    snapshot = storage.snapshot(run.id)
                    calls = discovery_frontier_attempts(snapshot.events)
                    return LiveDiscoveryResponse(
                        version=VERSION,
                        example_id=example_id,
                        snapshot=snapshot,
                        frontier_calls=calls,
                        provenance=LiveDiscoveryProvenance(
                            bounded_judgments=bounded_mode,
                            frontier=f"live {frontier_label(live_settings.openai_model)} when selected",
                            **(
                                {
                                    "support_checks": "live Jev signals; fallible semantic check",
                                    "timing": "measured client request stages and executed local work",
                                }
                                if bounded_mode == "live"
                                else {}
                            ),
                        ),
                        metrics=discovery_metrics(snapshot.events, example_id),
                        documents=[
                            retained_document(storage, item, document)
                            for item, document in zip(items, documents, strict=True)
                        ],
                    )
                finally:
                    await engine.close()
        finally:
            storage.close()


def discovery_frontier_attempts(events: list[Event]) -> int:
    """Count actual selected provider attempts, independently of the lesson title."""
    planning_route = None
    attempts = set()
    for event in events:
        if event.type == "decision" and event.instance_id == "intent":
            planning_route = event.payload["selected_route"]
        if event.type != "node_started" or event.payload.get("state") != "running":
            continue
        if event.instance_id == "synthesize" or (
            event.instance_id == "plan" and planning_route is not None and planning_route != "find"
        ):
            attempts.add((event.instance_id, event.attempt))
    return len(attempts)


def discovery_metrics(events: list[Event], example_id: Literal["find", "compare"]) -> LiveDiscoveryMetrics:
    """Use only the retained execution interval and actual validation counts."""
    started = completed = None
    observed_intent = None
    counts = {}
    for event in events:
        if event.type == "run_started" and started is None:
            started = event.timestamp
        elif event.type == "run_completed":
            completed = event.timestamp
        elif event.type == "decision" and event.instance_id == "intent":
            observed_intent = event.payload.get("signal", {}).get("choice")
        elif event.type == "node_completed" and event.instance_id in {"citations", "support"}:
            counts[event.instance_id] = event.payload
    elapsed_ms = None
    if started and completed:
        try:
            duration = (datetime.fromisoformat(completed) - datetime.fromisoformat(started)).total_seconds() * 1000
            elapsed_ms = duration if duration >= 0 else None
        except (ValueError, TypeError):
            pass
    return LiveDiscoveryMetrics(
        total_elapsed_ms=elapsed_ms,
        intent_agreement=DiscoveryIntentAgreement(
            matching=int(observed_intent == example_id),
            evaluated=int(observed_intent is not None),
            reference_intent=example_id,
            observed_intent=observed_intent,
        ),
        citation_claims_checked=counts.get("citations", {}).get("input_count"),
        citation_claims_valid=counts.get("citations", {}).get("output_count"),
        citation_claims_removed=counts.get("citations", {}).get("removed_count"),
        support_claims_checked=counts.get("support", {}).get("input_count"),
        support_claims_retained=counts.get("support", {}).get("output_count"),
    )


async def record_lessons() -> LessonCatalogue:
    """Execute real graphs and validation. No access to the operational store."""
    from .workflows.engine import WorkflowEngine

    with TemporaryDirectory(prefix="education-lessons-") as temporary:
        settings = isolated_settings(Path(temporary))
        storage = Storage(settings.app_data_dir)
        try:
            async with AsyncSqliteSaver.from_conn_string(
                str(settings.app_data_dir / "checkpoints.db")
            ) as saver:
                await saver.setup()
                engine = WorkflowEngine(settings, storage, Events(storage), saver)
                await engine.jev.close()
                await engine.openai.close()
                engine.jev, engine.openai = LessonJev(settings), LessonFrontier(settings)
                try:

                    async def classify(items, identity, review=True):
                        documents = [
                            load_lesson_document(storage, settings, item, identity) for item in items
                        ]
                        run, _ = storage.create_run(
                            "classification",
                            "test-fixture",
                            {
                                "document_ids": [doc.id for doc in documents],
                                "lesson_version": VERSION,
                                "lesson_title": identity,
                                "simulated_review": review,
                            },
                            settings.public_config(),
                        )
                        if identity in {"invalid-proposal", "timeout"}:
                            engine.openai.fault_document = documents[-1].id
                        await engine.execute(run.id)
                        run = storage.get_run(run.id)
                        if review and run.review:
                            submission = ReviewSubmission(
                                interrupt_id=run.review.interrupt_id,
                                revision=run.review.revision,
                                decisions=[
                                    {
                                        "document_id": item.document_id,
                                        "action": "accept",
                                        "category": item.proposal,
                                    }
                                    for item in run.review.items
                                ],
                            )
                            await engine.execute(run.id, resume=submission.model_dump(mode="json"))
                        return ClassificationLesson(
                            snapshot=storage.snapshot(run.id),
                            documents=[
                                retained_document(storage, item, doc)
                                for item, doc in zip(items, documents, strict=True)
                            ],
                        )

                    async def discover(query, identity):
                        run, _ = storage.create_run(
                            "discovery",
                            "test-fixture",
                            {
                                "query": query,
                                "filters": {"categories": ["policy"]},
                                "lesson_version": VERSION,
                                "lesson_title": identity,
                            },
                            settings.public_config(),
                        )
                        await engine.execute(run.id)
                        return storage.snapshot(run.id)

                    items = scenario_manifest()["documents"]
                    classification = await classify(items[:5], "Classify documents")
                    policies = await classify(items[5:], "Policy sources")
                    # Restrict the lesson's retrieval scope to the paired policy versions.
                    # The ordinary standing policy was used for classification, not this task.
                    policy_id = next(
                        doc.document.id for doc in classification.documents if doc.example_id == "policy"
                    )
                    storage.update_document(policy_id, indexed=False)
                    discovery = DiscoveryLesson(
                        documents=policies.documents,
                        find=await discover(FIND_QUERY, "Find the access policy"),
                        compare=await discover(COMPARE_QUERY, "Compare policies"),
                        empty=await discover('Find "unobtainium"', "No matching evidence"),
                        unsupported=await discover("Write a poem", "Unsupported request"),
                    )
                    safeguards = []
                    guard = await classify([scenario("proposed")], "Confidence plus guard", review=False)
                    safeguards.append(
                        SafeguardLesson(
                            id="guard",
                            title="Confidence is not permission",
                            explanation="The text guard requires interpretation and review even at 96% confidence.",
                            snapshot=guard.snapshot,
                            documents=guard.documents,
                            observed={
                                "passed": guard.snapshot.run.status == "awaiting_review"
                                and not guard.documents[0].document.indexed,
                                "proposal_searchable": guard.documents[0].document.indexed,
                            },
                        )
                    )
                    for fault in ("invalid-proposal", "timeout"):
                        engine.openai.fault = fault
                        lesson = await classify(
                            [scenario("clear"), scenario("proposed")], fault, review=False
                        )
                        attempts = sum(
                            event.type == "node_started" and event.instance_id.endswith(":interpret")
                            for event in lesson.snapshot.events
                        )
                        safeguards.append(
                            SafeguardLesson(
                                id=fault,
                                title="Reject an invalid proposal"
                                if fault == "invalid-proposal"
                                else "Bound a provider retry",
                                explanation="The proposal schema rejects a category outside the taxonomy. The affected document stays unpublished."
                                if fault == "invalid-proposal"
                                else "A simulated timeout triggers the actual one-retry limit. The direct document can still complete.",
                                snapshot=lesson.snapshot,
                                documents=lesson.documents,
                                observed={
                                    "passed": not lesson.documents[-1].document.indexed
                                    and lesson.documents[0].document.indexed
                                    and attempts == (1 if fault == "invalid-proposal" else 2),
                                    "frontier_attempts": attempts,
                                    "affected_document_searchable": lesson.documents[-1].document.indexed,
                                    "other_document_searchable": lesson.documents[0].document.indexed,
                                },
                            )
                        )
                    engine.openai.fault = "invalid-citation"
                    invalid = await discover(COMPARE_QUERY, "Reject an invalid citation")
                    removed = sum(
                        event.payload.get("removed_count", 0) or 0
                        for event in invalid.events
                        if event.type == "node_completed" and event.instance_id == "citations"
                    )
                    safeguards.append(
                        SafeguardLesson(
                            id="invalid-citation",
                            title="Check the citation before publishing",
                            explanation="The injected quotation is absent from its source. Exact citation validation removes that claim before support checking.",
                            snapshot=invalid,
                            documents=policies.documents,
                            observed={
                                "passed": removed == 1
                                and len((invalid.run.result or {}).get("claims", [])) == 1,
                                "claims_removed": int(removed),
                                "claims_published": len((invalid.run.result or {}).get("claims", [])),
                            },
                        )
                    )
                    catalogue = LessonCatalogue(
                        version=VERSION,
                        policy_version=POLICY_VERSION,
                        provenance=LessonProvenance(),
                        classification=classification,
                        discovery=discovery,
                        safeguards=safeguards,
                    )
                    if classification.snapshot.run.status != "succeeded" or not all(
                        item.observed["passed"] for item in safeguards
                    ):
                        raise RuntimeError(
                            "A generated lesson did not satisfy its observed execution contract"
                        )
                    return catalogue
                finally:
                    await engine.close()
        finally:
            storage.close()


def write_catalogue(catalogue: LessonCatalogue) -> None:
    """Retain earlier versioned recordings before switching the bundled entry lesson."""
    if CATALOGUE_PATH.exists():
        previous_text = CATALOGUE_PATH.read_text()
        previous = LessonCatalogue.model_validate_json(previous_text)
        if previous.version != catalogue.version:
            archive = FOLDER / "recordings" / f"{previous.version}.json"
            archive.parent.mkdir(parents=True, exist_ok=True)
            if archive.exists() and archive.read_text() != previous_text:
                raise RuntimeError("Refusing to overwrite a different retained lesson recording")
            if not archive.exists():
                archive.write_text(previous_text)
    CATALOGUE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOGUE_PATH.write_text(catalogue.model_dump_json(indent=2) + "\n")


if __name__ == "__main__":
    catalogue = asyncio.run(record_lessons())
    write_catalogue(catalogue)
    print(f"Recorded {catalogue.version} to {CATALOGUE_PATH.relative_to(ROOT)}")
