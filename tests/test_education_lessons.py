"""Lesson evidence is executed, content-bound, and isolated from operational data."""

import hashlib
import json

import pytest
from fastapi.testclient import TestClient

from doc_discovery.api import create_app
from doc_discovery.lessons import (
    CATALOGUE_PATH,
    COMPARE_QUERY,
    FOLDER,
    LessonCatalogue,
    LessonFrontier,
    LessonJev,
    PolicyExperimentRequest,
    evaluate_experiment,
    isolated_settings,
    lesson_catalogue,
    prepared_signal,
    record_lessons,
    scenario,
    write_catalogue,
)
from doc_discovery.policies import classification_route, mixed_purpose
from doc_discovery.schemas import ChoiceSignal, Document
from doc_discovery.settings import ROOT, Settings


def bounded_attempts(snapshot):
    return [
        event
        for event in snapshot.events
        if event.type == "node_started"
        and event.payload.get("node_name") in {"jev", "intent", "screen", "support"}
        and (event.instance_id != "support")
    ]


def frontier_attempts(snapshot):
    return [
        event
        for event in snapshot.events
        if event.type == "node_started"
        and event.payload.get("node_name") in {"interpret", "plan", "synthesize"}
        # A clear Find uses a code plan, explicitly labeled in its start event.
        and not (event.instance_id == "plan" and event.payload.get("label") == "One lexical search")
    ]


def test_recorded_catalogue_connects_branches_to_real_signals_and_publication():
    catalogue = lesson_catalogue()
    recorded = catalogue.classification
    assert recorded.snapshot.run.status == "succeeded"
    assert len(recorded.documents) == 5
    assert len(bounded_attempts(recorded.snapshot)) == 5
    assert len(frontier_attempts(recorded.snapshot)) == 2
    for doc in recorded.documents:
        assert doc.source_excerpt in doc.text
        assert doc.document.synthetic and doc.document.indexed
        event = next(
            event
            for event in recorded.snapshot.events
            if event.type == "decision" and event.instance_id == f"{doc.document.id}:jev"
        )
        decision = event.payload
        signal = ChoiceSignal.model_validate(decision["signal"])
        route = classification_route(signal, decision["threshold"], mixed_purpose(doc.text))
        assert route.name == decision["selected_route"]
        assert route.reason == decision["policy_reason"] == doc.expected_reason
        assert signal.provider == "fixture"
    assert catalogue.provenance.runtime == "executed"
    assert catalogue.provenance.providers == "simulated"


@pytest.mark.parametrize("threshold,route", [(0.9599, "accept"), (0.96, "accept"), (0.9601, "interpret")])
def test_experiment_threshold_applies_after_explicitly_disabling_the_text_guard(threshold, route):
    result = evaluate_experiment(PolicyExperimentRequest(example_id="ambiguous", threshold=threshold, guard_enabled=False))
    assert result.simulated.selected_route == route
    assert not result.simulated.reference_mismatch
    assert result.simulated.policy_violation == (route == "accept")
    assert result.original.selected_route == "interpret"
    assert result.original.reason == "mixed_purpose"
    assert result.provider_calls == 0 and result.no_write


@pytest.mark.parametrize("threshold", [0, .8, .96, 1])
def test_mixed_purpose_report_guard_precedes_every_confidence_threshold(threshold):
    result = evaluate_experiment(PolicyExperimentRequest(example_id="ambiguous", threshold=threshold))
    assert result.simulated.signal.choice == "report" and result.simulated.signal.confidence == .96
    assert result.simulated.reason == "mixed_purpose" and result.simulated.requires_review
    assert result.simulated.source_excerpt in scenario("ambiguous")["text"]


