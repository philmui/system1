"""Small SQLite transactions own metadata, immutable passage anchors and event cursors."""

import hashlib
import json
import re
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

from .schemas import Document, DocumentList, Event, Passage, Run, RunSnapshot, SearchFilters, now


def json_value(value):
    return value.model_dump(mode="json") if hasattr(value, "model_dump") else value


@contextmanager
def data_lease(data_dir: Path):
    """Enforce one execution owner, including CLI walkthroughs."""
    import fcntl

    data_dir.mkdir(parents=True, exist_ok=True)
    with (data_dir / "backend.lock").open("a") as lease:
        try:
            fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError(
                "Stop the backend or choose a separate APP_DATA_DIR before running a CLI walkthrough."
            ) from None
        yield


class Storage:
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "files").mkdir(exist_ok=True)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(self.data_dir / "application.db", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.execute("PRAGMA busy_timeout=5000")
        self.db.executescript("""
          CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, data TEXT NOT NULL, text TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS archived_documents(document_id TEXT PRIMARY KEY REFERENCES documents(id), reason TEXT NOT NULL, archived_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS passages(id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id), data TEXT NOT NULL);
          CREATE VIRTUAL TABLE IF NOT EXISTS passage_fts USING fts5(passage_id UNINDEXED, document_id UNINDEXED, text, tokenize='unicode61');
          CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, data TEXT NOT NULL, idempotency_key TEXT UNIQUE, request_hash TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS archived_runs(run_id TEXT PRIMARY KEY REFERENCES runs(id), archived_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS events(run_id TEXT NOT NULL REFERENCES runs(id), sequence INTEGER NOT NULL, logical_key TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(run_id, sequence), UNIQUE(run_id, logical_key));
        """)
        self.db.commit()
        self.fts5 = True

    def close(self):
        self.db.close()

    def add_document(self, document: Document, text: str, passages: list[Passage]):
        with self.lock, self.db:
            self.db.execute(
                "INSERT OR IGNORE INTO documents VALUES (?, ?, ?)",
                (document.id, document.model_dump_json(), text),
            )
            self.db.executemany(
                "INSERT OR IGNORE INTO passages VALUES (?, ?, ?)",
                [(p.id, p.document_id, p.model_dump_json()) for p in passages],
            )
        return self.get_document(document.id)

    def get_document(self, id: str) -> Document:
        with self.lock:
            row = self.db.execute("SELECT data FROM documents WHERE id=?", (id,)).fetchone()
        if row is None:
            raise KeyError("Document not found")
        return Document.model_validate_json(row["data"])

    def read_text(self, id: str) -> str:
        with self.lock:
            row = self.db.execute("SELECT text FROM documents WHERE id=?", (id,)).fetchone()
        if row is None:
            raise KeyError("Document not found")
        return row["text"]

    def update_document(self, id: str, **fields) -> Document:
        with self.lock, self.db:
            old = self.get_document(id)
            doc = Document.model_validate(old.model_dump() | fields)
            self.db.execute("UPDATE documents SET data=? WHERE id=?", (doc.model_dump_json(), id))
            if not doc.indexed:
                self.db.execute("DELETE FROM passage_fts WHERE document_id=?", (id,))
        return doc

    def passages(self, document_id: str) -> list[Passage]:
        with self.lock:
            rows = self.db.execute("SELECT data FROM passages WHERE document_id=?", (document_id,)).fetchall()
        return sorted((Passage.model_validate_json(r["data"]) for r in rows), key=lambda p: p.start)

    def get_passage(self, id: str) -> Passage:
        with self.lock:
            row = self.db.execute("SELECT data FROM passages WHERE id=?", (id,)).fetchone()
        if row is None:
            raise KeyError("Passage not found")
        return Passage.model_validate_json(row["data"])

    def documents(
        self, filters: SearchFilters | None = None, *, include_archived: bool = False
    ) -> DocumentList:
        filters = filters or SearchFilters()
        with self.lock:
            docs = [
                Document.model_validate_json(r["data"])
                for r in self.db.execute(
                    "SELECT data FROM documents"
                    if include_archived
                    else "SELECT data FROM documents WHERE id NOT IN (SELECT document_id FROM archived_documents)"
                )
            ]
        if filters.categories:
            docs = [d for d in docs if d.category in filters.categories]
        excluded = 0
        if filters.date_from or filters.date_to:
            excluded = sum(d.document_date is None for d in docs)
            docs = [
                d
                for d in docs
                if d.document_date is not None
                and (not filters.date_from or d.document_date >= filters.date_from)
                and (not filters.date_to or d.document_date <= filters.date_to)
            ]
        return DocumentList(
            documents=sorted(docs, key=lambda d: (d.uploaded_at, d.id), reverse=True),
            excluded_unknown_dates=excluded,
        )

    def is_archived(self, document_id: str) -> bool:
        with self.lock:
            return (
                self.db.execute(
                    "SELECT 1 FROM archived_documents WHERE document_id=?", (document_id,)
                ).fetchone()
                is not None
            )

    def restore_readable_documents(self, document_ids: list[str]):
        """An explicit example reload restores immutable readable inputs for a new run."""
        with self.lock, self.db:
            for document_id in document_ids:
                if self.get_document(document_id).extraction_status == "readable":
                    self.db.execute("DELETE FROM archived_documents WHERE document_id=?", (document_id,))

    def archive_unsuccessful_documents(self, candidates: set[str] | None = None) -> list[str]:
        """Remove terminal problem inputs from the collection, retaining source and run evidence.

        Pending review, active work, and interrupted/recoverable runs are protected.
        A readable document that has never been classified is not a failed document.
        """
        with self.lock, self.db:
            self.db.execute("BEGIN IMMEDIATE")
            runs = self.runs(limit=None, include_archived=True)
            protected = {
                document_id
                for run in runs
                if run.kind == "classification"
                and run.status in {"queued", "running", "awaiting_review", "interrupted"}
                for document_id in run.request.get("document_ids", [])
            }
            latest = {}
            for run in runs:
                if run.kind == "classification":
                    for document_id, outcome in (run.result or {}).get("outcomes", {}).items():
                        latest.setdefault(document_id, outcome.get("status"))
            archived = []
            for document in self.documents().documents:
                if (
                    document.id in protected
                    or document.indexed
                    or candidates is not None
                    and document.id not in candidates
                ):
                    continue
                bad_text = document.extraction_status not in {"pending", "readable"}
                failed = latest.get(document.id) in {"failed", "extraction_issue", "excluded"}
                if not (bad_text or failed):
                    continue
                reason = document.extraction_status if bad_text else latest[document.id]
                self.db.execute(
                    "INSERT OR IGNORE INTO archived_documents VALUES (?, ?, ?)", (document.id, reason, now())
                )
                self.db.execute("DELETE FROM passage_fts WHERE document_id=?", (document.id,))
                archived.append(document.id)
            return archived

    def index_document(self, id: str):
        with self.lock, self.db:
            doc = self.get_document(id)
            if (
                self.is_archived(id)
                or doc.extraction_status != "readable"
                or doc.category == "unknown"
                or doc.category_provenance in {"excluded", "unclassified", "proposal"}
            ):
                raise ValueError("Only accepted, readable documents can be indexed")
            self.db.execute("DELETE FROM passage_fts WHERE document_id=?", (id,))
            self.db.executemany(
                "INSERT INTO passage_fts VALUES (?, ?, ?)",
                [(p.id, p.document_id, p.text) for p in self.passages(id)],
            )
            doc.indexed = True
            self.db.execute("UPDATE documents SET data=? WHERE id=?", (doc.model_dump_json(), id))

    @staticmethod
    def search_expression(phrase: str) -> str:
        # Only lexical tokens enter the FTS parser. User operators never become syntax.
        tokens = list(dict.fromkeys(re.findall(r"[^\W_]+", phrase.casefold(), re.UNICODE)))[:24]
        return " OR ".join('"' + token + '"' for token in tokens)

    def search(
        self,
        phrase: str,
        filters: SearchFilters,
        limit: int = 8,
        *,
        allowed_document_ids: list[str] | None = None,
    ) -> list[Passage]:
        expression = self.search_expression(phrase)
        if allowed_document_ids == []:
            return []
        if not expression:
            return []
        clauses = ["json_extract(d.data, '$.indexed') = 1"]
        params: list = [expression]
        if allowed_document_ids is not None:
            clauses.append("d.id IN (" + ",".join("?" for _ in allowed_document_ids) + ")")
            params.extend(allowed_document_ids)
        if filters.categories:
            clauses.append(
                "json_extract(d.data, '$.category') IN (" + ",".join("?" for _ in filters.categories) + ")"
            )
            params.extend(filters.categories)
        if filters.date_from or filters.date_to:
            clauses.append("json_extract(d.data, '$.document_date') IS NOT NULL")
        if filters.date_from:
            clauses.append("json_extract(d.data, '$.document_date') >= ?")
            params.append(filters.date_from.isoformat())
        if filters.date_to:
            clauses.append("json_extract(d.data, '$.document_date') <= ?")
            params.append(filters.date_to.isoformat())
        params.append(min(max(limit, 1), 24))
        with self.lock:
            rows = self.db.execute(
                "SELECT p.data FROM passage_fts f JOIN passages p ON p.id=f.passage_id "
                "JOIN documents d ON d.id=f.document_id WHERE passage_fts MATCH ? AND "
                + " AND ".join(clauses)
                + " ORDER BY bm25(passage_fts), p.id LIMIT ?",
                params,
            ).fetchall()
        return [Passage.model_validate_json(r["data"]) for r in rows]

    def create_run(
        self,
        kind: str,
        mode: str,
        request: dict,
        configuration: dict,
        idempotency_key: str | None = None,
        linked_run_id: str | None = None,
    ) -> tuple[Run, bool]:
        digest = hashlib.sha256(
            json.dumps({"kind": kind, "request": request}, sort_keys=True).encode()
        ).hexdigest()
        with self.lock, self.db:
            # Cleanup may run in a separate process beside the backend. Serialize
            # admission with it and check again after obtaining the write lock.
            self.db.execute("BEGIN IMMEDIATE")
            if idempotency_key:
                row = self.db.execute(
                    "SELECT data, request_hash FROM runs WHERE idempotency_key=?", (idempotency_key,)
                ).fetchone()
                if row:
                    if digest != row["request_hash"]:
                        raise ValueError("Idempotency key was already used with a different request")
                    return Run.model_validate_json(row["data"]), False
            if kind == "classification" and any(
                self.is_archived(id) for id in request.get("document_ids", [])
            ):
                raise ValueError(
                    "This input was cleared from the collection. Reload the example before starting a new run."
                )
            id = str(uuid4())
            run = Run(
                id=id,
                thread_id=id,
                kind=kind,
                mode=mode,
                request=request,
                configuration=configuration,
                linked_run_id=linked_run_id,
            )
            self.db.execute(
                "INSERT INTO runs VALUES (?, ?, ?, ?)", (id, run.model_dump_json(), idempotency_key, digest)
            )
        return run, True

    def get_run(self, id: str) -> Run:
        with self.lock:
            row = self.db.execute("SELECT data FROM runs WHERE id=?", (id,)).fetchone()
        if row is None:
            raise KeyError("Run not found")
        return Run.model_validate_json(row["data"])

    def update_run(self, id: str, **fields) -> Run:
        with self.lock, self.db:
            run = Run.model_validate(self.get_run(id).model_dump() | fields | {"updated_at": now()})
            self.db.execute("UPDATE runs SET data=? WHERE id=?", (run.model_dump_json(), id))
        return run

    def runs(self, limit: int | None = 100, *, include_archived: bool = False) -> list[Run]:
        with self.lock:
            rows = self.db.execute(
                "SELECT data FROM runs"
                + ("" if include_archived else " WHERE id NOT IN (SELECT run_id FROM archived_runs)")
                + " ORDER BY rowid DESC"
                + (" LIMIT ?" if limit else ""),
                (limit,) if limit else (),
            ).fetchall()
        return [Run.model_validate_json(r["data"]) for r in rows]

    def archive_unsuccessful_runs(self) -> list[str]:
        """Hide terminal failed/partial runs from the list; their events remain inspectable."""
        with self.lock, self.db:
            self.db.execute("BEGIN IMMEDIATE")
            ids = [run.id for run in self.runs(limit=None) if run.status in {"failed", "partially_succeeded"}]
            self.db.executemany(
                "INSERT OR IGNORE INTO archived_runs VALUES (?, ?)", [(id, now()) for id in ids]
            )
            return ids

    def append_event(
        self,
        run_id: str,
        type: str,
        instance_id: str,
        payload: dict,
        parent_instance_id=None,
        attempt=1,
        key=None,
    ) -> Event:
        payload = json_value(payload)
        logical_key = (
            key
            or hashlib.sha256(
                json.dumps([type, instance_id, attempt, payload], sort_keys=True).encode()
            ).hexdigest()
        )
        with self.lock, self.db:
            row = self.db.execute(
                "SELECT data FROM events WHERE run_id=? AND logical_key=?", (run_id, logical_key)
            ).fetchone()
            if row:
                return Event.model_validate_json(row["data"])
            run = self.get_run(run_id)
            seq = run.last_event_sequence + 1
            event = Event(
                event_id=f"{run_id}:{seq}",
                sequence=seq,
                run_id=run_id,
                type=type,
                instance_id=instance_id,
                parent_instance_id=parent_instance_id,
                attempt=attempt,
                payload=payload,
            )
            self.db.execute(
                "INSERT INTO events VALUES (?, ?, ?, ?)", (run_id, seq, logical_key, event.model_dump_json())
            )
            run.last_event_sequence = seq
            run.updated_at = now()
            self.db.execute("UPDATE runs SET data=? WHERE id=?", (run.model_dump_json(), run_id))
        return event

    def events(self, run_id: str, after=0) -> list[Event]:
        with self.lock:
            rows = self.db.execute(
                "SELECT data FROM events WHERE run_id=? AND sequence>? ORDER BY sequence", (run_id, after)
            ).fetchall()
        return [Event.model_validate_json(r["data"]) for r in rows]

    def snapshot(self, run_id: str) -> RunSnapshot:
        with self.lock:
            run = self.get_run(run_id)
            events = self.events(run_id)
            return RunSnapshot(run=run, events=events, last_event_sequence=run.last_event_sequence)
