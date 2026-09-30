"""Bounded lexical retrieval workers, Jev evidence gates, and cited synthesis."""

import json
import re
from time import perf_counter
from typing import Annotated, Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from ..policies import (
    CANDIDATES_PER_TASK,
    INTENT_RUBRIC,
    MAX_EVIDENCE_PASSAGES,
    RELEVANCE_RUBRIC,
    SUPPORT_RUBRIC,
    intent_route,
    merge_keyed,
    probability_route,
    select_context,
)
from ..providers.common import ProviderError
from ..schemas import Claim, Decision, QueryPlan, SearchFilters, SearchTask


class DiscoveryState(TypedDict, total=False):
    run_id: str
    query: str
    filters: dict
    intent: str
    route: str
    plan: dict
    outcomes: Annotated[dict[str, Any], merge_keyed]
    evidence_ids: list[str]
    provenance: dict
    claims: list[dict]
    missing_evidence: list[str]
    partial: bool
    result: dict


class RetrievalInput(TypedDict):
    run_id: str
    query: str
    filters: dict
    task: dict
    scope_document_ids: list[str]


def simple_phrase(query: str) -> str:
    quoted = re.findall(r'["“]([^"”]+)["”]', query)
    if quoted:
        return " ".join(quoted)[:200]
    terms = [
        x
        for x in re.findall(r"\w+", query)
        if x.lower()
        not in {
            "find",
            "show",
            "search",
            "get",
            "me",
            "the",
            "all",
            "with",
            "containing",
            "contains",
            "in",
            "from",
            "to",
            "and",
            "documents",
            "document",
            "invoices",
            "invoice",
            "please",
        }
    ]
    return " ".join(terms[:12])[:200] or query[:200]


def valid_claim(claim: Claim, evidence: dict) -> bool:
    return bool(claim.citations) and all(
        c.passage_id in evidence and c.quote.strip() and c.quote in evidence[c.passage_id].text
        for c in claim.citations
    )


MAX_SCOPE_DOCUMENTS = 300
MAX_SCOPE_METADATA_BYTES = 20_000


def eligible_document_ids(storage, provenance, filters):
    frozen = {item["document_id"] for item in provenance.get("scope", {}).get("accepted_documents", [])}
    return {
        document.id
        for document in storage.documents(SearchFilters.model_validate(filters)).documents
        if document.id in frozen
        and document.indexed
        and document.extraction_status == "readable"
        and document.category != "unknown"
        and document.category_provenance not in {"proposal", "excluded", "unclassified"}
    }


def protect_discovery_result(storage, result, filters):
    """Recheck immediately before publication, without yielding between check and write."""
    eligible = eligible_document_ids(storage, result.get("provenance", {}), filters)
    kept = [passage for passage in result.get("passages", []) if passage["document_id"] in eligible]
    kept_ids = {passage["id"] for passage in kept}
    claims = [
        claim
        for claim in result.get("claims", [])
        if all(citation["passage_id"] in kept_ids for citation in claim["citations"])
    ]
    removed = [passage["id"] for passage in result.get("passages", []) if passage["id"] not in kept_ids]
    if not removed and len(claims) == len(result.get("claims", [])):
        return result
    provenance = dict(result.get("provenance", {}))
    provenance["withdrawn_evidence"] = sorted(set(provenance.get("withdrawn_evidence", [])) | set(removed))
    message = "Source acceptance or filter metadata changed during execution. Only evidence still in the recorded accepted scope was retained."
    return {
        **result,
        "passages": kept,
        "claims": claims,
        "partial": True,
        "provenance": provenance,
        "message": message,
        "missing_evidence": [
            *result.get("missing_evidence", []),
            "Evidence and dependent claims were withheld after a source left the accepted collection or original metadata filters.",
        ],
    }


