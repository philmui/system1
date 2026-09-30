"""Explicit sanitized LangSmith spans. Automatic graph state tracing is disabled."""

import asyncio
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import Any

from langsmith import Client
from langsmith.run_trees import RunTree
from urllib3.util.retry import Retry

_SAFE = {
    "run_id",
    "thread_id",
    "worker_id",
    "document_id",
    "task_id",
    "passage_ids",
    "kind",
    "mode",
    "graph_version",
    "policy_version",
    "rubric_version",
    "choice_threshold",
    "relevance_threshold",
    "support_threshold",
    "provider",
    "configured_model",
    "returned_model",
    "request_id",
    "attempt",
    "elapsed_ms",
    "queue_wait_ms",
    "policy_elapsed_ms",
    "usage",
    "input_tokens",
    "output_tokens",
    "total_tokens",
    "cached_tokens",
    "reasoning_tokens",
    "input_tokens_details",
    "output_tokens_details",
    "status",
    "outcome",
    "route",
    "category",
    "confidence",
    "noul",
    "count",
    "indexed_count",
    "error_code",
    "phase",
}


def sanitized(value: dict[str, Any]) -> dict[str, Any]:
    """An allowlist keeps document text, prompts, queries and filenames out of traces."""
    result = {}
    for key, item in value.items():
        if key not in _SAFE:
            continue
        if isinstance(item, dict):
            result[key] = sanitized(item)
        elif isinstance(item, (str, bool, int, float)) or item is None:
            result[key] = item
        elif isinstance(item, list) and key == "passage_ids":
            result[key] = [str(x) for x in item]
    return result


_current: ContextVar[RunTree | None] = ContextVar("atlas_trace", default=None)


class Telemetry:
    def __init__(self, settings, storage):
        self.settings = settings
        self.storage = storage
        self.roots: dict[str, RunTree] = {}
        self.workers: dict[tuple[str, str], RunTree] = {}
        self.failed_runs: set[str] = set()
        self.client = None
        self.configuration_unavailable = False
        if settings.langsmith_tracing and settings.langsmith_api_key and settings.app_mode == "live":
            try:
                self.client = Client(
                    api_key=settings.langsmith_api_key.get_secret_value(),
                    api_url=settings.langsmith_endpoint,
                    timeout_ms=3000,
                    retry_config=Retry(total=0),
                    hide_inputs=self.filter_payload,
                    hide_outputs=self.filter_payload,
                    hide_metadata=self.filter_payload,
                    omit_traced_runtime_info=True,
                    tracing_error_callback=self._delivery_error,
                )
            except Exception:
                self.configuration_unavailable = True

    def filter_payload(self, value):
        result = sanitized(value)
        if (
            self.settings.langsmith_trace_synthetic_text
            and value.get("synthetic_verified") is True
            and isinstance(value.get("synthetic_excerpt"), str)
        ):
            # The caller resolves all references against trusted local metadata.
            result["synthetic_verified"] = True
            result["synthetic_excerpt"] = (
                value["synthetic_excerpt"].encode("utf-8")[:14_000].decode("utf-8", errors="ignore")
            )
        return result

    def _delivery_error(self, _error):
        self.failed_runs.update(self.roots)

    async def begin(self, run):
        if not self.client:
            status = (
                "disabled (Simulated)"
                if run.mode == "test-fixture"
                else ("missing key" if self.settings.langsmith_tracing else "disabled")
            )
            self.storage.update_run(
                run.id,
                telemetry_status="configuration unavailable" if self.configuration_unavailable else status,
                trace_url=None,
            )
            return None
        try:
            root = RunTree(
                name=f"Atlas {run.kind}",
                run_type="chain",
                project_name=self.settings.langsmith_project,
                ls_client=self.client,
                inputs=self.filter_payload(
                    {
                        "run_id": run.id,
                        "thread_id": run.thread_id,
                        "kind": run.kind,
                        "mode": run.mode,
                        **run.configuration,
                    }
                ),
                extra={
                    "metadata": {
                        "run_id": run.id,
                        "graph_version": run.graph_version,
                        "policy_version": run.policy_version,
                    }
                },
            )
            await asyncio.to_thread(root.post)
            self.roots[run.id] = root
            self.storage.update_run(run.id, telemetry_status="pending delivery", trace_url=None)
            return root
        except Exception:
            self.storage.update_run(run.id, telemetry_status="delivery unavailable", trace_url=None)
            return None

    async def start_worker(self, run_id, worker_id, metadata):
        root = self.roots.get(run_id)
        if not root or (run_id, worker_id) in self.workers:
            return
        try:
            child = root.create_child(
                name="Document worker",
                inputs=self.filter_payload({"run_id": run_id, "worker_id": worker_id, **metadata}),
            )
            await asyncio.to_thread(child.post)
            self.workers[(run_id, worker_id)] = child
        except Exception:
            self.failed_runs.add(run_id)

    async def end_worker(self, run_id, worker_id, status):
        child = self.workers.pop((run_id, worker_id), None)
        if child:
            try:
                child.end(outputs={"status": status})
                await asyncio.to_thread(child.patch)
            except Exception:
                self.failed_runs.add(run_id)

    @asynccontextmanager
    async def span(self, run_id: str, name: str, metadata: dict | None = None, run_type: str = "chain"):
        parent = (
            _current.get()
            or self.workers.get((run_id, (metadata or {}).get("worker_id")))
            or self.roots.get(run_id)
        )
        child = None
        output: dict = {}
        token = None
        if parent:
            try:
                child = parent.create_child(
                    name=name,
                    run_type=run_type,
                    inputs=self.filter_payload({"run_id": run_id, **(metadata or {})}),
                    extra={"metadata": self.filter_payload({"run_id": run_id, **(metadata or {})})},
                )
                await asyncio.to_thread(child.post)
                token = _current.set(child)
            except Exception:
                self.failed_runs.add(run_id)
                child = None
        try:
            yield output
        except BaseException:
            if child:
                child.end(
                    error="Application operation failed; see the local run record.",
                    outputs=self.filter_payload(output),
                )
            raise
        finally:
            if child:
                try:
                    if child.end_time is None:
                        child.end(outputs=self.filter_payload(output))
                    await asyncio.to_thread(child.patch)
                except Exception:
                    self.failed_runs.add(run_id)
            if token is not None:
                _current.reset(token)

    async def finish(self, run_id: str, status: str):
        for _, worker_id in [key for key in self.workers if key[0] == run_id]:
            await self.end_worker(run_id, worker_id, status)
        root = self.roots.get(run_id)
        if not root or not self.client:
            return
        try:
            root.end(outputs={"status": status})
            await asyncio.to_thread(root.patch)
            await asyncio.to_thread(self.client.flush, timeout=4)
            # A locally constructed URL is not evidence of delivery. Read the actual run.
            for attempt in range(3):
                try:
                    recorded = await asyncio.to_thread(self.client.read_run, root.id)
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(0.2 * (attempt + 1))
            url = await asyncio.to_thread(self.client.get_run_url, run=recorded)
            self.storage.update_run(
                run_id,
                trace_url=url,
                telemetry_status="partial delivery" if run_id in self.failed_runs else "delivered",
            )
        except Exception:
            self.storage.update_run(run_id, telemetry_status="delivery unverified", trace_url=None)
        finally:
            self.roots.pop(run_id, None)
            self.failed_runs.discard(run_id)

    async def close(self):
        if self.client:
            try:
                await asyncio.to_thread(self.client.flush, timeout=4)
                await asyncio.to_thread(self.client.close, timeout=4)
            except Exception:
                pass


