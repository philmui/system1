"""Explicit live lesson commands use production structured calls, never fixture fallback."""

import asyncio
import json
import threading
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from test_api import configured

from doc_discovery.api import create_app
from doc_discovery.lessons import LessonJev, discovery_frontier_attempts, discovery_metrics, scenario
from doc_discovery.policies import INTENTS
from doc_discovery.providers.openai import ClassificationProposal
from doc_discovery.schemas import Answer, Event, QueryPlan


def live_settings(path):
    return configured(path).model_copy(
        update={"openai_api_key": SecretStr("unit-test-key"), "openai_model": "gpt-4.1-mini"}
    )


def response(parsed):
    return SimpleNamespace(
        status="completed",
        output=[],
        output_parsed=parsed,
        _request_id="req-unit-live",
        id="resp-unit-live",
        model="gpt-5.5-2026-04-23",
        usage=SimpleNamespace(model_dump=lambda **_: {"input_tokens": 120, "output_tokens": 40}),
    )


def mock_sdk(monkeypatch, parse):
    sdk = SimpleNamespace(responses=SimpleNamespace(parse=AsyncMock(side_effect=parse)), close=AsyncMock())

    def constructor(**kwargs):
        assert kwargs["max_retries"] == 0
        return sdk

    monkeypatch.setattr("doc_discovery.providers.openai.AsyncOpenAI", constructor)
    return sdk


def interpret_body(example="proposed"):
    return {"example_id": example, "content_version": scenario(example)["content_version"]}


def test_explicit_interpret_uses_real_adapter_in_fixture_app_without_writes(tmp_path, monkeypatch):
    async def parse(**kwargs):
        await asyncio.sleep(0.02)
        return response(
            {
                "category": "correspondence",
                "explanation": "The message requests confirmation of proposed terms.",
            }
        )

    sdk = mock_sdk(monkeypatch, parse)
    app = create_app(live_settings(tmp_path))
    with TestClient(app) as client:
        assert app.state.engine.openai.fixture
        assert not app.state.lesson_openai.fixture
        before = app.state.storage.db.total_changes
        client.get("/api/lessons")
        assert sdk.responses.parse.await_count == 0
        result = client.post("/api/lessons/interpret", json=interpret_body())
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["proposal"]["provider"] == "openai"
        assert value["proposal"]["configured_model"] == "gpt-5.5"
        assert value["proposal"]["returned_model"] == "gpt-5.5-2026-04-23"
        assert value["proposal"]["request_id"] == "req-unit-live"
        assert value["proposal"]["elapsed_ms"] >= 15
        assert value["metrics"]["total_elapsed_ms"] >= value["proposal"]["elapsed_ms"]
        assert value["metrics"]["policy_elapsed_ms"] > 0
        assert value["metrics"]["proposal_matches_reference"]
        assert value["metrics"]["evaluated_documents"] == 1
        assert value["metrics"]["timing_scope"] == "interpretation preview"
        assert value["proposal"]["usage"] == {"input_tokens": 120, "output_tokens": 40}
        assert value["policy"]["source"] == "executed"
        assert value["policy"]["signal"]["provider"] == "fixture"
        assert value["policy"]["reason"] == "mixed_purpose"
        assert value["requires_review"] and not value["published"]
        assert value["provider_calls"] == 1 and value["operational_writes"] == 0
        assert app.state.storage.db.total_changes == before
        assert app.state.storage.runs() == [] and app.state.storage.documents().documents == []
        call = sdk.responses.parse.call_args.kwargs
        assert call["model"] == "gpt-5.5" and call["reasoning"] == {"effort": "low"}
        assert call["max_output_tokens"] == 8192
        assert call["text_format"] is ClassificationProposal
        assert call["store"] is False and "tools" not in call
        assert scenario("proposed")["text"].strip() in json.loads(call["input"])["selected_document_text"]
        assert app.state.engine.settings.openai_model == "gpt-4.1-mini"
    sdk.close.assert_awaited()