def build_discovery(engine, checkpointer):
    storage = engine.storage

    async def interpret_intent(state: DiscoveryState):
        run_id, query = state["run_id"], state["query"]
        signal = await engine.call(run_id, "intent", "jev", lambda: engine.jev.intent(query))
        policy_started = perf_counter()
        route = intent_route(signal, engine.settings.jev_choice_threshold)
        policy_elapsed_ms = (perf_counter() - policy_started) * 1000
        await engine.decision(
            run_id,
            "intent",
            Decision(
                id=f"intent:{signal.request_id}",
                input_refs=["user-query"],
                input_excerpt=query,
                rubric=INTENT_RUBRIC,
                signal=signal,
                threshold=engine.settings.jev_choice_threshold,
                selected_route=route.name,
                explanation=route.explanation,
                policy_elapsed_ms=policy_elapsed_ms,
            ),
        )
        await engine.edge(
            run_id, "intent", "done" if route.name == "unsupported" else "plan", route.explanation
        )
        return {"intent": signal.choice, "route": route.name, "partial": False}

    async def plan(state: DiscoveryState):
        run_id = state["run_id"]
        filters = SearchFilters.model_validate(state["filters"])
        collection = storage.documents(filters)
        accepted = [document for document in collection.documents if document.indexed]
        scoped, size = [], 2
        for document in accepted[:MAX_SCOPE_DOCUMENTS]:
            item = {"document_id": document.id, "filename": document.filename, "category": document.category}
            item_size = len(json.dumps(item, ensure_ascii=False).encode("utf-8")) + 2
            if size + item_size > MAX_SCOPE_METADATA_BYTES:
                break
            scoped.append(item)
            size += item_size
        scope = {
            "filters": filters.model_dump(mode="json"),
            "accepted_documents": scoped,
            "scope_document_cap": MAX_SCOPE_DOCUMENTS,
            "scope_metadata_byte_cap": MAX_SCOPE_METADATA_BYTES,
            "excluded_scope_documents": len(accepted) - len(scoped),
            "candidate_cap_per_task": CANDIDATES_PER_TASK,
            "max_tasks": 3,
            "excluded_unknown_dates": collection.excluded_unknown_dates,
            "retrieval": "SQLite FTS5 lexical OR of safely quoted tokens",
        }
        if state["route"] == "find":
            await engine.node(run_id, "plan", "plan", "running", label="One lexical search")
            result = QueryPlan(
                intent="find",
                tasks=[
                    SearchTask(
                        id="task-1",
                        phrase=simple_phrase(state["query"]),
                        purpose="Locate matching passages with explicit metadata filters",
                    )
                ],
                explanation="A clear find request uses one bounded FTS5 task. No narrative answer is generated.",
            )
            await engine.node(
                run_id,
                "plan",
                "plan",
                "succeeded",
                label="One lexical search",
                detail=result.explanation,
                query_plan=result,
                output_count=len(result.tasks),
            )
        else:
            result, _ = await engine.call(
                run_id, "plan", "openai", lambda: engine.openai.plan(state["query"], state["intent"], scope)
            )
        await engine.node(run_id, "join", "join", "queued", expected=len(result.tasks), completed=0)
        for task in result.tasks:
            await engine.events.emit(
                run_id,
                "worker_created",
                f"worker:{task.id}",
                {
                    "node_name": "retrieval_worker",
                    "label": task.purpose,
                    "state": "queued",
                    "task_id": task.id,
                },
                parent_instance_id="plan",
                key=f"worker:{task.id}",
            )
            await engine.edge(run_id, "plan", f"{task.id}:retrieve", f"Search: {task.phrase}")
        if not result.tasks:
            await engine.edge(run_id, "plan", "join", "No retrieval tasks")
        return {
            "plan": result.model_dump(mode="json"),
            "intent": result.intent,
            "provenance": {"scope": scope},
        }

    def fanout(state: DiscoveryState):
        return [
            Send(
                "retrieval_worker",
                {
                    "run_id": state["run_id"],
                    "query": state["query"],
                    "filters": state["filters"],
                    "scope_document_ids": [
                        item["document_id"] for item in state["provenance"]["scope"]["accepted_documents"]
                    ],
                    "task": task,
                },
            )
            for task in state["plan"]["tasks"]
        ] or "join"

    async def worker(state: RetrievalInput):
        run_id, task = state["run_id"], SearchTask.model_validate(state["task"])
        parent, retrieve_id, screen_id = f"worker:{task.id}", f"{task.id}:retrieve", f"{task.id}:screen"
        await engine.node(run_id, parent, "retrieval_worker", "running", task_id=task.id, label=task.purpose)
        await engine.node(
            run_id, retrieve_id, "retrieve", "running", parent=parent, task_id=task.id, label="FTS5 retrieval"
        )
        outcome = {
            "task_id": task.id,
            "status": "succeeded",
            "passage_ids": [],
            "probabilities": {},
            "phrase": task.phrase,
            "omitted_passage_ids": [],
        }
        try:
            async with engine.telemetry.span(
                run_id, "Retrieval worker", {"task_id": task.id, "worker_id": parent}
            ):
                async with engine.telemetry.span(
                    run_id, "SQLite FTS5 search", {"task_id": task.id}, run_type="retriever"
                ) as output:
                    candidates = storage.search(
                        task.phrase,
                        SearchFilters.model_validate(state["filters"]),
                        limit=CANDIDATES_PER_TASK,
                        allowed_document_ids=state["scope_document_ids"],
                    )
                    output["count"] = len(candidates)
                engine.ensure_active(run_id)
                context = select_context(candidates)
                selected = [p for p in candidates if p.id in context.refs]
                outcome["omitted_passage_ids"] = [p.id for p in candidates if p.id not in context.refs]
                outcome["candidate_count"] = len(candidates)
                await engine.node(
                    run_id,
                    retrieve_id,
                    "retrieve",
                    "succeeded",
                    parent=parent,
                    task_id=task.id,
                    detail=f"{len(candidates)} candidates; cap {CANDIDATES_PER_TASK}; {len(selected)} within context budget",
                    label="FTS5 retrieval",
                    output_count=len(candidates),
                    passage_ids=[p.id for p in candidates],
                )
                await engine.edge(run_id, retrieve_id, screen_id, "Screen candidates with Jev")
                if selected:
                    signals = await engine.call(
                        run_id,
                        screen_id,
                        "jev",
                        lambda: engine.jev.relevance(state["query"], selected),
                        parent=parent,
                        task_id=task.id,
                    )
                else:
                    signals = {}
                    await engine.node(
                        run_id,
                        screen_id,
                        "screen",
                        "skipped",
                        parent=parent,
                        task_id=task.id,
                        detail="No candidate passages to screen",
                    )
                for passage in selected:
                    signal = signals[passage.id]
                    policy_started = perf_counter()
                    route = probability_route(signal, engine.settings.jev_relevance_threshold, "relevance")
                    policy_elapsed_ms = (perf_counter() - policy_started) * 1000
                    await engine.decision(
                        run_id,
                        screen_id,
                        Decision(
                            id=f"{screen_id}:{passage.id}:{signal.request_id}",
                            input_refs=[passage.id],
                            input_excerpt=f"User query: {state['query']}\n\n{passage.text}",
                            rubric=RELEVANCE_RUBRIC,
                            signal=signal,
                            threshold=engine.settings.jev_relevance_threshold,
                            selected_route=route.name,
                            explanation=route.explanation,
                            policy_elapsed_ms=policy_elapsed_ms,
                        ),
                        parent,
                    )
                    if route.name == "keep":
                        outcome["passage_ids"].append(passage.id)
                        outcome["probabilities"][passage.id] = signal.noul
                await engine.edge(
                    run_id,
                    screen_id,
                    "join",
                    f"{len(outcome['passage_ids'])} passages passed relevance policy",
                )
        except Exception as error:
            message = (
                str(error)
                if isinstance(error, ProviderError)
                else f"Retrieval or screening failed ({type(error).__name__})."
            )
            outcome |= {"status": "failed", "error": message, "passage_ids": [], "probabilities": {}}
            await engine.node(
                run_id,
                screen_id if isinstance(error, ProviderError) else retrieve_id,
                "screen" if isinstance(error, ProviderError) else "retrieve",
                "failed",
                parent=parent,
                task_id=task.id,
                detail=message,
            )
            await engine.edge(
                run_id,
                screen_id if isinstance(error, ProviderError) else retrieve_id,
                "join",
                "Error outcome; not an empty search",
            )
        await engine.node(
            run_id,
            parent,
            "retrieval_worker",
            "failed" if outcome["status"] == "failed" else "succeeded",
            task_id=task.id,
            label=task.purpose,
            outcome=outcome["status"],
        )
        completed = len(
            {
                e.instance_id
                for e in storage.events(run_id)
                if e.instance_id.startswith("worker:") and e.payload.get("outcome")
            }
        )
        expected = len({e.instance_id for e in storage.events(run_id) if e.type == "worker_created"})
        await engine.node(run_id, "join", "join", "running", expected=expected, completed=completed)
        return {"outcomes": {task.id: outcome}}

    async def join(state: DiscoveryState):
        run_id = state["run_id"]
        expected = {t["id"] for t in state["plan"]["tasks"]}
        actual = set(state.get("outcomes", {}))
        await engine.node(run_id, "join", "join", "running", expected=len(expected), completed=len(actual))
        if expected != actual:
            raise RuntimeError("Discovery join did not receive the complete expected task-ID set")
        probabilities: dict[str, float] = {}
        provenance = dict(state["provenance"])
        provenance["tasks"] = state.get("outcomes", {})
        provenance["passage_tasks"] = {}
        for task_id, outcome in sorted(state.get("outcomes", {}).items()):
            for passage_id in outcome["passage_ids"]:
                probabilities[passage_id] = max(
                    probabilities.get(passage_id, 0), outcome["probabilities"][passage_id]
                )
                provenance["passage_tasks"].setdefault(passage_id, []).append(task_id)
        eligible = eligible_document_ids(storage, provenance, state["filters"])
        withdrawn = [pid for pid in probabilities if storage.get_passage(pid).document_id not in eligible]
        provenance["withdrawn_evidence"] = withdrawn
        evidence_ids = sorted(
            (pid for pid in probabilities if pid not in withdrawn), key=lambda p: (-probabilities[p], p)
        )[:MAX_EVIDENCE_PASSAGES]
        # Bound total synthesis context while retaining whole immutable passages.
        context = select_context([storage.get_passage(pid) for pid in evidence_ids], max_bytes=28_000)
        evidence_ids = [pid for pid in evidence_ids if pid in context.refs]
        provenance["omitted_evidence_ranges"] = context.omitted
        provenance["evidence_passage_cap"] = MAX_EVIDENCE_PASSAGES
        failures = [o for o in state.get("outcomes", {}).values() if o["status"] == "failed"]
        partial = bool(failures or withdrawn)
        await engine.node(
            run_id,
            "join",
            "join",
            "succeeded",
            expected=len(expected),
            completed=len(actual),
            detail=f"{len(evidence_ids)} unique screened passages; {len(failures)} failed tasks; {sum(len(o['passage_ids']) for o in state.get('outcomes', {}).values()) - len(probabilities)} duplicate hits merged",
            input_count=sum(len(o["passage_ids"]) for o in state.get("outcomes", {}).values()),
            output_count=len(evidence_ids),
            removed_count=sum(len(o["passage_ids"]) for o in state.get("outcomes", {}).values())
            - len(evidence_ids),
            passage_ids=evidence_ids,
        )
        synthesize = bool(evidence_ids) and state["intent"] not in {"find", "unsupported"}
        await engine.edge(
            run_id,
            "join",
            "synthesize" if synthesize else "done",
            "Screened evidence supports synthesis"
            if synthesize
            else ("Find returns passages" if evidence_ids else "No accepted evidence"),
        )
        return {"evidence_ids": evidence_ids, "provenance": provenance, "partial": partial}

    async def synthesize(state: DiscoveryState):
        eligible = eligible_document_ids(storage, state["provenance"], state["filters"])
        passages = [
            storage.get_passage(pid)
            for pid in state["evidence_ids"]
            if storage.get_passage(pid).document_id in eligible
        ]
        if not passages:
            await engine.node(
                state["run_id"],
                "synthesize",
                "synthesize",
                "skipped",
                detail="Sources left the accepted collection before synthesis.",
            )
            await engine.edge(state["run_id"], "synthesize", "citations", "No eligible claims to check")
            return {
                "evidence_ids": [],
                "claims": [],
                "partial": True,
                "missing_evidence": ["Source acceptance or filter metadata changed before synthesis."],
            }
        answer, _ = await engine.call(
            state["run_id"], "synthesize", "openai", lambda: engine.openai.answer(state["query"], passages)
        )
        await engine.edge(
            state["run_id"],
            "synthesize",
            "citations",
            "Unvalidated draft claims are ready for exact citation checks",
        )
        return {
            "claims": [claim.model_dump() for claim in answer.claims],
            "missing_evidence": answer.missing_evidence,
            "evidence_ids": [p.id for p in passages],
            "partial": state.get("partial", False) or len(passages) != len(state["evidence_ids"]),
        }

    async def citations(state: DiscoveryState):
        run_id = state["run_id"]
        await engine.node(run_id, "citations", "citations", "running", label="Validate citation anchors")
        claims = [Claim.model_validate(value) for value in state.get("claims", [])]
        evidence = {pid: storage.get_passage(pid) for pid in state.get("evidence_ids", [])}
        valid = [claim for claim in claims if valid_claim(claim, evidence)]
        rejected = len(claims) - len(valid)
        missing = list(state.get("missing_evidence", []))
        if rejected:
            missing.append(
                f"{rejected} generated claims were removed because their citation IDs or exact quotation spans were invalid."
            )
        await engine.node(
            run_id,
            "citations",
            "citations",
            "succeeded",
            label="Validate citation anchors",
            input_count=len(claims),
            output_count=len(valid),
            removed_count=rejected,
            detail="Exact retained passage IDs and contiguous quotation spans checked in code",
        )
        await engine.edge(
            run_id, "citations", "support", "Only claims with valid citations reach semantic support"
        )
        return {"claims": [claim.model_dump() for claim in valid], "missing_evidence": missing}

    async def support(state: DiscoveryState):
        run_id = state["run_id"]
        await engine.node(run_id, "support", "support", "running", label="Claim support gate")
        kept, missing = [], list(state.get("missing_evidence", []))
        partial = state.get("partial", False)
        # At most eight generated claims. One bounded call per claim, no repair loop.
        for index, raw in enumerate(state.get("claims", [])):
            claim = Claim.model_validate(raw)
            passages = [
                storage.get_passage(pid) for pid in dict.fromkeys(c.passage_id for c in claim.citations)
            ]
            instance = f"support:claim-{index + 1}"
            try:
                signal = await engine.call(
                    run_id,
                    instance,
                    "jev",
                    lambda: engine.jev.support(claim.text, passages),
                    parent="support",
                )
                policy_started = perf_counter()
                route = probability_route(signal, engine.settings.jev_support_threshold, "support")
                policy_elapsed_ms = (perf_counter() - policy_started) * 1000
                await engine.decision(
                    run_id,
                    instance,
                    Decision(
                        id=f"{instance}:{signal.request_id}",
                        input_refs=[p.id for p in passages],
                        input_excerpt=f"Claim: {claim.text}\n\n" + "\n\n".join(p.text for p in passages),
                        rubric=SUPPORT_RUBRIC,
                        signal=signal,
                        threshold=engine.settings.jev_support_threshold,
                        selected_route=route.name,
                        explanation=route.explanation,
                        policy_elapsed_ms=policy_elapsed_ms,
                    ),
                    parent="support",
                )
                if route.name == "keep":
                    kept.append(claim.model_dump())
                else:
                    missing.append(f"Claim {index + 1} was removed by the fallible semantic support check.")
            except ProviderError:
                partial = True
                missing.append(f"Claim {index + 1} was withheld because its support judgment failed.")
        await engine.node(
            run_id,
            "support",
            "support",
            "succeeded",
            label="Claim support gate",
            detail=f"{len(kept)} of {len(state.get('claims', []))} claims retained",
            input_count=len(state.get("claims", [])),
            output_count=len(kept),
            removed_count=len(state.get("claims", [])) - len(kept),
        )
        await engine.edge(run_id, "support", "done", "Publish supported claims and evidence gaps")
        return {"claims": kept, "missing_evidence": missing, "partial": partial}

    async def done(state: DiscoveryState):
        await engine.node(state["run_id"], "done", "done", "running", label="Discovery results")
        intent = state["intent"]
        passages = [storage.get_passage(pid).model_dump(mode="json") for pid in state.get("evidence_ids", [])]
        claims = state.get("claims", [])
        missing = state.get("missing_evidence", [])
        if intent == "unsupported":
            message = "This application finds and explains documents. The request is outside that scope."
        elif state.get("provenance", {}).get("withdrawn_evidence"):
            message = "Source acceptance or filter metadata changed during execution. Evidence outside the recorded accepted scope was withheld."
            missing = [
                *missing,
                "Some sources left the accepted collection or original metadata filters before completion.",
            ]
        elif state.get("partial") and not passages:
            message = "Retrieval or evidence screening failed. The available result cannot establish whether supporting evidence exists."
        elif not passages or (intent != "find" and not claims):
            message = (
                "The available documents do not provide sufficient supporting evidence for this request."
            )
            if not missing:
                missing = ["No passage passed the configured evidence policy for the requested fact."]
        elif intent == "find":
            message = f"Found {len(passages)} relevant passages within the selected filters. No narrative answer was generated."
        else:
            message = f"{len(claims)} cited claims passed exact citation validation and the fallible semantic support check."
        if state.get("partial") and passages:
            message += " Some retrieval or support checks failed; this result is partial."
        result = {
            "intent": intent,
            "plan": state.get("plan"),
            "passages": passages,
            "claims": claims,
            "missing_evidence": missing,
            "message": message,
            "partial": state.get("partial", False),
            "provenance": state.get("provenance", {}),
        }
        result = protect_discovery_result(storage, result, state["filters"])
        await engine.node(
            state["run_id"],
            "done",
            "done",
            "succeeded",
            label="Discovery results",
            detail=result["message"],
            input_count=len(passages),
            output_count=len(result["claims"]) if intent != "find" else len(result["passages"]),
            passage_ids=[passage["id"] for passage in result["passages"]],
        )
        return {"result": result}

    graph = StateGraph(DiscoveryState)
    for name, node in [
        ("intent", interpret_intent),
        ("plan", plan),
        ("retrieval_worker", worker),
        ("join", join),
        ("synthesize", synthesize),
        ("citations", citations),
        ("support", support),
        ("done", done),
    ]:
        graph.add_node(name, node)
    graph.add_edge(START, "intent")
    graph.add_conditional_edges("intent", lambda s: "done" if s["route"] == "unsupported" else "plan")
    graph.add_conditional_edges("plan", fanout, ["retrieval_worker", "join"])
    graph.add_edge("retrieval_worker", "join")
    graph.add_conditional_edges(
        "join",
        lambda s: (
            "synthesize" if s["evidence_ids"] and s["intent"] not in {"find", "unsupported"} else "done"
        ),
    )
    graph.add_edge("synthesize", "citations")
    graph.add_edge("citations", "support")
    graph.add_edge("support", "done")
    graph.add_edge("done", END)
    return graph.compile(checkpointer=checkpointer)
