import asyncio
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from doc_discovery.events import Events
from doc_discovery.ingestion import ingest, load_samples
from doc_discovery.providers.common import ProviderError
from doc_discovery.schemas import Answer, Citation, Claim, NoulSignal
from doc_discovery.settings import Settings
from doc_discovery.storage import Storage
from doc_discovery.workflows.discover import valid_claim
from doc_discovery.workflows.engine import WorkflowEngine


@asynccontextmanager
async def harness(path):
    settings = Settings(
        _env_file=None,
        app_data_dir=path,
        app_mode="test-fixture",
        langsmith_tracing=False,
        typesafe_api_key=None,
        openai_api_key=None,
        langsmith_api_key=None,
    )
    storage = Storage(path)
    async with AsyncSqliteSaver.from_conn_string(str(path / "checkpoints.db")) as checkpointer:
        await checkpointer.setup()
        engine = WorkflowEngine(settings, storage, Events(storage), checkpointer)
        try:
            yield settings, storage, engine
        finally:
            await engine.close()
    storage.close()


def run(storage, settings, kind, request):
    return storage.create_run(kind, settings.app_mode, request, settings.public_config())[0]


@pytest.mark.parametrize("count", [0, 1, 4])
async def test_runtime_worker_count_and_complete_join(tmp_path, count):
    async with harness(tmp_path) as (settings, storage, engine):
        docs = [
            ingest(storage, settings, f"invoice-{i}.txt", f"Invoice Atlas {i}. Total USD 100.".encode())
            for i in range(count)
        ]
        job = run(storage, settings, "classification", {"document_ids": [d.id for d in docs]})
        await engine.execute(job.id)
        result = storage.get_run(job.id)
        assert result.status == "succeeded"
        assert result.result["indexed_count"] == count
        assert set(result.result["outcomes"]) == {d.id for d in docs}
        events = storage.events(job.id)
        assert len([e for e in events if e.type == "worker_created"]) == count
        joins = [e.payload for e in events if e.instance_id == "join" and e.type == "node_completed"]
        assert joins[-1]["completed"] == joins[-1]["expected"] == count
        assert [e.sequence for e in events] == list(range(1, len(events) + 1))
        if count > 1:
            starts = [
                e.sequence for e in events if e.instance_id.endswith(":jev") and e.type == "node_started"
            ]
            finishes = [
                e.sequence for e in events if e.instance_id.endswith(":jev") and e.type == "node_completed"
            ]
            assert max(starts) < min(finishes), "Fixture calls really overlapped"


async def test_failed_worker_and_empty_document_do_not_lose_other_results(tmp_path):
    async with harness(tmp_path) as (settings, storage, engine):
        docs = [
            ingest(storage, settings, "invoice.txt", b"Invoice Atlas total USD 100."),
            ingest(storage, settings, "provider-failure.txt", b"This is a simulated provider outage test."),
            ingest(storage, settings, "empty.txt", b""),
        ]
        job = run(storage, settings, "classification", {"document_ids": [d.id for d in docs]})
        await engine.execute(job.id)
        result = storage.get_run(job.id)
        assert result.status == "partially_succeeded" and result.result["indexed_count"] == 1
        outcomes = result.result["outcomes"]
        assert outcomes[docs[1].id]["status"] == "failed"
        assert outcomes[docs[2].id]["status"] == "extraction_issue"
        decisions = [e for e in storage.events(job.id) if e.type == "decision"]
        assert len(decisions) == 1, "Failures must not masquerade as uncertain judgments"


async def test_transient_failure_has_two_visible_attempts_and_no_sdk_retry_multiplication(tmp_path):
    async with harness(tmp_path) as (settings, storage, engine):
        document = ingest(storage, settings, "invoice.txt", b"Invoice Atlas total USD 100.")
        original = engine.jev.classify
        count = 0

        async def flaky(*args):
            nonlocal count
            count += 1
            if count == 1:
                raise ProviderError("jev", "rate_limit", "Simulated rate limit.", True)
            return await original(*args)

        engine.jev.classify = flaky
        job = run(storage, settings, "classification", {"document_ids": [document.id]})
        await engine.execute(job.id)
        assert storage.get_run(job.id).status == "succeeded" and count == 2
        attempts = [
            e.attempt
            for e in storage.events(job.id)
            if e.type == "node_started" and e.instance_id.endswith(":jev")
        ]
        assert attempts == [1, 2]
        failures = [e for e in storage.events(job.id) if e.type == "node_failed"]
        assert failures[0].payload["queue_wait_ms"] >= 0


