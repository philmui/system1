import time

from fastapi.testclient import TestClient

from doc_discovery.api import create_app
from doc_discovery.settings import Settings


def configured(tmp_path):
    return Settings(
        _env_file=None,
        app_data_dir=tmp_path,
        app_mode="test-fixture",
        langsmith_tracing=False,
        typesafe_api_key=None,
        openai_api_key=None,
        langsmith_api_key=None,
    )


def settle(client, run_id):
    for _ in range(200):
        snapshot = client.get(f"/api/runs/{run_id}").json()
        if snapshot["run"]["status"] not in {"queued", "running"}:
            return snapshot
        time.sleep(0.025)
    raise AssertionError("Run did not settle")


def test_http_upload_filters_idempotency_and_sse(tmp_path):
    with TestClient(create_app(configured(tmp_path))) as client:
        health = client.get("/api/health").json()
        assert health["mode"] == "test-fixture" and health["fts5"]
        cors = client.options(
            "/api/runs/classification",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,Idempotency-Key",
            },
        )
        assert cors.headers["access-control-allow-origin"] == "http://localhost:5173"
        assert cors.headers["access-control-allow-credentials"] == "true"

        response = client.post(
            "/api/documents",
            files=[("files", ("invoice.txt", b"Invoice Atlas. Total due USD 100.", "text/plain"))],
            data={"document_date": "2026-01-01"},
        )
        assert response.status_code == 200
        d = response.json()["documents"][0]
        assert d["date_provenance"] == "user_confirmed"
        assert client.post("/api/documents", files=[("files", ("evil.exe", b"code"))]).status_code == 422
        body = {"document_ids": [d["id"]]}
        assert (
            client.post("/api/runs/classification", json=body, headers={"Idempotency-Key": ""}).status_code
            == 422
        )

        first = client.post("/api/runs/classification", json=body, headers={"Idempotency-Key": "upload-run"})
        assert first.status_code == 202
        id = first.json()["id"]
        assert (
            client.post(
                "/api/runs/classification", json=body, headers={"Idempotency-Key": "upload-run"}
            ).json()["id"]
            == id
        )
        snap = settle(client, id)
        assert snap["run"]["status"] == "succeeded"
        assert snap["last_event_sequence"] == snap["events"][-1]["sequence"]
        events = client.get(f"/api/runs/{id}/events?after=1").text
        assert "event: execution" in events and "event: settled" in events
        assert f"id: {snap['last_event_sequence']}" in events
        assert "\nid: 1\n" not in "\n" + events
        assert (
            client.get("/api/documents?date_from=2026-01-01&date_to=2026-01-01").json()["documents"][0]["id"]
            == d["id"]
        )
        assert client.get("/api/documents?date_from=2026-02-01&date_to=2026-01-01").status_code == 422
        assert client.get("/api/documents/missing").status_code == 404
        changed = client.post(
            "/api/runs/classification", json={"document_ids": []}, headers={"Idempotency-Key": "upload-run"}
        )
        assert changed.status_code == 409


def test_review_survives_process_restart_and_rejects_stale_partial_duplicate(tmp_path):
    settings = configured(tmp_path)
    with TestClient(create_app(settings)) as client:
        docs = client.post("/api/samples").json()["documents"]
        mixed = [d for d in docs if "ambiguous" in d["filename"]]
        assert mixed
        result = client.post(
            "/api/runs/classification", json={"document_ids": [d["id"] for d in mixed]}
        ).json()
        id = result["id"]
        snapshot = settle(client, id)
        assert snapshot["run"]["status"] == "awaiting_review"
        review = snapshot["run"]["review"]
    with TestClient(create_app(settings)) as client:
        restored = client.get(f"/api/runs/{id}").json()
        assert restored["run"]["review"] == review
        bad = {"interrupt_id": review["interrupt_id"], "revision": review["revision"], "decisions": []}
        assert client.post(f"/api/runs/{id}/review", json=bad).status_code == 409
        complete = {
            **bad,
            "decisions": [
                {"document_id": i["document_id"], "action": "correct", "category": "correspondence"}
                for i in review["items"]
            ],
        }
        assert client.post(f"/api/runs/{id}/review", json={**complete, "revision": 999}).status_code == 409
        assert client.post(f"/api/runs/{id}/review", json=complete).status_code == 202
        assert client.post(f"/api/runs/{id}/review", json=complete).status_code == 409
        done = settle(client, id)
        assert done["run"]["status"] == "succeeded"
        doc = client.get("/api/documents/" + mixed[0]["id"]).json()["document"]
        assert doc["indexed"] and doc["human_correction"] and doc["original_judgment"]
        sequences = [e["sequence"] for e in done["events"]]
        assert sequences == list(range(1, len(sequences) + 1))
        index_done = [
            e for e in done["events"] if e["type"] == "node_completed" and e["instance_id"] == "index"
        ]
        assert len(index_done) == 1


