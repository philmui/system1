"""Publication is a durable per-document consequence, not a batch animation."""

import asyncio
import threading

import pytest
from fastapi.testclient import TestClient
from test_api import configured, settle
from test_workflows import harness, run

from doc_discovery.api import create_app
from doc_discovery.ingestion import ingest
from doc_discovery.schemas import GRAPH_VERSION, ReviewSubmission, SearchFilters


def publications(events, document_id=None):
    return [
        event
        for event in events
        if event.type == "node_completed"
        and event.payload.get("publication")
        and (document_id is None or event.payload["publication"]["document_id"] == document_id)
    ]


def test_real_find_can_return_a_document_while_another_worker_is_held(tmp_path, monkeypatch):
    app = create_app(configured(tmp_path))
    held = threading.Event()
    release = threading.Event()
    with TestClient(app) as client:
        docs = client.post("/api/samples/classification").json()["documents"]
        direct = next(d for d in docs if d["filename"] == "lesson-clear-invoice.md")
        ambiguous = next(d for d in docs if d["filename"] == "lesson-invoice-or-progress-report.md")
        original = app.state.engine.jev.classify

        async def hold(document, context):
            if document.id == ambiguous["id"]:
                held.set()
                while not release.is_set():
                    await asyncio.sleep(0.01)
            return await original(document, context)

        monkeypatch.setattr(app.state.engine.jev, "classify", hold)
        job = client.post(
            "/api/runs/classification", json={"document_ids": [direct["id"], ambiguous["id"]]}
        ).json()
        assert held.wait(3)
        try:
            # Await a committed event, not provider completion or mutable final state.
            for _ in range(300):
                snapshot = client.get(f"/api/runs/{job['id']}").json()
                if any(
                    e["payload"].get("publication", {}).get("document_id") == direct["id"]
                    for e in snapshot["events"]
                ):
                    break
                threading.Event().wait(0.01)
            else:
                pytest.fail("No independent publication while another worker is pending")
            assert snapshot["run"]["status"] == "running"
            query = client.post("/api/runs/discovery", json={"query": "Find invoice Atlas"}).json()
            found = settle(client, query["id"])["run"]["result"]
            assert direct["id"] in {p["document_id"] for p in found["passages"]}
            assert ambiguous["id"] not in {p["document_id"] for p in found["passages"]}
            assert client.get(f"/api/runs/{job['id']}").json()["run"]["status"] == "running"
        finally:
            release.set()
        waiting = settle(client, job["id"])["run"]
        assert waiting["status"] == "awaiting_review"
        assert waiting["result"]["indexed_count"] == 1
        assert client.get(f"/api/documents/{direct['id']}").json()["document"]["indexed"]
        assert not client.get(f"/api/documents/{ambiguous['id']}").json()["document"]["indexed"]


async def test_legacy_graph_keeps_batch_publication_barrier(tmp_path):
    async with harness(tmp_path) as (settings, storage, engine):
        direct = ingest(storage, settings, "invoice.txt", b"Invoice Atlas. Total USD 100.")
        ambiguous = ingest(
            storage,
            settings,
            "pending.txt",
            b"From: maya@example.test\nSubject: Proposed agreement\nPlease confirm pending service terms.",
        )
        job = run(storage, settings, "classification", {"document_ids": [direct.id, ambiguous.id]})
        storage.update_run(job.id, graph_version=GRAPH_VERSION)
        await engine.execute(job.id)
        saved = storage.get_run(job.id)
        assert saved.status == "awaiting_review"
        assert not storage.get_document(direct.id).indexed
        assert not publications(storage.events(job.id))
        review = saved.review
    # Legacy interrupted review continues on the original graph after a process restart.
    async with harness(tmp_path) as (_, storage, engine):
        submission = ReviewSubmission(
            interrupt_id=review.interrupt_id,
            revision=review.revision,
            decisions=[
                {"document_id": item.document_id, "action": "correct", "category": "correspondence"}
                for item in review.items
            ],
        )
        await engine.execute(job.id, resume=submission.model_dump(mode="json"))
        assert storage.get_run(job.id).status == "succeeded"
        assert storage.get_document(direct.id).indexed
        assert not publications(storage.events(job.id))


