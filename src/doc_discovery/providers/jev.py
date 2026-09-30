"""Typed TypeSafe adapter. Fixture signals are explicitly a different provider."""

import asyncio
import json
import logging
import re
from time import perf_counter
from typing import Any
from uuid import uuid4

from typesafe_sdk import AsyncTypeSafeClient, Choice, Noul, RetryPolicy

from ..policies import CATEGORY_RUBRIC, INTENT_RUBRIC, INTENTS, TAXONOMY, Context
from ..schemas import ChoiceSignal, Document, NoulSignal, Passage
from ..teaching import fixture_example
from .common import ProviderError, safe_error

# Verified against typesafe-sdk 0.7.2 and the model documentation on 2026-09-28.
# UTF-8 bytes conservatively bound tokens; reserve 1,024 for provider framing.
MODEL_LIMITS = {"jev-1.13.0": (64_000, 32_000), "jev-latest": (64_000, 32_000)}


def byte_size(value: Any) -> int:
    return len(json.dumps(value, ensure_ascii=False, default=str).encode("utf-8"))


def validate_budget(state: Any, questions: dict, model: str) -> None:
    limits = MODEL_LIMITS.get(model)
    if not limits:
        raise ProviderError(
            "jev",
            "model_limits",
            "This Jev model has no verified context limits in the adapter. Add its documented limits before use.",
        )
    state_size = byte_size(state)
    question_sizes = [byte_size({"id": key, **value}) for key, value in questions.items()]
    if (
        not question_sizes
        or state_size + sum(question_sizes) + 1024 > limits[0]
        or state_size + max(question_sizes) + 1024 > limits[1]
    ):
        raise ProviderError(
            "jev", "context_limit", "The selected context exceeds the conservative Jev request budget."
        )


