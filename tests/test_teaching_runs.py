from concurrent.futures import ThreadPoolExecutor
from threading import Event as ThreadEvent

import pytest
from fastapi.testclient import TestClient
from test_api import configured, settle

from doc_discovery.api import create_app
from doc_discovery.ingestion import ingest
from doc_discovery.schemas import CLASSIFICATION_GRAPH_VERSION, SearchFilters
from doc_discovery.storage import Storage, data_lease
from doc_discovery.teaching_runs import seed_teaching_runs


async def test_completed_teaching_runs_are_replayable_searchable_and_idempotent(tmp_path):
    # An open backend's execution lease must not be taken over by the fixture recorder.
    with data_lease(tmp_path):
        result = await seed_teaching_runs(tmp_path)
    store = Storage(tmp_path)
    try:
        assert len(result["created_run_ids"]) == 3
        for run_id, expected in zip(result["run_ids"], [(2, 0), (2, 1), (4, 2)], strict=True):
            run = store.get_run(run_id)
            events = store.events(run_id)
            assert run.status == "succeeded" and run.mode == "test-fixture"
            assert run.graph_version == CLASSIFICATION_GRAPH_VERSION
            assert run.request["teaching_pack"] == "classification-teaching-v2"
            assert run.request["simulated_review"] == (expected[1] > 0)
            assert run.result["indexed_count"] == expected[0]
            assert [event.sequence for event in events] == list(range(1, run.last_event_sequence + 1))
            assert events[-1].type == "run_completed"
            calls = [
                event
                for event in events
                if event.type == "node_started" and event.payload.get("state") == "running"
            ]
            assert sum(event.instance_id.endswith(":jev") for event in calls) == expected[0]
            assert sum(event.instance_id.endswith(":interpret") for event in calls) == expected[1]
            assert all(
                event.payload["signal"]["provider"] == "fixture"
                for event in events
                if event.type == "decision"
            )
            committed = [event.payload["publication"] for event in events if event.payload.get("publication")]
            assert len(committed) == expected[0]
            assert all(
                store.publication(run_id, item["document_id"]).model_dump(mode="json") == item
                for item in committed
            )
        documents = store.documents().documents
        assert len(documents) == 4
        for document in documents:
            assert document.synthetic and document.indexed and document.extraction_status == "readable"
            assert store.search(
                " ".join(store.read_text(document.id).split()[:15]),
                SearchFilters(),
                allowed_document_ids=[document.id],
            )
            assert (tmp_path / "files" / f"{document.id}.md").exists()
        repeated = await seed_teaching_runs(tmp_path)
        assert repeated["run_ids"] == result["run_ids"]
        assert repeated["created_run_ids"] == []
        assert len(store.runs()) == 3 and len(store.documents().documents) == 4
    finally:
        store.close()


async def test_new_teaching_version_preserves_existing_legacy_recordings(tmp_path):
    store = Storage(tmp_path)
    try:
        historical, _ = store.create_run(
            "classification",
            "test-fixture",
            {"document_ids": [], "teaching_pack": "classification-teaching-v1"},
            {},
            idempotency_key="classification-teaching-v1:clear",
        )
        store.update_run(
            historical.id,
            graph_version="atlas-v1",
            status="succeeded",
            result={"outcomes": {}, "indexed_count": 0},
        )
        store.append_event(
            historical.id,
            "run_completed",
            "run",
            {"status": "succeeded", "result": {"outcomes": {}, "indexed_count": 0}},
        )
        before = store.snapshot(historical.id)
        seeded = await seed_teaching_runs(tmp_path)
        assert len(seeded["created_run_ids"]) == 3
        assert store.snapshot(historical.id) == before
        assert historical.id not in seeded["run_ids"]
    finally:
        store.close()


