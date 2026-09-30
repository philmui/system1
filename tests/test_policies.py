import pytest
from pydantic import ValidationError

from doc_discovery.policies import (
    classification_route,
    intent_route,
    merge_keyed,
    mixed_purpose,
    probability_route,
    select_context,
)
from doc_discovery.schemas import ChoiceSignal, NoulSignal, Passage


def choice(label="invoice", confidence=0.8, probabilities=None):
    return ChoiceSignal(
        provider="fixture",
        elapsed_ms=1,
        choice=label,
        confidence=confidence,
        probabilities=probabilities or {label: 0.95, "other" if label != "other" else "invoice": 0.05},
    )


@pytest.mark.parametrize("confidence,route", [(0.7999, "interpret"), (0.8, "accept"), (0.8001, "accept")])
def test_classification_threshold_is_inclusive(confidence, route):
    assert classification_route(choice(confidence=confidence), 0.8).name == route


def test_tie_unknown_and_explicit_mixed_purpose_escalate_even_if_confident():
    assert (
        classification_route(
            choice(probabilities={"invoice": 0.5, "contract": 0.5}, confidence=0.99), 0.8
        ).name
        == "interpret"
    )
    assert classification_route(choice("unknown", 0.99), 0.8).name == "interpret"
    assert classification_route(choice(confidence=0.99), 0.8, ambiguity=True).name == "interpret"
    with pytest.raises(ValueError):
        classification_route(choice("made_up"), 0.8)
    assert mixed_purpose("From: A\nSubject: proposed agreement\nPlease confirm this draft.")
    assert not mixed_purpose("Service agreement. Signed by both parties.")


@pytest.mark.parametrize("purpose,threshold", [("relevance", 0.7), ("support", 0.8)])
def test_binary_probability_thresholds_are_separate_and_inclusive(purpose, threshold):
    below = NoulSignal(provider="fixture", elapsed_ms=1, noul=threshold - 0.0001)
    equal = NoulSignal(provider="fixture", elapsed_ms=1, noul=threshold)
    above = NoulSignal(provider="fixture", elapsed_ms=1, noul=threshold + 0.0001)
    assert probability_route(below, threshold, purpose).name == "remove"
    assert probability_route(equal, threshold, purpose).name == "keep"
    assert probability_route(above, threshold, purpose).name == "keep"
    assert "confidence" not in equal.model_dump()


def test_intent_find_unsupported_and_uncertainty():
    assert intent_route(choice("find"), 0.8).name == "find"
    assert intent_route(choice("unsupported"), 0.8).name == "unsupported"
    assert intent_route(choice("unsupported", 0.79), 0.8).name == "plan"
    assert intent_route(choice("compare"), 0.8).name == "plan"


def test_distribution_rejects_malformed_and_nan():
    for probabilities in (
        {},
        {"invoice": 0.9},
        {"invoice": float("nan"), "contract": 0.1},
        {"invoice": 0.2, "other": 0.8},
    ):
        with pytest.raises(ValidationError):
            choice(probabilities=probabilities) if probabilities else ChoiceSignal(
                provider="fixture", elapsed_ms=1, choice="invoice", confidence=0.8, probabilities={}
            )


def test_long_context_spreads_whole_passages_and_records_exact_omissions():
    passages = [
        Passage(
            id=f"p{i}",
            document_id="doc",
            content_version="v1",
            filename="long.md",
            text=f"Section {i}: " + ("界" * 100),
            start=i * 111,
            end=i * 111 + 111,
            page=i + 1,
        )
        for i in range(8)
    ]
    context = select_context(passages, max_bytes=900)
    assert "p0" in context.refs and "p7" in context.refs
    assert len(context.text.encode()) <= 900
    assert len(context.refs) + len(context.omitted) == len(passages)
    for p in passages:
        if p.id in context.refs:
            assert p.text in context.text
        else:
            assert any(f"{p.start}:{p.end}" in omitted for omitted in context.omitted)
    assert merge_keyed({"b": 2}, {"a": 1}) == {"a": 1, "b": 2}
