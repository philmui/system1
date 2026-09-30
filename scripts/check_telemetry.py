"""Opt-in read-only verification of the real traces recorded by the live smoke check."""

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse

from langsmith import Client

from doc_discovery.settings import Settings

settings = Settings()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--report", default="smoke-report.json", help="Report filename in APP_DATA_DIR")
args = parser.parse_args()
report_path = settings.app_data_dir / args.report
report = json.loads(report_path.read_text())
client = Client(api_key=settings.langsmith_api_key.get_secret_value(), api_url=settings.langsmith_endpoint)
forbidden = {
    "text",
    "document_text",
    "selected_document_text",
    "query",
    "user_query",
    "prompt",
    "content",
    "filename",
    "evidence",
    "passages",
}


def inspect_fields(value):
    if isinstance(value, dict):
        return any(k in forbidden or inspect_fields(v) for k, v in value.items())
    if isinstance(value, list):
        return any(inspect_fields(x) for x in value)
    return False


verified = []
for url in report.get("trace_urls", [report["trace_url"]] if report.get("trace_url") else []):
    id = urlparse(url).path.split("/r/")[1].split("/")[0]
    run = client.read_run(id, load_child_runs=True)
    pending = [run]
    count = 0
    failed = False
    provider_spans = []
    while pending:
        item = pending.pop()
        count += 1
        failed |= inspect_fields(item.inputs) or inspect_fields(item.outputs)
        if item.run_type == "llm":
            provider_spans.append(item.name)
        pending.extend(item.child_runs or [])
    verified.append(
        {
            "trace_name": run.name,
            "spans_read": count,
            "provider_spans": provider_spans,
            "forbidden_payload_fields_found": bool(failed),
            "root_completed": run.end_time is not None,
        }
    )
client.close()
output = {
    "verification": "Read persisted LangSmith root and child runs with authenticated API",
    "traces": verified,
}
output_name = (
    "telemetry-verification.json"
    if args.report == "smoke-report.json"
    else f"{Path(args.report).stem}-telemetry-verification.json"
)
(settings.app_data_dir / output_name).write_text(json.dumps(output, indent=2))
print(json.dumps(output, indent=2))
if not verified or any(x["forbidden_payload_fields_found"] for x in verified):
    raise SystemExit(1)
