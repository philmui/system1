"""Provider-safe errors; never persist arbitrary SDK exception bodies."""


class ProviderError(RuntimeError):
    def __init__(self, provider: str, code: str, message: str, retryable: bool = False):
        super().__init__(message)
        self.provider = provider
        self.code = code
        self.retryable = retryable


def safe_error(provider: str, error: Exception) -> ProviderError:
    if isinstance(error, ProviderError):
        return error
    status = getattr(error, "status_code", None)
    name = type(error).__name__.lower()
    if status in (401, 403):
        return ProviderError(
            provider, "authentication", f"{provider} authentication or account access failed."
        )
    if status == 429:
        return ProviderError(provider, "rate_limit", f"{provider} rate limit reached.", True)
    if status and status >= 500:
        return ProviderError(
            provider, "unavailable", f"{provider} is temporarily unavailable (HTTP {status}).", True
        )
    if "timeout" in name:
        return ProviderError(provider, "timeout", f"{provider} request timed out.", True)
    if "connection" in name or isinstance(error, OSError):
        return ProviderError(provider, "connection", f"{provider} network connection failed.", True)
    if "validation" in name or isinstance(error, (ValueError, KeyError, TypeError, AttributeError)):
        return ProviderError(
            provider, "invalid_response", f"{provider} returned an invalid or unsupported response."
        )
    return ProviderError(provider, "request_failed", f"{provider} request failed ({type(error).__name__}).")
