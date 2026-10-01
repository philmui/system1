"""Create completed, explicitly simulated lessons without using the live execution owner.

The real classification graph runs in a temporary fixture store. Only completed
synthetic recordings are published, so an open backend can keep its own lease.
"""

import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import NAMESPACE_URL, uuid5

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from .events import Events
from .ingestion import ingest
from .schemas import CLASSIFICATION_GRAPH_VERSION, ReviewSubmission, Run
from .settings import Settings
from .storage import Storage, data_lease
from .teaching import TEACHING_FOLDER, fixture_example
from .workflows.engine import WorkflowEngine

PACK = "classification-teaching-v2"
CASES = (
    {
        "key": "clear",
        "title": "Clear categories",
        "summary": "An invoice and a policy pass the runtime checks. Neither needs a frontier call.",
        "files": ["lesson-clear-invoice.md", "lesson-access-policy.md"],
        "reasons": ["accepted", "accepted"],
    },
    {
        "key": "uncertain",
        "title": "An uncertain category",
        "summary": "Compare a clear invoice with a progress report that mentions billing. Only the ambiguous page is interpreted.",
        "files": ["lesson-clear-invoice.md", "lesson-invoice-or-progress-report.md"],
        "reasons": ["accepted", "below_threshold"],
    },
    {
        "key": "guard",
        "title": "A policy guard overrides confidence",
        "summary": "Compare all three routes. An unsigned agreement email needs interpretation even at 96% confidence.",
        "files": [
            "lesson-clear-invoice.md",
            "lesson-access-policy.md",
            "lesson-invoice-or-progress-report.md",
            "lesson-unsigned-agreement-email.md",
        ],
        "reasons": ["accepted", "accepted", "below_threshold", "mixed_purpose"],
    },
)


async def _record(source: Storage, settings: Settings) -> list[Run]:
    manifest = json.loads((TEACHING_FOLDER / "manifest.json").read_text())
    documents = {}
    for item in manifest["documents"]:
        filename = item["filename"]
        raw = (TEACHING_FOLDER / filename).read_bytes()
        # Dedicated immutable identities never overwrite a user's uploaded file.
        identity = str(uuid5(NAMESPACE_URL, f"{PACK}:{filename}:{hashlib.sha256(raw).hexdigest()}"))
        documents[filename] = ingest(source, settings, filename, raw, synthetic=True, id=identity)
    runs = []
    async with AsyncSqliteSaver.from_conn_string(str(source.data_dir / "checkpoints.db")) as saver:
        await saver.setup()
        engine = WorkflowEngine(settings, source, Events(source), saver)
        try:
            for order, case in enumerate(CASES, 1):
                run, _ = source.create_run(
                    "classification",
                    "test-fixture",
                    {
                        "document_ids": [documents[name].id for name in case["files"]],
                        "teaching_pack": PACK,
                        "lesson_title": case["title"],
                        "lesson_summary": case["summary"],
                        "lesson_order": order,
                        "simulated_review": "accepted" != case["reasons"][-1],
                    },
                    settings.public_config(),
                    idempotency_key=f"{PACK}:{case['key']}",
                )
                await engine.execute(run.id)
                run = source.get_run(run.id)
                if run.status == "awaiting_review" and run.review:
                    # Explicit teaching actor: these approvals are simulated too.
                    submission = ReviewSubmission(
                        interrupt_id=run.review.interrupt_id,
                        revision=run.review.revision,
                        decisions=[
                            {"document_id": item.document_id, "action": "accept", "category": item.proposal}
                            for item in run.review.items
                        ],
                    )
                    await engine.execute(run.id, resume=submission.model_dump(mode="json"))
                run = source.get_run(run.id)
                reasons = [
                    event.payload["policy_reason"]
                    for event in source.events(run.id)
                    if event.type == "decision" and event.instance_id.endswith(":jev")
                ]
                if run.status != "succeeded" or sorted(reasons) != sorted(case["reasons"]):
                    raise RuntimeError("The teaching recording did not complete its expected routes")
                runs.append(run)
        finally:
            await engine.close()
    return runs


