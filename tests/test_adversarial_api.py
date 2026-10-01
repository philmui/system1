"""Adversarial public-boundary cases, using isolated storage and no paid calls."""

import asyncio
import threading
import time

import pytest
from fastapi.testclient import TestClient

from doc_discovery.api import create_app
from doc_discovery.settings import Settings


def settings_at(tmp_path, **overrides):
    return Settings(
        _env_file=None,
        app_data_dir=tmp_path,
        app_mode="test-fixture",
        langsmith_tracing=False,
        typesafe_api_key=None,
        openai_api_key=None,
        langsmith_api_key=None,
    ).model_copy(update=overrides)


def settled(client, run_id):
    for _ in range(300):
        snapshot = client.get(f"/api/runs/{run_id}").json()
        if snapshot["run"]["status"] not in {"queued", "running"}:
            return snapshot
        time.sleep(0.01)
    raise AssertionError("The isolated run did not settle")


def review_payload(review):
    return {
        "interrupt_id": review["interrupt_id"],
        "revision": review["revision"],
        "decisions": [
            {"document_id": item["document_id"], "action": "correct", "category": "correspondence"}
            for item in review["items"]
        ],
    }


@pytest.mark.parametrize("changed", [{"app_mode": "live"}, {"jev_choice_threshold": 0.9}])
def test_review_restart_rejects_changed_execution_contract(tmp_path, changed):
    """An incompatible resume must leave the saved review recoverable and visible."""
    original = settings_at(tmp_path)
    with TestClient(create_app(original)) as client:
        docs = client.post("/api/samples").json()["documents"]
        mixed = next(d for d in docs if "ambiguous" in d["filename"])
        run = client.post("/api/runs/classification", json={"document_ids": [mixed["id"]]}).json()
        before = settled(client, run["id"])["run"]
        assert before["status"] == "awaiting_review"
    with TestClient(create_app(original.model_copy(update=changed))) as client:
        result = client.post(f"/api/runs/{run['id']}/review", json=review_payload(before["review"]))
        assert result.status_code == 409
        after = client.get(f"/api/runs/{run['id']}").json()["run"]
        assert after["status"] == "awaiting_review"
        assert after["review"] == before["review"]


def test_long_filename_cannot_fail_after_partially_importing_batch(tmp_path):
    """Pre-validation and actual ingest must agree about the same filename."""
    with TestClient(create_app(settings_at(tmp_path)), raise_server_exceptions=False) as client:
        result = client.post(
            "/api/documents",
            files=[
                ("files", ("first.txt", b"Invoice Atlas. Total due USD 10.")),
                ("files", ("x" * 240 + ".txt", b"Invoice Atlas. Total due USD 20.")),
            ],
        )
        assert result.status_code in {200, 422}
        count = len(client.get("/api/documents").json()["documents"])
        assert count == (2 if result.status_code == 200 else 0)


def fill_queue(client, app, monkeypatch):
    async def blocked_execute(*_args, **_kwargs):
        await asyncio.Event().wait()

    monkeypatch.setattr(app.state.engine, "execute", blocked_execute)
    runs = []
    for number in range(16):
        response = client.post(
            "/api/runs/discovery",
            json={"query": f"Atlas {number}"},
            headers={"Idempotency-Key": f"queued-{number}"},
        )
        assert response.status_code == 202
        runs.append(response.json())
    assert len(app.state.tasks) == 16
    return runs


def test_existing_idempotent_command_returns_original_when_queue_is_full(tmp_path, monkeypatch):
    app = create_app(settings_at(tmp_path))
    with TestClient(app) as client:
        runs = fill_queue(client, app, monkeypatch)
        retry = client.post(
            "/api/runs/discovery",
            json={"query": "Atlas 0"},
            headers={"Idempotency-Key": "queued-0"},
        )
        assert retry.status_code == 202
        assert retry.json()["id"] == runs[0]["id"]
        assert len(app.state.tasks) == 16


