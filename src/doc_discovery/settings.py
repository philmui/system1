from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Pydantic's dotenv source uses python-dotenv.dotenv_values. Keeping loading
    # scoped here preserves environment precedence and _env_file=None isolation
    # without copying local credentials into the process-wide environment.
    model_config = SettingsConfigDict(
        env_file=ROOT / ".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )
    typesafe_api_key: SecretStr | None = None
    typesafe_default_model: str = "jev-1.13.0"
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-5.5"
    langsmith_api_key: SecretStr | None = None
    langsmith_tracing: bool = False
    langsmith_trace_synthetic_text: bool = False
    langsmith_project: str = "document-discovery-studio"
    langsmith_endpoint: str = "https://api.smith.langchain.com"
    app_data_dir: Path = ROOT / ".runtime"
    app_mode: Literal["live", "test-fixture"] = "live"
    jev_choice_threshold: float = Field(default=0.80, ge=0, le=1)
    jev_relevance_threshold: float = Field(default=0.70, ge=0, le=1)
    jev_support_threshold: float = Field(default=0.80, ge=0, le=1)
    max_concurrency: int = Field(default=4, ge=1, le=8)
    max_upload_bytes: int = Field(default=5_000_000, ge=1, le=20_000_000)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    provider_timeout_seconds: float = Field(default=45, ge=1, le=120)

    @field_validator("app_data_dir")
    @classmethod
    def absolute(cls, v):
        return v if v.is_absolute() else ROOT / v

    @field_validator("cors_origins")
    @classmethod
    def explicit_origins(cls, value):
        from urllib.parse import urlparse

        for origin in value.split(","):
            parsed = urlparse(origin.strip())
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.path
                or parsed.query
                or parsed.fragment
                or "*" in origin
            ):
                raise ValueError("CORS_ORIGINS must list explicit HTTP(S) origins with no paths or wildcard")
        return value

    def public_config(self):
        return {
            "choice_threshold": self.jev_choice_threshold,
            "relevance_threshold": self.jev_relevance_threshold,
            "support_threshold": self.jev_support_threshold,
            "max_concurrency": self.max_concurrency,
            "typesafe_model": self.typesafe_default_model,
            "openai_model": self.openai_model,
            "provider_timeout_seconds": self.provider_timeout_seconds,
        }
