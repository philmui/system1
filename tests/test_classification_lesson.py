"""Exercise the teaching corpus through the real API, policy, workers, and review."""

from fastapi.testclient import TestClient
from test_api import configured, settle

from doc_discovery.api import create_app
from doc_discovery.schemas import Document
from doc_discovery.teaching import fixture_example


def test_teaching_corpus_records_both_branches_and_the_actual_policy_reason(tmp_path):
    with TestClient(create_app(configured(tmp_path))) as client:
        docs = client.post("/api/samples/classification").json()["documents"]
        assert len(docs) == 4 and all(
            doc["synthetic"] and doc["extraction_status"] == "readable" for doc in docs
        )
        assert docs == client.post("/api/samples/classification").json()["documents"]
        by_name = {doc["filename"]: doc["id"] for doc in docs}
        job = client.post("/api/runs/classification", json={"document_ids": list(by_name.values())})
        assert job.status_code == 202
        run_id = job.json()["id"]
        snap = settle(client, run_id)
        assert snap["run"]["status"] == "awaiting_review"
        events = snap["events"]
        decisions = {
            event["instance_id"]: event["payload"] for event in events if event["type"] == "decision"
        }
        expected = {
            "lesson-clear-invoice.md": ("accept", "accepted"),
            "lesson-access-policy.md": ("accept", "accepted"),
            "lesson-invoice-or-progress-report.md": ("interpret", "below_threshold"),
            "lesson-unsigned-agreement-email.md": ("interpret", "mixed_purpose"),
        }
        for name, (route, reason) in expected.items():
            decision = decisions[f"{by_name[name]}:jev"]
            assert decision["selected_route"] == route
            assert decision["policy_reason"] == reason
            assert decision["signal"]["provider"] == "fixture"
            assert decision["policy_elapsed_ms"] >= 0
            assert any(
                event["type"] == "edge_selected"
                and event["payload"]["source_instance_id"] == f"{by_name[name]}:jev"
                and event["payload"]["target_instance_id"]
                == f"{by_name[name]}:{'interpret' if route == 'interpret' else 'outcome'}"
                for event in events
            )
        guarded = decisions[f"{by_name['lesson-unsigned-agreement-email.md']}:jev"]
        assert guarded["signal"]["confidence"] > guarded["threshold"]
        assert (
            len(
                [
                    event
                    for event in events
                    if event["type"] == "node_started"
                    and event["payload"].get("state") == "running"
                    and event["instance_id"].endswith(":jev")
                ]
            )
            == 4
        )
        assert (
            len(
                [
                    event
                    for event in events
                    if event["type"] == "node_started"
                    and event["payload"].get("state") == "running"
                    and event["instance_id"].endswith(":interpret")
                ]
            )
            == 2
        )
        # A frontier interpretation really can change the proposed category.
        assert (
            decisions[f"{by_name['lesson-unsigned-agreement-email.md']}:interpret"]["signal"]["category"]
            == "correspondence"
        )
        review = snap["run"]["review"]
        assert len(review["items"]) == 2
        response = client.post(
            f"/api/runs/{run_id}/review",
            json={
                "interrupt_id": review["interrupt_id"],
                "revision": review["revision"],
                "decisions": [
                    {
                        "document_id": item["document_id"],
                        "action": "accept",
                        "category": item["proposal"],
                    }
                    for item in review["items"]
                ],
            },
        )
        assert response.status_code == 202, response.text
        complete = settle(client, run_id)
        assert complete["run"]["status"] == "succeeded"
        assert complete["run"]["result"]["indexed_count"] == 4


def test_fixture_signals_are_bound_to_synthetic_content_not_just_filenames(tmp_path):
    with TestClient(create_app(configured(tmp_path))) as client:
        doc = Document.model_validate(client.post("/api/samples/classification").json()["documents"][2])
        assert fixture_example(doc)["confidence"] == 0.58
        assert fixture_example(doc.model_copy(update={"synthetic": False})) is None
        assert fixture_example(doc.model_copy(update={"content_version": "different"})) is None


def test_teaching_signals_obey_the_configured_threshold(tmp_path):
    settings = configured(tmp_path).model_copy(update={"jev_choice_threshold": 0.99})
    with TestClient(create_app(settings)) as client:
        docs = client.post("/api/samples/classification").json()["documents"]
        run = client.post("/api/runs/classification", json={"document_ids": [docs[0]["id"]]}).json()
        snap = settle(client, run["id"])
        judgment = next(
            event["payload"]
            for event in snap["events"]
            if event["type"] == "decision" and event["instance_id"].endswith(":jev")
        )
        assert judgment["threshold"] == 0.99
        assert judgment["policy_reason"] == "below_threshold"
        assert judgment["selected_route"] == "interpret"
