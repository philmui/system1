import os
from unittest.mock import Mock

import pytest
from dotenv import dotenv_values
from pydantic_settings.sources.providers import dotenv as dotenv_source

from doc_discovery.providers import openai as openai_module
from doc_discovery.settings import ROOT, Settings


@pytest.fixture
def local_env(tmp_path, monkeypatch):
    # Use only fictional credentials; never read or change the developer's .env.
    for name in list(os.environ):
        if name.upper() in {"OPENAI_API_KEY", "OPENAI_MODEL", "APP_MODE"}:
            monkeypatch.delenv(name)
    project = tmp_path / "project"
    project.mkdir()
    path = project / ".env"
    path.write_text(
        'export OPENAI_API_KEY="fictional-file-key"\n'
        "OPENAI_MODEL=gpt-5.5\n"
        "APP_MODE=live\n"
        "UNRELATED_SETTING=ignored\n",
        encoding="utf-8",
    )
    assert Settings.model_config["env_file"] == ROOT / ".env"
    monkeypatch.setitem(Settings.model_config, "env_file", path)
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    monkeypatch.chdir(elsewhere)
    return path


def test_python_dotenv_reads_configured_file_and_passes_key_to_sdk(local_env, monkeypatch):
    read = Mock(wraps=dotenv_values)
    monkeypatch.setattr(dotenv_source, "dotenv_values", read)
    sdk = Mock()
    monkeypatch.setattr(openai_module, "AsyncOpenAI", sdk)

    settings = Settings()
    provider = openai_module.OpenAIProvider(settings)

    read.assert_called_once_with(local_env, encoding="utf-8")
    sdk.assert_called_once_with(
        api_key="fictional-file-key", timeout=settings.provider_timeout_seconds, max_retries=0
    )
    assert provider.fixture is False
    assert settings.openai_model == "gpt-5.5"
    assert "OPENAI_API_KEY" not in os.environ
    assert "fictional-file-key" not in repr(settings)
    assert "fictional-file-key" not in settings.model_dump_json()
    assert "openai_api_key" not in settings.public_config()


def test_environment_and_constructor_override_dotenv_without_mutating_it(local_env, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "fictional-environment-key")
    assert Settings().openai_api_key.get_secret_value() == "fictional-environment-key"
    assert Settings(openai_api_key="fictional-explicit-key").openai_api_key.get_secret_value() == (
        "fictional-explicit-key"
    )
    assert dotenv_values(local_env)["OPENAI_API_KEY"] == "fictional-file-key"


def test_isolated_settings_disable_dotenv_and_explicit_none_never_inherits_key(local_env, monkeypatch):
    assert Settings(_env_file=None).openai_api_key is None
    assert Settings(openai_api_key=None).openai_api_key is None
    monkeypatch.setenv("OPENAI_API_KEY", "fictional-environment-key")
    assert Settings(_env_file=None, openai_api_key=None).openai_api_key is None


def test_missing_dotenv_does_not_search_parent_directories(local_env, tmp_path):
    settings = Settings(_env_file=tmp_path / "absent.env")
    assert settings.openai_api_key is None
