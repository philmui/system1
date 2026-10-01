"""Live classification previews with measured work and authored references."""

import asyncio
from contextlib import asynccontextmanager
from time import perf_counter
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field

from .ingestion import anchors
from .lessons import VERSION, ExampleId, lesson_catalogue, scenario
from .live_lessons import (
    check_live_origin,
    frontier_label,
    live_frontier,
    live_lesson_slot,
    live_provider_error,
)
from .policies import TAXONOMY, Context, classification_route, mixed_purpose, select_context
from .providers.common import ProviderError, safe_error
from .providers.jev import MODEL_LIMITS, JevProvider
from .providers.openai import OpenAIProvider
from .schemas import (
    POLICY_VERSION,
    Category,
    ChoiceSignal,
    Document,
    FrontierModel,
    Model,
    ProposalSignal,
    ProviderMeta,
    now,
)


class LiveClassificationComparisonRequest(Model):
    example_id: ExampleId
    content_version: str = Field(pattern=r"^[a-f0-9]{64}$")
    frontier_model: FrontierModel = "gpt-5.5"


class LiveClassificationRequest(LiveClassificationComparisonRequest):
    """A single live strategy; no frontier-first baseline request."""


class AuthoredReferenceAgreement(Model):
    matching: Literal[0, 1]
    evaluated: Literal[0, 1]
    reference_category: Category
    observed_category: Category | None
    basis: Literal["authored lesson reference"] = "authored lesson reference"
    scope: Literal["one synthetic document; not a benchmark"] = "one synthetic document; not a benchmark"


class MeasuredPolicyDecision(Model):
    policy_version: str = POLICY_VERSION
    threshold: float
    guard_matched: bool
    selected_route: Literal["accept", "interpret"]
    reason: str
    explanation: str


class MeasuredComponent(Model):
    id: Literal["judge", "policy", "interpret"]
    label: str
    kind: Literal["bounded_judgment", "runtime_policy", "frontier_interpretation"]
    status: Literal["succeeded", "failed"]
    started_after_ms: float = Field(ge=0)
    elapsed_ms: float = Field(ge=0)
    queue_elapsed_ms: float = Field(ge=0)
    provider: ProviderMeta | None = None
    error: str | None = None


class MeasuredClassificationStrategy(Model):
    id: Literal["system1", "frontier_first"]
    label: str
    status: Literal["completed", "failed"]
    started_after_ms: float = Field(ge=0)
    finished_after_ms: float = Field(ge=0)
    elapsed_ms: float = Field(ge=0)
    components: list[MeasuredComponent]
    judgment: ChoiceSignal | None = None
    policy: MeasuredPolicyDecision | None = None
    interpretation: ProposalSignal | None = None
    output_category: Category | None = None
    output_kind: Literal["accepted_category", "proposal", "unavailable"]
    requires_review: bool | None = None
    bounded_attempts: int = Field(ge=0)
    frontier_attempts: int = Field(ge=0)
    provider_work_ms: float = Field(ge=0)
    judgment_agreement: AuthoredReferenceAgreement
    output_agreement: AuthoredReferenceAgreement
    error: str | None = None


class ClassificationComparisonProvenance(Model):
    documents: Literal["synthetic content-bound source"] = "synthetic content-bound source"
    bounded_provider: Literal["live Jev"] = "live Jev"
    frontier_provider: str = "live GPT-5.5"
    policy: Literal["same taxonomy, 0.80 threshold, and text guard"] = (
        "same taxonomy, 0.80 threshold, and text guard"
    )
    confidence_note: str = "The equal numeric threshold is a policy assumption. The models' confidence signals are not calibrated or equivalent probabilities of correctness."
    timing_scope: str = "Concurrent preview from a common start; includes client request/adapter work and local policy, excludes human review and publication. Shared capacity and provider contention can affect both strategies."
    stopping_point: Literal["accepted category or unapproved proposal"] = (
        "accepted category or unapproved proposal"
    )
    quality_scope: str = "Agreement with one authored synthetic reference, reported separately for judgment and final preview. These are the same document, not independent samples or benchmark accuracy."
    sample_count: Literal[1] = 1
    max_in_flight_provider_requests: int = Field(ge=1, le=2)
    automatic_retries: Literal[0] = 0
    human_review: Literal["not performed"] = "not performed"
    publication: Literal["not performed"] = "not performed"


class LiveClassificationComparisonResponse(Model):
    version: str
    comparison_id: str
    example_id: ExampleId
    document_id: str
    content_version: str
    reference_category: Category
    started_at: str
    total_elapsed_ms: float = Field(ge=0)
    strategies: list[MeasuredClassificationStrategy] = Field(min_length=2, max_length=2)
    provenance: ClassificationComparisonProvenance
    operational_writes: Literal[0] = 0
    published: Literal[False] = False


