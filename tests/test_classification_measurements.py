"""Paired live measurements preserve fairness, scope, failures, and reference denominators."""

import asyncio
import hashlib
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from test_live_lessons import app_data_counts, live_settings, mock_sdk, response

from doc_discovery.api import create_app
from doc_discovery.ingestion import ingest
from doc_discovery.lessons import scenario
from doc_discovery.policies import CATEGORY_RUBRIC, TAXONOMY, classification_route, mixed_purpose
from doc_discovery.providers.openai import BoundedClassification, ClassificationProposal
from doc_discovery.schemas import ChoiceSignal, ProposalSignal
from doc_discovery.settings import ROOT


def settings(path):
    return live_settings(path).model_copy(update={"typesafe_api_key": SecretStr("fictional-jev-key")})


def body(example="clear"):
    return {"example_id": example, "content_version": scenario(example)["content_version"]}


def bounded(choice="invoice", confidence=0.97):
    probabilities = {category: 0.006666666666666667 for category in TAXONOMY}
    probabilities[choice] = 0.96
    return {"choice": choice, "confidence": confidence, "probabilities": probabilities}


def jev_response(value):
    return SimpleNamespace(
        model="jev-1.13.0",
        usage=SimpleNamespace(model_dump=lambda **_: {"input_tokens": 100}),
        raw_http_response=SimpleNamespace(headers={"x-request-id": "req-measured-jev"}),
        choices={"category": SimpleNamespace(**value)},
    )


def mock_jev(monkeypatch, operation):
    client = SimpleNamespace(system_one=AsyncMock(side_effect=operation), aclose=AsyncMock())
    monkeypatch.setattr("doc_discovery.providers.jev.AsyncTypeSafeClient", lambda **_: client)
    return client


def test_direct_pair_runs_from_shared_start_with_equal_context_and_no_operational_writes(
    tmp_path, monkeypatch
):
    entered = 0
    both_started = asyncio.Event()

    async def overlap():
        nonlocal entered
        entered += 1
        if entered == 2:
            both_started.set()
        await asyncio.wait_for(both_started.wait(), 3)
        await asyncio.sleep(0.02)

    async def jev_call(**kwargs):
        await overlap()
        return jev_response(bounded())

    async def frontier_call(**kwargs):
        assert kwargs["text_format"] is BoundedClassification
        await overlap()
        return response(bounded())

    jev, sdk = mock_jev(monkeypatch, jev_call), mock_sdk(monkeypatch, frontier_call)
    app = create_app(settings(tmp_path))
    with TestClient(app) as client:
        before = app.state.storage.db.total_changes
        result = client.post("/api/lessons/compare-classification", json=body())
        assert result.status_code == 200, result.text
        value = result.json()
        first, second = value["strategies"]
        assert first["id"] == "system1" and second["id"] == "frontier_first"
        assert first["bounded_attempts"] == 1 and first["frontier_attempts"] == 0
        assert second["bounded_attempts"] == 0 and second["frontier_attempts"] == 1
        assert jev.system_one.await_count == sdk.responses.parse.await_count == 1
        for strategy in value["strategies"]:
            assert strategy["status"] == "completed" and strategy["output_kind"] == "accepted_category"
            assert strategy["requires_review"] is False
            assert strategy["output_agreement"]["matching"] == strategy["output_agreement"]["evaluated"] == 1
            assert strategy["elapsed_ms"] >= strategy["provider_work_ms"] > 0
            assert strategy["finished_after_ms"] <= value["total_elapsed_ms"]
            assert [component["id"] for component in strategy["components"]] == ["judge", "policy"]
        assert first["components"][0]["provider"]["provider"] == "jev"
        assert second["components"][0]["provider"]["provider"] == "openai"
        assert value["total_elapsed_ms"] < sum(strategy["elapsed_ms"] for strategy in value["strategies"])
        assert (
            value["provenance"]["sample_count"] == 1
            and "not calibrated" in value["provenance"]["confidence_note"]
        )
        assert value["provenance"]["automatic_retries"] == 0
        assert not value["published"] and app.state.storage.db.total_changes == before
        assert app_data_counts(client) == (0, 0)
        jev_state = jev.system_one.call_args.kwargs["state"]
        frontier_state = json.loads(sdk.responses.parse.call_args.kwargs["input"])
        assert frontier_state == jev_state
        assert CATEGORY_RUBRIC in sdk.responses.parse.call_args.kwargs["instructions"]
    jev.aclose.assert_awaited()


