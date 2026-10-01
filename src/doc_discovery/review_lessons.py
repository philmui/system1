"""Explicit live review previews on a fixed fictional corpus; never publication."""

import hashlib
import json
import re
from functools import lru_cache
from time import perf_counter
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field

from .live_lessons import live_frontier, live_lesson_slot, live_provider_error
from .providers.common import ProviderError
from .schemas import FrontierModel, Model, ProviderMeta
from .settings import ROOT

ReviewAnswer = Literal["yes", "no", "uncertain"]
ReviewPageId = Literal["ARC-000141", "ARC-000212", "ARC-000377", "ARC-000401", "ARC-000455", "ARC-000508"]
ReviewAction = Literal["classify", "redact"]


class LiveReviewRequest(Model):
    page_id: ReviewPageId
    content_version: str = Field(pattern=r"^[a-f0-9]{64}$")
    action: ReviewAction
    frontier_model: FrontierModel = "gpt-5.5"


class LiveReviewJudgment(Model):
    responsive: ReviewAnswer
    personal_info: ReviewAnswer
    privileged: ReviewAnswer
    explanation: str = Field(min_length=1, max_length=2000)


class LiveRedactionDraft(Model):
    redacted_text: str = Field(min_length=1, max_length=12000)
    removed_spans: list[str] = Field(max_length=30)
    explanation: str = Field(min_length=1, max_length=2000)


class ReviewReferenceCheck(Model):
    criterion: str
    expected: str
    observed: str
    matched: bool


class ReviewReferenceResult(Model):
    version: str
    metric: Literal["fictional_reference_agreement", "authored_pii_span_coverage"]
    matched: int = Field(ge=0)
    total: int = Field(ge=0)
    checks: list[ReviewReferenceCheck]
    extra_removed_characters: int | None = Field(default=None, ge=0)
    rewrite_integrity: bool | None = None
    basis: str = "Authored fictional examples; not production accuracy or a legal determination."


class ReviewActionMetrics(Model):
    handler_wall_ms: float = Field(ge=0, allow_inf_nan=False)
    input_checks_ms: float = Field(ge=0, allow_inf_nan=False)
    provider_ms: float = Field(ge=0, allow_inf_nan=False)
    code_validation_ms: float = Field(ge=0, allow_inf_nan=False)
    reference_evaluation_ms: float = Field(ge=0, allow_inf_nan=False)
    reference: ReviewReferenceResult
    timing_scope: str = "One preview action: handler entry to response construction, excluding HTTP transport, serialization, and attorney approval."
    workflow_elapsed_ms: None = None
    workflow_quality: None = None


class LiveReviewResponse(Model):
    version: Literal["review-pages-v1"] = "review-pages-v1"
    page_id: ReviewPageId
    content_version: str
    action: ReviewAction
    metadata: ProviderMeta
    judgment: LiveReviewJudgment | None = None
    proposed_route: Literal["produce", "aside", "redact", "attorney"] | None = None
    redaction: LiveRedactionDraft | None = None
    validation: Literal["structured judgment", "exact source rewrite"]
    requires_review: Literal[True] = True
    published: Literal[False] = False
    operational_writes: Literal[0] = 0
    provider_calls: Literal[1] = 1
    provider_source: Literal["live"] = "live"
    timing: Literal["measured provider round trip"] = "measured provider round trip"
    metrics: ReviewActionMetrics | None = None


@lru_cache(maxsize=1)
def review_pages() -> dict[str, dict]:
    catalogue = json.loads((ROOT / "data/education-examples/review-pages-v1.json").read_text())
    pages = {page["id"]: page for page in catalogue["pages"]}
    for page in pages.values():
        if hashlib.sha256(page["text"].encode()).hexdigest() != page["content_version"]:
            raise ValueError("Prepared review source hash does not match its text")
        page["reference_version"] = catalogue["reference_version"]
        for span in page["reference_pii_spans"]:
            if not span["text"] or span["text"] not in page["text"]:
                raise ValueError("Authored PII target is missing from its source")
    return pages


def review_route(judgment: LiveReviewJudgment) -> Literal["produce", "aside", "redact", "attorney"]:
    """Same task policy as the existing prepared legal-review illustration."""
    if judgment.privileged != "no":
        return "attorney"
    if judgment.responsive == "no":
        return "aside"
    if judgment.responsive == "uncertain" or judgment.personal_info == "uncertain":
        return "attorney"
    return "redact" if judgment.personal_info == "yes" else "produce"


def validate_redaction(source: str, draft: LiveRedactionDraft) -> None:
    """Validate literal rewriting only; this cannot establish PII completeness."""
    spans = draft.removed_spans
    if len(spans) != len(set(spans)) or any(not span or span not in source for span in spans):
        raise ProviderError("openai", "invalid_response", "The redaction draft contains an invalid source span.")
    ranges = sorted((match.start(), match.end()) for span in spans for match in re.finditer(re.escape(span), source))
    cursor = 0
    fragments = []
    for start, end in ranges:
        if start < cursor:
            raise ProviderError("openai", "invalid_response", "The redaction draft declares overlapping source spans.")
        fragments.extend((source[cursor:start], "[REDACTED]"))
        cursor = end
    expected = "".join([*fragments, source[cursor:]])
    if expected != draft.redacted_text:
        raise ProviderError("openai", "invalid_response", "The redaction draft changed text outside its declared redactions.")