def _publish(source: Storage, target: Storage, runs: list[Run]) -> tuple[list[str], list[str]]:
    """Publish immutable completed records atomically; never resume another engine's work."""
    published, created = [], []
    with target.lock, target.db:
        target.db.execute("BEGIN IMMEDIATE")
        active_inputs = {
            document_id
            for run in target.runs(limit=None, include_archived=True)
            if run.status in {"queued", "running", "awaiting_review", "interrupted"}
            for document_id in run.request.get("document_ids", [])
        }
        for run in runs:
            if (
                run.status != "succeeded"
                or run.mode != "test-fixture"
                or run.request.get("teaching_pack") != PACK
                or run.graph_version != CLASSIFICATION_GRAPH_VERSION
            ):
                raise ValueError("Only completed simulated teaching runs can be published")
            row = source.db.execute("SELECT * FROM runs WHERE id=?", (run.id,)).fetchone()
            existing = target.db.execute(
                "SELECT data FROM runs WHERE idempotency_key=?", (row["idempotency_key"],)
            ).fetchone()
            if existing:
                saved = Run.model_validate_json(existing["data"])
                if (
                    saved.mode != "test-fixture"
                    or saved.status != "succeeded"
                    or saved.request != run.request
                    or saved.graph_version != run.graph_version
                ):
                    raise ValueError("An existing teaching identity has incompatible recorded data")
                published.append(saved.id)
                continue
            for document_id in run.request["document_ids"]:
                document = source.get_document(document_id)
                if not fixture_example(document) or not document.indexed or document_id in active_inputs:
                    raise ValueError(
                        "Teaching inputs must be accepted synthetic documents with no active work"
                    )
                prior = target.db.execute("SELECT data FROM documents WHERE id=?", (document_id,)).fetchone()
                if prior:
                    saved = target.get_document(document_id)
                    if not saved.synthetic or saved.content_version != document.content_version:
                        raise ValueError("A teaching identity cannot overwrite different source content")
                    continue
                filename = f"{document_id}{Path(document.filename).suffix.lower()}"
                raw = (source.data_dir / "files" / filename).read_bytes()
                if hashlib.sha256(raw).hexdigest() != document.content_version:
                    raise ValueError("The teaching source file does not match its recorded content")
                destination = target.data_dir / "files" / filename
                if destination.exists() and destination.read_bytes() != raw:
                    raise ValueError("A teaching source file cannot replace an existing different file")
                destination.write_bytes(raw)
                target.db.execute(
                    "INSERT INTO documents VALUES (?, ?, ?)",
                    (document.id, document.model_dump_json(), source.read_text(document.id)),
                )
                for passage in source.passages(document.id):
                    target.db.execute(
                        "INSERT INTO passages VALUES (?, ?, ?)",
                        (passage.id, document.id, passage.model_dump_json()),
                    )
                    target.db.execute(
                        "INSERT INTO passage_fts VALUES (?, ?, ?)", (passage.id, document.id, passage.text)
                    )
            target.db.execute("INSERT INTO runs VALUES (?, ?, ?, ?)", tuple(row))
            target.db.executemany(
                "INSERT INTO events VALUES (?, ?, ?, ?)",
                [
                    tuple(event)
                    for event in source.db.execute(
                        "SELECT * FROM events WHERE run_id=? ORDER BY sequence", (run.id,)
                    )
                ],
            )
            target.db.executemany(
                "INSERT INTO publications VALUES (?, ?, ?, ?, ?)",
                [
                    tuple(publication)
                    for publication in source.db.execute(
                        "SELECT * FROM publications WHERE run_id=?", (run.id,)
                    )
                ],
            )
            published.append(run.id)
            created.append(run.id)
    return published, created


async def seed_teaching_runs(destination: Path, *, cleanup: bool = False) -> dict:
    # Explicit fixture settings prevent environment keys, tracing or thresholds
    # from turning a repeatable lesson into paid calls or different decisions.
    with TemporaryDirectory(prefix="classification-lessons-") as temporary, data_lease(Path(temporary)):
        settings = Settings(
            _env_file=None,
            app_data_dir=Path(temporary),
            app_mode="test-fixture",
            typesafe_api_key=None,
            openai_api_key=None,
            langsmith_api_key=None,
            langsmith_tracing=False,
            langsmith_trace_synthetic_text=False,
            jev_choice_threshold=0.8,
            jev_relevance_threshold=0.7,
            jev_support_threshold=0.8,
            max_concurrency=4,
        )
        source, target = Storage(settings.app_data_dir), Storage(destination)
        try:
            recordings = await _record(source, settings)
            published, created = _publish(source, target, recordings)
            removed_documents = target.archive_unsuccessful_documents() if cleanup else []
            removed_runs = target.archive_unsuccessful_runs() if cleanup else []
            return {
                "run_ids": published,
                "created_run_ids": created,
                "archived_document_ids": removed_documents,
                "archived_run_ids": removed_runs,
            }
        finally:
            source.close()
            target.close()
