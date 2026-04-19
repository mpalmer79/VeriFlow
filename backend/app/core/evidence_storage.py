"""Local filesystem storage for uploaded document content.

Files are addressed by a server-generated UUID so the storage path is not
influenced by client-supplied filenames. The storage URI persisted on the
`Document` row is `file:<absolute-path>`; anything else is treated as a
legacy metadata reference and is not resolvable for integrity checks.

This module does not implement cloud storage, versioning, retention, or
encryption at rest. It is intentionally the smallest thing that lets
ingest + verification + integrity-check work with real bytes.
"""

from __future__ import annotations

import hashlib
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.core.config import get_settings


LOCAL_URI_PREFIX = "file:"
_UUID_HEX_RE = re.compile(r"^[0-9a-f]{32}$")


class StorageError(Exception):
    pass


class PayloadTooLarge(StorageError):
    pass


class EmptyPayload(StorageError):
    pass


@dataclass(frozen=True)
class StoredObject:
    storage_uri: str
    absolute_path: Path
    size_bytes: int
    content_hash: str


def _storage_root() -> Path:
    root = Path(get_settings().evidence_storage_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _build_local_uri(path: Path) -> str:
    return f"{LOCAL_URI_PREFIX}{path.resolve()}"


def store_bytes(content: bytes) -> StoredObject:
    if len(content) == 0:
        raise EmptyPayload("File payload is empty")
    max_bytes = get_settings().max_upload_bytes
    if len(content) > max_bytes:
        raise PayloadTooLarge(
            f"File exceeds maximum upload size ({len(content)} > {max_bytes} bytes)"
        )

    digest = hashlib.sha256(content).hexdigest()
    storage_name = f"{uuid.uuid4().hex}.bin"
    absolute_path = _storage_root() / storage_name
    absolute_path.write_bytes(content)
    return StoredObject(
        storage_uri=_build_local_uri(absolute_path),
        absolute_path=absolute_path,
        size_bytes=len(content),
        content_hash=digest,
    )


def is_local_uri(storage_uri: Optional[str]) -> bool:
    return bool(storage_uri and storage_uri.startswith(LOCAL_URI_PREFIX))


def resolve_local_path(storage_uri: Optional[str]) -> Optional[Path]:
    """Return the absolute local path if the URI points at local storage and
    the file is contained within the configured evidence directory. Returns
    None if the URI is not local, does not exist, or escapes the root.
    """
    if not is_local_uri(storage_uri):
        return None
    raw = storage_uri[len(LOCAL_URI_PREFIX):]
    try:
        candidate = Path(raw).resolve()
    except (OSError, RuntimeError):
        return None
    root = _storage_root()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    if not candidate.is_file():
        return None
    return candidate


def read_stored_bytes(storage_uri: Optional[str]) -> Optional[bytes]:
    path = resolve_local_path(storage_uri)
    if path is None:
        return None
    try:
        return path.read_bytes()
    except OSError:
        return None


def hash_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def safe_filename(original: Optional[str]) -> Optional[str]:
    """Return a trimmed, slash-free rendition of a client filename for
    persistence. The returned value is never used as a storage path —
    `store_bytes` always uses a server-generated UUID — but persisting the
    original name is useful for audit/display.
    """
    if original is None:
        return None
    trimmed = original.strip().replace("\x00", "")
    if not trimmed:
        return None
    # Strip any directory components so a value like "../../etc/passwd"
    # cannot linger in the label field.
    base = os.path.basename(trimmed)
    return base[:255] or None


__all__ = [
    "StorageError",
    "PayloadTooLarge",
    "EmptyPayload",
    "StoredObject",
    "LOCAL_URI_PREFIX",
    "store_bytes",
    "is_local_uri",
    "resolve_local_path",
    "read_stored_bytes",
    "hash_bytes",
    "safe_filename",
]