def test_guard_and_controlled_pair_are_actual_text_rules():
    proposed = scenario("proposed")
    finalized = scenario("finalized")
    assert mixed_purpose(proposed["text"])
    assert not mixed_purpose(finalized["text"])
    assert prepared_signal(proposed).confidence == prepared_signal(finalized).confidence == 0.96
    assert prepared_signal(proposed).choice == prepared_signal(finalized).choice == "contract"
    default = evaluate_experiment(PolicyExperimentRequest(threshold=0))
    assert default.simulated.reason == "mixed_purpose"
    off = evaluate_experiment(PolicyExperimentRequest(guard_enabled=False))
    assert off.simulated.selected_route == "accept"
    assert off.simulated.policy_violation and off.simulated.reference_mismatch
    assert off.simulated_coverage.accepted_policy_violations == 2
    final = evaluate_experiment(PolicyExperimentRequest(example_id="finalized"))
    assert final.simulated.reason == "accepted"
    assert not final.simulated.policy_violation and not final.simulated.reference_mismatch
    pair = evaluate_experiment(
        PolicyExperimentRequest(example_id="finalized", original_example_id="proposed")
    )
    assert pair.original.reason == "mixed_purpose" and pair.original.source == "recorded"
    assert pair.original.decision_id and pair.simulated.reason == "accepted"
    assert pair.original.signal.confidence == pair.simulated.signal.confidence
    assert pair.original.content_version != pair.simulated.content_version
    assert pair.changed_fields == ["document variant"]


def test_v3_retains_the_original_uncertainty_source_and_v2_recording():
    archived = LessonCatalogue.model_validate_json((FOLDER / "recordings/disaggregated-lessons-v2.json").read_text())
    original = next(doc for doc in archived.classification.documents if doc.example_id == "ambiguous")
    original_path = ROOT / "data/classification-examples/lesson-invoice-or-progress-report.md"
    assert hashlib.sha256(original_path.read_bytes()).hexdigest() == original.document.content_version
    assert original_path.read_text() == original.text
    assert not mixed_purpose(original.text)
    legacy_decision = next(event.payload for event in archived.classification.snapshot.events if event.type == "decision" and event.instance_id == f"{original.document.id}:jev")
    assert legacy_decision["signal"]["confidence"] == .58
    assert legacy_decision["policy_reason"] == "below_threshold"
    current = next(doc for doc in lesson_catalogue().classification.documents if doc.example_id == "ambiguous")
    assert current.document.id != original.document.id
    assert current.document.content_version != original.document.content_version
    assert current.document.filename == "mixed-purpose-report-v3.md"
    assert current.reference_category == "report" and current.expected_reason == "mixed_purpose"
    assert mixed_purpose(current.text)


def test_writing_new_catalogue_keeps_prior_events_immutable_and_refuses_conflicting_archive(tmp_path, monkeypatch):
    import doc_discovery.lessons as module

    old = (FOLDER / "recordings/disaggregated-lessons-v2.json").read_text()
    current = lesson_catalogue()
    path = tmp_path / "entry.json"
    path.write_text(old)
    monkeypatch.setattr(module, "CATALOGUE_PATH", path)
    monkeypatch.setattr(module, "FOLDER", tmp_path)
    write_catalogue(current)
    archive = tmp_path / "recordings/disaggregated-lessons-v2.json"
    assert archive.read_text() == old
    write_catalogue(current)
    assert archive.read_text() == old
    path.write_text(old)
    archive.write_text("conflicting recording")
    with pytest.raises(RuntimeError, match="Refusing to overwrite"):
        write_catalogue(current)
    assert path.read_text() == old