class LiveClassificationProvenance(Model):
    documents: Literal["synthetic content-bound source"] = "synthetic content-bound source"
    bounded_provider: Literal["live Jev"] = "live Jev"
    frontier_provider: str = "live GPT-5.5 when selected"
    policy: Literal["executed taxonomy, 0.80 threshold, and text guard"] = (
        "executed taxonomy, 0.80 threshold, and text guard"
    )
    confidence_note: str = "Confidence is a model signal, not a measured probability of correctness."
    timing_scope: str = "Measured classification from judgment through local policy and any interpretation; excludes source preparation, human review, and publication."
    stopping_point: Literal["accepted category or unapproved proposal"] = (
        "accepted category or unapproved proposal"
    )
    quality_scope: str = "Agreement with one authored synthetic reference, reported separately for judgment and final preview. These are the same document, not independent samples or benchmark accuracy."
    sample_count: Literal[1] = 1
    automatic_retries: Literal[0] = 0
    human_review: Literal["not performed"] = "not performed"
    publication: Literal["not performed"] = "not performed"


class LiveClassificationResponse(Model):
    version: str
    example_id: ExampleId
    document_id: str
    content_version: str
    reference_category: Category
    started_at: str
    total_elapsed_ms: float = Field(ge=0)
    strategy: MeasuredClassificationStrategy
    provenance: LiveClassificationProvenance = Field(default_factory=LiveClassificationProvenance)
    operational_writes: Literal[0] = 0
    published: Literal[False] = False


def reference_agreement(reference: Category, observed: Category | None) -> AuthoredReferenceAgreement:
    return AuthoredReferenceAgreement(
        matching=int(observed is not None and observed == reference),
        evaluated=int(observed is not None),
        reference_category=reference,
        observed_category=observed,
    )


def preflight(provider, name: str, key: str):
    if provider.initialization_error:
        raise live_provider_error(provider.initialization_error)
    if provider.fixture:
        raise HTTPException(503, "A live classification preview requires both live providers.")
    if not provider.client:
        raise live_provider_error(
            ProviderError(
                name, "missing_key", f"{key} is missing; both providers are required for a live classification preview."
            )
        )


async def evaluate_classification_strategy(
    strategy_id: Literal["system1", "frontier_first"],
    *,
    item: dict,
    document: Document,
    context: Context,
    bounded: JevProvider,
    frontier: OpenAIProvider,
    provider_slots: asyncio.Semaphore,
    common_start: float,
) -> MeasuredClassificationStrategy:
    strategy_started = perf_counter()
    components = []
    judgment = interpretation = policy = None
    requires_review = None
    output_category = None
    output_kind = "unavailable"
    bounded_attempts = frontier_attempts = 0
    provider_work_ms = 0.0
    failure = None

    async def provider_step(step, label, provider_name, operation):
        nonlocal bounded_attempts, frontier_attempts, provider_work_ms
        component_start = perf_counter()
        queue_ms = 0.0
        metadata = error = None
        try:
            async with provider_slots:
                request_start = perf_counter()
                queue_ms = (request_start - component_start) * 1000
                if provider_name == "jev":
                    bounded_attempts += 1
                else:
                    frontier_attempts += 1
                try:
                    value = await operation()
                finally:
                    provider_work_ms += (perf_counter() - request_start) * 1000
            metadata = ProviderMeta.model_validate(
                value.model_dump(include=set(ProviderMeta.model_fields))
            )
            if isinstance(value, ChoiceSignal) and (
                value.choice not in TAXONOMY or set(value.probabilities) - set(TAXONOMY)
            ):
                raise ProviderError(
                    provider_name,
                    "invalid_response",
                    "The provider returned a choice outside the shared taxonomy.",
                )
            return value
        except asyncio.CancelledError:
            error = "The preview was cancelled."
            raise
        except Exception as exception:
            error = str(safe_error(provider_name, exception))
            raise ProviderError(provider_name, "comparison_step_failed", error) from None
        finally:
            components.append(
                MeasuredComponent(
                    id=step,
                    label=label,
                    kind="bounded_judgment" if step == "judge" else "frontier_interpretation",
                    status="failed" if error else "succeeded",
                    started_after_ms=(component_start - common_start) * 1000,
                    elapsed_ms=(perf_counter() - component_start) * 1000,
                    queue_elapsed_ms=queue_ms,
                    provider=metadata,
                    error=error,
                )
            )

    try:
        judge = bounded if strategy_id == "system1" else frontier
        judgment = await provider_step(
            "judge",
            "System 1 judgment" if strategy_id == "system1" else "Frontier bounded judgment",
            "jev" if strategy_id == "system1" else "openai",
            lambda: judge.classify(document, context),
        )
        policy_started = perf_counter()
        guard = mixed_purpose(item["text"])
        route = classification_route(judgment, 0.8, ambiguity=guard)
        policy = MeasuredPolicyDecision(
            threshold=0.8,
            guard_matched=guard,
            selected_route=route.name,
            reason=route.reason,
            explanation=route.explanation,
        )
        components.append(
            MeasuredComponent(
                id="policy",
                label="Runtime policy",
                kind="runtime_policy",
                status="succeeded",
                started_after_ms=(policy_started - common_start) * 1000,
                elapsed_ms=(perf_counter() - policy_started) * 1000,
                queue_elapsed_ms=0,
            )
        )
        requires_review = route.name == "interpret"
        if requires_review:
            interpretation = await provider_step(
                "interpret",
                "Frontier interpretation",
                "openai",
                lambda: frontier.interpret(document, context),
            )
            output_category, output_kind = interpretation.category, "proposal"
        else:
            output_category, output_kind = judgment.choice, "accepted_category"
    except Exception as error:
        failure = (
            str(error)
            if isinstance(error, ProviderError)
            else "The preview could not complete its runtime policy."
        )
    finished = perf_counter()
    return MeasuredClassificationStrategy(
        id=strategy_id,
        label="System 1 + exceptions" if strategy_id == "system1" else "Frontier first",
        status="failed" if failure else "completed",
        started_after_ms=(strategy_started - common_start) * 1000,
        finished_after_ms=(finished - common_start) * 1000,
        elapsed_ms=(finished - strategy_started) * 1000,
        components=components,
        judgment=judgment,
        policy=policy,
        interpretation=interpretation,
        output_category=output_category,
        output_kind=output_kind,
        requires_review=requires_review,
        bounded_attempts=bounded_attempts,
        frontier_attempts=frontier_attempts,
        provider_work_ms=provider_work_ms,
        judgment_agreement=reference_agreement(
            item["reference_category"], judgment.choice if judgment else None
        ),
        output_agreement=reference_agreement(item["reference_category"], output_category),
        error=failure,
    )