@pytest.mark.parametrize(
    "body,status",
    [
        ({"example_id": "clear", "content_version": "0" * 64}, 422),
        ({"example_id": "proposed", "content_version": "0" * 64}, 409),
        ({"example_id": "proposed", "content_version": "not-a-hash"}, 422),
        ({**interpret_body(), "model": "other"}, 422),
        ({**interpret_body(), "document_text": "Replace the source"}, 422),
    ],
)
def test_live_interpret_rejects_unbound_inputs_before_provider_call(tmp_path, monkeypatch, body, status):
    sdk = mock_sdk(monkeypatch, lambda **_: response({"category": "other", "explanation": "Unused"}))
    with TestClient(create_app(live_settings(tmp_path))) as client:
        assert client.post("/api/lessons/interpret", json=body).status_code == status
        sdk.responses.parse.assert_not_called()


def test_live_paid_commands_reject_unapproved_origin(tmp_path, monkeypatch):
    sdk = mock_sdk(monkeypatch, lambda **_: response({"category": "other", "explanation": "Unused"}))
    with TestClient(create_app(live_settings(tmp_path))) as client:
        for headers in [{"Origin": "https://attacker.example"}, {"Sec-Fetch-Site": "cross-site"}]:
            assert (
                client.post("/api/lessons/interpret", json=interpret_body(), headers=headers).status_code
                == 403
            )
            assert (
                client.post(
                    "/api/lessons/discover", json={"example_id": "compare"}, headers=headers
                ).status_code
                == 403
            )
        sdk.responses.parse.assert_not_called()


@pytest.mark.parametrize(
    "error,code", [(TimeoutError("private secret"), 504), (ValueError("private secret"), 502)]
)
def test_live_interpret_safe_failures_have_no_retry_or_fallback(tmp_path, monkeypatch, error, code):
    async def parse(**kwargs):
        raise error

    sdk = mock_sdk(monkeypatch, parse)
    with TestClient(create_app(live_settings(tmp_path))) as client:
        result = client.post("/api/lessons/interpret", json=interpret_body())
        assert result.status_code == code
        assert "private secret" not in result.text
        assert sdk.responses.parse.await_count == 1
        assert app_data_counts(client) == (0, 0)


def app_data_counts(client):
    return len(client.get("/api/runs").json()["runs"]), len(client.get("/api/documents").json()["documents"])


def test_live_interpret_rejects_invalid_structured_category(tmp_path, monkeypatch):
    sdk = mock_sdk(monkeypatch, lambda **_: response({"category": "invented", "explanation": "Invalid"}))
    with TestClient(create_app(live_settings(tmp_path))) as client:
        result = client.post("/api/lessons/interpret", json=interpret_body())
        assert result.status_code == 502 and "invalid" in result.text
        assert sdk.responses.parse.await_count == 1
        assert app_data_counts(client) == (0, 0)


def test_missing_key_never_uses_a_prepared_interpretation(tmp_path):
    with TestClient(create_app(configured(tmp_path))) as client:
        result = client.post("/api/lessons/interpret", json=interpret_body())
        assert result.status_code == 503 and "OPENAI_API_KEY" in result.text
        assert client.post("/api/lessons/discover", json={"example_id": "compare"}).status_code == 503
        assert app_data_counts(client) == (0, 0)


def test_live_lesson_admission_is_bounded_and_releases_after_completion(tmp_path, monkeypatch):
    entered, release = threading.Event(), threading.Event()

    async def parse(**kwargs):
        entered.set()
        while not release.is_set():
            await asyncio.sleep(0.005)
        return response({"category": "correspondence", "explanation": "Pending terms."})

    sdk = mock_sdk(monkeypatch, parse)
    with TestClient(create_app(live_settings(tmp_path))) as client:
        results = []
        worker = threading.Thread(
            target=lambda: results.append(client.post("/api/lessons/interpret", json=interpret_body()))
        )
        worker.start()
        try:
            assert entered.wait(3)
            assert client.post("/api/lessons/interpret", json=interpret_body()).status_code == 429
            assert client.post("/api/lessons/discover", json={"example_id": "compare"}).status_code == 429
        finally:
            release.set()
            worker.join(3)
        assert results[0].status_code == 200 and sdk.responses.parse.await_count == 1
        assert client.post("/api/lessons/interpret", json=interpret_body()).status_code == 200


