"""Independent adversarial checks of the live Review & redact provider boundary."""

import pytest
from fastapi.testclient import TestClient
from test_live_lessons import app_data_counts, live_settings, mock_sdk, response

from doc_discovery.api import create_app
from doc_discovery.review_lessons import LiveRedactionDraft, LiveReviewJudgment, review_pages


def body(action="classify", page_id="ARC-000377"):
    return {
        "page_id": page_id,
        "content_version": review_pages()[page_id]["content_version"],
        "action": action,
    }


def test_review_live_classification_metadata_and_policy_are_real_but_not_approval(tmp_path, monkeypatch):
    sdk = mock_sdk(
        monkeypatch,
        lambda **_: response(
            {
                "responsive": "yes",
                "personal_info": "yes",
                "privileged": "no",
                "explanation": "The page discusses cutoff approvals and contains personal contact details.",
            }
        ),
    )
    app = create_app(live_settings(tmp_path))
    with TestClient(app) as client:
        before = app.state.storage.db.total_changes
        result = client.post("/api/lessons/review/live", json=body())
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["metadata"]["provider"] == "openai"
        assert value["metadata"]["configured_model"] == "gpt-5.5"
        assert value["metadata"]["request_id"] == "req-unit-live"
        assert value["proposed_route"] == "redact"
        assert value["requires_review"] and not value["published"]
        assert value["operational_writes"] == 0 and value["provider_calls"] == 1
        assert sdk.responses.parse.await_count == 1
        assert sdk.responses.parse.call_args.kwargs["text_format"] is LiveReviewJudgment
        assert app.state.storage.db.total_changes == before
        assert app_data_counts(client) == (0, 0)


@pytest.mark.parametrize(
    "change,expected_status",
    [
        ({"content_version": "0" * 64}, 409),
        ({"page_id": "unknown"}, 422),
        ({"text": "arbitrary uploaded text"}, 422),
        ({"action": "publish"}, 422),
        ({"model": "different"}, 422),
    ],
)
def test_review_untrusted_inputs_never_start_a_request(tmp_path, monkeypatch, change, expected_status):
    sdk = mock_sdk(monkeypatch, lambda **_: response(None))
    with TestClient(create_app(live_settings(tmp_path))) as client:
        assert client.post("/api/lessons/review/live", json=body() | change).status_code == expected_status
        sdk.responses.parse.assert_not_called()


def test_review_rejects_unknown_origin_and_unsupported_redaction_source(tmp_path, monkeypatch):
    sdk = mock_sdk(monkeypatch, lambda **_: response(None))
    with TestClient(create_app(live_settings(tmp_path))) as client:
        assert (
            client.post(
                "/api/lessons/review/live", json=body(), headers={"Origin": "https://attacker.example"}
            ).status_code
            == 403
        )
        assert client.post("/api/lessons/review/live", json=body("redact", "ARC-000141")).status_code == 409
        sdk.responses.parse.assert_not_called()


@pytest.mark.parametrize("tampered", [False, True])
def test_redaction_checks_literal_changes_and_does_not_authorize_publication(tmp_path, monkeypatch, tampered):
    page = review_pages()["ARC-000377"]
    removed = next(line.strip() for line in page["text"].splitlines() if line.strip())
    draft = {
        "redacted_text": page["text"].replace(removed, "[REDACTED]")
        + ("\nInvented text" if tampered else ""),
        "removed_spans": [removed],
        "explanation": "A draft literal redaction, requiring human inspection.",
    }
    sdk = mock_sdk(monkeypatch, lambda **_: response(draft))
    with TestClient(create_app(live_settings(tmp_path))) as client:
        result = client.post("/api/lessons/review/live", json=body("redact"))
        assert result.status_code == (502 if tampered else 200), result.text
        assert sdk.responses.parse.call_args.kwargs["text_format"] is LiveRedactionDraft
        assert sdk.responses.parse.await_count == 1
        if not tampered:
            value = result.json()
            assert value["validation"] == "exact source rewrite"
            assert value["requires_review"] and not value["published"]
        assert app_data_counts(client) == (0, 0)


def test_review_rejects_invalid_structured_judgment_without_fallback(tmp_path, monkeypatch):
    sdk = mock_sdk(
        monkeypatch,
        lambda **_: response(
            {
                "responsive": "approved",
                "personal_info": "no",
                "privileged": "no",
                "explanation": "Invalid enum.",
            }
        ),
    )
    with TestClient(create_app(live_settings(tmp_path))) as client:
        result = client.post("/api/lessons/review/live", json=body())
        assert result.status_code == 502
        assert sdk.responses.parse.await_count == 1
        assert app_data_counts(client) == (0, 0)


def test_review_provider_failure_is_safe_and_never_returns_prepared_result(tmp_path, monkeypatch):
    async def fail(**kwargs):
        raise TimeoutError("private credentials and response body")

    sdk = mock_sdk(monkeypatch, fail)
    with TestClient(create_app(live_settings(tmp_path))) as client:
        result = client.post("/api/lessons/review/live", json=body())
        assert result.status_code == 504
        assert "private credentials" not in result.text
        assert sdk.responses.parse.await_count == 1
        assert app_data_counts(client) == (0, 0)