def test_guard_imposes_the_same_extra_interpretation_and_review_on_both_strategies(tmp_path, monkeypatch):
    jev = mock_jev(monkeypatch, lambda **_: jev_response(bounded("contract", 0.98)))

    async def frontier_call(**kwargs):
        if kwargs["text_format"] is BoundedClassification:
            return response(bounded("correspondence", 0.99))
        assert kwargs["text_format"] is ClassificationProposal
        return response(
            {
                "category": "correspondence",
                "explanation": "The sender proposes terms and asks for confirmation.",
            }
        )

    sdk = mock_sdk(monkeypatch, frontier_call)
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post("/api/lessons/compare-classification", json=body("proposed"))
        assert result.status_code == 200, result.text
        first, second = result.json()["strategies"]
        assert first["frontier_attempts"] == 1 and second["frontier_attempts"] == 2
        assert sdk.responses.parse.await_count == 3 and jev.system_one.await_count == 1
        for strategy in (first, second):
            assert strategy["policy"]["reason"] == "mixed_purpose"
            assert strategy["requires_review"] and strategy["output_kind"] == "proposal"
            assert strategy["output_agreement"]["matching"] == 1
        assert first["judgment_agreement"]["matching"] == 0
        assert second["judgment_agreement"]["matching"] == 1
        assert app_data_counts(client) == (0, 0)


def test_frontier_first_can_finish_without_the_exception_needed_by_system1(tmp_path, monkeypatch):
    mock_jev(monkeypatch, lambda **_: jev_response(bounded("invoice", 0.58)))
    sdk = mock_sdk(
        monkeypatch,
        lambda **kwargs: response(
            bounded("invoice", 0.95)
            if kwargs["text_format"] is BoundedClassification
            else {"category": "invoice", "explanation": "An itemized invoice with a payment amount."}
        ),
    )
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post("/api/lessons/compare-classification", json=body("clear"))
        assert result.status_code == 200, result.text
        first, second = result.json()["strategies"]
        assert first["policy"]["reason"] == "below_threshold" and first["output_kind"] == "proposal"
        assert second["policy"]["reason"] == "accepted" and second["output_kind"] == "accepted_category"
        assert first["frontier_attempts"] == second["frontier_attempts"] == 1
        assert sdk.responses.parse.await_count == 2
        assert first["judgment_agreement"]["matching"] == 1 and first["output_agreement"]["matching"] == 1
        assert second["output_agreement"]["matching"] == 1


@pytest.mark.parametrize("failure", ["jev", "interpret", "invalid_jev", "invalid_baseline"])
def test_partial_failure_retains_observed_work_and_does_not_fabricate_quality_denominators(
    tmp_path, monkeypatch, failure
):
    async def jev_call(**kwargs):
        if failure == "jev":
            raise TimeoutError("private provider detail")
        value = bounded("invoice", 0.4 if failure == "interpret" else 0.97)
        if failure == "invalid_jev":
            value = {"choice": "invented", "confidence": 0.9, "probabilities": {"invented": 1}}
        return jev_response(value)

    async def frontier_call(**kwargs):
        if kwargs["text_format"] is ClassificationProposal:
            raise TimeoutError("private provider detail")
        value = bounded()
        if failure == "invalid_baseline":
            value["probabilities"]["invoice"] = 0.1
        return response(value)

    jev, sdk = mock_jev(monkeypatch, jev_call), mock_sdk(monkeypatch, frontier_call)
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post("/api/lessons/compare-classification", json=body())
        assert result.status_code == 200, result.text
        first, second = result.json()["strategies"]
        failed = second if failure == "invalid_baseline" else first
        other = first if failed is second else second
        assert failed["status"] == "failed" and other["status"] == "completed"
        assert failed["output_kind"] == "unavailable" and failed["output_category"] is None
        assert failed["output_agreement"]["matching"] == failed["output_agreement"]["evaluated"] == 0
        assert failed["judgment_agreement"]["evaluated"] == (1 if failure == "interpret" else 0)
        assert failed["provider_work_ms"] > 0 and failed["components"][-1]["status"] == "failed"
        assert jev.system_one.await_count == 1
        assert sdk.responses.parse.await_count == (2 if failure == "interpret" else 1)
        assert "private provider detail" not in result.text
        assert app_data_counts(client) == (0, 0)


@pytest.mark.parametrize("endpoint", ["compare-classification", "classify/live"])
@pytest.mark.parametrize("missing", ["typesafe_api_key", "openai_api_key"])
def test_missing_either_provider_prevents_starting_paid_classification(tmp_path, monkeypatch, missing, endpoint):
    jev = mock_jev(monkeypatch, lambda **_: jev_response(bounded()))
    sdk = mock_sdk(monkeypatch, lambda **_: response(bounded()))
    with TestClient(create_app(settings(tmp_path).model_copy(update={missing: None}))) as client:
        result = client.post(f"/api/lessons/{endpoint}", json=body())
        assert result.status_code == 503
        jev.system_one.assert_not_called()
        sdk.responses.parse.assert_not_called()