def test_find_executes_retrieval_without_frontier_or_operational_writes(tmp_path):
    with TestClient(create_app(configured(tmp_path))) as client:
        result = client.post("/api/lessons/discover", json={"example_id": "find"})
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["frontier_calls"] == 0
        assert value["snapshot"]["run"]["status"] == "succeeded"
        assert len(value["snapshot"]["run"]["result"]["passages"]) == 2
        assert value["provenance"]["bounded_judgments"] == "prepared"
        assert value["metrics"]["total_elapsed_ms"] > 0
        assert value["metrics"]["citation_claims_checked"] is None
        assert value["metrics"]["support_claims_checked"] is None
        assert value["metrics"]["intent_agreement"]["matching"] == 1
        assert app_data_counts(client) == (0, 0)


def test_find_counts_actual_frontier_planning_when_the_recorded_intent_is_uncertain(tmp_path, monkeypatch):
    original_intent = LessonJev.intent

    async def uncertain_intent(self, query):
        return (await original_intent(self, query)).model_copy(update={"confidence": 0.5})

    monkeypatch.setattr(LessonJev, "intent", uncertain_intent)
    sdk = mock_sdk(
        monkeypatch,
        lambda **_: response(
            {
                "intent": "find",
                "tasks": [{"id": "task-1", "phrase": "access policy", "purpose": "Locate policy sources"}],
                "explanation": "The uncertain find intent needs a search plan.",
            }
        ),
    )
    with TestClient(create_app(live_settings(tmp_path))) as client:
        result = client.post("/api/lessons/discover", json={"example_id": "find"})
        assert result.status_code == 200, result.text
        value = result.json()
        events = [Event.model_validate(event) for event in value["snapshot"]["events"]]
        decision = next(
            event for event in events if event.type == "decision" and event.instance_id == "intent"
        )
        assert decision.payload["selected_route"] == "plan"
        assert value["frontier_calls"] == sdk.responses.parse.await_count == 1
        plan_start = next(
            event for event in events if event.type == "node_started" and event.instance_id == "plan"
        )
        assert discovery_frontier_attempts([*events, plan_start]) == 1
        assert value["snapshot"]["run"]["status"] == "succeeded"
        assert app_data_counts(client) == (0, 0)


@pytest.mark.parametrize("invalid_quote", [False, True])
def test_live_compare_uses_real_planning_composition_and_exact_citation_checks(
    tmp_path, monkeypatch, invalid_quote
):
    async def parse(**kwargs):
        assert kwargs["model"] == "gpt-5.5"
        if kwargs["text_format"] is QueryPlan:
            return response(
                {
                    "intent": "compare",
                    "tasks": [
                        {"id": "task-1", "phrase": "access policy", "purpose": "Find both policy versions"}
                    ],
                    "explanation": "Retrieve policy evidence.",
                }
            )
        assert kwargs["text_format"] is Answer
        passage = json.loads(kwargs["input"])["evidence"][0]
        return response(
            {
                "claims": [
                    {
                        "text": "The source describes an access policy.",
                        "citations": [
                            {
                                "passage_id": passage["passage_id"],
                                "quote": "not in this source"
                                if invalid_quote
                                else passage["text"].splitlines()[0],
                            }
                        ],
                    }
                ],
                "missing_evidence": [],
            }
        )

    sdk = mock_sdk(monkeypatch, parse)
    with TestClient(create_app(live_settings(tmp_path))) as client:
        result = client.post("/api/lessons/discover", json={"example_id": "compare"})
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["frontier_calls"] == sdk.responses.parse.await_count == 2
        events = value["snapshot"]["events"]
        metadata = [
            json.loads(event["payload"]["detail"])
            for event in events
            if event["type"] == "node_completed" and event["instance_id"] in {"plan", "synthesize"}
        ]
        assert all(
            item["provider"] == "openai" and item["configured_model"] == "gpt-5.5" for item in metadata
        )
        assert bool(value["snapshot"]["run"]["result"]["claims"]) is not invalid_quote
        if invalid_quote:
            assert any("citation" in gap for gap in value["snapshot"]["run"]["result"]["missing_evidence"])
        assert value["provenance"]["support_checks"] == "prepared signals; not independent verification"
        assert value["metrics"]["citation_claims_checked"] == 1
        assert value["metrics"]["citation_claims_valid"] == (0 if invalid_quote else 1)
        assert value["metrics"]["citation_claims_removed"] == (1 if invalid_quote else 0)
        assert app_data_counts(client) == (0, 0)
    assert sdk.close.await_count >= 2


