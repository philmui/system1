"""Reproducible local setup, fixture walkthrough and opt-in synthetic live check."""

import argparse
import asyncio
import json
import shutil
import time

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from .evaluation import count_provider_calls, evaluate
from .events import Events
from .ingestion import load_samples
from .schemas import ReviewSubmission
from .settings import ROOT, Settings
from .storage import Storage, data_lease


async def run_walkthrough(settings: Settings):
    from .workflows.engine import WorkflowEngine

    storage = Storage(settings.app_data_dir)
    docs = load_samples(storage, settings)
    selected = [
        d.id
        for d in docs
        if d.filename
        in {
            "atlas-invoice-march.md",
            "atlas-ambiguous-agreement-email.md",
            "atlas-northstar-service-agreement.md",
            "atlas-copperleaf-service-agreement.md",
        }
    ]
    # Select the mixed email by manifest route to keep the walkthrough independent of filenames.
    manifest = json.loads((ROOT / "data/samples/manifest.json").read_text())
    ambiguous = {d["filename"] for d in manifest["documents"] if d["expected_route"] == "review"}
    selected = list(dict.fromkeys(selected + [d.id for d in docs if d.filename in ambiguous]))
    events = Events(storage)
    async with AsyncSqliteSaver.from_conn_string(str(settings.app_data_dir / "checkpoints.db")) as saver:
        await saver.setup()
        engine = WorkflowEngine(settings, storage, events, saver)
        try:
            run, _ = storage.create_run(
                "classification", settings.app_mode, {"document_ids": selected}, settings.public_config()
            )
            started = time.perf_counter()
            await engine.execute(run.id)
            classification = storage.get_run(run.id)
            review_observed = classification.status == "awaiting_review"
            if classification.review:
                # This is an explicit synthetic smoke-test reviewer, not automatic production acceptance.
                submission = ReviewSubmission(
                    interrupt_id=classification.review.interrupt_id,
                    revision=classification.review.revision,
                    decisions=[
                        {"document_id": i.document_id, "action": "correct", "category": "correspondence"}
                        for i in classification.review.items
                    ],
                )
                await engine.execute(run.id, resume=submission.model_dump(mode="json"))
            classification = storage.get_run(run.id)
            query, _ = storage.create_run(
                "discovery",
                settings.app_mode,
                {
                    "query": "Compare the termination notice periods in the Atlas service agreements.",
                    "filters": {},
                },
                settings.public_config(),
            )
            await engine.execute(query.id)
            discovery = storage.get_run(query.id)
            ev = storage.events(run.id) + storage.events(query.id)
            decisions = [e.payload for e in ev if e.type == "decision"]
            jev = [d for d in decisions if d["signal"]["provider"] == "jev"]
            openai = [d for d in decisions if d["signal"]["provider"] == "openai"]
            report = {
                "mode": settings.app_mode,
                "synthetic_inputs_only": True,
                "classification": {
                    "run_id": run.id,
                    "status": classification.status,
                    "review_observed": review_observed,
                    "result": classification.result,
                },
                "discovery": {"run_id": query.id, "status": discovery.status, "result": discovery.result},
                "jev_decisions": len(jev),
                "openai_decisions": len(openai),
                "decision_models": sorted(
                    {d["signal"].get("returned_model") or "unavailable" for d in decisions}
                ),
                "completed_provider_calls": {
                    "classification": count_provider_calls(storage.events(run.id)),
                    "discovery": count_provider_calls(storage.events(query.id)),
                },
                "elapsed_seconds": round(time.perf_counter() - started, 3),
                "telemetry": {
                    "classification": classification.telemetry_status,
                    "discovery": discovery.telemetry_status,
                },
                "trace_urls": [r.trace_url for r in (classification, discovery) if r.trace_url],
                "errors": [r.error for r in (classification, discovery) if r.error],
            }
            (settings.app_data_dir / "smoke-report.json").write_text(json.dumps(report, indent=2))
            # Prints only safe IDs/statuses, never document inputs, raw exceptions or credentials.
            print(
                json.dumps(
                    {k: v for k, v in report.items() if k not in {"classification", "discovery"}}
                    | {
                        "classification_status": classification.status,
                        "discovery_status": discovery.status,
                        "report": str(settings.app_data_dir / "smoke-report.json"),
                    },
                    indent=2,
                )
            )
            return report
        finally:
            await engine.close()
            storage.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=["init", "load-samples", "teaching-runs", "demo", "live-smoke", "evaluate", "reset"],
    )
    parser.add_argument(
        "--live", action="store_true", help="Make paid provider calls for evaluation (synthetic data only)"
    )
    parser.add_argument(
        "--confirm", action="store_true", help="Confirm deletion of generated .runtime demo data"
    )
    parser.add_argument("--case", dest="case_id", help="Evaluate just one labeled case by its ID")
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Clear unsuccessful documents and failed/partial runs when creating teaching runs; retain their history",
    )
    args = parser.parse_args()
    settings = Settings()
    if args.command in {"init", "load-samples"}:
        storage = Storage(settings.app_data_dir)
        if args.command == "load-samples":
            documents = load_samples(storage, settings)
            storage.restore_readable_documents([document.id for document in documents])
            storage.archive_unsuccessful_documents({document.id for document in documents})
            readable = sum(document.extraction_status == "readable" for document in documents)
            print(f"Loaded {readable} readable synthetic documents; classify them in the interface.")
        else:
            print("SQLite initialized; FTS5 available.")
        storage.close()
    elif args.command == "teaching-runs":
        from .teaching_runs import seed_teaching_runs

        print(
            json.dumps(asyncio.run(seed_teaching_runs(settings.app_data_dir, cleanup=args.cleanup)), indent=2)
        )
    elif args.command == "reset":
        if not args.confirm or settings.app_data_dir.resolve() != (ROOT / ".runtime").resolve():
            parser.error(
                "Reset requires --confirm and APP_DATA_DIR=.runtime. Custom data directories are never deleted."
            )
        if settings.app_data_dir.exists():
            import fcntl

            with (settings.app_data_dir / "backend.lock").open("a") as lease:
                try:
                    fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    parser.error("Stop the backend before resetting demo data.")
                shutil.rmtree(settings.app_data_dir)
        print("Generated .runtime data removed; sources, notes, and .env preserved.")
    elif args.command == "evaluate":
        settings = settings.model_copy(update={"app_mode": "live" if args.live else "test-fixture"})
        asyncio.run(evaluate(settings, args.case_id))
    else:
        settings = settings.model_copy(
            update={"app_mode": "live" if args.command == "live-smoke" else "test-fixture"}
        )
        if args.command == "live-smoke" and not (settings.typesafe_api_key and settings.openai_api_key):
            parser.error(
                "Live smoke needs TYPESAFE_API_KEY and OPENAI_API_KEY; no fixture fallback is permitted."
            )
        with data_lease(settings.app_data_dir):
            report = asyncio.run(run_walkthrough(settings))
        if any(report[kind]["status"] != "succeeded" for kind in ("classification", "discovery")):
            raise SystemExit(1)


if __name__ == "__main__":
    main()
