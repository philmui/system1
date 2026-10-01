"""Same-origin local proxies work without broadening the cross-origin allowlist."""

import pytest
from fastapi.testclient import TestClient
from test_live_lessons import live_settings, mock_sdk, response

from doc_discovery.api import create_app
from doc_discovery.review_lessons import review_pages


def review_body():
    page = review_pages()["ARC-000141"]
    return {"page_id": page["id"], "content_version": page["content_version"], "action": "classify"}


@pytest.mark.parametrize(
    "base_url,origin,peer",
    [
        ("http://127.0.0.1:5175", "http://127.0.0.1:5175", "127.0.0.1"),
        ("http://localhost:6123", "http://localhost:6123", "127.0.0.1"),
        ("http://[::1]:5300", "http://[::1]:5300", "::1"),
        ("http://127.0.0.1:8000", "http://127.0.0.1:5173", "127.0.0.1"),
    ],
)
def test_local_proxy_or_explicit_origin_can_classify(tmp_path, monkeypatch, base_url, origin, peer):
    sdk = mock_sdk(monkeypatch, lambda **_: response({
        "responsive": "yes", "personal_info": "no", "privileged": "no",
        "explanation": "A fictional relevant page.",
    }))
    with TestClient(create_app(live_settings(tmp_path)), base_url=base_url, client=(peer, 50000)) as client:
        result = client.post("/api/lessons/review/live", json=review_body(), headers={"Origin": origin})
        assert result.status_code == 200, result.text
        assert result.json()["metadata"]["provider"] == "openai"
        assert result.json()["operational_writes"] == 0
        assert sdk.responses.parse.await_count == 1


@pytest.mark.parametrize(
    "base_url,headers,peer",
    [
        ("http://127.0.0.1:5175", {"Origin": "https://attacker.example"}, "127.0.0.1"),
        ("http://127.0.0.1:8000", {"Origin": "http://127.0.0.1:5175"}, "127.0.0.1"),
        ("http://127.0.0.1:5175", {"Origin": "https://127.0.0.1:5175"}, "127.0.0.1"),
        ("http://127.0.0.1:5175", {"Origin": "null"}, "127.0.0.1"),
        ("http://127.0.0.1:5175", {"Sec-Fetch-Site": "cross-site"}, "127.0.0.1"),
        ("http://127.0.0.1:8000", {"Origin": "http://127.0.0.1:5175", "X-Forwarded-Host": "127.0.0.1:5175"}, "127.0.0.1"),
        ("https://attacker.example", {"Origin": "https://attacker.example"}, "127.0.0.1"),
        ("http://127.0.0.1.attacker.example", {"Origin": "http://127.0.0.1.attacker.example"}, "127.0.0.1"),
        ("http://127.0.0.1:5175", {"Origin": "http://127.0.0.1:5175"}, "198.51.100.10"),
    ],
)
def test_proxy_support_does_not_admit_untrusted_live_requests(tmp_path, monkeypatch, base_url, headers, peer):
    sdk = mock_sdk(monkeypatch, lambda **_: response(None))
    with TestClient(create_app(live_settings(tmp_path)), base_url=base_url, client=(peer, 50000)) as client:
        result = client.post("/api/lessons/review/live", json=review_body(), headers=headers)
        assert result.status_code == 403, result.text
        sdk.responses.parse.assert_not_called()


def test_proxy_support_keeps_direct_cors_allowlist_explicit(tmp_path):
    with TestClient(create_app(live_settings(tmp_path))) as client:
        headers = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"}
        allowed = client.options("/api/lessons/review/live", headers=headers | {"Origin": "http://127.0.0.1:5173"})
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
        rejected = client.options("/api/lessons/review/live", headers=headers | {"Origin": "http://127.0.0.1:5175"})
        assert rejected.status_code == 400
        assert "access-control-allow-origin" not in rejected.headers