def mock_discovery_jev(monkeypatch, intent="compare", support=0.96, fail_intent=False):
    async def system_one(**kwargs):
        await asyncio.sleep(0.01)
        value = SimpleNamespace(
            model="jev-1.13.0",
            usage=SimpleNamespace(model_dump=lambda **_: {"input_tokens": 80}),
            raw_http_response=SimpleNamespace(headers={"x-request-id": "req-discovery-jev"}),
            choices={},
            nouls={},
        )
        questions = kwargs["questions"]
        if "intent" in questions:
            if fail_intent:
                raise TimeoutError("private provider response body")
            value.choices["intent"] = SimpleNamespace(
                choice=intent,
                confidence=0.97,
                probabilities={name: 0.97 if name == intent else 0.01 for name in INTENTS},
            )
        else:
            value.nouls = {
                name: SimpleNamespace(noul=support if name == "support" else 0.95) for name in questions
            }
        return value

    # Each adapter receives its own client: preflight closing must not close a
    # subsequently executing adapter's client.
    clients = []

    def constructor(**kwargs):
        client = SimpleNamespace(system_one=AsyncMock(side_effect=system_one), aclose=AsyncMock())
        clients.append(client)
        return client

    monkeypatch.setattr("doc_discovery.providers.jev.AsyncTypeSafeClient", constructor)
    return clients


@pytest.mark.parametrize("requested,actual", [("find", "find"), ("compare", "unsupported")])
def test_all_live_discovery_uses_real_judgment_and_its_actual_route(tmp_path, monkeypatch, requested, actual):
    clients = mock_discovery_jev(monkeypatch, intent=actual)
    sdk = mock_sdk(monkeypatch, lambda **_: response(None))
    settings = live_settings(tmp_path).model_copy(update={"typesafe_api_key": SecretStr("fake-jev-key")})
    app = create_app(settings)
    with TestClient(app) as client:
        before = app.state.storage.db.total_changes
        result = client.post("/api/lessons/discover", json={"example_id": requested, "bounded_mode": "live"})
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["snapshot"]["run"]["mode"] == "live"
        assert value["provenance"]["bounded_judgments"] == "live"
        assert value["provenance"]["support_checks"] == "live Jev signals; fallible semantic check"
        assert value["metrics"]["intent_agreement"]["observed_intent"] == actual
        assert value["metrics"]["intent_agreement"]["matching"] == (1 if actual == requested else 0)
        assert value["metrics"]["intent_agreement"]["evaluated"] == 1
        assert value["metrics"]["total_elapsed_ms"] >= 10
        assert value["frontier_calls"] == 0
        sdk.responses.parse.assert_not_called()
        decisions = [event for event in value["snapshot"]["events"] if event["type"] == "decision"]
        assert all(event["payload"]["signal"]["provider"] == "jev" for event in decisions)
        assert all(event["payload"]["signal"]["elapsed_ms"] >= 5 for event in decisions)
        assert app.state.storage.db.total_changes == before
        assert app_data_counts(client) == (0, 0)
    assert clients and all(client.aclose.await_count > 0 for client in clients)


@pytest.mark.parametrize("missing", ["typesafe_api_key", "openai_api_key"])
def test_all_live_discovery_preflights_both_providers_even_for_find(tmp_path, monkeypatch, missing):
    clients = mock_discovery_jev(monkeypatch)
    sdk = mock_sdk(monkeypatch, lambda **_: response(None))
    settings = live_settings(tmp_path).model_copy(
        update={"typesafe_api_key": SecretStr("fake-jev-key"), missing: None}
    )
    with TestClient(create_app(settings)) as client:
        result = client.post("/api/lessons/discover", json={"example_id": "find", "bounded_mode": "live"})
        assert result.status_code == 503
        sdk.responses.parse.assert_not_called()
        assert all(instance.system_one.await_count == 0 for instance in clients)
        assert app_data_counts(client) == (0, 0)