class JevProvider:
    def __init__(self, settings):
        self.settings = settings
        self.fixture = settings.app_mode == "test-fixture"
        self.client = None
        self.initialization_error = None
        self.last_error = None
        # SDK debug request bodies can contain private document text.
        logging.getLogger("typesafe_sdk").setLevel(logging.WARNING)
        if not self.fixture and settings.typesafe_api_key:
            try:
                self.client = AsyncTypeSafeClient(
                    api_key=settings.typesafe_api_key.get_secret_value(),
                    model=settings.typesafe_default_model,
                    timeout=settings.provider_timeout_seconds,
                    retry=RetryPolicy(max_retries=0),
                )
            except Exception:
                self.initialization_error = ProviderError(
                    "jev", "invalid_configuration", "jev credential or client configuration is invalid."
                )

    def _failed(self, error):
        self.last_error = safe_error("jev", error)
        return self.last_error

    async def close(self):
        if self.client:
            await self.client.aclose()

    async def _request(self, state, questions):
        if self.initialization_error:
            raise self.initialization_error
        if not self.client:
            raise ProviderError(
                "jev", "missing_key", "TYPESAFE_API_KEY is missing; live execution cannot call Jev."
            )
        wire = {
            key: {"type": "choice", "instructions": q.instructions, "criteria": dict(q.criteria)}
            if isinstance(q, Choice)
            else {"type": "noul", "instructions": q.instructions}
            for key, q in questions.items()
        }
        validate_budget(state, wire, self.settings.typesafe_default_model)
        started = perf_counter()
        try:
            async with asyncio.timeout(self.settings.provider_timeout_seconds):
                response = await self.client.system_one(state=state, questions=questions)
            raw = getattr(response, "raw_http_response", None)
            headers = getattr(raw, "headers", {})
            metadata = dict(
                provider="jev",
                request_id=headers.get("x-request-id") or headers.get("request-id"),
                configured_model=self.settings.typesafe_default_model,
                returned_model=response.model,
                elapsed_ms=(perf_counter() - started) * 1000,
                usage=response.usage.model_dump(exclude_none=True) or None,
            )
            self.last_error = None
            return response, metadata
        except Exception as error:
            raise self._failed(error) from None

    async def _fixture_meta(self):
        started = perf_counter()
        await asyncio.sleep(0.055)
        return dict(
            provider="fixture",
            request_id=f"simulated-{uuid4().hex}",
            configured_model="deterministic-fixture-v1",
            returned_model="deterministic-fixture-v1",
            elapsed_ms=(perf_counter() - started) * 1000,
        )

    async def _fixture_choice(self, choice, criteria, confidence=0.95):
        meta = await self._fixture_meta()
        probability = 0.96 if confidence >= 0.8 else 0.52
        probabilities = {key: (1 - probability) / (len(criteria) - 1) for key in criteria}
        probabilities[choice] = probability
        return ChoiceSignal(**meta, choice=choice, confidence=confidence, probabilities=probabilities)

    async def classify(self, document: Document, context: Context) -> ChoiceSignal:
        if self.fixture:
            example = fixture_example(document)
            if example and "choice" in example:
                return await self._fixture_choice(example["choice"], TAXONOMY, example["confidence"])
            text = context.text.lower()
            if "provider-failure" in document.filename:
                raise ProviderError(
                    "jev", "fixture_failure", "Simulated Jev failure for a deterministic failure test."
                )
            if "ambiguous" in document.filename.lower() or ("subject:" in text and "agreement" in text):
                return await self._fixture_choice("contract", TAXONOMY, 0.55)
            if "invoice" in document.filename.lower():
                label = "invoice"
            elif "report" in document.filename.lower():
                label = "report"
            elif "correspondence" in document.filename.lower() or re.search(
                r"(?im)^(from|subject|to):", context.text
            ):
                label = "correspondence"
            elif re.search(r"\b(service agreement|contract)\b", text):
                label = "contract"
            elif re.search(r"\b(policy|procedure)\b", text):
                label = "policy"
            elif re.search(r"\b(report|status|milestone)\b", text) and "subject:" not in text:
                label = "report"
            elif (
                re.search(r"(?im)^(from|subject|to):", context.text) or "correspondence" in document.filename
            ):
                label = "correspondence"
            elif len(context.text.strip()) < 30:
                label = "unknown"
            else:
                label = "other"
            return await self._fixture_choice(label, TAXONOMY)
        response, metadata = await self._request(
            {
                "document_id": document.id,
                "filename": document.filename,
                "content_version": document.content_version,
                "document_text": context.text,
                "omitted_range_count": len(context.omitted),
                "context_completeness": "Selected excerpts; omitted ranges are recorded in the local decision audit."
                if context.omitted
                else "All extracted passages are included.",
                "category_definitions": TAXONOMY,
            },
            {"category": Choice(instructions=CATEGORY_RUBRIC, criteria=TAXONOMY)},
        )
        try:
            answer = response.choices["category"]
            return ChoiceSignal(
                **metadata,
                choice=answer.choice,
                confidence=answer.confidence,
                probabilities=answer.probabilities,
            )
        except Exception as error:
            raise self._failed(error) from None

    async def intent(self, query: str) -> ChoiceSignal:
        if self.fixture:
            q = query.lower()
            if re.search(r"\b(delete|execute|send email|run code|write a poem)\b", q):
                label = "unsupported"
            elif re.search(r"\b(compare|difference|conflict)\b", q):
                label = "compare"
            elif re.search(r"\b(summarize|summary|explain|what|how|why|who)\b", q):
                label = "summarize"
            else:
                label = "find"
            return await self._fixture_choice(label, INTENTS)
        response, metadata = await self._request(
            {"user_query": query, "intent_definitions": INTENTS},
            {"intent": Choice(instructions=INTENT_RUBRIC, criteria=INTENTS)},
        )
        try:
            answer = response.choices["intent"]
            return ChoiceSignal(
                **metadata,
                choice=answer.choice,
                confidence=answer.confidence,
                probabilities=answer.probabilities,
            )
        except Exception as error:
            raise self._failed(error) from None

    async def relevance(self, query: str, passages: list[Passage]) -> dict[str, NoulSignal]:
        from ..policies import RELEVANCE_RUBRIC

        if not passages:
            return {}
        if self.fixture:
            meta = await self._fixture_meta()
            stop = {
                "the",
                "and",
                "are",
                "for",
                "what",
                "how",
                "does",
                "about",
                "find",
                "containing",
                "compare",
                "summarize",
                "please",
                "project",
                "atlas",
                "service",
                "agreements",
                "documents",
                "invoices",
            }
            tokens = [x for x in re.findall(r"\w+", query.lower()) if len(x) > 2 and x not in stop]
            signals = {}
            for passage in passages:
                text = passage.text.lower()
                if re.search(
                    r"\b(mars|lunar|spaceship|ceo salary|unicorn|launch code|submarine|insurance policy number)\b",
                    query.lower(),
                ):
                    relevant = False
                elif tokens:
                    relevant = any(word.rstrip("s") in text for word in tokens)
                else:
                    relevant = bool(set(re.findall(r"\w+", query.lower())) & set(re.findall(r"\w+", text)))
                signals[passage.id] = NoulSignal(**meta, noul=0.94 if relevant else 0.12)
            return signals
        # Independent judgments are batched; each question identifies its exact evidence.
        state = {
            "user_query": query,
            "passages": [
                {"passage_id": p.id, "document_id": p.document_id, "text": p.text} for p in passages
            ],
        }
        questions = {
            p.id: Noul(instructions=f"{RELEVANCE_RUBRIC} Judge ONLY passage {p.id} for user query {query!r}.")
            for p in passages
        }
        response, metadata = await self._request(state, questions)
        try:
            return {p.id: NoulSignal(**metadata, noul=response.nouls[p.id].noul) for p in passages}
        except Exception as error:
            raise self._failed(error) from None

    async def support(self, claim: str, passages: list[Passage]) -> NoulSignal:
        from ..policies import SUPPORT_RUBRIC

        if self.fixture:
            meta = await self._fixture_meta()
            # Simulated rubric, intentionally not an independent factual evaluator.
            numbers = re.findall(r"\b\d+\b", claim)
            source = " ".join(p.text.lower() for p in passages)
            valid = bool(passages) and all(n in source for n in numbers) and "invented" not in claim.lower()
            return NoulSignal(**meta, noul=0.96 if valid else 0.08)
        response, metadata = await self._request(
            {
                "claim": claim,
                "cited_passages": [
                    {"passage_id": p.id, "document_id": p.document_id, "text": p.text} for p in passages
                ],
            },
            {"support": Noul(instructions=SUPPORT_RUBRIC)},
        )
        try:
            return NoulSignal(**metadata, noul=response.nouls["support"].noul)
        except Exception as error:
            raise self._failed(error) from None
