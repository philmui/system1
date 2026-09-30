"""Content-bound fixture signals for the synthetic classification lesson.

These are used only by fixture providers. Live providers never read this mapping.
The runtime still executes its normal policy, workers, review, and event logging.
"""

import hashlib
import json
from functools import lru_cache

from .schemas import Document
from .settings import ROOT

TEACHING_FOLDER = ROOT / "data" / "classification-examples"


@lru_cache(maxsize=1)
def teaching_manifest() -> dict:
    return json.loads((TEACHING_FOLDER / "manifest.json").read_text())


@lru_cache(maxsize=1)
def _fixture_examples() -> dict:
    return {
        (
            item["filename"],
            hashlib.sha256((TEACHING_FOLDER / item["filename"]).read_bytes()).hexdigest(),
        ): item
        for item in teaching_manifest()["documents"]
    }


def fixture_example(document: Document) -> dict | None:
    if not document.synthetic:
        return None
    return _fixture_examples().get((document.filename, document.content_version))
