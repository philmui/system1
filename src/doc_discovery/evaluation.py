"""Small held-out evaluation; fixture metrics are explicitly mechanical checks."""

import json
import time
from pathlib import Path
from tempfile import TemporaryDirectory

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from .events import Events
from .ingestion import ingest, load_samples
from .settings import ROOT, Settings
from .storage import Storage


def count_provider_calls(events):
    requests = set()
    for event in events:
        if event.type != "node_completed" or not event.payload.get("detail"):
            continue
        try:
            metadata = json.loads(event.payload["detail"])
        except ValueError, TypeError:
            continue
        if isinstance(metadata, dict) and metadata.get("provider"):
            requests.add(metadata.get("request_id") or f"{event.instance_id}:{event.attempt}")
    return len(requests)


async def evaluate(settings: Settings, case_id: str | None = None):
    """Run separate labeled examples through the same graph and policy, with no tuning."""
    from .workflows.engine import WorkflowEngine

    with TemporaryDirectory(prefix="atlas-evaluation-") as tmp:
        temp_settings = settings.model_copy(update={"app_data_dir": Path(tmp), "langsmith_tracing": False})
        storage = Storage(Path(tmp))
        async with AsyncSqliteSaver.from_conn_string(str(Path(tmp) / "checkpoints.db")) as saver:
            await saver.setup()
            engine = WorkflowEngine(temp_settings, storage, Events(storage), saver)
            try:
                cases = json.loads((ROOT / "data/evaluation/classification.json").read_text())["cases"]
                if case_id:
                    cases = [c for c in cases if c["id"] == case_id]
                observations = []
                for case in cases:
                    d = ingest(
                        storage, temp_settings, case["id"] + ".txt", case["text"].encode(), synthetic=True
                    )
                    run, _ = storage.create_run(
                        "classification",
                        settings.app_mode,
                        {"document_ids": [d.id]},
                        temp_settings.public_config(),
                    )
                    t = time.perf_counter()
                    await engine.execute(run.id)
                    final = storage.get_run(run.id)
                    decisions = [e.payload for e in storage.events(run.id) if e.type == "decision"]
                    choice = next(
                        (x["signal"]["choice"] for x in decisions if x["signal"]["kind"] == "choice"), None
                    )
                    observations.append(
                        {
                            "id": case["id"],
                            "expected": case["expected_category"],
                            "observed": choice,
                            "correct": choice == case["expected_category"],
                            "expected_escalation": case["expect_escalation"],
                            "escalated": final.status == "awaiting_review",
                            "status": final.status,
                            "provider_calls": len(
                                {x["signal"].get("request_id") or x["id"] for x in decisions}
                            ),
                            "elapsed_ms": round((time.perf_counter() - t) * 1000, 1),
                        }
                    )
                # Retrieval evaluation uses a reference-labeled corpus to isolate retrieval
                # from classification errors. These labels are not simulated provider outputs.
                for prior in storage.documents().documents:
                    storage.update_document(prior.id, indexed=False)
                samples = load_samples(storage, temp_settings)
                manifest = json.loads((ROOT / "data/samples/manifest.json").read_text())
                references = {d["filename"]: d for d in manifest["documents"]}
                for doc in samples:
                    ref = references[doc.filename]
                    if doc.extraction_status == "readable" and ref["expected_route"] == "accepted":
                        storage.update_document(
                            doc.id,
                            category=ref["expected_category"],
                            category_provenance="evaluation_reference",
                        )
                        storage.index_document(doc.id)
                discovery = []
                query_cases = json.loads((ROOT / "data/evaluation/discovery.json").read_text())["cases"]
                if case_id:
                    query_cases = [c for c in query_cases if c["id"] == case_id]
                    if not cases and not query_cases:
                        raise ValueError("Unknown evaluation case ID")
                for case in query_cases:
                    run, _ = storage.create_run(
                        "discovery",
                        settings.app_mode,
                        {"query": case["query"], "filters": case.get("filters", {})},
                        temp_settings.public_config(),
                    )
                    started = time.perf_counter()
                    await engine.execute(run.id)
                    final = storage.get_run(run.id)
                    result = final.result or {}
                    passages = result.get("passages", [])
                    claims = result.get("claims", [])
                    citations = [c for claim in claims for c in claim["citations"]]
                    valid = sum(c["quote"] in storage.get_passage(c["passage_id"]).text for c in citations)
                    observed = sorted({p["filename"] for p in passages})
                    expected = case.get("expected_filenames", case.get("relevant_filenames", []))
                    discovery.append(
                        {
                            "id": case["id"],
                            "status": final.status,
                            "expected_relevant_filenames": expected,
                            "observed_filenames": observed,
                            "relevant_returned": len(set(expected) & set(observed)),
                            "returned_count": len(observed),
                            "reference_count": len(expected),
                            "citations_valid": valid,
                            "citations_total": len(citations),
                            "claims_retained": len(claims),
                            "claims": claims,
                            "missing_evidence": result.get("missing_evidence", []),
                            "provider_calls": count_provider_calls(storage.events(run.id)),
                            "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
                            "relevance_checks": sum(
                                e.type == "decision"
                                and e.payload["signal"]["kind"] == "noul"
                                and not e.instance_id.startswith("support")
                                for e in storage.events(run.id)
                            ),
                            "support_checks": sum(
                                e.type == "decision"
                                and e.payload["signal"]["kind"] == "noul"
                                and e.instance_id.startswith("support")
                                for e in storage.events(run.id)
                            ),
                            "note": "Noul judgments are fallible checks, not independent ground truth.",
                        }
                    )
                report = {
                    "mode": settings.app_mode,
                    "split": "held-out; no threshold tuning",
                    "category_correct": sum(x["correct"] for x in observations),
                    "category_total": len(observations),
                    "escalation_correct": sum(
                        x["escalated"] == x["expected_escalation"] for x in observations
                    ),
                    "cases": observations,
                    "discovery_cases": discovery,
                    "retrieval_condition": "Reference-labeled readable Atlas corpus; ambiguous and empty excluded.",
                    "note": "Fixture results verify mechanics only. Live results are a small labeled sample, not broad reliability.",
                }
                settings.app_data_dir.mkdir(parents=True, exist_ok=True)
                target = settings.app_data_dir / (
                    f"evaluation-{case_id}.json" if case_id else "evaluation-report.json"
                )
                target.write_text(json.dumps(report, indent=2))
                print(json.dumps(report, indent=2))
            finally:
                await engine.close()
                storage.close()