def test_review_resume_cannot_bypass_the_execution_queue_limit(tmp_path, monkeypatch):
    app = create_app(settings_at(tmp_path))
    with TestClient(app) as client:
        docs = client.post("/api/samples").json()["documents"]
        mixed = next(d for d in docs if "ambiguous" in d["filename"])
        run = client.post("/api/runs/classification", json={"document_ids": [mixed["id"]]}).json()
        before = settled(client, run["id"])["run"]
        assert before["status"] == "awaiting_review"
        fill_queue(client, app, monkeypatch)
        response = client.post(f"/api/runs/{run['id']}/review", json=review_payload(before["review"]))
        assert response.status_code == 429
        assert len(app.state.tasks) == 16
        assert client.get(f"/api/runs/{run['id']}").json()["run"]["status"] == "awaiting_review"


def test_reclassification_preserves_the_previously_approved_searchable_version(tmp_path, monkeypatch):
    """A new pending judgment must not remove the immutable approved source."""
    app = create_app(settings_at(tmp_path))
    relevance_started = threading.Event()
    allow_relevance = threading.Event()
    classify_started = threading.Event()
    with TestClient(app) as client:
        document = client.post(
            "/api/documents", files=[("files", ("invoice.txt", b"Invoice Atlas. Total due USD 100."))]
        ).json()["documents"][0]
        initial = client.post("/api/runs/classification", json={"document_ids": [document["id"]]}).json()
        assert settled(client, initial["id"])["run"]["status"] == "succeeded"
        provider = app.state.engine.jev
        original_relevance = provider.relevance

        async def delayed_relevance(*args):
            relevance_started.set()
            while not allow_relevance.is_set():
                await asyncio.sleep(0.01)
            return await original_relevance(*args)

        async def held_classification(*_args):
            classify_started.set()
            await asyncio.Event().wait()

        monkeypatch.setattr(provider, "relevance", delayed_relevance)
        monkeypatch.setattr(provider, "classify", held_classification)
        query = client.post("/api/runs/discovery", json={"query": "Atlas"}).json()
        assert relevance_started.wait(3)
        reclassification = client.post(
            "/api/runs/classification", json={"document_ids": [document["id"]]}
        ).json()
        assert classify_started.wait(3)
        visible = client.get(f"/api/documents/{document['id']}").json()["document"]
        assert visible["indexed"] and visible["category_provenance"] == "jev"
        assert visible["content_version"] == document["content_version"]
        allow_relevance.set()
        result = settled(client, query["id"])["run"]["result"]
        assert {p["document_id"] for p in result["passages"]} == {document["id"]}
        client.post(f"/api/runs/{reclassification['id']}/cancel")


def test_metadata_endpoint_cannot_change_source_version_or_forge_synthetic_identity(tmp_path):
    with TestClient(create_app(settings_at(tmp_path))) as client:
        document = client.post(
            "/api/documents", files=[("files", ("../../atlas-invoice-march.md", b"Private invoice text"))]
        ).json()["documents"][0]
        assert document["filename"] == "atlas-invoice-march.md"
        assert not document["synthetic"]
        before = client.get(f"/api/documents/{document['id']}").json()
        response = client.patch(
            f"/api/documents/{document['id']}",
            json={"document_date": "2026-01-01", "synthetic": True, "content_version": "forged"},
        )
        assert response.status_code == 422
        assert client.get(f"/api/documents/{document['id']}").json() == before
        stored_files = list((tmp_path / "files").iterdir())
        assert len(stored_files) == 1
        assert stored_files[0].parent == tmp_path / "files"
        assert stored_files[0].name.startswith(document["id"])


def test_cancellation_after_review_acceptance_prevents_index_writes(tmp_path, monkeypatch):
    app = create_app(settings_at(tmp_path))
    index_reached = threading.Event()
    with TestClient(app) as client:
        docs = client.post("/api/samples").json()["documents"]
        mixed = next(d for d in docs if "ambiguous" in d["filename"])
        run = client.post("/api/runs/classification", json={"document_ids": [mixed["id"]]}).json()
        before = settled(client, run["id"])["run"]
        original_emit = app.state.events.emit

        async def pause_before_index(run_id, event_type, instance_id, *args, **kwargs):
            if run_id == run["id"] and event_type == "node_started" and instance_id == "index":
                index_reached.set()
                await asyncio.Event().wait()
            return await original_emit(run_id, event_type, instance_id, *args, **kwargs)

        monkeypatch.setattr(app.state.events, "emit", pause_before_index)
        assert (
            client.post(f"/api/runs/{run['id']}/review", json=review_payload(before["review"])).status_code
            == 202
        )
        assert index_reached.wait(3)
        cancelled = client.post(f"/api/runs/{run['id']}/cancel")
        assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
        snapshot = client.get(f"/api/runs/{run['id']}").json()
        assert snapshot["events"][-1]["type"] == "run_completed"
        assert snapshot["events"][-1]["payload"]["status"] == "cancelled"
        assert not client.get(f"/api/documents/{mixed['id']}").json()["document"]["indexed"]
        assert (
            client.post(f"/api/runs/{run['id']}/review", json=review_payload(before["review"])).status_code
            == 409
        )
        client.post(f"/api/runs/{run['id']}/cancel")
        assert client.get(f"/api/runs/{run['id']}").json()["events"] == snapshot["events"]