def test_catalogue_and_experiment_never_write_or_call_live_models(tmp_path, monkeypatch):
    async def forbidden(*args, **kwargs):
        raise AssertionError("A read-only lesson attempted a live provider call")

    from doc_discovery.providers.jev import JevProvider
    from doc_discovery.providers.openai import OpenAIProvider

    monkeypatch.setattr(JevProvider, "_request", forbidden)
    monkeypatch.setattr(OpenAIProvider, "_parse", forbidden)
    settings = Settings(
        _env_file=None,
        app_data_dir=tmp_path,
        app_mode="live",
        typesafe_api_key=None,
        openai_api_key=None,
        langsmith_api_key=None,
        langsmith_tracing=False,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        before = list(app.state.storage.db.iterdump())
        first = client.get("/api/lessons")
        assert first.status_code == 200
        assert first.json() == client.get("/api/lessons").json()
        for value in (0, 0.8, 1):
            response = client.post(
                "/api/lessons/experiment", json={"example_id": "proposed", "threshold": value}
            )
            assert response.status_code == 200
            assert response.json()["no_write"]
        assert list(app.state.storage.db.iterdump()) == before
        assert app.state.storage.runs() == []
        assert app.state.storage.documents().documents == []
        assert client.post("/api/lessons/experiment", json={"threshold": -1}).status_code == 422
        assert client.post("/api/lessons/experiment", json={"threshold": 1.01}).status_code == 422
        assert (
            client.post("/api/lessons/experiment", json={"example_id": "arbitrary-upload"}).status_code == 422
        )
        assert (
            client.post("/api/lessons/experiment", json={"text": "unbounded caller input"}).status_code == 422
        )


async def test_extra_fixture_adapter_requires_synthetic_matching_content_and_fixture_mode(tmp_path):
    from doc_discovery.policies import Context

    settings = isolated_settings(tmp_path)
    provider = LessonJev(settings)
    item = scenario("finalized")
    doc = Document(
        id="test", filename=item["filename"], content_version=item["content_version"], synthetic=True
    )
    context = Context(text=item["text"], refs=[], omitted=[])
    assert (await provider.classify(doc, context)).confidence == 0.96
    # The ordinary fixture heuristic sees an agreement email as ambiguous; the
    # special controlled signal applies only to the retained synthetic content.
    assert (await provider.classify(doc.model_copy(update={"synthetic": False}), context)).confidence == 0.55
    assert (
        await provider.classify(doc.model_copy(update={"content_version": "changed"}), context)
    ).confidence == 0.55
    await provider.close()
    live = settings.model_copy(update={"app_mode": "live"})
    with pytest.raises(ValueError, match="cannot run in live"):
        LessonJev(live)
    with pytest.raises(ValueError, match="cannot run in live"):
        LessonFrontier(live)


def test_discovery_deliberately_allocates_generation_and_validates_citations():
    discovery = lesson_catalogue().discovery
    assert len(frontier_attempts(discovery.find)) == 0
    assert discovery.find.run.result["intent"] == "find"
    assert discovery.find.run.result["passages"] and not discovery.find.run.result["claims"]
    assert len(frontier_attempts(discovery.compare)) == 2  # Planning and composition.
    assert discovery.compare.run.request["query"] == COMPARE_QUERY
    assert len(discovery.compare.run.result["claims"]) == 2
    source = {passage.id: passage for doc in discovery.documents for passage in doc.passages}
    for claim in discovery.compare.run.result["claims"]:
        for citation in claim["citations"]:
            assert citation["quote"] in source[citation["passage_id"]].text
    assert not discovery.empty.run.result["passages"]
    assert not discovery.empty.run.result["claims"]
    assert discovery.unsupported.run.result["intent"] == "unsupported"
    assert len(frontier_attempts(discovery.unsupported)) == 0


def test_safeguards_record_enforcement_separately_from_run_success():
    guards = {item.id: item for item in lesson_catalogue().safeguards}
    assert all(item.observed["passed"] for item in guards.values())
    assert guards["guard"].snapshot.run.status == "awaiting_review"
    assert guards["invalid-proposal"].snapshot.run.status == "partially_succeeded"
    assert guards["timeout"].snapshot.run.status == "partially_succeeded"
    assert guards["timeout"].observed["frontier_attempts"] == 2
    assert guards["invalid-proposal"].observed["frontier_attempts"] == 1
    assert guards["invalid-citation"].observed["claims_removed"] == 1
    rejected = guards["invalid-citation"].snapshot
    assert "999 days" not in json.dumps(rejected.run.result["claims"])
    assert "999 days" in json.dumps(
        [event.payload for event in rejected.events if event.instance_id == "synthesize"]
    )


async def test_offline_recorder_executes_current_graph_and_keeps_catalogue_parseable():
    recorded = await record_lessons()
    assert recorded.classification.snapshot.run.status == "succeeded"
    assert len(frontier_attempts(recorded.classification.snapshot)) == 2
    assert all(item.observed["passed"] for item in recorded.safeguards)
    assert LessonCatalogue.model_validate_json(CATALOGUE_PATH.read_text()).version == recorded.version