@pytest.mark.parametrize("reviewed", [False, True])
async def test_committed_publication_survives_interruption_before_worker_checkpoint(
    tmp_path, monkeypatch, reviewed
):
    async with harness(tmp_path) as (settings, storage, engine):
        content = (
            b"From: maya@example.test\nSubject: Proposed Atlas agreement\nPlease confirm pending service terms."
            if reviewed
            else b"Invoice Atlas. Total USD 100."
        )
        doc = ingest(storage, settings, "document.txt", content)
        job = run(storage, settings, "classification", {"document_ids": [doc.id]})
        resume = None
        if reviewed:
            await engine.execute(job.id)
            review = storage.get_run(job.id).review
            assert review is not None
            resume = ReviewSubmission(
                interrupt_id=review.interrupt_id,
                revision=review.revision,
                decisions=[{"document_id": doc.id, "action": "correct", "category": "correspondence"}],
            ).model_dump(mode="json")
        original = engine.edge
        committed_before_checkpoint = asyncio.Event()

        async def crash_after_commit(run_id, source, target, label):
            if source == f"{doc.id}:publish":
                committed_before_checkpoint.set()
                await asyncio.Event().wait()
            await original(run_id, source, target, label)

        monkeypatch.setattr(engine, "edge", crash_after_commit)
        execution = asyncio.create_task(engine.execute(job.id, resume=resume))
        await asyncio.wait_for(committed_before_checkpoint.wait(), 3)
        execution.cancel()
        with pytest.raises(asyncio.CancelledError):
            await execution
        assert storage.get_run(job.id).status == "interrupted"
        assert storage.search("Atlas", SearchFilters())
        committed = publications(storage.events(job.id), doc.id)
        assert len(committed) == 1
        publication = committed[0].payload["publication"]
        assert publication["content_version"] == doc.content_version
        assert publication["authorization_id"]
    async with harness(tmp_path) as (_, storage, engine):
        assert (await engine.can_recover(job.id))[0]
        await engine.execute(job.id, recover=True)
        finished = storage.get_run(job.id)
        assert finished.status == "succeeded"
        assert finished.result["indexed_count"] == 1
        assert len(publications(storage.events(job.id), doc.id)) == 1
        assert len(storage.search("Atlas", SearchFilters())) == 1


async def test_failed_publication_preserves_classification_but_fails_worker(tmp_path, monkeypatch):
    async with harness(tmp_path) as (settings, storage, engine):
        doc = ingest(storage, settings, "invoice.txt", b"Invoice Atlas. Total USD 100.")
        job = run(storage, settings, "classification", {"document_ids": [doc.id]})

        def fail(*args, **kwargs):
            raise RuntimeError("injected index failure")

        monkeypatch.setattr(storage, "publish_document", fail)
        await engine.execute(job.id)
        finished = storage.get_run(job.id)
        assert finished.status == "failed"
        assert finished.result["outcomes"][doc.id]["status"] == "failed"
        assert finished.result["indexed_count"] == 0
        assert not storage.search("Atlas", SearchFilters())
        assert not publications(storage.events(job.id))
        assert any(
            e.type == "decision" and e.payload["selected_route"] == "accept" for e in storage.events(job.id)
        )


async def test_publication_rolls_back_index_and_metadata_when_event_write_fails(tmp_path, monkeypatch):
    async with harness(tmp_path) as (settings, storage, engine):
        doc = ingest(storage, settings, "invoice.txt", b"Invoice Atlas. Total USD 100.")
        job = run(storage, settings, "classification", {"document_ids": [doc.id]})
        original = storage._append_event

        def fail_committed_evidence(run_id, event_type, instance_id, payload, *args, **kwargs):
            if payload.get("publication"):
                # The transaction has already inserted FTS rows and metadata.
                assert storage.get_document(doc.id).indexed
                assert storage.search("Atlas", SearchFilters())
                raise RuntimeError("injected durable event failure")
            return original(run_id, event_type, instance_id, payload, *args, **kwargs)

        monkeypatch.setattr(storage, "_append_event", fail_committed_evidence)
        await engine.execute(job.id)
        assert storage.get_run(job.id).status == "failed"
        assert not storage.get_document(doc.id).indexed
        assert not storage.search("Atlas", SearchFilters())
        assert storage.publication(job.id, doc.id) is None
        assert not publications(storage.events(job.id))