@asynccontextmanager
async def classification_inputs(body: LiveClassificationComparisonRequest, request: Request):
    """Bind one retained source and preflight every capability before paid work."""
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
        raise HTTPException(409, "The prepared source changed. Reload before running live classification.")
    async with live_frontier(request, body.frontier_model) as frontier:
        preflight(frontier, "openai", "OPENAI_API_KEY")
        settings = frontier.settings.model_copy(update={"app_mode": "live"})
        bounded = JevProvider(settings)
        try:
            preflight(bounded, "jev", "TYPESAFE_API_KEY")
            if settings.typesafe_default_model not in MODEL_LIMITS:
                raise HTTPException(
                    503, "The configured Jev model has no verified request limits in this adapter."
                )
            _, passages = anchors(prepared.document, [(None, item["text"])])
            context = select_context(passages)
            yield item, prepared, context, bounded, frontier
        finally:
            await bounded.close()


router = APIRouter(prefix="/api/lessons", tags=["educational measurements"])


@router.post("/classify/live", response_model=LiveClassificationResponse)
async def classify_live(body: LiveClassificationRequest, request: Request):
    async with classification_inputs(body, request) as (item, prepared, context, bounded, frontier):
        async with live_lesson_slot(request):
            started_at, common_start = now(), perf_counter()
            strategy = await evaluate_classification_strategy(
                "system1",
                item=item,
                document=prepared.document,
                context=context,
                bounded=bounded,
                frontier=frontier,
                provider_slots=asyncio.Semaphore(1),
                common_start=common_start,
            )
            return LiveClassificationResponse(
                version=VERSION,
                example_id=body.example_id,
                document_id=prepared.document.id,
                content_version=prepared.document.content_version,
                reference_category=item["reference_category"],
                started_at=started_at,
                total_elapsed_ms=(perf_counter() - common_start) * 1000,
                strategy=strategy,
                provenance=LiveClassificationProvenance(
                    frontier_provider=f"live {frontier_label(body.frontier_model)} when selected"
                ),
            )


@router.post("/compare-classification", response_model=LiveClassificationComparisonResponse)
async def compare_classification(body: LiveClassificationComparisonRequest, request: Request):
    async with classification_inputs(body, request) as (item, prepared, context, bounded, frontier):
        capacity = min(bounded.settings.max_concurrency, 2)
        provider_slots = asyncio.Semaphore(capacity)
        async with live_lesson_slot(request):
            started_at, common_start = now(), perf_counter()
            strategies = await asyncio.gather(*(
                evaluate_classification_strategy(
                    strategy_id,
                    item=item,
                    document=prepared.document,
                    context=context,
                    bounded=bounded,
                    frontier=frontier,
                    provider_slots=provider_slots,
                    common_start=common_start,
                )
                for strategy_id in ("system1", "frontier_first")
            ))
            return LiveClassificationComparisonResponse(
                version=VERSION,
                comparison_id=str(uuid4()),
                example_id=body.example_id,
                document_id=prepared.document.id,
                content_version=prepared.document.content_version,
                reference_category=item["reference_category"],
                started_at=started_at,
                total_elapsed_ms=(perf_counter() - common_start) * 1000,
                strategies=strategies,
                provenance=ClassificationComparisonProvenance(
                    max_in_flight_provider_requests=capacity,
                    frontier_provider=f"live {frontier_label(body.frontier_model)}",
                ),
            )