def judgment_reference(page: dict, judgment: LiveReviewJudgment) -> ReviewReferenceResult:
    fields = [("Responsiveness", "responsive", "responsive"), ("Personal information", "pii", "personal_info"), ("Potential privilege", "privileged", "privileged")]
    checks = [ReviewReferenceCheck(criterion=label, expected=page[source], observed=getattr(judgment, field), matched=page[source] == getattr(judgment, field)) for label, source, field in fields]
    return ReviewReferenceResult(version=page["reference_version"], metric="fictional_reference_agreement", matched=sum(check.matched for check in checks), total=len(checks), checks=checks)


def redaction_reference(page: dict, draft: LiveRedactionDraft) -> ReviewReferenceResult:
    """Count fully removed authored occurrences, not substring disappearance.

    Partial-name deletion cannot satisfy a whole-name target. Every occurrence
    is a separate target, and removing unrelated text remains visible.
    """
    source = page["text"]
    removed: set[int] = set()
    for span in draft.removed_spans:
        for match in re.finditer(re.escape(span), source):
            removed.update(range(match.start(), match.end()))
    target_positions: set[int] = set()
    checks = []
    for span in page["reference_pii_spans"]:
        for occurrence, match in enumerate(re.finditer(re.escape(span["text"]), source), start=1):
            positions = set(range(match.start(), match.end()))
            target_positions.update(positions)
            matched = positions <= removed
            checks.append(ReviewReferenceCheck(criterion=f"{span['kind']} · {span['text']} · occurrence {occurrence}", expected="Fully removed", observed="Fully removed" if matched else "Partly retained" if positions & removed else "Retained", matched=matched))
    return ReviewReferenceResult(version=page["reference_version"], metric="authored_pii_span_coverage", matched=sum(check.matched for check in checks), total=len(checks), checks=checks, extra_removed_characters=len(removed - target_positions), rewrite_integrity=True, basis="Removal coverage of authored PII occurrences only. Unlisted PII, legal sufficiency, and final release quality are not evaluated.")


def action_metrics(started: float, input_checks_ms: float, metadata: ProviderMeta, validation_ms: float, reference_started: float, reference: ReviewReferenceResult) -> ReviewActionMetrics:
    finished = perf_counter()
    return ReviewActionMetrics(handler_wall_ms=(finished - started) * 1000, input_checks_ms=input_checks_ms, provider_ms=metadata.elapsed_ms, code_validation_ms=validation_ms, reference_evaluation_ms=(finished - reference_started) * 1000, reference=reference)


router = APIRouter(prefix="/api/lessons/review", tags=["Lessons"])


@router.post("/live", response_model=LiveReviewResponse)
async def live_review(body: LiveReviewRequest, request: Request):
    started = perf_counter()
    async with live_lesson_slot(request):
        page = review_pages()[body.page_id]
        if body.content_version != page["content_version"]:
            raise HTTPException(409, "The prepared page changed. Refresh before requesting a live review.")
        if body.action == "redact" and not page.get("redacted"):
            raise HTTPException(409, "Choose the Cutoff approvals page to try the redaction example.")
        async with live_frontier(request, body.frontier_model) as provider:
            input_checks_ms = (perf_counter() - started) * 1000
            try:
                if body.action == "classify":
                    judgment, metadata = await provider._parse(
                        LiveReviewJudgment,
                        "Classify this fictional page for a legal document review. Return yes, no, or uncertain "
                        "for responsiveness to a revenue-recognition and quarter-end-cutoff inquiry; presence of "
                        "personal identifying information; and potential attorney-client privilege. Uncertainty "
                        "must remain explicit. Do not decide legal enforceability or authorize disclosure. "
                        "Give a brief explanation based only on observable source text.",
                        {"page_id": page["id"], "text": page["text"]},
                    )
                    validation_started = perf_counter()
                    judgment = LiveReviewJudgment.model_validate(judgment)
                    meta = live_metadata(metadata)
                    route = review_route(judgment)
                    validation_ms = (perf_counter() - validation_started) * 1000
                    reference_started = perf_counter()
                    reference = judgment_reference(page, judgment)
                    return LiveReviewResponse(
                        page_id=body.page_id, content_version=body.content_version, action=body.action,
                        metadata=meta, judgment=judgment,
                        proposed_route=route, validation="structured judgment",
                        metrics=action_metrics(started, input_checks_ms, meta, validation_ms, reference_started, reference),
                    )
                draft, metadata = await provider._parse(
                    LiveRedactionDraft,
                    "Create a redaction DRAFT for this fictional page. Select personal names, email addresses, "
                    "phone numbers, and employee identifiers. Return each exact removed literal string once in "
                    "removed_spans. Produce redacted_text by replacing every occurrence of those strings with "
                    "[REDACTED]. Preserve every other character, space, and newline exactly. Choose nonoverlapping "
                    "spans. Do not add instructions or certify completeness. An attorney must inspect this draft.",
                    {"page_id": page["id"], "text": page["text"]},
                )
                validation_started = perf_counter()
                draft = LiveRedactionDraft.model_validate(draft)
                meta = live_metadata(metadata)
                validate_redaction(page["text"], draft)
                validation_ms = (perf_counter() - validation_started) * 1000
                reference_started = perf_counter()
                reference = redaction_reference(page, draft)
                return LiveReviewResponse(
                    page_id=body.page_id, content_version=body.content_version, action=body.action,
                    metadata=meta, redaction=draft, validation="exact source rewrite",
                    metrics=action_metrics(started, input_checks_ms, meta, validation_ms, reference_started, reference),
                )
            except ProviderError as error:
                raise live_provider_error(error) from None
            except (ValueError, TypeError):
                raise HTTPException(502, "The provider returned an invalid review response.") from None


def live_metadata(metadata: dict) -> ProviderMeta:
    value = ProviderMeta.model_validate(metadata)
    if value.provider != "openai":
        raise ProviderError("openai", "invalid_response", "A live review did not return live provider evidence.")
    return value