@pytest.mark.parametrize("endpoint", ["compare-classification", "classify/live"])
def test_content_binding_origin_and_extra_fields_are_rejected_without_requests(tmp_path, monkeypatch, endpoint):
    jev = mock_jev(monkeypatch, lambda **_: jev_response(bounded()))
    sdk = mock_sdk(monkeypatch, lambda **_: response(bounded()))
    with TestClient(create_app(settings(tmp_path))) as client:
        assert (
            client.post(
                f"/api/lessons/{endpoint}", json=body() | {"content_version": "0" * 64}
            ).status_code
            == 409
        )
        assert (
            client.post(
                f"/api/lessons/{endpoint}", json=body() | {"text": "arbitrary source"}
            ).status_code
            == 422
        )
        assert (
            client.post(
                f"/api/lessons/{endpoint}",
                json=body(),
                headers={"Origin": "https://attacker.example"},
            ).status_code
            == 403
        )
        jev.system_one.assert_not_called()
        sdk.responses.parse.assert_not_called()


def test_single_capacity_records_queue_time_separately_from_provider_work(tmp_path, monkeypatch):
    async def jev_call(**kwargs):
        await asyncio.sleep(0.02)
        return jev_response(bounded())

    jev = mock_jev(monkeypatch, jev_call)
    sdk = mock_sdk(monkeypatch, lambda **_: response(bounded()))
    with TestClient(create_app(settings(tmp_path).model_copy(update={"max_concurrency": 1}))) as client:
        result = client.post("/api/lessons/compare-classification", json=body())
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["provenance"]["max_in_flight_provider_requests"] == 1
        second = value["strategies"][1]
        assert second["components"][0]["queue_elapsed_ms"] >= 15
        assert second["elapsed_ms"] > second["provider_work_ms"]
        assert jev.system_one.await_count == sdk.responses.parse.await_count == 1


@pytest.mark.parametrize("example", ["clear", "policy", "ambiguous", "proposed", "finalized"])
@pytest.mark.parametrize("endpoint", ["compare-classification", "classify/live"])
def test_every_content_bound_example_uses_live_results_and_its_own_reference(tmp_path, monkeypatch, example, endpoint):
    item = scenario(example)
    category = item["reference_category"]
    mock_jev(monkeypatch, lambda **_: jev_response(bounded(category)))
    mock_sdk(
        monkeypatch,
        lambda **kwargs: response(
            bounded(category)
            if kwargs["text_format"] is BoundedClassification
            else {"category": category, "explanation": "Measured mock result for this source."}
        ),
    )
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post(f"/api/lessons/{endpoint}", json=body(example))
        assert result.status_code == 200, result.text
        value = result.json()
        assert value["content_version"] == item["content_version"]
        assert value["reference_category"] == category
        strategies = value["strategies"] if endpoint == "compare-classification" else [value["strategy"]]
        assert all(strategy["output_agreement"]["matching"] == 1 for strategy in strategies)


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", ["compare-classification", "classify/live"])
async def test_cancelling_stops_calls_closes_client_and_releases_admission(tmp_path, monkeypatch, endpoint):
    started = 0
    stopped = 0
    both_started = asyncio.Event()
    expected_calls = 2 if endpoint == "compare-classification" else 1

    async def held_call(**kwargs):
        nonlocal started, stopped
        started += 1
        if started == expected_calls:
            both_started.set()
        try:
            await asyncio.Event().wait()
        finally:
            stopped += 1

    jev = mock_jev(monkeypatch, held_call)
    mock_sdk(monkeypatch, held_call)
    app = create_app(settings(tmp_path))
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            before = app.state.storage.db.total_changes
            task = asyncio.create_task(client.post(f"/api/lessons/{endpoint}", json=body()))
            await asyncio.wait_for(both_started.wait(), 3)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert stopped == expected_calls
            assert not app.state.lesson_interpret_slots.locked()
            jev.aclose.assert_awaited()
            assert app.state.storage.db.total_changes == before


