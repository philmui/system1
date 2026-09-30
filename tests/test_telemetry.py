from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from doc_discovery.ingestion import ingest
from doc_discovery.schemas import NoulSignal
from doc_discovery.settings import Settings
from doc_discovery.storage import Storage
from doc_discovery.telemetry import Telemetry, jev_trace_evaluator, sanitized


def configured(path):
    return Settings(
        _env_file=None,
        app_mode="test-fixture",
        app_data_dir=path,
        typesafe_api_key=None,
        openai_api_key=None,
        langsmith_api_key=None,
        langsmith_tracing=False,
    )


def test_payload_allowlist_removes_text_and_nested_private_content():
    payload = {
        "run_id": "run",
        "filename": "private.pdf",
        "query": "private question",
        "document_text": "private document",
        "usage": {"input_tokens": 12, "document_text": "nested private"},
        "passage_ids": ["p1"],
    }
    filtered = sanitized(payload)
    assert filtered == {"run_id": "run", "usage": {"input_tokens": 12}, "passage_ids": ["p1"]}
    assert "private" not in str(filtered)


async def test_eventual_trace_read_is_bounded_and_failure_clears_stale_link(tmp_path):
    settings = configured(tmp_path)
    storage = Storage(tmp_path)
    job = storage.create_run("discovery", "test-fixture", {"query": "Atlas"}, settings.public_config())[0]
    telemetry = Telemetry(settings, storage)
    try:
        root = SimpleNamespace(id="trace-id", end=Mock(), patch=Mock())
        telemetry.roots[job.id] = root
        client = SimpleNamespace(
            flush=Mock(),
            read_run=Mock(side_effect=[RuntimeError("not yet delivered"), object()]),
            get_run_url=Mock(return_value="https://smith.langchain.com/test-run"),
        )
        telemetry.client = client
        await telemetry.finish(job.id, "succeeded")
        assert client.read_run.call_count == 2
        assert storage.get_run(job.id).telemetry_status == "delivered"
        assert storage.get_run(job.id).trace_url
        assert storage.get_run(job.id).status == "queued", (
            "Telemetry must not change application routing/status"
        )
        telemetry.roots[job.id] = root
        client.read_run = Mock(side_effect=RuntimeError("unavailable"))
        await telemetry.finish(job.id, "succeeded")
        assert client.read_run.call_count == 3
        assert storage.get_run(job.id).trace_url is None
        assert storage.get_run(job.id).telemetry_status == "delivery unverified"
        assert storage.get_run(job.id).status == "queued"
    finally:
        storage.close()


async def test_broken_span_delivery_does_not_change_application_result(tmp_path):
    settings = configured(tmp_path)
    storage = Storage(tmp_path)
    telemetry = Telemetry(settings, storage)
    telemetry.roots["run"] = SimpleNamespace(create_child=Mock(side_effect=RuntimeError("telemetry outage")))
    try:
        value = 0
        async with telemetry.span("run", "Jev", {"document_text": "private"}) as output:
            value = 42
            output.update({"outcome": "accepted", "document_text": "private"})
        assert value == 42
        assert "run" in telemetry.failed_runs
    finally:
        storage.close()


async def test_optional_evaluator_resolves_actual_local_citations_and_skips_simulation(tmp_path, monkeypatch):
    settings = configured(tmp_path)
    settings.app_mode = "live"
    storage = Storage(tmp_path)
    doc = ingest(storage, settings, "terms.txt", b"Either party may terminate with 30 days written notice.")
    passage = storage.passages(doc.id)[0]
    job = storage.create_run(
        "discovery", "live", {"query": "Compare notice periods"}, settings.public_config()
    )[0]
    storage.update_run(
        job.id,
        result={
            "claims": [
                {
                    "text": "The agreement requires 30 days written notice.",
                    "citations": [{"passage_id": passage.id, "quote": "30 days written notice"}],
                }
            ]
        },
    )
    provider = SimpleNamespace(
        support=AsyncMock(return_value=NoulSignal(provider="jev", elapsed_ms=1, noul=0.87)), close=AsyncMock()
    )
    monkeypatch.setattr("doc_discovery.settings.Settings", lambda: settings)
    monkeypatch.setattr("doc_discovery.providers.jev.JevProvider", lambda _: provider)
    trace = SimpleNamespace(inputs={"run_id": job.id}, extra={})
    try:
        result = await jev_trace_evaluator(trace)
        assert result["score"] == 0.87 and "not ground truth" in result["comment"]
        assert provider.support.await_count == 1
        assert provider.support.call_args.args[1][0].id == passage.id
        settings.app_mode = "test-fixture"
        result = await jev_trace_evaluator(trace)
        assert result["score"] is None and provider.support.await_count == 1
    finally:
        storage.close()


async def test_invalid_sdk_setup_stays_runnable_and_exposes_safe_error(tmp_path, monkeypatch):
    import pytest

    from doc_discovery.providers.common import ProviderError
    from doc_discovery.providers.jev import JevProvider
    from doc_discovery.providers.openai import OpenAIProvider

    settings = Settings(
        _env_file=None,
        app_data_dir=tmp_path,
        app_mode="live",
        typesafe_api_key="invalid credential with whitespace",
        openai_api_key="test-key",
        langsmith_tracing=False,
    )
    jev = JevProvider(settings)
    assert jev.initialization_error is not None
    with pytest.raises(ProviderError, match="configuration"):
        await jev.intent("Atlas")
    monkeypatch.setattr(
        "doc_discovery.providers.openai.AsyncOpenAI",
        Mock(side_effect=ValueError("private configuration value")),
    )
    provider = OpenAIProvider(settings)
    assert provider.initialization_error is not None
    assert "private" not in str(provider.initialization_error)
    with pytest.raises(ProviderError, match="configuration"):
        await provider.plan("Atlas", "find", {})
