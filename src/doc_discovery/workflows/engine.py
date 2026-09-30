"""Translate executed LangGraph work into the stable public event contract."""

import asyncio
import json
from collections.abc import Awaitable, Callable
from time import perf_counter
from typing import Any

from langgraph.types import Command
from langsmith import tracing_context

from ..policies import select_context
from ..providers.common import ProviderError, safe_error
from ..providers.jev import JevProvider
from ..providers.openai import OpenAIProvider
from ..schemas import (
    GRAPH_VERSION,
    POLICY_VERSION,
    Answer,
    Decision,
    NodePayload,
    QueryPlan,
    ReviewRequest,
    ReviewSubmission,
)
from ..telemetry import Telemetry
from .classify import build_classification
from .discover import build_discovery, protect_discovery_result

_LABELS = {
    "extract": "Read retained text & anchors",
    "jev": "Jev category judgment",
    "interpret": "OpenAI proposal",
    "outcome": "Worker outcome",
    "join": "Join worker outcomes",
    "index": "Index accepted documents",
    "intent": "Jev intent judgment",
    "plan": "OpenAI query plan",
    "screen": "Jev evidence screening",
    "synthesize": "OpenAI cited answer",
    "support": "Jev claim support",
    "retrieve": "FTS5 retrieval",
}