async def jev_trace_evaluator(run, example=None):
    """Optional LangSmith async evaluator for retained local application traces.

    Configure APP_DATA_DIR to the trace's original application database. The
    trace supplies only an application run ID; claims and anchors are resolved
    locally. This opt-in callback performs at most eight live Jev calls. It is
    fallible judge feedback, never independent ground truth or a routing rule.
    """
    from .providers.jev import JevProvider
    from .schemas import Claim
    from .settings import Settings
    from .storage import Storage

    feedback = {
        "key": "jev_claim_support_probability",
        "score": None,
        "comment": "No retained live claims were available for this trace.",
    }
    inputs = getattr(run, "inputs", None) or {}
    metadata = (getattr(run, "extra", None) or {}).get("metadata", {})
    run_id = inputs.get("run_id") or metadata.get("run_id")
    settings = Settings()
    if not run_id or settings.app_mode != "live" or not (settings.app_data_dir / "application.db").exists():
        return feedback
    storage = Storage(settings.app_data_dir)
    provider = None
    try:
        recorded = storage.get_run(run_id)
        claims = (recorded.result or {}).get("claims", [])[:8]
        if recorded.mode != "live" or not claims:
            return feedback
        provider = JevProvider(settings)
        probabilities = []
        for value in claims:
            claim = Claim.model_validate(value)
            evidence = [
                storage.get_passage(pid) for pid in dict.fromkeys(c.passage_id for c in claim.citations)
            ]
            signal = await provider.support(claim.text, evidence)
            probabilities.append(signal.noul)
        return {
            "key": "jev_claim_support_probability",
            "score": sum(probabilities) / len(probabilities),
            "comment": f"Mean Noul support probability for {len(probabilities)} retained claims; atlas-rubric-v1. Compare with human references; this judge is not ground truth.",
        }
    except Exception:
        return {**feedback, "comment": "Local evidence lookup or the optional Jev evaluator was unavailable."}
    finally:
        if provider:
            await provider.close()
        storage.close()