@pytest.mark.parametrize("name,body,status", [("blocked.exe", b"text", 422), ("large.txt", b"x" * 65, 413)])
def test_invalid_later_upload_leaves_no_registered_or_saved_files(tmp_path, name, body, status):
    with TestClient(create_app(settings_at(tmp_path, max_upload_bytes=64))) as client:
        result = client.post(
            "/api/documents",
            files=[("files", ("valid.txt", b"Invoice Atlas. Total due USD 10.")), ("files", (name, body))],
        )
        assert result.status_code == status
        assert not client.get("/api/documents").json()["documents"]
        assert not list((tmp_path / "files").iterdir())


@pytest.mark.parametrize("with_image", [True, False])
def test_mixed_text_and_image_only_pdf_cannot_silently_classify_only_the_cover(tmp_path, with_image):
    from io import BytesIO

    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject, NumberObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=200, height=200)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})}
    )
    text = DecodedStreamObject()
    text.set_data(b"BT /F1 12 Tf 20 100 Td (Invoice Atlas total USD 100.) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(text)
    image_page = writer.add_blank_page(width=200, height=200)
    if with_image:
        image = DecodedStreamObject()
        image.set_data(bytes([0, 255, 0, 255] * 4))
        image.update(
            {
                NameObject("/Type"): NameObject("/XObject"),
                NameObject("/Subtype"): NameObject("/Image"),
                NameObject("/Width"): NumberObject(4),
                NameObject("/Height"): NumberObject(4),
                NameObject("/ColorSpace"): NameObject("/DeviceGray"),
                NameObject("/BitsPerComponent"): NumberObject(8),
            }
        )
        image_page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/XObject"): DictionaryObject({NameObject("/Im0"): writer._add_object(image)})}
        )
        drawing = DecodedStreamObject()
        drawing.set_data(b"q 100 0 0 100 10 10 cm /Im0 Do Q")
        image_page[NameObject("/Contents")] = writer._add_object(drawing)
    output = BytesIO()
    writer.write(output)
    with TestClient(create_app(settings_at(tmp_path))) as client:
        response = client.post("/api/documents", files=[("files", ("mixed.pdf", output.getvalue()))])
        assert response.status_code == 200
        document = response.json()["documents"][0]
        if with_image:
            assert document["extraction_error"] or document["extraction_status"] != "readable"
        else:
            assert document["extraction_status"] == "readable" and document["extraction_error"] is None
        run = client.post("/api/runs/classification", json={"document_ids": [document["id"]]}).json()
        settled(client, run["id"])
        assert client.get(f"/api/documents/{document['id']}").json()["document"]["indexed"] is not with_image


def test_recover_cannot_bypass_the_execution_queue_limit(tmp_path, monkeypatch):
    app = create_app(settings_at(tmp_path))
    with TestClient(app) as client:
        docs = client.post("/api/samples").json()["documents"]
        mixed = next(d for d in docs if "ambiguous" in d["filename"])
        run = client.post("/api/runs/classification", json={"document_ids": [mixed["id"]]}).json()
        before = settled(client, run["id"])["run"]
        assert before["status"] == "awaiting_review"
        # Model a process interrupted before applying the saved review checkpoint.
        app.state.storage.update_run(run["id"], status="interrupted")
        fill_queue(client, app, monkeypatch)
        response = client.post(f"/api/runs/{run['id']}/recover")
        assert response.status_code == 429
        assert len(app.state.tasks) == 16
        assert client.get(f"/api/runs/{run['id']}").json()["run"]["status"] == "interrupted"