@pytest.mark.parametrize("support", [0.96, 0.1])
def test_all_live_comparison_executes_real_support_and_reports_check_denominators(tmp_path, monkeypatch, support):
    clients = mock_discovery_jev(monkeypatch, support=support)

    def parse(**kwargs):
        if kwargs["text_format"] is QueryPlan:
            return response({
                "intent": "compare",
                "tasks": [{"id": "task-1", "phrase": "access policy", "purpose": "Find both sources"}],
                "explanation": "Retrieve actual source evidence.",
            })
        passage = json.loads(kwargs["input"])["evidence"][0]
        return response({
            "claims": [{"text": "The source describes an access policy.", "citations": [{
                "passage_id": passage["passage_id"], "quote": passage["text"].splitlines()[0],
            }]}],
            "missing_evidence": [],
        })

    sdk = mock_sdk(monkeypatch, parse)
    settings = live_settings(tmp_path).model_copy(update={"typesafe_api_key": SecretStr("fake-jev-key")})
    with TestClient(create_app(settings)) as client:
        result = client.post("/api/lessons/discover", json={"example_id": "compare", "bounded_mode": "live"})
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["frontier_calls"] == sdk.responses.parse.await_count == 2
        assert value["metrics"]["citation_claims_checked"] == value["metrics"]["citation_claims_valid"] == 1
        assert value["metrics"]["support_claims_checked"] == 1
        assert value["metrics"]["support_claims_retained"] == (1 if support > 0.8 else 0)
        assert len(value["snapshot"]["run"]["result"]["claims"]) == (1 if support > 0.8 else 0)
        assert "not evaluated" in value["metrics"]["quality_scope"]
        assert sum(instance.system_one.await_count for instance in clients) == 3
        assert app_data_counts(client) == (0, 0)


def test_absent_discovery_events_leave_timing_quality_and_check_counts_unavailable():
    result = discovery_metrics([], "find")
    assert result.total_elapsed_ms is None
    assert result.intent_agreement.evaluated == 0
    assert result.citation_claims_checked is None and result.support_claims_retained is None


def test_failed_live_intent_preserves_real_retry_work_without_prepared_quality(tmp_path, monkeypatch):
    clients = mock_discovery_jev(monkeypatch, fail_intent=True)
    sdk = mock_sdk(monkeypatch, lambda **_: response(None))
    settings = live_settings(tmp_path).model_copy(update={"typesafe_api_key": SecretStr("fake-jev-key")})
    with TestClient(create_app(settings)) as client:
        result = client.post("/api/lessons/discover", json={"example_id": "find", "bounded_mode": "live"})
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["snapshot"]["run"]["status"] == "failed"
        assert value["metrics"]["total_elapsed_ms"] > 0
        assert value["metrics"]["intent_agreement"]["evaluated"] == 0
        assert value["metrics"]["citation_claims_checked"] is None
        assert sum(instance.system_one.await_count for instance in clients) == 2
        sdk.responses.parse.assert_not_called()
        assert "private provider response body" not in result.text
        assert app_data_counts(client) == (0, 0)


@pytest.mark.parametrize(
    "failure,expected_calls", [("timeout", 2), ("invalid_plan", 1), ("incomplete_answer", 2)]
)
def test_live_compare_records_failure_without_prepared_answer_or_secret_body(
    tmp_path, monkeypatch, failure, expected_calls
):
    async def parse(**kwargs):
        if failure == "timeout":
            raise TimeoutError("private provider credential body")
        if kwargs["text_format"] is QueryPlan:
            return response(
                {
                    "intent": "compare",
                    "tasks": [
                        {
                            "id": "invalid-task" if failure == "invalid_plan" else "task-1",
                            "phrase": "access policy",
                            "purpose": "Retrieve policy evidence",
                        }
                    ],
                    "explanation": "Find sources.",
                }
            )
        incomplete = response(None)
        incomplete.status = "incomplete"
        return incomplete

    sdk = mock_sdk(monkeypatch, parse)
    with TestClient(create_app(live_settings(tmp_path))) as client:
        result = client.post("/api/lessons/discover", json={"example_id": "compare"})
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["snapshot"]["run"]["status"] == "failed"
        assert value["snapshot"]["run"]["result"] is None
        assert value["frontier_calls"] == sdk.responses.parse.await_count == expected_calls
        assert any(event["type"] == "node_failed" for event in value["snapshot"]["events"])
        assert "private provider credential body" not in result.text
        assert app_data_counts(client) == (0, 0)
    assert sdk.close.await_count >= 2