def test_cleanup_hides_terminal_problems_but_preserves_sources_history_and_active_inputs(tmp_path):
    settings = configured(tmp_path)
    app = create_app(settings)
    with TestClient(app) as client:
        store = app.state.storage
        documents = {}
        for state in [
            "failed",
            "partially_succeeded",
            "succeeded",
            "awaiting_review",
            "interrupted",
            "running",
            "queued",
        ]:
            document = ingest(store, settings, f"{state}.txt", b"Invoice: total due $750.")
            documents[state] = document
            run, _ = store.create_run(
                "classification", "test-fixture", {"document_ids": [document.id]}, settings.public_config()
            )
            store.update_run(run.id, status=state, result={"outcomes": {document.id: {"status": "failed"}}})
        empty = ingest(store, settings, "empty.txt", b"")
        never_run = ingest(store, settings, "fresh.txt", b"Invoice: total due $400.")
        indexed = documents["succeeded"]
        store.update_document(indexed.id, category="invoice", category_provenance="jev")
        store.index_document(indexed.id)
        before_runs = {run.id: store.snapshot(run.id) for run in store.runs()}
        removed = client.post("/api/documents/cleanup").json()["archived_document_ids"]
        assert set(removed) == {empty.id, documents["failed"].id, documents["partially_succeeded"].id}
        visible = {document["id"] for document in client.get("/api/documents").json()["documents"]}
        assert not visible.intersection(removed)
        assert never_run.id in visible and indexed.id in visible
        assert {
            documents[state].id for state in ["awaiting_review", "interrupted", "running", "queued"]
        }.issubset(visible)
        for document_id in removed:
            assert client.get(f"/api/documents/{document_id}").status_code == 200
        all_documents = client.get("/api/documents?include_archived=true").json()["documents"]
        assert len(all_documents) == 9
        hidden_runs = client.post("/api/runs/cleanup").json()["archived_run_ids"]
        assert {before_runs[run_id].run.status for run_id in hidden_runs} == {"failed", "partially_succeeded"}
        assert not {run["id"] for run in client.get("/api/runs").json()["runs"]}.intersection(hidden_runs)
        for run_id, snapshot in before_runs.items():
            assert store.snapshot(run_id) == snapshot
        assert client.post("/api/runs/cleanup").json()["archived_run_ids"] == []


def test_explicit_example_reload_restores_archived_inputs_and_restart_checks_admission(tmp_path):
    app = create_app(configured(tmp_path))
    with TestClient(app) as client:
        store = app.state.storage
        documents = client.post("/api/samples/classification").json()["documents"]
        document = documents[0]
        run, _ = store.create_run(
            "classification",
            "test-fixture",
            {"document_ids": [document["id"]]},
            configured(tmp_path).public_config(),
        )
        store.update_run(run.id, status="failed", result={"outcomes": {document["id"]: {"status": "failed"}}})
        assert client.post("/api/documents/cleanup").json()["archived_document_ids"] == [document["id"]]
        assert client.post(f"/api/runs/{run.id}/restart").status_code == 409
        assert (
            client.post("/api/runs/classification", json={"document_ids": [document["id"]]}).status_code
            == 409
        )
        restored = client.post("/api/samples/classification").json()["documents"]
        assert [item["id"] for item in restored] == [item["id"] for item in documents]
        restarted = client.post(f"/api/runs/{run.id}/restart")
        assert restarted.status_code == 202
        assert settle(client, restarted.json()["id"])["run"]["status"] == "succeeded"
        assert all(
            item["extraction_status"] == "readable"
            for item in client.post("/api/samples").json()["documents"]
        )


def test_creation_rechecks_archival_after_an_earlier_read(tmp_path):
    settings = configured(tmp_path)
    archiver, creator = Storage(tmp_path), Storage(tmp_path)
    try:
        document = ingest(archiver, settings, "empty.txt", b"")
        command = {"document_ids": [document.id]}
        original, _ = creator.create_run("classification", "test-fixture", command, {}, "original")
        creator.update_run(original.id, status="failed")
        checked, continue_creation = ThreadEvent(), ThreadEvent()

        def create_after_check():
            assert not creator.is_archived(document.id)
            checked.set()
            assert continue_creation.wait(timeout=2)
            return creator.create_run("classification", "test-fixture", command, {}, "new")

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(create_after_check)
            assert checked.wait(timeout=2)
            archiver.archive_unsuccessful_documents()
            continue_creation.set()
            with pytest.raises(ValueError, match="cleared from the collection"):
                future.result(timeout=2)
        # Retrying an already accepted command remains idempotent, even in history.
        previous, created = creator.create_run("classification", "test-fixture", command, {}, "original")
        assert previous.id == original.id and not created
    finally:
        archiver.close()
        creator.close()
