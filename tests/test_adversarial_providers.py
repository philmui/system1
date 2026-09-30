"""Adversarial regressions for provider context bounds and truthful CLI outcomes."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from doc_discovery import cli
from doc_discovery.ingestion import ingest
from doc_discovery.policies import select_context
from doc_discovery.providers.jev import JevProvider
from doc_discovery.settings import Settings
from doc_discovery.storage import Storage


async def test_omission_audit_cannot_overflow_selected_context_budget(tmp_path):
    settings = Settings(
        _env_file=None,
        app_data_dir=tmp_path,
        app_mode="live",
        typesafe_api_key=None,
        openai_api_key=None,
        langsmith_tracing=False,
    )
    storage = Storage(tmp_path)
    text = ("Invoice Atlas. Total USD 100.\n" * 17000)[:490000]
    document = ingest(storage, settings, "large-invoice.txt", text.encode())
    context = select_context(storage.passages(document.id))
    assert len(context.omitted) > 400
    provider = JevProvider(settings)
    provider.client = SimpleNamespace(
        system_one=AsyncMock(
            return_value=SimpleNamespace(
                raw_http_response=SimpleNamespace(headers={}),
                model="jev-1.13.0",
                usage=SimpleNamespace(model_dump=lambda **kw: {}),
                choices={
                    "category": SimpleNamespace(
                        choice="invoice", confidence=0.9, probabilities={"invoice": 1.0}
                    )
                },
            )
        )
    )
    try:
        signal = await provider.classify(document, context)
        assert signal.choice == "invoice"
        state = provider.client.system_one.call_args.kwargs["state"]
        assert state["omitted_range_count"] == len(context.omitted)
        assert "omitted_ranges" not in state
        assert len(context.omitted) > 400  # Full audit remains available for the local Decision record.
    finally:
        storage.close()


def test_unsuccessful_smoke_does_not_exit_successfully(monkeypatch, tmp_path):
    settings = Settings(
        _env_file=None, app_data_dir=tmp_path, app_mode="test-fixture", langsmith_tracing=False
    )
    monkeypatch.setattr(cli, "Settings", lambda: settings)
    monkeypatch.setattr("sys.argv", ["doc-discovery", "demo"])
    monkeypatch.setattr(
        cli,
        "run_walkthrough",
        AsyncMock(return_value={"classification": {"status": "failed"}, "discovery": {"status": "failed"}}),
    )
    with pytest.raises(SystemExit) as error:
        cli.main()
    assert error.value.code == 1
