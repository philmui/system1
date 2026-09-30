from concurrent.futures import ThreadPoolExecutor
from datetime import date
from io import BytesIO

import pytest
from pypdf import PdfWriter

from doc_discovery.events import Events
from doc_discovery.ingestion import extract, ingest, load_samples
from doc_discovery.schemas import Event, SearchFilters
from doc_discovery.settings import Settings
from doc_discovery.storage import Storage


@pytest.fixture
def store(tmp_path):
    db = Storage(tmp_path)
    yield db
    db.close()


@pytest.fixture
def settings(tmp_path):
    return Settings(_env_file=None, app_data_dir=tmp_path, app_mode="test-fixture", langsmith_tracing=False)


def test_preserved_anchors_and_generated_storage_path(store, settings):
    text = "# Opening\n" + ("A passage about Atlas.\n" * 110)
    doc = ingest(store, settings, "../../private.md", text.encode())
    assert doc.filename == "private.md"
    assert doc.extraction_elapsed_ms is not None and doc.extraction_elapsed_ms >= 0
    assert store.get_document(doc.id).extraction_elapsed_ms == doc.extraction_elapsed_ms
    assert not (store.data_dir / "private.md").exists()
    assert (store.data_dir / "files" / f"{doc.id}.md").exists()
    ps = store.passages(doc.id)
    assert len(ps) > 1
    assert ps[1].start < ps[0].end
    for p in ps:
        assert store.read_text(doc.id)[p.start : p.end] == p.text
        assert p.content_version == doc.content_version
    assert len({p.id for p in ps}) == len(ps)


def test_extraction_failures_are_explicit(store, settings):
    assert ingest(store, settings, "empty.txt", b"").extraction_status == "empty"
    assert ingest(store, settings, "binary.txt", b"\xff\x00").extraction_status == "unreadable"
    assert ingest(store, settings, "broken.pdf", b"not pdf").extraction_status == "unreadable"
    with pytest.raises(ValueError):
        ingest(store, settings, "file.exe", b"no")
    small = settings.model_copy(update={"max_upload_bytes": 1})
    with pytest.raises(ValueError):
        ingest(store, small, "file.txt", b"too long")
    writer = PdfWriter()
    writer.add_blank_page(100, 100)
    stream = BytesIO()
    writer.write(stream)
    assert extract("blank.pdf", stream.getvalue())[0] == "scanned"
    writer.encrypt("secret")
    stream = BytesIO()
    writer.write(stream)
    assert extract("encrypted.pdf", stream.getvalue())[0] == "encrypted"


def test_inclusive_dates_unknown_count_and_rejected_search(store, settings):
    for name, d in [
        ("start", date(2026, 1, 1)),
        ("end", date(2026, 1, 31)),
        ("outside", date(2026, 2, 1)),
        ("undated", None),
    ]:
        doc = ingest(store, settings, name + ".txt", b"Invoice Atlas", d)
        store.update_document(doc.id, category="invoice", category_provenance="jev")
        store.index_document(doc.id)
    filters = SearchFilters(categories=["invoice"], date_from=date(2026, 1, 1), date_to=date(2026, 1, 31))
    listing = store.documents(filters)
    assert len(listing.documents) == 2
    assert listing.excluded_unknown_dates == 1
    assert len(store.documents().documents) == 4
    assert len(store.search("Atlas", filters)) == 2
    victim = listing.documents[0]
    store.update_document(victim.id, indexed=False, category_provenance="excluded")
    assert len(store.search("Atlas", filters)) == 1
    with pytest.raises(ValueError):
        store.index_document(victim.id)
    # Quoted user FTS operators cannot become executable syntax.
    store.search('Atlas" OR NEAR(*) ; DROP TABLE documents', SearchFilters())
    assert len(store.documents().documents) == 4


def test_event_sequences_idempotency_snapshot(store):
    run, _ = store.create_run("classification", "test-fixture", {"document_ids": []}, {}, "key")
    again, created = store.create_run("classification", "test-fixture", {"document_ids": []}, {}, "key")
    assert not created and again.id == run.id
    with pytest.raises(ValueError):
        store.create_run("discovery", "test-fixture", {"query": "x"}, {}, "key")

    def append(i):
        return store.append_event(run.id, "node_started", f"n{i}", {"node_name": "test", "label": str(i)})

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(append, range(40)))
    assert append(3).sequence <= 40
    snapshot = store.snapshot(run.id)
    assert snapshot.last_event_sequence == 40
    assert [e.sequence for e in snapshot.events] == list(range(1, 41))
    assert len(store.events(run.id, after=35)) == 5
    with pytest.raises(ValueError):
        Event(event_id="x", sequence=1, run_id=run.id, instance_id="x", type="edge_selected", payload={})


def test_sample_load_idempotent_and_original_metadata(store, settings):
    first = load_samples(store, settings)
    second = load_samples(store, settings)
    assert len(first) == 14
    assert {d.id for d in first} == {d.id for d in second}
    assert all(d.synthetic for d in first)
    assert any(d.document_date is None for d in first)
    assert any(d.extraction_status == "empty" for d in first)
    assert not any(d.indexed for d in first)


async def test_event_publish_happens_after_durable_write(store):
    run, _ = store.create_run("classification", "test-fixture", {"document_ids": []}, {})
    events = Events(store)
    emitted = await events.emit(
        run.id, "run_started", "run", {"kind": "classification", "mode": "test-fixture"}
    )
    assert store.events(run.id)[0] == emitted


def test_root_env_and_deployment_priority(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("APP_MODE", "test-fixture")
    s = Settings()
    assert s.app_mode == "test-fixture"
    assert s.app_data_dir.is_absolute()
    assert "api_key" not in str(s.public_config())


def test_operational_run_scan_is_not_limited_to_recent_hundred(store):
    first, _ = store.create_run("classification", "test-fixture", {"document_ids": []}, {})
    for _ in range(101):
        run, _ = store.create_run("classification", "test-fixture", {"document_ids": []}, {})
        store.update_run(run.id, status="succeeded")
    assert len(store.runs()) == 100
    assert first.id not in {r.id for r in store.runs()}
    assert first.id in {r.id for r in store.runs(limit=None)}


def test_section_label_describes_passage_start(store, settings):
    d = ingest(
        store,
        settings,
        "agreement.md",
        b"# Service agreement\n\n## Termination\n30 days notice.\n\n## Entire agreement\nSigned.",
    )
    assert store.passages(d.id)[0].section == "Service agreement"


def test_text_pdf_retains_page_and_character_anchor(store, settings):
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

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
    content = DecodedStreamObject()
    content.set_data(b"BT /F1 12 Tf 20 100 Td (Invoice Atlas total USD 100.) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(content)
    output = BytesIO()
    writer.write(output)
    document = ingest(store, settings, "invoice.pdf", output.getvalue())
    assert document.extraction_status == "readable"
    passage = store.passages(document.id)[0]
    assert passage.page == 1
    assert "Invoice Atlas" in passage.text
    assert store.read_text(document.id)[passage.start : passage.end] == passage.text


def test_cli_and_backend_share_execution_lease(tmp_path):
    from doc_discovery.storage import data_lease

    with data_lease(tmp_path):
        with pytest.raises(RuntimeError, match="Stop the backend"):
            with data_lease(tmp_path):
                pass
    with data_lease(tmp_path):
        pass
