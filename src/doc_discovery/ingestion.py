"""Bounded extraction; immutable source versions and exact character anchors."""

import hashlib
import io
import json
import re
from datetime import date
from pathlib import Path
from time import perf_counter
from uuid import NAMESPACE_URL, uuid4, uuid5

from pypdf import PdfReader

from .schemas import Document, Passage
from .settings import ROOT, Settings
from .storage import Storage

ALLOWED = {".txt", ".md", ".pdf"}
MAX_EXTRACTED_CHARS = 500_000
MAX_PDF_PAGES = 200


def _contains_image(page) -> bool:
    """Inspect image resources without decoding image pixels, including nested forms."""
    pending = [page]
    visited: set[int] = set()
    while pending:
        item = pending.pop().get_object()
        if id(item) in visited:
            continue
        visited.add(id(item))
        if len(visited) > 256:
            raise ValueError("PDF resource nesting exceeds the inspection limit")
        resources = item.get("/Resources", {})
        if resources:
            resources = resources.get_object()
        objects = resources.get("/XObject", {})
        if objects:
            objects = objects.get_object()
        for reference in objects.values():
            resource = reference.get_object()
            if resource.get("/Subtype") == "/Image":
                return True
            if resource.get("/Subtype") == "/Form":
                pending.append(resource)
    # Inline images do not appear in the resource dictionary.
    content = page.get_contents()
    return bool(content and any(operator == b"INLINE IMAGE" for _, operator in content.operations))


def extract(filename: str, raw: bytes) -> tuple[str, str | None, list[tuple[int | None, str]]]:
    if Path(filename).suffix.lower() == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(raw))
            if reader.is_encrypted:
                return (
                    "encrypted",
                    "Encrypted PDFs are not supported. Upload an unencrypted text-based copy.",
                    [],
                )
            if len(reader.pages) > MAX_PDF_PAGES:
                return "unreadable", f"PDF exceeds the {MAX_PDF_PAGES}-page extraction limit.", []
            pages = []
            chars = 0
            for number, page in enumerate(reader.pages, 1):
                text = page.extract_text() or ""
                if not text.strip() and _contains_image(page):
                    return (
                        "scanned",
                        f"Page {number} contains an image but no extractable text. "
                        "OCR is not available; upload a text-based copy of every page. "
                        "The whole document is withheld from classification to avoid omitting evidence.",
                        [],
                    )
                chars += len(text)
                if chars > MAX_EXTRACTED_CHARS:
                    return "unreadable", "Extracted text exceeds the 500,000-character limit.", []
                pages.append((number, text))
            if not any(t.strip() for _, t in pages):
                return (
                    "scanned",
                    "No extractable text. This PDF may be scanned or blank; OCR is not available.",
                    [],
                )
            return "readable", None, pages
        except Exception:
            return "unreadable", "PDF could not be read. Upload a valid text-based PDF or UTF-8 text.", []
    try:
        text = raw.decode("utf-8-sig")
        if "\x00" in text:
            raise UnicodeError("Binary data")
    except UnicodeError:
        return "unreadable", "Text must use UTF-8 encoding and contain no binary data.", []
    if len(text) > MAX_EXTRACTED_CHARS:
        return "unreadable", "Text exceeds the 500,000-character extraction limit.", []
    if not text.strip():
        return "empty", "The document contains no readable text.", []
    return "readable", None, [(None, text)]


def anchors(doc: Document, pages: list[tuple[int | None, str]]) -> tuple[str, list[Passage]]:
    output = []
    texts = []
    offset = 0
    for page, text in pages:
        section = None
        # Keep overlapping bounded passages; offsets always refer to retained extracted text.
        start = 0
        while start < len(text):
            end = min(start + 1100, len(text))
            if end < len(text):
                boundary = text.rfind("\n", start + 600, end)
                if boundary > start:
                    end = boundary + 1
            excerpt = text[start:end]
            heading_scope = text[:start] if start else text[: text.find("\n") if "\n" in text else len(text)]
            headings = re.findall(r"^#{1,6}\s+(.+)$", heading_scope, re.MULTILINE)
            if headings:
                section = headings[-1]
            if excerpt.strip():
                pid = str(
                    uuid5(NAMESPACE_URL, f"{doc.id}:{doc.content_version}:{offset + start}:{offset + end}")
                )
                output.append(
                    Passage(
                        id=pid,
                        document_id=doc.id,
                        content_version=doc.content_version,
                        filename=doc.filename,
                        text=excerpt,
                        page=page,
                        section=section,
                        start=offset + start,
                        end=offset + end,
                    )
                )
            if end == len(text):
                break
            start = max(start + 1, end - 120)
        texts.append(text)
        offset += len(text) + 2
    return "\n\n".join(texts), output


def normalized_filename(filename: str) -> str:
    filename = Path(filename.replace("\\", "/")).name or "untitled.txt"
    if len(filename) > 255 or any(ord(character) < 32 for character in filename):
        raise ValueError("Filename must contain at most 255 characters and no control characters")
    if Path(filename).suffix.lower() not in ALLOWED:
        raise ValueError("Supported file types: UTF-8 .txt, .md and text-based .pdf")
    return filename


def ingest(
    storage: Storage,
    settings: Settings,
    filename: str,
    raw: bytes,
    document_date: date | None = None,
    synthetic=False,
    id: str | None = None,
) -> Document:
    filename = normalized_filename(filename)
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED:
        raise ValueError("Supported file types: UTF-8 .txt, .md and text-based .pdf")
    if len(raw) > settings.max_upload_bytes:
        raise ValueError(f"File exceeds the {settings.max_upload_bytes:,}-byte upload limit")
    digest = hashlib.sha256(raw).hexdigest()
    id = id or str(uuid4())
    try:
        existing = storage.get_document(id)
        if existing.content_version == digest:
            return existing
        raise ValueError("An immutable document identifier cannot be reused with different content")
    except KeyError:
        pass
    extraction_started = perf_counter()
    status, error, pages = extract(filename, raw)
    doc = Document(
        id=id,
        filename=filename,
        content_version=digest,
        document_date=document_date,
        date_provenance=("synthetic_manifest" if synthetic else "user_confirmed")
        if document_date
        else "unknown",
        synthetic=synthetic,
        extraction_status=status,
        extraction_error=error,
    )
    text, passages = anchors(doc, pages)
    doc.extraction_elapsed_ms = max(0, (perf_counter() - extraction_started) * 1000)
    # No client path components are used for storage filenames.
    destination = storage.data_dir / "files" / f"{id}{extension}"
    destination.write_bytes(raw)
    return storage.add_document(doc, text, passages)


def load_samples(storage: Storage, settings: Settings, teaching: bool = False) -> list[Document]:
    folder = ROOT / "data" / ("classification-examples" if teaching else "samples")
    manifest = json.loads((folder / "manifest.json").read_text())
    documents = []
    for item in manifest["documents"]:
        raw = (folder / item["filename"]).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        documents.append(
            ingest(
                storage,
                settings,
                item["filename"],
                raw,
                date.fromisoformat(item["document_date"]) if item.get("document_date") else None,
                synthetic=True,
                id=str(
                    uuid5(
                        NAMESPACE_URL,
                        f"{'lesson-v1' if teaching else 'atlas-v1'}:{item['filename']}:{digest}",
                    )
                ),
            )
        )
    return documents
