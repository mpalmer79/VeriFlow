"""Structured logging with per-request context.

Emits one log line per HTTP request on response. Non-development
environments write JSON lines to stdout (so log collectors can ingest
them without a parser); development writes a human-readable single
line.

Request id propagation is handled by a `contextvars.ContextVar` that
the middleware seeds and a logging filter reads. This keeps the
log-record surface uniform without threading the id through every
call site.

No third-party dependencies. `logging` + a small JSON formatter is
enough for the volume VeriFlow produces.
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from typing import Any, Dict, Optional


request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
actor_id_ctx: ContextVar[Optional[int]] = ContextVar("actor_id", default=None)


_STANDARD_RECORD_KEYS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
    "asctime",
    # Injected by the filter; already consumed below.
    "request_id",
    "actor_id",
}


class _RequestContextFilter(logging.Filter):
    """Injects request_id + actor_id onto every record from the
    current ContextVar state."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        record.actor_id = actor_id_ctx.get()
        return True


class JsonLineFormatter(logging.Formatter):
    """JSON-per-line formatter.

    Carries the structured fields callers pass via `extra=` through to
    stdout without swallowing them into the message string.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = {
            "timestamp": self.formatTime(record, datefmt="%Y-%m-%dT%H:%M:%S.%f")[:-3]
            + "Z",
            "level": record.levelname.lower(),
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
        }
        actor_id = getattr(record, "actor_id", None)
        if actor_id is not None:
            payload["actor_id"] = actor_id
        # Any extra structured fields callers passed via `extra={}`.
        for key, value in record.__dict__.items():
            if key in _STANDARD_RECORD_KEYS:
                continue
            if key.startswith("_"):
                continue
            payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class HumanFormatter(logging.Formatter):
    """Single-line human format for local development."""

    def format(self, record: logging.LogRecord) -> str:
        request_id = getattr(record, "request_id", None) or "-"
        base = f"{self.formatTime(record, '%H:%M:%S')} {record.levelname:<5} {request_id} {record.getMessage()}"
        extras = []
        for key, value in record.__dict__.items():
            if key in _STANDARD_RECORD_KEYS:
                continue
            if key.startswith("_"):
                continue
            extras.append(f"{key}={value}")
        if extras:
            base = f"{base} | {' '.join(extras)}"
        if record.exc_info:
            base = f"{base}\n{self.formatException(record.exc_info)}"
        return base


_CONFIGURED = False


def configure_logging(app_env: str) -> None:
    """Install root-level logging for the app.

    Safe to call more than once; subsequent calls reconfigure the root
    handler. Tests don't call this — they use the stdlib default to
    keep output quiet.
    """
    global _CONFIGURED
    root = logging.getLogger()
    # Remove existing handlers so calling twice (e.g. test reload) does
    # not stack them.
    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.addFilter(_RequestContextFilter())
    is_dev = (app_env or "").strip().lower() in {"development", "dev"}
    handler.setFormatter(HumanFormatter() if is_dev else JsonLineFormatter())
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
