from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from doc_discovery.policies import Context
from doc_discovery.providers.common import ProviderError
from doc_discovery.providers.jev import JevProvider, validate_budget
from doc_discovery.providers.openai import ClassificationProposal, OpenAIProvider
from doc_discovery.schemas import ChoiceSignal, Document, NoulSignal
from doc_discovery.settings import Settings


def settings():
    return Settings(
        _env_file=None,
        app_mode="live",
        typesafe_api_key=None,
        openai_api_key=None,
        langsmith_tracing=False,
        langsmith_api_key=None,
    )


def document():
    return Document(id="doc", filename="input.txt", content_version="v1", extraction_status="readable")


@pytest.mark.parametrize("confidence", [float("nan"), -0.01, 1.01])
def test_invalid_confidence_rejected(confidence):
    with pytest.raises(ValidationError):
        ChoiceSignal(
            provider="jev",
            elapsed_ms=1,
            choice="invoice",
            confidence=confidence,
            probabilities={"invoice": 1},
        )


def test_choice_and_noul_semantics_do_not_merge():
    s = NoulSignal(provider="jev", elapsed_ms=1, noul=0.8)
    assert "confidence" not in s.model_dump()
    with pytest.raises(ValidationError):
        ChoiceSignal(
            provider="jev", elapsed_ms=1, choice="invoice", confidence=0.9, probabilities={"contract": 1}
        )
    with pytest.raises(ValidationError):
        ChoiceSignal(
            provider="jev",
            elapsed_ms=1,
            choice="invoice",
            confidence=0.9,
            probabilities={"invoice": 0.2, "contract": 0.8},
        )


def test_request_budget_counts_all_questions_and_largest():
    validate_budget("small", {"q": {"instructions": "small"}}, "jev-1.13.0")
    with pytest.raises(ProviderError, match="budget"):
        validate_budget("s" * 31000, {"q": {"instructions": "x" * 1000}}, "jev-1.13.0")
    with pytest.raises(ProviderError, match="budget"):
        validate_budget("s" * 2000, {str(i): {"instructions": "x" * 25000} for i in range(3)}, "jev-1.13.0")
    with pytest.raises(ProviderError, match="verified"):
        validate_budget("small", {"q": {}}, "unverified-model")


async def test_missing_keys_never_use_fixtures():
    with pytest.raises(ProviderError) as caught:
        await JevProvider(settings()).classify(document(), Context("Invoice amount due", [], []))
    assert caught.value.code == "missing_key"
    with pytest.raises(ProviderError) as caught:
        await OpenAIProvider(settings()).interpret(document(), Context("Invoice", [], []))
    assert caught.value.code == "missing_key"


async def test_jev_metadata_and_typed_sdk_field_parsing():
    provider = JevProvider(settings())
    usage = SimpleNamespace(model_dump=lambda **kwargs: {"input_tokens": 13})
    response = SimpleNamespace(
        model="jev-1.13.0",
        usage=usage,
        raw_http_response=SimpleNamespace(headers={"x-request-id": "request-1"}),
        choices={
            "category": SimpleNamespace(
                choice="invoice", confidence=0.83, probabilities={"invoice": 0.9, "contract": 0.1}
            )
        },
    )
    provider.client = SimpleNamespace(system_one=AsyncMock(return_value=response))
    signal = await provider.classify(document(), Context("Invoice amount due", [], []))
    assert signal.choice == "invoice" and signal.confidence == 0.83
    assert signal.request_id == "request-1" and signal.usage == {"input_tokens": 13}
    call = provider.client.system_one.call_args.kwargs
    assert call["state"]["document_id"] == "doc"
    assert "category_definitions" in call["state"]
    assert call["questions"]["category"].criteria["unknown"]


async def test_timeouts_are_failures_not_uncertainty():
    provider = JevProvider(settings())
    provider.client = SimpleNamespace(system_one=AsyncMock(side_effect=TimeoutError()))
    with pytest.raises(ProviderError) as error:
        await provider.intent("Find Atlas")
    assert error.value.code == "timeout" and error.value.retryable


@pytest.mark.parametrize(
    "status,parts,parsed,expected",
    [
        ("incomplete", [], None, "incomplete"),
        ("completed", [SimpleNamespace(content=[SimpleNamespace(type="refusal")])], None, "refusal"),
        ("completed", [], None, "missing_output"),
    ],
)
async def test_openai_incomplete_refusal_missing_parsed(status, parts, parsed, expected):
    provider = OpenAIProvider(settings())
    provider.client = SimpleNamespace(
        responses=SimpleNamespace(
            parse=AsyncMock(return_value=SimpleNamespace(status=status, output=parts, output_parsed=parsed))
        )
    )
    with pytest.raises(ProviderError) as error:
        await provider.interpret(document(), Context("mixed document", [], []))
    assert error.value.code == expected


async def test_openai_response_uses_typed_parse_and_no_tools():
    provider = OpenAIProvider(settings())
    proposal = ClassificationProposal(category="contract", explanation="Unsigned terms require review.")
    provider.client = SimpleNamespace(
        responses=SimpleNamespace(
            parse=AsyncMock(
                return_value=SimpleNamespace(
                    status="completed",
                    output=[],
                    output_parsed=proposal,
                    _request_id="req-2",
                    id="response-2",
                    model="gpt-4.1-mini",
                    usage=None,
                )
            )
        )
    )
    signal = await provider.interpret(document(), Context("Mixed agreement/email", [], []))
    assert signal.kind == "proposal" and signal.category == "contract"
    call = provider.client.responses.parse.call_args.kwargs
    assert call["text_format"] is ClassificationProposal
    assert call["store"] is False and "tools" not in call
    assert "untrusted data" in call["instructions"]


@pytest.mark.parametrize(
    "model,reasoning",
    [("gpt-5.5", True), ("gpt-5.5-2026-04-23", True), ("gpt-5.6-sol", True), ("gpt-4.1", False), ("gpt-4.1-mini", False), ("gpt-5.5-pro", False)],
)
async def test_selected_reasoning_budgets_do_not_change_nonreasoning_or_other_models(model, reasoning):
    provider = OpenAIProvider(settings().model_copy(update={"openai_model": model}))
    provider.client = SimpleNamespace(
        responses=SimpleNamespace(
            parse=AsyncMock(
                return_value=SimpleNamespace(
                    status="completed",
                    output=[],
                    output_parsed=ClassificationProposal(category="contract", explanation="Proposed terms."),
                    id="response-budget",
                    model=model,
                    usage=None,
                )
            )
        )
    )
    signal = await provider.interpret(document(), Context("Proposed agreement", [], []))
    options = provider.client.responses.parse.call_args.kwargs
    assert options["model"] == signal.configured_model == model
    assert options["max_output_tokens"] == (8192 if reasoning else 2400)
    assert options.get("reasoning") == ({"effort": "low"} if reasoning else None)