async def test_cancelled_checkpoint_can_recover_without_repeating_completed_index(tmp_path):
    async with harness(tmp_path) as (settings, storage, engine):
        doc = ingest(storage, settings, "invoice.txt", b"Invoice Atlas total USD 100.")
        job = run(storage, settings, "classification", {"document_ids": [doc.id]})
        original = engine.jev.classify
        entered = asyncio.Event()

        async def blocked(*args):
            entered.set()
            await asyncio.sleep(30)
            return await original(*args)

        engine.jev.classify = blocked
        task = asyncio.create_task(engine.execute(job.id))
        await entered.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert storage.get_run(job.id).status == "interrupted"
    # New engine and SQLite connection represent a real process lifecycle boundary.
    async with harness(tmp_path) as (_, storage, engine):
        assert (await engine.can_recover(job.id))[0]
        await engine.execute(job.id, recover=True)
        assert storage.get_run(job.id).status == "succeeded"
        index = [e for e in storage.events(job.id) if e.instance_id == "index" and e.type == "node_completed"]
        assert len(index) == 1 and storage.get_document(doc.id).indexed
        starts = [
            e.attempt
            for e in storage.events(job.id)
            if e.instance_id.endswith(":jev") and e.type == "node_started"
        ]
        assert starts == [1, 2]


async def test_explicit_cancellation_prevents_downstream_indexing(tmp_path):
    async with harness(tmp_path) as (settings, storage, engine):
        doc = ingest(storage, settings, "invoice.txt", b"Invoice Atlas total USD 100.")
        job = run(storage, settings, "classification", {"document_ids": [doc.id]})
        original = engine.jev.classify

        async def cancelled(*args):
            signal = await original(*args)
            storage.update_run(job.id, status="cancelled")
            return signal

        engine.jev.classify = cancelled
        with pytest.raises(asyncio.CancelledError):
            await engine.execute(job.id)
        assert not storage.get_document(doc.id).indexed
        assert storage.get_run(job.id).status == "cancelled"


async def test_invalid_citations_and_failed_support_cannot_produce_supported_answers(tmp_path):
    async with harness(tmp_path) as (settings, storage, engine):
        docs = load_samples(storage, settings)
        chosen = [d for d in docs if "service-agreement" in d.filename]
        classification = run(storage, settings, "classification", {"document_ids": [d.id for d in chosen]})
        await engine.execute(classification.id)
        passage = storage.passages(chosen[0].id)[0]
        bad = Claim(
            text="Invented fact", citations=[Citation(passage_id=passage.id, quote="not in the source")]
        )
        assert not valid_claim(bad, {passage.id: passage})
        original = engine.openai.answer

        async def answer(query, passages):
            result, metadata = await original(query, passages)
            return Answer(claims=[bad, *result.claims], missing_evidence=[]), metadata

        engine.openai.answer = answer
        engine.jev.support = AsyncMock(
            return_value=NoulSignal(provider="fixture", request_id="rejected-support", elapsed_ms=1, noul=0.1)
        )
        job = run(
            storage,
            settings,
            "discovery",
            {"query": "Compare termination notice periods in Atlas agreements.", "filters": {}},
        )
        await engine.execute(job.id)
        result = storage.get_run(job.id).result
        assert not result["claims"] and "support" in result["message"].lower()
        assert any("citation" in gap for gap in result["missing_evidence"])
        assert any("semantic support" in gap for gap in result["missing_evidence"])
        assert len(result["passages"]) == len({p["id"] for p in result["passages"]})
        assert any(len(tasks) == 2 for tasks in result["provenance"]["passage_tasks"].values())


async def test_search_failure_is_not_insufficient_evidence(tmp_path):
    async with harness(tmp_path) as (settings, storage, engine):

        def broken(*args, **kwargs):
            raise RuntimeError("storage unavailable")

        storage.search = broken
        job = run(storage, settings, "discovery", {"query": "Atlas", "filters": {}})
        await engine.execute(job.id)
        result = storage.get_run(job.id)
        assert result.status == "failed"
        assert "failed" in result.result["message"]
        assert result.result["partial"]


async def test_opt_in_synthetic_trace_text_verifies_all_anchors_and_excludes_uploads(tmp_path):
    async with harness(tmp_path) as (settings, storage, engine):
        fictional = ingest(
            storage, settings, "sample.md", b"Fictional invoice: Atlas total USD 30.", synthetic=True
        )
        uploaded = ingest(storage, settings, "sample.md", b"Private uploaded invoice: Atlas total USD 30.")
        synthetic_passage = storage.passages(fictional.id)[0]
        uploaded_passage = storage.passages(uploaded.id)[0]
        refs = [fictional.id, synthetic_passage.id]
        assert engine.synthetic_trace_context(refs) == {}
        settings.langsmith_trace_synthetic_text = True
        context = engine.synthetic_trace_context(refs)
        assert context["synthetic_verified"] is True
        assert synthetic_passage.text in context["synthetic_excerpt"]
        assert engine.synthetic_trace_context([*refs, uploaded_passage.id]) == {}
        assert engine.synthetic_trace_context([uploaded.id, uploaded_passage.id]) == {}
        assert engine.synthetic_trace_context([*refs, "user-query"]) == {}
        filtered = engine.telemetry.filter_payload(context)
        assert filtered == context
        settings.langsmith_trace_synthetic_text = False
        assert engine.telemetry.filter_payload(context) == {}