def test_startup_interrupt_recovery_cancel_and_linked_restart(tmp_path):
    from doc_discovery.storage import Storage

    settings = configured(tmp_path)
    db = Storage(tmp_path)
    run, _ = db.create_run("classification", "test-fixture", {"document_ids": []}, settings.public_config())
    db.update_run(run.id, status="running")
    db.close()
    with TestClient(create_app(settings)) as client:
        assert client.get(f"/api/runs/{run.id}").json()["run"]["status"] == "interrupted"
        assert client.get(f"/api/runs/{run.id}").json()["events"][-1]["payload"]["timing_incomplete"]
        # No checkpoint exists for an unscheduled process-local job.
        assert client.post(f"/api/runs/{run.id}/recover").status_code == 409
        restarted = client.post(f"/api/runs/{run.id}/restart")
        assert restarted.status_code == 202
        new = restarted.json()
        assert new["linked_run_id"] == run.id
        assert settle(client, new["id"])["run"]["status"] == "succeeded"
        assert client.post(f"/api/runs/{run.id}/cancel").json()["status"] == "cancelled"


def test_openapi_exposes_the_same_validated_event_payload_contract(tmp_path):
    from doc_discovery.schemas import EVENT_PAYLOAD_MODELS

    schema = create_app(configured(tmp_path)).openapi()
    components = schema["components"]["schemas"]
    refs = {item["$ref"] for item in components["Event"]["properties"]["payload"]["oneOf"]}
    assert refs == {f"#/components/schemas/{model.__name__}" for model in EVENT_PAYLOAD_MODELS.values()}
    assert "timing_incomplete" in components["RunCompletedPayload"]["properties"]
    assert "query_plan" in components["NodePayload"]["properties"]
    assert len(components["Event"]["allOf"]) == len(EVENT_PAYLOAD_MODELS)


def test_fixture_discovery_citations_find_and_missing(tmp_path):
    with TestClient(create_app(configured(tmp_path))) as client:
        docs = client.post("/api/samples").json()["documents"]
        selected = [
            d["id"]
            for d in docs
            if ("agreement" in d["filename"] and "ambiguous" not in d["filename"])
            or "invoice" in d["filename"]
        ]
        run = client.post("/api/runs/classification", json={"document_ids": selected}).json()
        assert settle(client, run["id"])["run"]["status"] == "succeeded"
        query = client.post(
            "/api/runs/discovery",
            json={
                "query": "Atlas",
                "filters": {"categories": ["invoice"], "date_from": "2026-03-31", "date_to": "2026-03-31"},
            },
        ).json()
        found = settle(client, query["id"])["run"]["result"]
        assert found["intent"] == "find"
        assert not found["claims"]
        assert {p["filename"] for p in found["passages"]} == {"atlas-invoice-march.md"}
        complex = client.post(
            "/api/runs/discovery",
            json={"query": "Compare the termination notice periods in the Atlas service agreements."},
        ).json()
        compared = settle(client, complex["id"])
        assert compared["run"]["result"]["claims"]
        for claim in compared["run"]["result"]["claims"]:
            for citation in claim["citations"]:
                passage = client.get("/api/passages/" + citation["passage_id"]).json()
                assert citation["quote"] in passage["text"]
        missing = client.post(
            "/api/runs/discovery", json={"query": "What is the Atlas submarine insurance policy number?"}
        ).json()
        absent = settle(client, missing["id"])["run"]["result"]
        assert not absent["claims"]
        assert "evidence" in absent["message"].lower() or "support" in absent["message"].lower()
