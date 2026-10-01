"""A per-request model choice reaches SDK calls without changing policy or settings."""

import json

import pytest
from fastapi.testclient import TestClient
from test_classification_measurements import body as classification_body
from test_classification_measurements import bounded, jev_response, mock_jev, settings
from test_live_lessons import app_data_counts, mock_discovery_jev, mock_sdk, response
from test_live_review import body as review_body

from doc_discovery.api import create_app
from doc_discovery.providers.openai import BoundedClassification, ClassificationProposal
from doc_discovery.review_lessons import LiveRedactionDraft, LiveReviewJudgment, review_pages
from doc_discovery.schemas import Answer, QueryPlan

MODELS = ["gpt-4.1", "gpt-5.5", "gpt-5.6-sol"]
OPERATIONS = ["classify/live", "compare-classification", "interpret", "discover", "review-classify", "review-redact"]


def request_data(operation, model):
    if operation.startswith("review-"):
        return "review/live", review_body(operation.removeprefix("review-")) | {"frontier_model": model}
    if operation == "discover":
        return operation, {"example_id": "compare", "bounded_mode": "live", "frontier_model": model}
    return operation, classification_body("proposed") | {"frontier_model": model}


def parsed_response(options):
    schema = options["text_format"]
    if schema is BoundedClassification:
        parsed = bounded("contract", 0.99)
    elif schema is ClassificationProposal:
        parsed = {"category": "correspondence", "explanation": "The source proposes future terms."}
    elif schema is QueryPlan:
        parsed = {"intent": "compare", "tasks": [{"id": "task-1", "phrase": "access policy", "purpose": "Retrieve both policies"}], "explanation": "Find actual retained evidence."}
    elif schema is Answer:
        passage = json.loads(options["input"])["evidence"][0]
        parsed = {"claims": [{"text": "The source describes access rules.", "citations": [{"passage_id": passage["passage_id"], "quote": passage["text"].splitlines()[0]}]}], "missing_evidence": []}
    elif schema is LiveReviewJudgment:
        parsed = {"responsive": "yes", "personal_info": "yes", "privileged": "no", "explanation": "This source identifies a revenue approver."}
    else:
        assert schema is LiveRedactionDraft
        parsed = {"redacted_text": review_pages()["ARC-000377"]["text"].replace("Jordan Lee", "[REDACTED]"), "removed_spans": ["Jordan Lee"], "explanation": "Draft for attorney review."}
    result = response(parsed)
    # Keep configured and returned values separate; metadata must preserve both.
    result.model = options["model"] + "-unit-snapshot"
    return result


def frontier_metadata(value, operation):
    if operation == "classify/live":
        return [value["strategy"]["interpretation"]]
    if operation == "compare-classification":
        return [value["strategies"][0]["interpretation"], value["strategies"][1]["judgment"], value["strategies"][1]["interpretation"]]
    if operation == "interpret":
        return [value["proposal"]]
    if operation == "discover":
        return [json.loads(event["payload"]["detail"]) for event in value["snapshot"]["events"] if event["type"] == "node_completed" and event["instance_id"] in {"plan", "synthesize"}]
    return [value["metadata"]]