def test_single_workflow_measures_live_judgment_and_does_not_call_a_frontier_baseline(tmp_path, monkeypatch):
    async def jev_call(**kwargs):
        await asyncio.sleep(0.02)
        # A different answer from the prepared signal proves the response is
        # connected to live adapter output rather than the catalogue recording.
        return jev_response(bounded("policy", 0.93))

    jev = mock_jev(monkeypatch, jev_call)
    sdk = mock_sdk(monkeypatch, lambda **_: response(None))
    app = create_app(settings(tmp_path))
    with TestClient(app) as client:
        before = app.state.storage.db.total_changes
        client.get("/api/lessons")
        jev.system_one.assert_not_called()
        sdk.responses.parse.assert_not_called()
        result = client.post("/api/lessons/classify/live", json=body())
        assert result.status_code == 200, result.text
        value = result.json()
        strategy = value["strategy"]
        assert strategy["id"] == "system1" and strategy["status"] == "completed"
        assert strategy["judgment"]["provider"] == "jev"
        assert strategy["judgment"]["returned_model"] == "jev-1.13.0"
        assert strategy["judgment"]["request_id"] == "req-measured-jev"
        assert strategy["judgment"]["elapsed_ms"] >= 15
        assert strategy["policy"]["selected_route"] == "accept"
        assert strategy["output_category"] == "policy" and strategy["output_kind"] == "accepted_category"
        assert strategy["output_agreement"]["matching"] == 0
        assert strategy["output_agreement"]["evaluated"] == 1
        assert strategy["bounded_attempts"] == 1 and strategy["frontier_attempts"] == 0
        assert value["total_elapsed_ms"] >= strategy["elapsed_ms"] >= strategy["judgment"]["elapsed_ms"]
        assert value["provenance"]["bounded_provider"] == "live Jev"
        assert value["provenance"]["publication"] == "not performed"
        assert not value["published"] and value["operational_writes"] == 0
        assert app.state.storage.db.total_changes == before and app_data_counts(client) == (0, 0)
        jev.system_one.assert_awaited_once()
        sdk.responses.parse.assert_not_called()
    jev.aclose.assert_awaited()


def test_live_report_at_full_confidence_still_follows_the_actual_text_guard(tmp_path, monkeypatch):
    jev = mock_jev(monkeypatch, lambda **_: jev_response(bounded("report", 1)))
    sdk = mock_sdk(monkeypatch, lambda **_: response({"category": "report", "explanation": "The progress report includes proposed milestone terms requiring approval."}))
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post("/api/lessons/classify/live", json=body("ambiguous"))
        assert result.status_code == 200, result.text
        strategy = result.json()["strategy"]
        assert strategy["judgment"]["choice"] == "report" and strategy["judgment"]["confidence"] == 1
        assert strategy["judgment"]["provider"] == "jev"
        assert strategy["policy"]["reason"] == "mixed_purpose"
        assert strategy["output_category"] == "report" and strategy["output_kind"] == "proposal"
        assert strategy["requires_review"] and not result.json()["published"]
        jev.system_one.assert_awaited_once()
        sdk.responses.parse.assert_awaited_once()
        assert strategy["bounded_attempts"] == strategy["frontier_attempts"] == 1


def test_the_original_plain_progress_report_can_validly_take_the_direct_route():
    text = (ROOT / "data/classification-examples/lesson-invoice-or-progress-report.md").read_text()
    signal = ChoiceSignal(provider="jev", request_id="test-real-contract", configured_model="jev-1.13.0", returned_model="jev-1.13.0", elapsed_ms=1, **bounded("report", 1))
    assert not mixed_purpose(text)
    assert classification_route(signal, .8, mixed_purpose(text)).name == "accept"


def test_modified_report_content_hash_cannot_inherit_the_prepared_source(tmp_path, monkeypatch):
    jev = mock_jev(monkeypatch, lambda **_: jev_response(bounded("report", 1)))
    sdk = mock_sdk(monkeypatch, lambda **_: response(None))
    changed_hash = hashlib.sha256((scenario("ambiguous")["text"] + "Edited source.").encode()).hexdigest()
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post("/api/lessons/classify/live", json=body("ambiguous") | {"content_version": changed_hash})
        assert result.status_code == 409
        jev.system_one.assert_not_called()
        sdk.responses.parse.assert_not_called()


