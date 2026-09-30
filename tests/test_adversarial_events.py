"""Adversarial execution races: recorded corpus scope and acceptance must hold at publication."""

from datetime import date

import pytest
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from doc_discovery.events import Events
from doc_discovery.ingestion import ingest
from doc_discovery.settings import Settings
from doc_discovery.storage import Storage
from doc_discovery.workflows.engine import WorkflowEngine


@pytest.fixture
async def services(tmp_path):
    settings = Settings(
        _env_file=None,
        app_data_dir=tmp_path,
        app_mode="test-fixture",
        langsmith_tracing=False,
        typesafe_api_key=None,
        openai_api_key=None,
        langsmith_api_key=None,
    )
    storage = Storage(tmp_path)
    async with AsyncSqliteSaver.from_conn_string(str(tmp_path / "checkpoints.db")) as saver:
        await saver.setup()
        engine = WorkflowEngine(settings, storage, Events(storage), saver)
        try:
            yield settings, storage, engine
        finally:
            await engine.close()
    storage.close()


def accepted(settings, storage, name="invoice.txt", content=b"Atlas invoice total USD 100."):
    doc = ingest(storage, settings, name, content, document_date=date(2026, 3, 1))
    storage.update_document(doc.id, category="invoice", category_provenance="human")
    storage.index_document(doc.id)
    return storage.get_document(doc.id)


def discovery(settings, storage, query="Atlas", filters=None):
    return storage.create_run(
        "discovery", "test-fixture", {"query": query, "filters": filters or {}}, settings.public_config()
    )[0]


async def test_new_documents_cannot_enter_a_recorded_scope_after_planning(services):
    settings, storage, engine = services
    original_doc = accepted(settings, storage)
    original_search = storage.search
    created = []

    def concurrent_import(*args, **kwargs):
        if not created:
            created.append(
                accepted(settings, storage, "new-invoice.txt", b"Atlas Atlas Atlas invoice USD 200.")
            )
        return original_search(*args, **kwargs)

    storage.search = concurrent_import
    run = discovery(settings, storage)
    await engine.execute(run.id)
    result = storage.get_run(run.id).result
    assert {p["document_id"] for p in result["passages"]} == {original_doc.id}
    assert {d["document_id"] for d in result["provenance"]["scope"]["accepted_documents"]} == {
        original_doc.id
    }


@pytest.mark.parametrize(
    "changed",
    [
        {"indexed": False, "category_provenance": "proposal"},
        {"category": "other"},
        {"document_date": None, "date_provenance": "unknown"},
    ],
)
async def test_evidence_changed_during_screening_is_withheld(services, changed):
    settings, storage, engine = services
    doc = accepted(settings, storage)
    original_relevance = engine.jev.relevance

    async def concurrent_metadata_change(*args):
        signals = await original_relevance(*args)
        storage.update_document(doc.id, **changed)
        return signals

    engine.jev.relevance = concurrent_metadata_change
    run = discovery(
        settings,
        storage,
        filters={"categories": ["invoice"], "date_from": "2026-01-01", "date_to": "2026-12-31"},
    )
    await engine.execute(run.id)
    result = storage.get_run(run.id).result
    assert result["passages"] == []
    assert result["claims"] == []
    assert result["partial"]
    assert "changed" in result["message"].lower() or "accepted" in result["message"].lower()


async def test_late_exclusion_after_graph_completion_cannot_publish_stale_claims(services):
    settings, storage, engine = services
    doc = accepted(
        settings,
        storage,
        "agreement.md",
        b"Atlas service agreement. Termination: Either party may terminate on 30 days written notice.",
    )
    original_finish = engine.telemetry.finish

    async def concurrent_exclusion(run_id, status):
        await original_finish(run_id, status)
        storage.update_document(doc.id, indexed=False, category_provenance="excluded")

    engine.telemetry.finish = concurrent_exclusion
    run = discovery(settings, storage, "Compare Atlas termination notice periods.")
    await engine.execute(run.id)
    final = storage.get_run(run.id)
    assert final.result["passages"] == []
    assert final.result["claims"] == []
    terminal = [event for event in storage.events(run.id) if event.type == "run_completed"][-1]
    assert terminal.payload["result"]["claims"] == []
    assert final.status in {"failed", "partially_succeeded"}


async def test_stage_latency_and_intermediate_formation_are_recorded_and_replay_stable(services):
    settings, storage, engine = services
    accepted(
        settings,
        storage,
        "agreement.md",
        b"Atlas service agreement. Termination: Either party may terminate on 30 days written notice.",
    )
    run = discovery(settings, storage, "Compare Atlas termination notice periods.")
    await engine.execute(run.id)
    first = storage.events(run.id)
    assert storage.get_run(run.id).status == "succeeded"
    completed = {event.instance_id: event for event in first if event.type == "node_completed"}
    for stage in [
        "intent",
        "plan",
        "task-1:retrieve",
        "task-1:screen",
        "join",
        "synthesize",
        "citations",
        "support",
        "done",
    ]:
        assert completed[stage].payload.get("elapsed_ms") is not None, stage
        assert completed[stage].payload["elapsed_ms"] >= 0, stage
    assert len(completed["plan"].payload["query_plan"]["tasks"]) == 2
    draft = completed["synthesize"].payload["draft_claims"]
    assert draft and completed["citations"].payload["input_count"] == len(draft)
    assert completed["support"].payload["output_count"] == len(storage.get_run(run.id).result["claims"])
    assert completed["join"].payload["input_count"] > completed["join"].payload["output_count"]
    assert completed["join"].payload["removed_count"] > 0
    assert completed["task-1:retrieve"].payload["passage_ids"]
    decisions = [event for event in first if event.type == "decision"]
    assert decisions and all(event.payload["policy_elapsed_ms"] >= 0 for event in decisions)
    assert completed["intent"].payload["queue_wait_ms"] >= 0
    assert [event.model_dump() for event in storage.events(run.id)] == [event.model_dump() for event in first]


async def test_review_resume_keeps_measured_worker_duration_outside_human_pause(services):
    settings, storage, engine = services
    doc = ingest(
        storage,
        settings,
        "ambiguous.md",
        b"From: Alex\nSubject: proposed agreement\nPlease confirm the unsigned draft agreement.",
    )
    run = storage.create_run(
        "classification", "test-fixture", {"document_ids": [doc.id]}, settings.public_config()
    )[0]
    await engine.execute(run.id)
    paused = storage.get_run(run.id)
    worker_events = [
        event
        for event in storage.events(run.id)
        if event.instance_id == f"worker:{doc.id}" and event.payload.get("elapsed_ms") is not None
    ]
    observed = worker_events[-1].payload["elapsed_ms"]
    review = paused.review
    await engine.execute(
        run.id,
        resume={
            "interrupt_id": review.interrupt_id,
            "revision": review.revision,
            "decisions": [{"document_id": doc.id, "action": "correct", "category": "correspondence"}],
        },
    )
    finished = [
        event
        for event in storage.events(run.id)
        if event.instance_id == f"worker:{doc.id}" and event.type == "node_completed"
    ][-1]
    assert finished.payload["elapsed_ms"] == observed