@pytest.mark.parametrize("model", MODELS)
@pytest.mark.parametrize("operation", OPERATIONS)
def test_each_selected_model_reaches_live_sdk_and_provenance_without_global_mutation(tmp_path, monkeypatch, model, operation):
    if operation == "discover":
        mock_discovery_jev(monkeypatch)
    else:
        mock_jev(monkeypatch, lambda **_: jev_response(bounded("contract", 0.99)))
    sdk = mock_sdk(monkeypatch, lambda **options: parsed_response(options))
    app = create_app(settings(tmp_path))
    with TestClient(app) as client:
        before = app.state.storage.db.total_changes
        original_config = app.state.engine.settings.public_config()
        endpoint, data = request_data(operation, model)
        result = client.post(f"/api/lessons/{endpoint}", json=data)
        assert result.status_code == 200, result.text
        value = result.json()
        calls = sdk.responses.parse.call_args_list
        assert calls and all(call.kwargs["model"] == model for call in calls)
        for call in calls:
            assert call.kwargs.get("reasoning") == (None if model == "gpt-4.1" else {"effort": "low"})
            assert call.kwargs["max_output_tokens"] == (2400 if model == "gpt-4.1" else 8192)
        for metadata in frontier_metadata(value, operation):
            assert metadata["configured_model"] == model
            assert metadata["returned_model"] == model + "-unit-snapshot"
            assert metadata["provider"] == "openai" and metadata["elapsed_ms"] >= 0
        if operation in {"classify/live", "compare-classification"}:
            assert model.upper() in value["provenance"]["frontier_provider"].upper()
            strategies = value.get("strategies", [value.get("strategy")])
            assert all(strategy["policy"]["reason"] == "mixed_purpose" for strategy in strategies)
        elif operation == "discover":
            assert model.upper() in value["provenance"]["frontier"].upper()
            assert value["snapshot"]["run"]["configuration"]["openai_model"] == model
            assert value["frontier_calls"] == 2
        assert app.state.engine.settings.public_config() == original_config
        assert app.state.lesson_openai.settings.openai_model == "gpt-5.5"
        assert app.state.storage.db.total_changes == before
        assert app_data_counts(client) == (0, 0)
        assert sdk.close.await_count >= 1


@pytest.mark.parametrize("operation", OPERATIONS)
def test_unsupported_model_is_rejected_before_any_provider_call(tmp_path, monkeypatch, operation):
    jev = mock_jev(monkeypatch, lambda **_: jev_response(bounded()))
    sdk = mock_sdk(monkeypatch, lambda **options: parsed_response(options))
    with TestClient(create_app(settings(tmp_path))) as client:
        endpoint, data = request_data(operation, "unlisted-model")
        assert client.post(f"/api/lessons/{endpoint}", json=data).status_code == 422
        jev.system_one.assert_not_called()
        sdk.responses.parse.assert_not_called()


@pytest.mark.parametrize("model", MODELS)
def test_model_selection_does_not_add_frontier_work_to_direct_classification(tmp_path, monkeypatch, model):
    jev = mock_jev(monkeypatch, lambda **_: jev_response(bounded()))
    sdk = mock_sdk(monkeypatch, lambda **options: parsed_response(options))
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post("/api/lessons/classify/live", json=classification_body("clear") | {"frontier_model": model})
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["strategy"]["policy"]["selected_route"] == "accept"
        assert value["strategy"]["frontier_attempts"] == 0
        assert model.upper() in value["provenance"]["frontier_provider"].upper()
        jev.system_one.assert_awaited_once()
        sdk.responses.parse.assert_not_called()


def test_subsequent_default_request_does_not_inherit_previous_model_choice(tmp_path, monkeypatch):
    sdk = mock_sdk(monkeypatch, lambda **options: parsed_response(options))
    with TestClient(create_app(settings(tmp_path))) as client:
        first = client.post("/api/lessons/interpret", json=classification_body("proposed") | {"frontier_model": "gpt-4.1"})
        second = client.post("/api/lessons/interpret", json=classification_body("proposed"))
        assert first.status_code == second.status_code == 200
        assert [call.kwargs["model"] for call in sdk.responses.parse.call_args_list] == ["gpt-4.1", "gpt-5.5"]


def test_prepared_discovery_bounded_mode_also_honors_selected_frontier(tmp_path, monkeypatch):
    sdk = mock_sdk(monkeypatch, lambda **options: parsed_response(options))
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post("/api/lessons/discover", json={"example_id": "compare", "frontier_model": "gpt-4.1"})
        assert result.status_code == 200, result.text
        assert result.json()["provenance"]["bounded_judgments"] == "prepared"
        assert all(call.kwargs["model"] == "gpt-4.1" for call in sdk.responses.parse.call_args_list)


def test_selected_model_failure_never_substitutes_a_default_model(tmp_path, monkeypatch):
    async def unavailable(**options):
        raise ValueError("private model-access response")

    sdk = mock_sdk(monkeypatch, unavailable)
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post("/api/lessons/interpret", json=classification_body("proposed") | {"frontier_model": "gpt-5.6-sol"})
        assert result.status_code == 502
        assert "private model-access response" not in result.text
        sdk.responses.parse.assert_awaited_once()
        assert sdk.responses.parse.call_args.kwargs["model"] == "gpt-5.6-sol"
        assert app_data_counts(client) == (0, 0)