class WorkflowEngine:
    def __init__(self, settings, storage, events, checkpointer):
        self.settings, self.storage, self.events = settings, storage, events
        self.jev, self.openai = JevProvider(settings), OpenAIProvider(settings)
        self.telemetry = Telemetry(settings, storage)
        self.provider_slots = asyncio.Semaphore(settings.max_concurrency)
        self._attempts: dict[tuple[str, str], int] = {}
        self._node_starts: dict[tuple[str, str, int], float] = {}
        self._node_durations: dict[tuple[str, str, int], float] = {}
        self.classification = build_classification(self, checkpointer)
        self.discovery = build_discovery(self, checkpointer)

    def graph(self, run):
        return self.classification if run.kind == "classification" else self.discovery

    def config(self, run):
        return {
            "configurable": {"thread_id": run.thread_id},
            "max_concurrency": self.settings.max_concurrency,
            "recursion_limit": 60,
            "callbacks": [],
        }

    def ensure_active(self, run_id):
        if self.storage.get_run(run_id).status == "cancelled":
            raise asyncio.CancelledError()

    def attempt(self, run_id, instance):
        return self._attempts.get((run_id, instance), 1)

    async def node(self, run_id, instance, name, state, parent=None, label=None, attempt=1, **fields):
        self.ensure_active(run_id)
        timing_key = (run_id, instance, attempt)
        if state == "running":
            self._node_starts.setdefault(timing_key, perf_counter())
        elif state not in {"queued"}:
            if timing_key in self._node_starts:
                self._node_durations.setdefault(
                    timing_key, max(0, (perf_counter() - self._node_starts[timing_key]) * 1000)
                )
            if timing_key in self._node_durations:
                fields.setdefault("elapsed_ms", self._node_durations[timing_key])
        if name == "worker":
            if state == "running":
                await self.telemetry.start_worker(run_id, instance, fields)
            else:
                await self.telemetry.end_worker(run_id, instance, state)
        event_type = (
            "node_failed"
            if state == "failed"
            else ("node_started" if state in {"running", "queued", "awaiting_review"} else "node_completed")
        )
        payload = NodePayload(
            node_name=name,
            label=label or _LABELS.get(name, name.replace("_", " ").capitalize()),
            state=state,
            **fields,
        )
        await self.events.emit(
            run_id,
            event_type,
            instance,
            payload.model_dump(exclude_none=True),
            parent_instance_id=parent,
            attempt=attempt,
            key=f"{event_type}:{instance}:{state}:{attempt}:{fields.get('completed', '')}",
        )

    async def edge(self, run_id, source, target, label):
        self.ensure_active(run_id)
        await self.events.emit(
            run_id,
            "edge_selected",
            source,
            {"source_instance_id": source, "target_instance_id": target, "label": label},
            key=f"edge:{source}:{target}:{label}",
        )

    def synthetic_trace_context(self, refs):
        """Verify every source identity; never trust a filename or provider assertion."""
        if not self.settings.langsmith_trace_synthetic_text or not refs:
            return {}
        passages = {}
        for ref in refs:
            try:
                document = self.storage.get_document(ref)
            except KeyError:
                try:
                    passage = self.storage.get_passage(ref)
                    document = self.storage.get_document(passage.document_id)
                    passages[passage.id] = passage
                except KeyError:
                    return {}
            if not document.synthetic:
                return {}
        if not passages:
            return {}
        context = select_context(list(passages.values()))
        return {"synthetic_verified": True, "synthetic_excerpt": context.text}

    async def decision(self, run_id, instance, value: Decision, parent=None):
        self.ensure_active(run_id)
        await self.events.emit(
            run_id,
            "decision",
            instance,
            value.model_dump(mode="json"),
            parent_instance_id=parent,
            attempt=self.attempt(run_id, instance),
            key=f"decision:{value.id}",
        )
        async with self.telemetry.span(
            run_id,
            "Deterministic policy",
            {
                "worker_id": parent,
                "policy_version": value.policy_version,
                "rubric_version": value.signal.rubric_version,
                "route": value.selected_route,
                "policy_elapsed_ms": value.policy_elapsed_ms,
                "confidence": getattr(value.signal, "confidence", None),
                "noul": getattr(value.signal, "noul", None),
                **self.synthetic_trace_context(value.input_refs),
            },
        ) as output:
            output["route"] = value.selected_route

    @staticmethod
    def provider_meta(value):
        if isinstance(value, tuple) and len(value) == 2 and isinstance(value[1], dict):
            return value[1]
        if hasattr(value, "provider"):
            return value.model_dump(
                include={
                    "provider",
                    "request_id",
                    "configured_model",
                    "returned_model",
                    "elapsed_ms",
                    "usage",
                    "rubric_version",
                }
            )
        if isinstance(value, dict) and value:
            return WorkflowEngine.provider_meta(next(iter(value.values())))
        return {}

    async def call(
        self,
        run_id: str,
        instance: str,
        provider: str,
        operation: Callable[[], Awaitable[Any]],
        parent=None,
        **fields,
    ):
        # SDK retries are off. One explicit retry makes attempts visible and caps work.
        previous = max(
            (
                e.attempt
                for e in self.storage.events(run_id)
                if e.instance_id == instance and e.type == "node_started"
            ),
            default=0,
        )
        name = instance.rsplit(":", 1)[-1]
        if name.startswith("claim-"):
            name = "support"
        for offset in range(2):
            attempt = previous + offset + 1
            self._attempts[(run_id, instance)] = attempt
            self.ensure_active(run_id)
            queued_at = perf_counter()
            async with self.provider_slots:
                self.ensure_active(run_id)
                queue_wait_ms = max(0, (perf_counter() - queued_at) * 1000)
                await self.node(
                    run_id,
                    instance,
                    name,
                    "running",
                    parent=parent,
                    attempt=attempt,
                    queue_wait_ms=queue_wait_ms,
                    **fields,
                )
                try:
                    async with self.telemetry.span(
                        run_id,
                        f"{provider} {name}",
                        {"provider": provider, "worker_id": parent, "attempt": attempt, **fields},
                        run_type="llm",
                    ) as output:
                        value = await operation()
                        self.ensure_active(run_id)
                        metadata = self.provider_meta(value)
                        output.update(metadata)
                        output["queue_wait_ms"] = queue_wait_ms
                    formation = {}
                    if isinstance(value, tuple) and isinstance(value[0], QueryPlan):
                        formation["query_plan"] = value[0]
                        formation["output_count"] = len(value[0].tasks)
                    elif isinstance(value, tuple) and isinstance(value[0], Answer):
                        formation["draft_claims"] = value[0].claims
                        formation["output_count"] = len(value[0].claims)
                    await self.node(
                        run_id,
                        instance,
                        name,
                        "succeeded",
                        parent=parent,
                        attempt=attempt,
                        detail=json.dumps(metadata, ensure_ascii=False),
                        queue_wait_ms=queue_wait_ms,
                        **formation,
                        **fields,
                    )
                    return value
                except Exception as error:
                    safe = safe_error(provider, error)
                    await self.node(
                        run_id,
                        instance,
                        name,
                        "failed",
                        parent=parent,
                        attempt=attempt,
                        detail=str(safe),
                        queue_wait_ms=queue_wait_ms,
                        **fields,
                    )
                    if not safe.retryable or offset == 1:
                        raise safe from None
            await self.edge(run_id, instance, instance, "Transient provider failure; one bounded retry")
            await asyncio.sleep(0.2)
        raise AssertionError("unreachable")

    @staticmethod
    def validate_review(run, raw) -> ReviewSubmission:
        submission = ReviewSubmission.model_validate(raw)
        review = run.review
        if (
            not review
            or submission.interrupt_id != review.interrupt_id
            or submission.revision != review.revision
        ):
            raise ValueError("This review is stale; reload the run")
        expected = {item.document_id for item in review.items}
        actual = [item.document_id for item in submission.decisions]
        if set(actual) != expected or len(actual) != len(expected):
            raise ValueError("Submit exactly one decision for every outstanding document")
        proposals = {item.document_id: item.proposal for item in review.items}
        for decision in submission.decisions:
            if decision.action == "correct" and decision.category in {None, "unknown"}:
                raise ValueError("A correction needs a supported category other than unknown")
            if decision.action == "accept" and proposals[decision.document_id] == "unknown":
                raise ValueError("Unknown cannot be accepted; choose a category or exclude the document")
        return submission

    async def can_recover(self, run_id):
        run = self.storage.get_run(run_id)
        if (
            run.graph_version != GRAPH_VERSION
            or run.policy_version != POLICY_VERSION
            or run.mode != self.settings.app_mode
            or run.configuration != self.settings.public_config()
        ):
            return False, "The original graph, provider mode, or policy configuration is incompatible"
        with tracing_context(enabled=False):
            snapshot = await self.graph(run).aget_state(self.config(run))
        if not snapshot.values or not snapshot.next:
            return False, "No unfinished compatible checkpoint is available"
        return True, "Continue the original checkpoint; in-flight provider calls may execute again"

    async def execute(self, run_id: str, resume: dict | None = None, recover: bool = False):
        run = self.storage.get_run(run_id)
        for event in self.storage.events(run_id):
            if (
                event.type in {"node_completed", "node_failed", "node_started"}
                and event.payload.get("elapsed_ms") is not None
            ):
                self._node_durations.setdefault(
                    (run_id, event.instance_id, event.attempt), event.payload["elapsed_ms"]
                )
        if run.status == "cancelled":
            return
        if run.mode != self.settings.app_mode:
            raise ValueError("Execution mode differs from the recorded run")
        if resume is not None:
            if (
                run.graph_version != GRAPH_VERSION
                or run.policy_version != POLICY_VERSION
                or run.configuration != self.settings.public_config()
            ):
                raise ValueError("The original review graph or policy configuration is incompatible")
            self.validate_review(run, resume)
            value: Any = Command(resume=resume)
        elif recover:
            eligible, reason = await self.can_recover(run_id)
            if not eligible:
                raise ValueError(reason)
            value = None
        elif run.kind == "classification":
            value = {
                "run_id": run_id,
                "document_ids": run.request["document_ids"],
                "outcomes": {},
                "review_revision": 1,
            }
        else:
            value = {
                "run_id": run_id,
                "query": run.request["query"],
                "filters": run.request.get("filters", {}),
                "outcomes": {},
            }
        self.storage.update_run(run_id, status="running", error=None)
        await self.events.emit(
            run_id,
            "run_started",
            "run",
            {"kind": run.kind, "mode": run.mode, "resumed": resume is not None, "recovered": recover},
            key=f"run-started:{'resume' if resume is not None else 'recover' if recover else 'initial'}:{run.last_event_sequence if recover else 1}",
        )
        await self.telemetry.begin(run)
        graph = self.graph(run)
        config = self.config(run)
        final_status = "failed"
        try:
            # v2 updates are {type, ns, data}. Never publish arbitrary graph state.
            # Explicit lifecycle events supply starts/decisions; stream updates verify
            # executed progression and expose documented LangGraph interrupts.
            with tracing_context(enabled=False):
                async for part in graph.astream(
                    value, config=config, stream_mode="updates", version="v2", durability="sync"
                ):
                    if part["type"] != "updates" or not isinstance(part["data"], dict):
                        raise RuntimeError("Unexpected LangGraph v2 stream envelope")
                    self.ensure_active(run_id)
                self.ensure_active(run_id)
                snapshot = await graph.aget_state(config)
            interrupts = list(snapshot.interrupts)
            if interrupts:
                interruption = interrupts[0]
                review = ReviewRequest(
                    interrupt_id=interruption.id,
                    revision=interruption.value["revision"],
                    items=interruption.value["items"],
                )
                await self.telemetry.finish(run_id, "awaiting_review")
                self.ensure_active(run_id)
                self.storage.update_run(
                    run_id,
                    status="awaiting_review",
                    review=review,
                    result={"outcomes": snapshot.values.get("outcomes", {}), "indexed_count": 0},
                )
                await self.events.emit(
                    run_id,
                    "review_requested",
                    "review",
                    review.model_dump(mode="json"),
                    key=f"review-request:{review.interrupt_id}:{review.revision}",
                )
                final_status = "awaiting_review"
            else:
                result = snapshot.values.get("result")
                if result is None:
                    raise RuntimeError("Graph ended without a terminal result")
                if run.kind == "classification":
                    outcomes = list(result["outcomes"].values())
                    failures = sum(o["status"] in {"failed", "extraction_issue"} for o in outcomes)
                    final_status = (
                        "partially_succeeded"
                        if failures and failures < len(outcomes)
                        else ("failed" if failures else "succeeded")
                    )
                else:
                    task_results = result.get("provenance", {}).get("tasks", {}).values()
                    failed = [task for task in task_results if task["status"] == "failed"]
                    final_status = (
                        ("partially_succeeded" if result["passages"] else "failed")
                        if failed or result.get("partial")
                        else "succeeded"
                    )
                self.ensure_active(run_id)
                await self.telemetry.finish(run_id, final_status)
                self.ensure_active(run_id)
                if run.kind == "discovery":
                    result = protect_discovery_result(self.storage, result, run.request.get("filters", {}))
                    if result.get("partial"):
                        final_status = "partially_succeeded" if result["passages"] else "failed"
                self.storage.update_run(run_id, status=final_status, result=result, review=None)
                await self.events.emit(
                    run_id,
                    "run_completed",
                    "run",
                    {"status": final_status, "result": result},
                    key=f"terminal:{final_status}",
                )
        except asyncio.CancelledError:
            # API cancellation already marks cancelled. Orderly server shutdown marks
            # interrupted so the same compatible checkpoint remains recoverable.
            current = self.storage.get_run(run_id)
            final_status = "cancelled" if current.status == "cancelled" else "interrupted"
            self.storage.update_run(
                run_id,
                status=final_status,
                error=None
                if final_status == "cancelled"
                else "Execution stopped; checkpoint recovery may be available.",
            )
            if final_status == "interrupted":
                await self.events.emit(
                    run_id,
                    "run_completed",
                    "run",
                    {"status": final_status, "result": None},
                    key=f"shutdown:{current.last_event_sequence}",
                )
            raise
        except Exception as error:
            if self.storage.get_run(run_id).status == "cancelled":
                final_status = "cancelled"
                raise asyncio.CancelledError() from None
            message = (
                str(error)
                if isinstance(error, ProviderError)
                else f"Workflow failed ({type(error).__name__}); inspect the local events and configuration."
            )
            self.storage.update_run(run_id, status="failed", error=message)
            await self.events.emit(
                run_id,
                "run_completed",
                "run",
                {"status": "failed", "result": None, "error": message},
                key=f"terminal:failed:{run.last_event_sequence}",
            )
            final_status = "failed"
        finally:
            await self.telemetry.finish(run_id, final_status)

    async def close(self):
        await self.jev.close()
        await self.openai.close()
        await self.telemetry.close()
