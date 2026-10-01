"""Actual review adapter boundaries, exercised with a mocked OpenAI SDK."""

import asyncio
import itertools
import json

import pytest
from fastapi.testclient import TestClient
from test_api import configured
from test_live_lessons import live_settings, mock_sdk, response

from doc_discovery.api import create_app
from doc_discovery.providers.common import ProviderError
from doc_discovery.review_lessons import (
    LiveRedactionDraft,
    LiveReviewJudgment,
    judgment_reference,
    redaction_reference,
    review_pages,
    review_route,
    validate_redaction,
)


def body(action="classify", page_id="ARC-000377"):
    return {"action": action, "page_id": page_id, "content_version": review_pages()[page_id]["content_version"]}


def test_live_review_classifies_fixed_text_with_real_adapter_and_keeps_outputs_unpublished(tmp_path, monkeypatch):
    async def parse(**kwargs):
        await asyncio.sleep(.02)
        return response({"responsive": "yes", "personal_info": "yes", "privileged": "no", "explanation": "The page records a revenue adjustment and identifies its approver."})

    sdk = mock_sdk(monkeypatch, parse)
    app = create_app(live_settings(tmp_path))
    with TestClient(app) as client:
        before = app.state.storage.db.total_changes
        result = client.post("/api/lessons/review/live", json=body())
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["metadata"]["provider"] == "openai"
        assert value["metadata"]["configured_model"] == "gpt-5.5"
        assert value["metadata"]["elapsed_ms"] >= 15
        assert value["metadata"]["request_id"] == "req-unit-live"
        assert value["judgment"]["personal_info"] == "yes"
        assert value["proposed_route"] == "redact"
        assert value["requires_review"] and not value["published"]
        assert value["operational_writes"] == 0 and value["provider_calls"] == 1
        metrics = value["metrics"]
        assert metrics["handler_wall_ms"] >= metrics["provider_ms"] >= 15
        assert metrics["provider_ms"] == value["metadata"]["elapsed_ms"]
        assert all(metrics[key] >= 0 for key in ("input_checks_ms", "code_validation_ms", "reference_evaluation_ms"))
        assert sum(metrics[key] for key in ("input_checks_ms", "provider_ms", "code_validation_ms", "reference_evaluation_ms")) <= metrics["handler_wall_ms"]
        assert metrics["reference"]["matched"] == 3 and metrics["reference"]["total"] == 3
        assert metrics["reference"]["version"] == "review-references-v1"
        assert metrics["workflow_elapsed_ms"] is None and metrics["workflow_quality"] is None
        assert app.state.storage.db.total_changes == before
        assert app.state.storage.runs() == [] and app.state.storage.documents().documents == []
        call = sdk.responses.parse.call_args.kwargs
        assert call["text_format"] is LiveReviewJudgment
        assert call["model"] == "gpt-5.5" and call["store"] is False
        assert json.loads(call["input"])["text"] == review_pages()["ARC-000377"]["text"]


def test_live_redaction_returns_actual_validated_draft_not_prepared_copy(tmp_path, monkeypatch):
    source = review_pages()["ARC-000377"]["text"]
    # Deliberately incomplete so the test proves validation does not certify
    # completeness or silently substitute the prepared full redaction.
    actual = source.replace("Jordan Lee", "[REDACTED]")
    sdk = mock_sdk(monkeypatch, lambda **_: response({"redacted_text": actual, "removed_spans": ["Jordan Lee"], "explanation": "The selected name was removed; inspect all remaining identifiers."}))
    with TestClient(create_app(live_settings(tmp_path))) as client:
        result = client.post("/api/lessons/review/live", json=body("redact"))
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["redaction"]["redacted_text"] == actual
        assert actual != review_pages()["ARC-000377"]["redacted"]
        assert value["validation"] == "exact source rewrite"
        assert value["requires_review"] and not value["published"]
        assert value["judgment"] is None and value["proposed_route"] is None
        reference = value["metrics"]["reference"]
        assert reference["matched"] == 1 and reference["total"] == 4
        assert reference["rewrite_integrity"] is True
        assert reference["extra_removed_characters"] == 0
        assert sdk.responses.parse.call_args.kwargs["text_format"] is LiveRedactionDraft
        assert sdk.responses.parse.await_count == 1


@pytest.mark.parametrize("invalid", [
    {"redacted_text": "A fabricated replacement", "removed_spans": [], "explanation": "Invalid"},
    {"redacted_text": "Anything", "removed_spans": ["not in the source"], "explanation": "Invalid"},
    {"redacted_text": "Anything", "removed_spans": ["Jordan Lee", "Jordan Lee"], "explanation": "Invalid"},
])
def test_invalid_redaction_is_rejected_without_fallback_or_publication(tmp_path, monkeypatch, invalid):
    sdk = mock_sdk(monkeypatch, lambda **_: response(invalid))
    with TestClient(create_app(live_settings(tmp_path))) as client:
        result = client.post("/api/lessons/review/live", json=body("redact"))
        assert result.status_code == 502
        assert sdk.responses.parse.await_count == 1
        assert client.get("/api/runs").json()["runs"] == []