async def test_late_publication_cannot_write_after_cancellation_or_archive(tmp_path, monkeypatch):
    async with harness(tmp_path) as (settings, storage, engine):
        doc = ingest(storage, settings, "invoice.txt", b"Invoice Atlas. Total USD 100.")
        job = run(storage, settings, "classification", {"document_ids": [doc.id]})
        original = storage.publish_document

        def cancel_then_publish(*args, **kwargs):
            storage.update_run(job.id, status="cancelled")
            return original(*args, **kwargs)

        monkeypatch.setattr(storage, "publish_document", cancel_then_publish)
        with pytest.raises(asyncio.CancelledError):
            await engine.execute(job.id)
        assert not storage.search("Atlas", SearchFilters())
        assert not publications(storage.events(job.id))
        storage.update_run(job.id, status="failed", result={"outcomes": {doc.id: {"status": "failed"}}})
        assert storage.archive_unsuccessful_documents() == [doc.id]
        storage.update_run(job.id, status="running")
        decision = next(e.payload for e in storage.events(job.id) if e.type == "decision")
        with pytest.raises(ValueError):
            original(job.id, doc.id, doc.content_version, decision["id"])
        assert not storage.search("Atlas", SearchFilters())
        assert not publications(storage.events(job.id))


@pytest.mark.parametrize("action", ["correct", "exclude"])
async def test_review_replaces_or_withdraws_an_approved_version_only_after_authorization(
    tmp_path, monkeypatch, action
):
    async with harness(tmp_path) as (settings, storage, engine):
        doc = ingest(storage, settings, "invoice.txt", b"Invoice Atlas. Total USD 100.")
        original = run(storage, settings, "classification", {"document_ids": [doc.id]})
        await engine.execute(original.id)
        approved = storage.get_document(doc.id)
        classify = engine.jev.classify

        async def uncertain(*args):
            return (await classify(*args)).model_copy(update={"confidence": 0.1})

        monkeypatch.setattr(engine.jev, "classify", uncertain)
        reclassification = run(storage, settings, "classification", {"document_ids": [doc.id]})
        await engine.execute(reclassification.id)
        waiting = storage.get_run(reclassification.id)
        assert waiting.status == "awaiting_review" and waiting.result["indexed_count"] == 0
        assert storage.get_document(doc.id) == approved
        assert storage.search("Atlas", SearchFilters(categories=["invoice"]))
        assert not publications(storage.events(reclassification.id))
        submission = ReviewSubmission(
            interrupt_id=waiting.review.interrupt_id,
            revision=waiting.review.revision,
            decisions=[
                {
                    "document_id": doc.id,
                    "action": action,
                    "category": "report" if action == "correct" else None,
                }
            ],
        )
        await engine.execute(reclassification.id, resume=submission.model_dump(mode="json"))
        result = storage.get_run(reclassification.id)
        assert result.status == "succeeded"
        commit = publications(storage.events(result.id), doc.id)
        assert len(commit) == 1
        assert commit[0].payload["publication"]["status"] == (
            "searchable" if action == "correct" else "withdrawn"
        )
        assert not storage.search("Atlas", SearchFilters(categories=["invoice"]))
        assert bool(storage.search("Atlas", SearchFilters(categories=["report"]))) is (action == "correct")
        assert result.result["indexed_count"] == (1 if action == "correct" else 0)


async def test_newer_classification_prevents_stale_checkpoint_publication(tmp_path, monkeypatch):
    async with harness(tmp_path) as (settings, storage, engine):
        doc = ingest(storage, settings, "invoice.txt", b"Invoice Atlas. Total USD 100.")
        old = run(storage, settings, "classification", {"document_ids": [doc.id]})
        original_publish = engine.publish
        ready = asyncio.Event()

        async def held(*args):
            ready.set()
            await asyncio.Event().wait()

        monkeypatch.setattr(engine, "publish", held)
        execution = asyncio.create_task(engine.execute(old.id))
        await asyncio.wait_for(ready.wait(), 3)
        execution.cancel()
        with pytest.raises(asyncio.CancelledError):
            await execution
        assert storage.get_run(old.id).status == "interrupted"
        monkeypatch.setattr(engine, "publish", original_publish)
        newer = run(storage, settings, "classification", {"document_ids": [doc.id]})
        await engine.execute(newer.id)
        assert storage.get_run(newer.id).status == "succeeded"
        eligible, reason = await engine.can_recover(old.id)
        assert not eligible and "superseded" in reason
        decision = next(e.payload for e in storage.events(old.id) if e.type == "decision")
        storage.update_run(old.id, status="running")
        with pytest.raises(ValueError):
            storage.publish_document(old.id, doc.id, doc.content_version, decision["id"])
        assert not publications(storage.events(old.id))
        assert storage.get_document(doc.id).indexed
