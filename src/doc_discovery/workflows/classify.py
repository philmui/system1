"""Versioned classification: publish accepted workers, then join outstanding review.

The legacy builder retains the original batch barrier for saved atlas-v1 checkpoints.
"""

from time import perf_counter
from typing import Annotated, Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send, interrupt

from ..policies import CATEGORY_RUBRIC, classification_route, merge_keyed, mixed_purpose, select_context
from ..providers.common import ProviderError
from ..schemas import Decision, ReviewItem


class BatchState(TypedDict, total=False):
    run_id: str
    document_ids: list[str]
    outcomes: Annotated[dict[str, Any], merge_keyed]
    result: dict
    review_revision: int


class WorkerInput(TypedDict):
    run_id: str
    doc_id: str


class WorkerOutput(TypedDict):
    outcomes: dict[str, Any]


class WorkerState(WorkerInput, total=False):
    route: str
    outcome: dict
    outcomes: dict[str, Any]


def build_classification(engine, checkpointer, *, independent=False):
    storage = engine.storage

    async def extract(state: WorkerState):
        run_id, doc_id = state["run_id"], state["doc_id"]
        parent = f"worker:{doc_id}"
        if independent and (committed := storage.publication(run_id, doc_id)):
            # A process may stop after the durable commit but before the worker
            # checkpoint. Preserve its original authority instead of judging again.
            return {
                "route": "outcome",
                "outcome": {
                    "document_id": doc_id,
                    "status": "accepted",
                    "category": committed.category,
                    "content_version": committed.content_version,
                    "authorization_id": committed.authorization_id,
                    "publication": committed.model_dump(mode="json"),
                },
            }
        await engine.node(run_id, parent, "worker", "running", document_id=doc_id, label="Document worker")
        await engine.node(
            run_id, f"{doc_id}:extract", "extract", "running", parent=parent, document_id=doc_id
        )
        try:
            document = storage.get_document(doc_id)
            context = select_context(storage.passages(doc_id))
            if not independent:
                storage.update_document(doc_id, indexed=False)
            if document.extraction_status != "readable" or not context.text.strip():
                error = (
                    document.extraction_error
                    or f"Document extraction is {document.extraction_status}; no readable context is available."
                )
                await engine.node(
                    run_id,
                    f"{doc_id}:extract",
                    "extract",
                    "failed",
                    parent=parent,
                    document_id=doc_id,
                    detail=error,
                )
                await engine.edge(run_id, f"{doc_id}:extract", f"{doc_id}:outcome", "Extraction issue")
                return {
                    "route": "outcome",
                    "outcome": {
                        "document_id": doc_id,
                        "status": "extraction_issue",
                        "category": "unknown",
                        "error": error,
                    },
                }
            await engine.node(
                run_id,
                f"{doc_id}:extract",
                "extract",
                "succeeded",
                parent=parent,
                document_id=doc_id,
                detail=f"{len(context.refs)} retained passage anchors; {len(context.omitted)} omitted ranges",
            )
            await engine.edge(run_id, f"{doc_id}:extract", f"{doc_id}:jev", "Readable content")
            return {"route": "judge"}
        except Exception as error:
            await engine.node(
                run_id,
                f"{doc_id}:extract",
                "extract",
                "failed",
                parent=parent,
                document_id=doc_id,
                detail=f"Local extraction/storage error ({type(error).__name__}).",
            )
            await engine.edge(
                run_id, f"{doc_id}:extract", f"{doc_id}:outcome", "Local extraction/storage error"
            )
            return {
                "route": "outcome",
                "outcome": {
                    "document_id": doc_id,
                    "status": "failed",
                    "category": "unknown",
                    "error": "Unable to read the registered document.",
                },
            }

    async def judge(state: WorkerState):
        run_id, doc_id = state["run_id"], state["doc_id"]
        parent, instance = f"worker:{doc_id}", f"{doc_id}:jev"
        try:
            document = storage.get_document(doc_id)
            context = select_context(storage.passages(doc_id))
            signal = await engine.call(
                run_id,
                instance,
                "jev",
                lambda: engine.jev.classify(document, context),
                parent=parent,
                document_id=doc_id,
            )
            ambiguous = mixed_purpose(storage.read_text(doc_id))
            policy_started = perf_counter()
            route = classification_route(signal, engine.settings.jev_choice_threshold, ambiguous)
            policy_elapsed_ms = (perf_counter() - policy_started) * 1000
            decision = Decision(
                id=f"{instance}:category:{signal.request_id or engine.attempt(run_id, instance)}",
                input_refs=[doc_id, *context.refs],
                input_excerpt=context.text,
                omitted_context=context.omitted,
                rubric=CATEGORY_RUBRIC,
                signal=signal,
                threshold=engine.settings.jev_choice_threshold,
                selected_route=route.name,
                explanation=route.explanation,
                policy_elapsed_ms=policy_elapsed_ms,
                policy_reason=route.reason,
            )
            await engine.decision(run_id, instance, decision, parent)
            if not independent:
                storage.update_document(
                    doc_id,
                    original_judgment=document.original_judgment or signal.model_dump(mode="json"),
                    category=signal.choice,
                    category_provenance="jev" if route.name == "accept" else "proposal",
                    indexed=False,
                )
            elif not document.indexed and document.original_judgment is None:
                storage.update_document(doc_id, original_judgment=signal.model_dump(mode="json"))
            await engine.edge(
                run_id,
                instance,
                f"{doc_id}:interpret"
                if route.name == "interpret"
                else f"{doc_id}:{'publish' if independent else 'outcome'}",
                route.explanation,
            )
            if route.name == "accept":
                return {
                    "route": "publish" if independent else "outcome",
                    "outcome": {
                        "document_id": doc_id,
                        "status": "accepted",
                        "category": signal.choice,
                        **(
                            {"authorization_id": decision.id, "content_version": document.content_version}
                            if independent
                            else {}
                        ),
                    },
                }
            return {"route": "interpret"}
        except Exception as error:
            message = (
                str(error)
                if isinstance(error, ProviderError)
                else f"Classification failed ({type(error).__name__})."
            )
            await engine.node(
                run_id,
                instance,
                "jev",
                "failed",
                parent=parent,
                document_id=doc_id,
                detail=message,
                attempt=engine.attempt(run_id, instance),
            )
            await engine.edge(
                run_id, instance, f"{doc_id}:outcome", "Provider or storage failure; no confidence route"
            )
            return {
                "route": "outcome",
                "outcome": {
                    "document_id": doc_id,
                    "status": "failed",
                    "category": "unknown",
                    "error": message,
                },
            }

    async def interpret(state: WorkerState):
        run_id, doc_id = state["run_id"], state["doc_id"]
        parent, instance = f"worker:{doc_id}", f"{doc_id}:interpret"
        try:
            document = storage.get_document(doc_id)
            context = select_context(storage.passages(doc_id))
            proposal = await engine.call(
                run_id,
                instance,
                "openai",
                lambda: engine.openai.interpret(document, context),
                parent=parent,
                document_id=doc_id,
            )
            await engine.decision(
                run_id,
                instance,
                Decision(
                    id=f"{instance}:proposal:{proposal.request_id}",
                    input_refs=[doc_id, *context.refs],
                    input_excerpt=context.text,
                    omitted_context=context.omitted,
                    rubric="Propose a taxonomy category from observable evidence. Every OpenAI classification remains a human-review proposal.",
                    signal=proposal,
                    selected_route="review",
                    explanation="OpenAI interpretation is a proposal. A person must accept, correct, or exclude it.",
                ),
                parent,
            )
            if not independent or not document.indexed:
                storage.update_document(
                    doc_id, category=proposal.category, category_provenance="proposal", indexed=False
                )
            await engine.edge(run_id, instance, f"{doc_id}:outcome", "Proposal requires parent-level review")
            return {
                "outcome": {
                    "document_id": doc_id,
                    "status": "awaiting_review",
                    "category": proposal.category,
                    "explanation": proposal.explanation,
                    **({"content_version": document.content_version} if independent else {}),
                }
            }
        except Exception as error:
            message = (
                str(error)
                if isinstance(error, ProviderError)
                else f"Interpretation failed ({type(error).__name__})."
            )
            await engine.node(
                run_id,
                instance,
                "interpret",
                "failed",
                parent=parent,
                detail=message,
                attempt=engine.attempt(run_id, instance),
            )
            await engine.edge(run_id, instance, f"{doc_id}:outcome", "Interpretation failed")
            return {
                "outcome": {
                    "document_id": doc_id,
                    "status": "failed",
                    "category": "unknown",
                    "error": message,
                }
            }

    async def publish(state: WorkerState):
        run_id, doc_id, value = state["run_id"], state["doc_id"], state["outcome"]
        try:
            committed = await engine.publish(
                run_id, doc_id, value["content_version"], value["authorization_id"]
            )
            value = value | {"publication": committed}
            await engine.edge(
                run_id,
                f"{doc_id}:publish",
                f"{doc_id}:outcome",
                "Document searchable; return batch accounting",
            )
        except Exception as error:
            value = value | {"status": "failed", "error": f"Index storage failed ({type(error).__name__})."}
            await engine.node(
                run_id,
                f"{doc_id}:publish",
                "publish",
                "failed",
                parent=f"worker:{doc_id}",
                document_id=doc_id,
                detail=value["error"],
                label="Publish document",
            )
            await engine.edge(run_id, f"{doc_id}:publish", f"{doc_id}:outcome", "Publication failed")
        return {"outcome": value}

    async def outcome(state: WorkerState):
        run_id, doc_id = state["run_id"], state["doc_id"]
        value = state["outcome"]
        parent = f"worker:{doc_id}"
        await engine.node(
            run_id, f"{doc_id}:outcome", "outcome", "running", parent=parent, document_id=doc_id
        )
        status = (
            "awaiting_review"
            if value["status"] == "awaiting_review"
            else ("failed" if value["status"] in {"failed", "extraction_issue"} else "succeeded")
        )
        await engine.node(
            run_id,
            f"{doc_id}:outcome",
            "outcome",
            status,
            parent=parent,
            document_id=doc_id,
            outcome=value["status"],
            detail=value.get("error"),
        )
        await engine.node(
            run_id,
            parent,
            "worker",
            status,
            document_id=doc_id,
            outcome=value["status"],
            label="Document worker",
        )
        await engine.edge(run_id, f"{doc_id}:outcome", "join", "Return keyed terminal outcome")
        completed = len(
            {
                e.instance_id
                for e in storage.events(run_id)
                if e.instance_id.endswith(":outcome") and e.payload.get("outcome")
            }
        )
        await engine.node(
            run_id,
            "join",
            "join",
            "running",
            expected=len(storage.get_run(run_id).request["document_ids"]),
            completed=completed,
        )
        return {"outcomes": {doc_id: value}}

    worker = StateGraph(WorkerState, input_schema=WorkerInput, output_schema=WorkerOutput)
    worker.add_node("extract", extract)
    worker.add_node("judge", judge)
    worker.add_node("interpret", interpret)
    worker.add_node("outcome", outcome)
    if independent:
        worker.add_node("publish", publish)
        worker.add_edge("publish", "outcome")
    worker.add_edge(START, "extract")
    worker.add_conditional_edges("extract", lambda s: s["route"], {"judge": "judge", "outcome": "outcome"})
    worker.add_conditional_edges(
        "judge",
        lambda s: s["route"],
        {"interpret": "interpret", "outcome": "outcome", **({"publish": "publish"} if independent else {})},
    )
    worker.add_edge("interpret", "outcome")
    worker.add_edge("outcome", END)
    compiled_worker = worker.compile()

    async def dispatch(state: BatchState):
        run_id, doc_ids = state["run_id"], state["document_ids"]
        await engine.node(
            run_id, "dispatch", "dispatch", "running", expected=len(doc_ids), label="Dispatch documents"
        )
        await engine.node(run_id, "join", "join", "queued", expected=len(doc_ids), completed=0)
        for doc_id in doc_ids:
            document = storage.get_document(doc_id)
            await engine.events.emit(
                run_id,
                "worker_created",
                f"worker:{doc_id}",
                {"node_name": "worker", "label": document.filename, "state": "queued", "document_id": doc_id},
                parent_instance_id="dispatch",
                key=f"worker:{doc_id}",
            )
            await engine.edge(run_id, "dispatch", f"{doc_id}:extract", "One LangGraph Send per document")
        await engine.node(
            run_id, "dispatch", "dispatch", "succeeded", expected=len(doc_ids), label="Dispatch documents"
        )
        return {}

    def fanout(state: BatchState):
        return [
            Send("document_worker", {"run_id": state["run_id"], "doc_id": doc_id})
            for doc_id in state["document_ids"]
        ] or "join"

    async def join(state: BatchState):
        expected, actual = set(state["document_ids"]), set(state.get("outcomes", {}))
        await engine.node(
            state["run_id"], "join", "join", "running", expected=len(expected), completed=len(actual)
        )
        if expected != actual:
            raise RuntimeError("Classification join did not receive the complete expected worker-ID set")
        await engine.node(
            state["run_id"], "join", "join", "succeeded", expected=len(expected), completed=len(actual)
        )
        pending = any(value["status"] == "awaiting_review" for value in state.get("outcomes", {}).values())
        await engine.edge(
            state["run_id"],
            "join",
            "review" if pending else "index",
            "Pending proposals" if pending else "Every worker is terminal",
        )
        return {}

    async def review(state: BatchState):
        run_id = state["run_id"]
        items = [
            ReviewItem(
                document_id=doc_id,
                filename=storage.get_document(doc_id).filename,
                proposal=value["category"],
                explanation=value.get("explanation", "Human review required."),
            ).model_dump()
            for doc_id, value in sorted(state["outcomes"].items())
            if value["status"] == "awaiting_review"
        ]
        await engine.node(
            run_id,
            "review",
            "review",
            "awaiting_review",
            label="Human review",
            detail=f"{len(items)} proposals await one complete submission",
        )
        # LangGraph restarts this node on resume. Everything before the interrupt is
        # read-only or a logically keyed event; indexing happens in a later node.
        raw = interrupt({"revision": state.get("review_revision", 1), "items": items})
        submission = engine.validate_review(storage.get_run(run_id), raw)
        reviewed = {}
        async with engine.telemetry.span(run_id, "Human review", {"count": len(submission.decisions)}):
            for decision in submission.decisions:
                old = state["outcomes"][decision.document_id]
                category = decision.category if decision.action == "correct" else old["category"]
                reviewed[decision.document_id] = old | {
                    "status": "excluded" if decision.action == "exclude" else "accepted",
                    "category": category,
                    "human_correction": decision.model_dump(mode="json"),
                    **(
                        {
                            "authorization_id": f"review:{submission.interrupt_id}:{submission.revision}:{decision.document_id}"
                        }
                        if independent
                        else {}
                    ),
                }
        for doc_id, value in reviewed.items():
            await engine.node(
                run_id,
                f"worker:{doc_id}",
                "worker",
                "skipped" if value["status"] == "excluded" else "succeeded",
                document_id=doc_id,
                outcome=value["status"],
                label="Document worker",
            )
        await engine.events.emit(
            run_id,
            "review_resumed",
            "review",
            {
                "interrupt_id": submission.interrupt_id,
                "revision": submission.revision,
                "count": len(reviewed),
                **(
                    {"decisions": [decision.model_dump(mode="json") for decision in submission.decisions]}
                    if independent
                    else {}
                ),
            },
            key=f"review-resumed:{submission.revision}",
        )
        await engine.node(run_id, "review", "review", "succeeded", label="Human review")
        await engine.edge(run_id, "review", "index", "Validated human decisions")
        return {"outcomes": reviewed}

    async def index(state: BatchState):
        run_id = state["run_id"]
        label = "Reconcile publication outcomes" if independent else "Index accepted documents"
        await engine.node(run_id, "index", "index", "running", label=label)
        indexed = 0
        outcomes = dict(state.get("outcomes", {}))
        for doc_id, value in sorted(outcomes.items()):
            engine.ensure_active(run_id)
            try:
                if independent:
                    if value["status"] in {"accepted", "excluded"}:
                        if not value.get("publication"):
                            await engine.edge(
                                run_id,
                                "review",
                                f"{doc_id}:publish",
                                "Validated review authorizes publication"
                                if value["status"] == "accepted"
                                else "Validated review excludes document",
                            )
                            committed = await engine.publish(
                                run_id, doc_id, value["content_version"], value["authorization_id"]
                            )
                            value = value | {"publication": committed}
                            outcomes[doc_id] = value
                            await engine.edge(
                                run_id, f"{doc_id}:publish", "done", "Record publication outcome"
                            )
                        if value["publication"]["status"] == "searchable":
                            indexed += 1
                    continue
                if value["status"] == "accepted":
                    fields = {"category": value["category"]}
                    if value.get("human_correction"):
                        fields |= {
                            "human_correction": value["human_correction"],
                            "category_provenance": "human",
                        }
                    storage.update_document(doc_id, **fields)
                    storage.index_document(doc_id)
                    indexed += 1
                elif value["status"] == "excluded":
                    storage.update_document(
                        doc_id,
                        indexed=False,
                        category_provenance="excluded",
                        human_correction=value.get("human_correction"),
                    )
            except Exception as error:
                outcomes[doc_id] = value | {
                    "status": "failed",
                    "error": f"Index storage failed ({type(error).__name__}).",
                }
                if independent:
                    await engine.node(
                        run_id,
                        f"{doc_id}:publish",
                        "publish",
                        "failed",
                        parent=f"worker:{doc_id}",
                        document_id=doc_id,
                        detail=outcomes[doc_id]["error"],
                        label="Publish document",
                    )
        await engine.node(
            run_id,
            "index",
            "index",
            "succeeded",
            label=label,
            detail=f"{indexed} documents indexed idempotently",
            input_count=len(outcomes),
            output_count=indexed,
            removed_count=len(outcomes) - indexed,
        )
        await engine.edge(
            run_id, "index", "done", "Record batch results" if independent else "Publish batch results"
        )
        return {"outcomes": outcomes, "result": {"outcomes": outcomes, "indexed_count": indexed}}

    async def done(state: BatchState):
        await engine.node(state["run_id"], "done", "done", "running", label="Batch results")
        await engine.node(state["run_id"], "done", "done", "succeeded", label="Batch results")
        return {}

    parent = StateGraph(BatchState)
    parent.add_node("dispatch", dispatch)
    parent.add_node("document_worker", compiled_worker)
    parent.add_node("join", join)
    parent.add_node("review", review)
    parent.add_node("index", index)
    parent.add_node("done", done)
    parent.add_edge(START, "dispatch")
    parent.add_conditional_edges("dispatch", fanout, ["document_worker", "join"])
    parent.add_edge("document_worker", "join")
    parent.add_conditional_edges(
        "join",
        lambda s: (
            "review"
            if any(v["status"] == "awaiting_review" for v in s.get("outcomes", {}).values())
            else "index"
        ),
    )
    parent.add_edge("review", "index")
    parent.add_edge("index", "done")
    parent.add_edge("done", END)
    return parent.compile(checkpointer=checkpointer)