@pytest.mark.parametrize("changes,status", [
    ({"page_id": "uploaded-document"}, 422), ({"content_version": "0" * 64}, 409),
    ({"text": "Injected input"}, 422), ({"model": "other"}, 422),
    ({"action": "publish"}, 422),
])
def test_unbound_review_requests_never_call_provider(tmp_path, monkeypatch, changes, status):
    sdk = mock_sdk(monkeypatch, lambda **_: response({}))
    with TestClient(create_app(live_settings(tmp_path))) as client:
        assert client.post("/api/lessons/review/live", json=body() | changes).status_code == status
        assert client.post("/api/lessons/review/live", json=body("redact", "ARC-000401")).status_code == 409
        for headers in ({"origin": "https://attacker.example"}, {"sec-fetch-site": "cross-site"}):
            assert client.post("/api/lessons/review/live", json=body(), headers=headers).status_code == 403
        sdk.responses.parse.assert_not_called()


def test_timeout_and_missing_key_leave_live_latency_unmeasured(tmp_path, monkeypatch):
    with TestClient(create_app(configured(tmp_path / "missing"))) as client:
        assert client.post("/api/lessons/review/live", json=body()).status_code == 503

    async def timeout(**kwargs):
        raise TimeoutError("private SDK data")

    sdk = mock_sdk(monkeypatch, timeout)
    with TestClient(create_app(live_settings(tmp_path / "timeout"))) as client:
        result = client.post("/api/lessons/review/live", json=body())
        assert result.status_code == 504 and "private SDK data" not in result.text
        assert sdk.responses.parse.await_count == 1


def test_runtime_rule_prioritizes_privilege_and_uncertainty_over_production():
    for responsive, personal_info, privileged in itertools.product(("yes", "no", "uncertain"), repeat=3):
        judgment = LiveReviewJudgment(responsive=responsive, personal_info=personal_info, privileged=privileged, explanation="Test signal")
        route = review_route(judgment)
        if privileged != "no":
            assert route == "attorney"
        elif responsive == "no":
            assert route == "aside"
        elif responsive == "uncertain" or personal_info == "uncertain":
            assert route == "attorney"
        else:
            assert route == ("redact" if personal_info == "yes" else "produce")


def test_reference_agreement_counts_authored_uncertainty_and_discloses_mismatches():
    page = review_pages()["ARC-000455"]
    same = judgment_reference(page, LiveReviewJudgment(responsive="uncertain", personal_info="no", privileged="uncertain", explanation="Source is incomplete."))
    assert same.matched == 3 and same.total == 3
    different = judgment_reference(page, LiveReviewJudgment(responsive="yes", personal_info="no", privileged="no", explanation="A mismatching test result."))
    assert different.matched == 1 and different.total == 3
    assert [(check.expected, check.observed) for check in different.checks if not check.matched] == [("uncertain", "yes"), ("uncertain", "no")]


def test_redaction_reference_never_credits_partial_names_and_exposes_extra_removals():
    page = review_pages()["ARC-000377"]
    partial = LiveRedactionDraft(redacted_text=page["text"].replace("Jordan", "[REDACTED]"), removed_spans=["Jordan"], explanation="Partial name only.")
    validate_redaction(page["text"], partial)
    reference = redaction_reference(page, partial)
    assert reference.matched == 0 and reference.total == 4
    assert reference.checks[0].observed == "Partly retained"
    whole_page = LiveRedactionDraft(redacted_text="[REDACTED]", removed_spans=[page["text"]], explanation="Over-redacted.")
    validate_redaction(page["text"], whole_page)
    reference = redaction_reference(page, whole_page)
    assert reference.matched == 4 and reference.extra_removed_characters > 0
    complete = LiveRedactionDraft(redacted_text=page["redacted"], removed_spans=[span["text"] for span in page["reference_pii_spans"]], explanation="All authored targets.")
    validate_redaction(page["text"], complete)
    reference = redaction_reference(page, complete)
    assert reference.matched == reference.total == 4 and reference.extra_removed_characters == 0


def test_every_authored_occurrence_is_counted_and_overlapping_declarations_are_rejected():
    page = {"text": "Approver: Jordan Lee\nAuthor: Jordan Lee", "reference_version": "test-v1", "reference_pii_spans": [{"kind": "name", "text": "Jordan Lee"}]}
    draft = LiveRedactionDraft(redacted_text="[REDACTED]\nAuthor: Jordan Lee", removed_spans=["Approver: Jordan Lee"], explanation="One occurrence remains.")
    validate_redaction(page["text"], draft)
    reference = redaction_reference(page, draft)
    assert reference.matched == 1 and reference.total == 2
    assert reference.checks[1].observed == "Retained"
    source = review_pages()["ARC-000377"]["text"]
    overlapping = LiveRedactionDraft(redacted_text=source.replace("dan Lee", "[REDACTED]").replace("Jordan", "[REDACTED]"), removed_spans=["Jordan", "dan Lee"], explanation="Overlapping spans cannot prove complete removal.")
    with pytest.raises(ProviderError, match="overlapping"):
        validate_redaction(source, overlapping)