async def test_ordinary_nonsynthetic_upload_uses_the_same_mixed_purpose_guard(tmp_path):
    from test_workflows import harness, run

    item = scenario("ambiguous")
    async with harness(tmp_path) as (configuration, storage, engine):
        doc = ingest(storage, configuration, "uploaded-progress-email.md", item["text"].encode())
        assert not doc.synthetic
        signal = ChoiceSignal(provider="jev", request_id="test-real-contract", configured_model="jev-1.13.0", returned_model="jev-1.13.0", elapsed_ms=1, **bounded("report", 1))
        engine.jev.classify = AsyncMock(return_value=signal)
        engine.openai.interpret = AsyncMock(return_value=ProposalSignal(provider="openai", request_id="test-real-proposal", configured_model="gpt-5.5", returned_model="gpt-5.5", elapsed_ms=1, category="report", explanation="Progress report with terms awaiting acceptance."))
        job = run(storage, configuration, "classification", {"document_ids": [doc.id]})
        await engine.execute(job.id)
        recorded = storage.get_run(job.id)
        assert recorded.status == "awaiting_review" and not storage.get_document(doc.id).indexed
        decision = next(event.payload for event in storage.events(job.id) if event.type == "decision")
        assert decision["signal"]["confidence"] == 1 and decision["policy_reason"] == "mixed_purpose"
        engine.openai.interpret.assert_awaited_once()


@pytest.mark.parametrize("example,confidence,reason", [("clear", 0.4, "below_threshold"), ("proposed", 0.99, "mixed_purpose")])
def test_single_workflow_interprets_only_the_actual_policy_exception(tmp_path, monkeypatch, example, confidence, reason):
    jev = mock_jev(monkeypatch, lambda **_: jev_response(bounded("invoice", confidence)))
    sdk = mock_sdk(monkeypatch, lambda **_: response({"category": "correspondence", "explanation": "Actual structured proposal."}))
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post("/api/lessons/classify/live", json=body(example))
        assert result.status_code == 200, result.text
        strategy = result.json()["strategy"]
        assert strategy["policy"]["reason"] == reason
        assert strategy["bounded_attempts"] == strategy["frontier_attempts"] == 1
        assert strategy["output_kind"] == "proposal" and strategy["requires_review"]
        assert [component["id"] for component in strategy["components"]] == ["judge", "policy", "interpret"]
        assert strategy["interpretation"]["provider"] == "openai"
        assert strategy["interpretation"]["configured_model"] == "gpt-5.5"
        assert sdk.responses.parse.call_args.kwargs["text_format"] is ClassificationProposal
        jev.system_one.assert_awaited_once()
        sdk.responses.parse.assert_awaited_once()
        assert app_data_counts(client) == (0, 0)


@pytest.mark.parametrize("failed_provider", ["jev", "openai"])
def test_single_workflow_keeps_partial_evidence_without_fixture_fallback(tmp_path, monkeypatch, failed_provider):
    async def jev_call(**kwargs):
        if failed_provider == "jev":
            raise TimeoutError("private credential response")
        return jev_response(bounded("invoice", 0.4))

    async def frontier_call(**kwargs):
        raise TimeoutError("private credential response")

    jev = mock_jev(monkeypatch, jev_call)
    sdk = mock_sdk(monkeypatch, frontier_call)
    with TestClient(create_app(settings(tmp_path))) as client:
        result = client.post("/api/lessons/classify/live", json=body())
        assert result.status_code == 200, result.text
        strategy = result.json()["strategy"]
        assert strategy["status"] == "failed" and strategy["output_kind"] == "unavailable"
        assert strategy["output_agreement"]["evaluated"] == 0
        assert strategy["judgment_agreement"]["evaluated"] == (1 if failed_provider == "openai" else 0)
        assert strategy["frontier_attempts"] == (1 if failed_provider == "openai" else 0)
        assert strategy["components"][-1]["status"] == "failed" and strategy["provider_work_ms"] > 0
        assert "private credential response" not in result.text
        jev.system_one.assert_awaited_once()
        assert sdk.responses.parse.await_count == (1 if failed_provider == "openai" else 0)
        assert app_data_counts(client) == (0, 0)


@pytest.mark.asyncio
async def test_single_classification_holds_shared_lesson_admission_until_finished(tmp_path, monkeypatch):
    started, release = asyncio.Event(), asyncio.Event()

    async def held_call(**kwargs):
        started.set()
        await release.wait()
        return jev_response(bounded())

    jev = mock_jev(monkeypatch, held_call)
    sdk = mock_sdk(monkeypatch, lambda **_: response(None))
    app = create_app(settings(tmp_path))
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            task = asyncio.create_task(client.post("/api/lessons/classify/live", json=body()))
            try:
                await asyncio.wait_for(started.wait(), 3)
                rejected = await client.post("/api/lessons/compare-classification", json=body())
                assert rejected.status_code == 429
                jev.system_one.assert_awaited_once()
                sdk.responses.parse.assert_not_called()
            finally:
                release.set()
                result = await task
            assert result.status_code == 200
            assert not app.state.lesson_interpret_slots.locked()
