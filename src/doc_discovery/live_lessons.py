"""Shared admission for explicit, paid lesson commands; mounting a page does no work."""

from contextlib import asynccontextmanager

from fastapi import HTTPException, Request

from .providers.common import ProviderError
from .providers.openai import OpenAIProvider
from .schemas import FrontierModel


def frontier_label(model: FrontierModel) -> str:
    return model.replace("gpt-", "GPT-", 1)


@asynccontextmanager
async def live_frontier(request: Request, model: FrontierModel):
    """Each command owns its selected provider and leaves application settings alone."""
    settings = request.app.state.lesson_openai.settings.model_copy(
        update={"app_mode": "live", "openai_model": model}
    )
    provider = OpenAIProvider(settings)
    try:
        yield provider
    finally:
        await provider.close()


def check_live_origin(request: Request):
    origin = request.headers.get("origin")
    # A local reverse proxy preserves the browser's Host and Origin. Accept
    # their exact match only over loopback; remote and cross-origin requests
    # still require the explicit allowlist. Never trust X-Forwarded-Host here.
    local_same_origin = (
        request.client is not None
        and request.client.host in {"127.0.0.1", "::1"}
        and request.url.hostname in {"localhost", "127.0.0.1", "::1"}
        and origin == f"{request.url.scheme}://{request.url.netloc}"
    )
    if origin is not None and origin not in request.app.state.lesson_allowed_origins and not local_same_origin:
        raise HTTPException(403, "This origin is not allowed to request a live lesson.")
    if origin is None and request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Cross-site live lesson requests are not allowed.")


@asynccontextmanager
async def live_lesson_slot(request: Request):
    check_live_origin(request)
    slots = request.app.state.lesson_interpret_slots
    if slots.locked():
        raise HTTPException(429, "A live lesson is already running. Wait for it to finish.")
    async with slots:
        yield


def live_provider_error(error: ProviderError) -> HTTPException:
    status = (
        503
        if error.code in {"missing_key", "invalid_configuration"}
        else 504
        if error.code == "timeout"
        else 502
    )
    return HTTPException(status, str(error))
