"""Single-process HTTP commands and resumable, durable-log SSE transport."""

import asyncio
import fcntl
from contextlib import asynccontextmanager
from datetime import date
from typing import Annotated

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse, StreamingResponse
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from .classification_measurements import router as classification_measurements_router
from .events import Events
from .ingestion import ingest, load_samples, normalized_filename
from .lessons import router as lessons_router
from .providers.openai import OpenAIProvider
from .review_lessons import router as review_lessons_router
from .schemas import (
    EVENT_PAYLOAD_MODELS,
    TERMINAL,
    Category,
    ClassificationRequest,
    DiscoveryRequest,
    Document,
    DocumentList,
    MetadataUpdate,
    Passage,
    ReviewSubmission,
    Run,
    RunSnapshot,
    SearchFilters,
)
from .settings import Settings
from .storage import Storage


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        from .workflows.engine import WorkflowEngine

        settings.app_data_dir.mkdir(parents=True, exist_ok=True)
        lease = (settings.app_data_dir / "backend.lock").open("a")
        try:
            fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            lease.close()
            raise RuntimeError(
                "This data directory is already owned by a backend process; use one worker."
            ) from None
        storage = Storage(settings.app_data_dir)
        events = Events(storage)
        app.state.storage, app.state.events = storage, events
        app.state.tasks = {}
        app.state.locks = {}
        app.state.execution_slots = asyncio.Semaphore(settings.max_concurrency)
        app.state.lesson_interpret_slots = asyncio.Semaphore(1)
        app.state.lesson_allowed_origins = {value.strip() for value in settings.cors_origins.split(",")}
        # Default lesson configuration; each explicit request owns a provider
        # with its allowlisted model selection, without changing this object.
        app.state.lesson_openai = OpenAIProvider(
            settings.model_copy(update={"app_mode": "live", "openai_model": "gpt-5.5"})
        )
        # The local queue is in-process. A restart makes unfinished work visible and recoverable.
        for run in storage.runs(limit=None):
            if run.status in {"running", "queued"}:
                storage.update_run(
                    run.id, status="interrupted", error="Backend restarted during in-process execution."
                )
                await events.emit(
                    run.id,
                    "run_completed",
                    "run",
                    {"status": "interrupted", "result": None, "timing_incomplete": True},
                    key=f"restart:{run.last_event_sequence}",
                )
        async with AsyncSqliteSaver.from_conn_string(str(settings.app_data_dir / "checkpoints.db")) as saver:
            await saver.setup()
            app.state.engine = WorkflowEngine(settings, storage, events, saver)
            try:
                yield
            finally:
                tasks = list(app.state.tasks.items())
                for _, task in tasks:
                    task.cancel()
                if tasks:
                    await asyncio.gather(*(t for _, t in tasks), return_exceptions=True)
                for id, _ in tasks:
                    run = storage.get_run(id)
                    if run.status in {"queued", "running"}:
                        storage.update_run(
                            id, status="interrupted", error="Backend stopped during execution."
                        )
                await app.state.engine.close()
                await app.state.lesson_openai.close()
        storage.close()
        lease.close()

    app = FastAPI(
        title="Document Discovery Studio",
        version="1.0.0",
        lifespan=lifespan,
        description="Single-user Atlas demonstration. JSON commands, retained sources and ordered SSE execution records.",
    )
    app.include_router(lessons_router)
    app.include_router(classification_measurements_router)
    app.include_router(review_lessons_router)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[x.strip() for x in settings.cors_origins.split(",") if x.strip()],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type", "Idempotency-Key", "Last-Event-ID"],
    )

    @app.exception_handler(KeyError)
    async def missing(request, exc):
        return JSONResponse(status_code=404, content={"detail": str(exc).strip("'")})

    def lock(id):
        return app.state.locks.setdefault(id, asyncio.Lock())

    def launch(run_id: str, resume=None, recover=False):
        current = app.state.tasks.get(run_id)
        if current and not current.done():
            raise HTTPException(409, "This run already has an active execution")

        async def job():
            try:
                async with app.state.execution_slots:
                    if app.state.storage.get_run(run_id).status == "cancelled":
                        return
                    await app.state.engine.execute(run_id, resume=resume, recover=recover)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                # Provider payloads/keys must not appear in logs or public exception strings.
                error = f"Execution failed ({type(exc).__name__}). Inspect readiness and retry a linked run."
                app.state.storage.update_run(run_id, status="failed", error=error)
                await app.state.events.emit(
                    run_id, "run_completed", "run", {"status": "failed", "result": None}
                )
            finally:
                app.state.tasks.pop(run_id, None)

        app.state.tasks[run_id] = asyncio.create_task(job(), name=f"run:{run_id}")

    @app.get("/api/health")
    async def health():
        integrations = {
            "jev": "configured" if settings.typesafe_api_key else "missing_credentials",
            "openai": "configured" if settings.openai_api_key else "missing_credentials",
            "langsmith": "disabled"
            if not settings.langsmith_tracing
            else "configured"
            if settings.langsmith_api_key
            else "missing_credentials",
        }
        for name in ("jev", "openai"):
            adapter = getattr(app.state.engine, name)
            error = getattr(adapter, "initialization_error", None) or getattr(adapter, "last_error", None)
            if error and settings.app_mode == "live":
                integrations[name] = f"provider_error: {error.code}"
        recent = app.state.storage.runs()
        return {
            "status": "ok",
            "mode": settings.app_mode,
            "fts5": app.state.storage.fts5,
            "integrations": integrations,
            "configuration": settings.public_config(),
            "readiness_note": "Configured means a key is present; live execution checks provider availability.",
            "last_run_error": next((r.error for r in recent if r.error), None),
        }

    @app.get("/api/documents", response_model=DocumentList)
    async def documents(
        category: Category | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        include_archived: bool = False,
    ):
        if date_from and date_to and date_from > date_to:
            raise HTTPException(422, "date_from must be before date_to")
        return app.state.storage.documents(
            SearchFilters(categories=[category] if category else [], date_from=date_from, date_to=date_to),
            include_archived=include_archived,
        )

    @app.post("/api/documents/cleanup")
    async def cleanup_documents():
        return {"archived_document_ids": app.state.storage.archive_unsuccessful_documents()}

    @app.post("/api/documents")
    async def upload(
        files: Annotated[list[UploadFile], File()], document_date: Annotated[date | None, Form()] = None
    ):
        if not 1 <= len(files) <= 30:
            raise HTTPException(422, "Upload between 1 and 30 files at a time")
        # Validate every file before writes so invalid types/sizes cannot silently import part of a batch.
        inputs = []
        for file in files:
            raw = await file.read(settings.max_upload_bytes + 1)
            try:
                filename = normalized_filename(file.filename or "untitled.txt")
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from None
            if len(raw) > settings.max_upload_bytes:
                raise HTTPException(413, f"{filename[:80]} exceeds the upload size limit")
            inputs.append((filename, raw))
        docs = [
            await asyncio.to_thread(ingest, app.state.storage, settings, name, raw, document_date)
            for name, raw in inputs
        ]
        return {"documents": docs}

    @app.post("/api/samples")
    async def samples():
        docs = await asyncio.to_thread(load_samples, app.state.storage, settings)
        app.state.storage.restore_readable_documents([doc.id for doc in docs])
        app.state.storage.archive_unsuccessful_documents(
            {doc.id for doc in docs if doc.extraction_status != "readable"}
        )
        return {
            "documents": [
                doc
                for doc in docs
                if doc.extraction_status == "readable" and not app.state.storage.is_archived(doc.id)
            ]
        }

    @app.post("/api/samples/classification")
    async def classification_samples():
        docs = await asyncio.to_thread(load_samples, app.state.storage, settings, True)
        app.state.storage.restore_readable_documents([doc.id for doc in docs])
        return {"documents": docs}

    @app.get("/api/documents/{document_id}")
    async def document(document_id: str):
        return {
            "document": app.state.storage.get_document(document_id),
            "passages": app.state.storage.passages(document_id),
        }

    @app.patch("/api/documents/{document_id}", response_model=Document)
    async def metadata(document_id: str, body: MetadataUpdate):
        return app.state.storage.update_document(
            document_id,
            document_date=body.document_date,
            date_provenance="user_confirmed" if body.document_date else "unknown",
        )

    @app.get("/api/passages/{passage_id}", response_model=Passage)
    async def passage(passage_id: str):
        return app.state.storage.get_passage(passage_id)

    async def start(kind, body, key):
        if key is not None and (not key.strip() or len(key) > 200):
            raise HTTPException(422, "Idempotency-Key must contain 1 to 200 nonblank characters")
        request = body.model_dump(mode="json")
        # A retry of an accepted command does not consume queue capacity.
        if (
            key
            and app.state.storage.db.execute("SELECT id FROM runs WHERE idempotency_key=?", (key,)).fetchone()
        ):
            try:
                return app.state.storage.create_run(
                    kind, settings.app_mode, request, settings.public_config(), key
                )[0]
            except ValueError as exc:
                raise HTTPException(409, str(exc)) from None

        if kind == "classification":
            ids = request["document_ids"]
            if len(set(ids)) != len(ids):
                raise HTTPException(422, "Document IDs must be unique")
            for id in ids:
                app.state.storage.get_document(id)
                if app.state.storage.is_archived(id):
                    raise HTTPException(
                        409,
                        "This document was removed from the collection. Import a readable copy to classify it again.",
                    )
            active = [
                r
                for r in app.state.storage.runs(limit=None)
                if r.status in {"queued", "running", "awaiting_review"}
            ]
            # A replayed idempotency request can return its original run; check after creation below.
            collisions = [
                r
                for r in active
                if r.kind == "classification" and set(ids) & set(r.request.get("document_ids", []))
            ]
        else:
            collisions = []
        if len(app.state.tasks) >= 16:
            raise HTTPException(429, "The local queue is full; wait for an active run to finish")
        try:
            # One event loop owns commands; there is no await between collision check and creation.
            if collisions:
                if key:
                    row = app.state.storage.db.execute(
                        "SELECT id FROM runs WHERE idempotency_key=?", (key,)
                    ).fetchone()
                    if row and any(r.id == row["id"] for r in collisions):
                        return app.state.storage.create_run(
                            kind, settings.app_mode, request, settings.public_config(), key
                        )[0]
                raise HTTPException(
                    409, "A document is already assigned to an active classification or review"
                )
            run, created = app.state.storage.create_run(
                kind, settings.app_mode, request, settings.public_config(), key
            )
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None
        if created:
            launch(run.id)
        return run

    @app.post("/api/runs/classification", response_model=Run, status_code=202)
    async def classify(body: ClassificationRequest, idempotency_key: Annotated[str | None, Header()] = None):
        return await start("classification", body, idempotency_key)

    @app.post("/api/runs/discovery", response_model=Run, status_code=202)
    async def discover(body: DiscoveryRequest, idempotency_key: Annotated[str | None, Header()] = None):
        return await start("discovery", body, idempotency_key)

    @app.get("/api/runs")
    async def runs():
        return {"runs": app.state.storage.runs()}

    @app.post("/api/runs/cleanup")
    async def cleanup_runs():
        return {"archived_run_ids": app.state.storage.archive_unsuccessful_runs()}

    @app.get("/api/runs/{run_id}", response_model=RunSnapshot)
    async def snapshot(run_id: str):
        return app.state.storage.snapshot(run_id)

    @app.get("/api/runs/{run_id}/history")
    async def history(run_id: str, after: int = Query(default=0, ge=0)):
        app.state.storage.get_run(run_id)
        return {"events": app.state.storage.events(run_id, after)}

    @app.get("/api/runs/{run_id}/events")
    async def stream(
        request: Request,
        run_id: str,
        after: int = Query(default=0, ge=0),
        last_event_id: Annotated[str | None, Header()] = None,
    ):
        app.state.storage.get_run(run_id)
        try:
            cursor = max(after, int(last_event_id or 0))
        except ValueError:
            raise HTTPException(422, "Last-Event-ID must be an event sequence number") from None

        async def generate():
            nonlocal cursor
            while not await request.is_disconnected():
                snapshot = app.state.storage.snapshot(run_id)
                pending = [e for e in snapshot.events if e.sequence > cursor]
                for event in pending:
                    yield f"id: {event.sequence}\nevent: execution\ndata: {event.model_dump_json()}\n\n"
                    cursor = event.sequence
                if snapshot.run.status in TERMINAL or snapshot.run.status == "awaiting_review":
                    yield "event: settled\ndata: {}\n\n"
                    return
                if not pending:
                    yield ": heartbeat\n\n"
                await app.state.events.wait(1)

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
        )

    def ensure_compatible(run):
        if not app.state.engine.compatible(run):
            raise HTTPException(
                409,
                "The saved graph, mode, or policy configuration differs. Restore the original configuration to resume, or cancel and start a linked new run.",
            )

    def ensure_queue_capacity():
        if len(app.state.tasks) >= 16:
            raise HTTPException(429, "The local queue is full; wait for an active run to finish")

    @app.post("/api/runs/{run_id}/review", response_model=Run, status_code=202)
    async def review(run_id: str, body: ReviewSubmission):
        async with lock(run_id):
            run = app.state.storage.get_run(run_id)
            if run.status != "awaiting_review" or not run.review:
                raise HTTPException(409, "This run is not awaiting review")
            ensure_compatible(run)
            if body.interrupt_id != run.review.interrupt_id or body.revision != run.review.revision:
                raise HTTPException(409, "This review is stale; reload the run")
            expected = {i.document_id for i in run.review.items}
            actual = [d.document_id for d in body.decisions]
            if set(actual) != expected or len(actual) != len(expected):
                raise HTTPException(409, "Submit exactly one decision for every outstanding item")
            for d in body.decisions:
                if d.action == "correct" and d.category in {None, "unknown"}:
                    raise HTTPException(422, "A correction requires a readable category other than unknown")
                if d.action == "accept":
                    item = next(i for i in run.review.items if i.document_id == d.document_id)
                    if item.proposal == "unknown":
                        raise HTTPException(
                            422, "Unknown cannot be accepted; choose a category or exclude the item"
                        )
            ensure_queue_capacity()
            app.state.storage.update_run(run_id, status="queued")
            launch(run_id, resume=body.model_dump(mode="json"))
            return app.state.storage.get_run(run_id)

    @app.post("/api/runs/{run_id}/cancel", response_model=Run)
    async def cancel(run_id: str):
        async with lock(run_id):
            run = app.state.storage.get_run(run_id)
            if run.status in TERMINAL and run.status != "interrupted":
                return run
            app.state.storage.update_run(run_id, status="cancelled")
            task = app.state.tasks.get(run_id)
            if task:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
            app.state.storage.update_run(run_id, status="cancelled")
            await app.state.events.emit(
                run_id, "run_completed", "run", {"status": "cancelled", "result": None}
            )
            return app.state.storage.get_run(run_id)

    def ensure_documents_idle(run):
        if run.kind != "classification":
            return
        ids = set(run.request["document_ids"])
        for other in app.state.storage.runs(limit=None):
            if (
                other.id != run.id
                and other.kind == "classification"
                and other.status in {"queued", "running", "awaiting_review"}
                and ids.intersection(other.request["document_ids"])
            ):
                raise HTTPException(409, "A document is assigned to another active classification or review")

    @app.post("/api/runs/{run_id}/recover", response_model=Run, status_code=202)
    async def recover(run_id: str):
        async with lock(run_id):
            run = app.state.storage.get_run(run_id)
            if run.status != "interrupted":
                raise HTTPException(409, "Only interrupted executions can recover")
            if not app.state.engine.compatible(run):
                raise HTTPException(409, "Configuration or graph version changed; start a linked new run")
            eligible, reason = await app.state.engine.can_recover(run_id)
            if not eligible:
                raise HTTPException(409, reason + "; start a linked new run")
            ensure_documents_idle(run)
            ensure_queue_capacity()
            app.state.storage.update_run(run_id, status="queued", error=None)
            launch(run_id, recover=True)
            return app.state.storage.get_run(run_id)

    @app.post("/api/runs/{run_id}/restart", response_model=Run, status_code=202)
    async def restart(run_id: str):
        old = app.state.storage.get_run(run_id)
        if old.status not in TERMINAL:
            raise HTTPException(409, "Cancel active work before starting a linked new run")
        if old.kind == "classification" and any(
            app.state.storage.is_archived(id) for id in old.request["document_ids"]
        ):
            raise HTTPException(
                409,
                "Some inputs were removed from the collection. Reload readable examples or import a readable copy before starting a new run.",
            )
        ensure_documents_idle(old)
        if len(app.state.tasks) >= 16:
            raise HTTPException(429, "The local queue is full; wait for an active run to finish")
        run, _ = app.state.storage.create_run(
            old.kind, settings.app_mode, old.request, settings.public_config(), linked_run_id=run_id
        )
        launch(run.id)
        return run

    def public_openapi():
        if app.openapi_schema is not None:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title, version=app.version, description=app.description, routes=app.routes
        )
        components = schema.setdefault("components", {}).setdefault("schemas", {})
        payload_types = list(dict.fromkeys(EVENT_PAYLOAD_MODELS.values()))
        for model in payload_types:
            definition = model.model_json_schema(ref_template="#/components/schemas/{model}")
            components.update(definition.pop("$defs", {}))
            components[model.__name__] = definition
        # Runtime validation uses the same mapping. Expose each validated payload in Swagger,
        # while retaining plain JSON dictionaries for the local event log and SSE wire format.
        components["Event"]["properties"]["payload"] = {
            "title": "Execution payload",
            "oneOf": [{"$ref": f"#/components/schemas/{model.__name__}"} for model in payload_types],
            "description": "The event type selects its validated payload schema.",
        }
        components["Event"]["allOf"] = [
            {
                "if": {"properties": {"type": {"const": event_type}}},
                "then": {"properties": {"payload": {"$ref": f"#/components/schemas/{model.__name__}"}}},
            }
            for event_type, model in EVENT_PAYLOAD_MODELS.items()
        ]
        app.openapi_schema = schema
        return schema

    app.openapi = public_openapi
    return app


app = create_app()
