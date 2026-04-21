"""Tiny in-process Prometheus metrics.

No external dependencies. The implementation is a module-level dict
of counters plus a simple histogram-bucket counter. Label cardinality
is kept under control by using FastAPI's path templates
(`/api/records/{record_id}`) rather than expanded URLs.

The `/metrics` endpoint renders these to Prometheus exposition format.
It is unauthenticated (standard Prometheus posture) and must not
surface any organization- or user-scoped data.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from threading import Lock
from typing import Dict, List, Tuple


# Default histogram buckets (seconds). Matches the Prometheus client
# library defaults, which are reasonable for a web request budget.
_HTTP_BUCKETS: Tuple[float, ...] = (
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
)


@dataclass
class _Histogram:
    name: str
    help_text: str
    buckets: Tuple[float, ...]
    bucket_counts: List[int] = field(default_factory=list)
    sum_seconds: float = 0.0
    count: int = 0

    def __post_init__(self) -> None:
        self.bucket_counts = [0] * len(self.buckets)

    def observe(self, value: float) -> None:
        for idx, upper in enumerate(self.buckets):
            if value <= upper:
                self.bucket_counts[idx] += 1
        self.sum_seconds += value
        self.count += 1


_lock = Lock()

# Counters keyed on their label tuple.
_http_requests_total: Dict[Tuple[str, str, str], int] = {}
_http_duration: _Histogram = _Histogram(
    name="veriflow_http_request_duration_seconds",
    help_text="HTTP request duration in seconds.",
    buckets=_HTTP_BUCKETS,
)
_audit_write_total: int = 0
_audit_verify_duration: _Histogram = _Histogram(
    name="veriflow_audit_verify_duration_seconds",
    help_text="Time spent in audit_service.verify_chain.",
    buckets=_HTTP_BUCKETS,
)
_evaluation_duration: _Histogram = _Histogram(
    name="veriflow_evaluation_duration_seconds",
    help_text="Time spent in evaluation_service.evaluate_and_persist.",
    buckets=_HTTP_BUCKETS,
)


def observe_http_request(
    method: str,
    path_template: str,
    status: int,
    duration_seconds: float,
) -> None:
    key = (method.upper(), path_template, str(status))
    with _lock:
        _http_requests_total[key] = _http_requests_total.get(key, 0) + 1
        _http_duration.observe(duration_seconds)


def observe_audit_write() -> None:
    global _audit_write_total
    with _lock:
        _audit_write_total += 1


def observe_audit_verify(duration_seconds: float) -> None:
    with _lock:
        _audit_verify_duration.observe(duration_seconds)


def observe_evaluation(duration_seconds: float) -> None:
    with _lock:
        _evaluation_duration.observe(duration_seconds)


def reset() -> None:
    """Test helper. Clears all metric state."""
    global _audit_write_total, _http_duration, _audit_verify_duration, _evaluation_duration
    with _lock:
        _http_requests_total.clear()
        _audit_write_total = 0
        _http_duration = _Histogram(
            name="veriflow_http_request_duration_seconds",
            help_text="HTTP request duration in seconds.",
            buckets=_HTTP_BUCKETS,
        )
        _audit_verify_duration = _Histogram(
            name="veriflow_audit_verify_duration_seconds",
            help_text="Time spent in audit_service.verify_chain.",
            buckets=_HTTP_BUCKETS,
        )
        _evaluation_duration = _Histogram(
            name="veriflow_evaluation_duration_seconds",
            help_text="Time spent in evaluation_service.evaluate_and_persist.",
            buckets=_HTTP_BUCKETS,
        )


def _escape_label_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _render_counter(
    name: str, help_text: str, samples: List[Tuple[str, float]]
) -> List[str]:
    lines = [f"# HELP {name} {help_text}", f"# TYPE {name} counter"]
    for label_str, value in samples:
        suffix = f"{{{label_str}}}" if label_str else ""
        lines.append(f"{name}{suffix} {value}")
    return lines


def _render_histogram(hist: _Histogram) -> List[str]:
    lines = [
        f"# HELP {hist.name} {hist.help_text}",
        f"# TYPE {hist.name} histogram",
    ]
    cumulative = 0
    for upper, count in zip(hist.buckets, hist.bucket_counts):
        cumulative = count  # buckets are already cumulative under this model
        lines.append(f'{hist.name}_bucket{{le="{upper}"}} {cumulative}')
    lines.append(f'{hist.name}_bucket{{le="+Inf"}} {hist.count}')
    lines.append(f"{hist.name}_sum {hist.sum_seconds}")
    lines.append(f"{hist.name}_count {hist.count}")
    return lines


def render_prometheus() -> str:
    with _lock:
        http_samples: List[Tuple[str, float]] = []
        for (method, path, status), value in sorted(_http_requests_total.items()):
            labels = (
                f'method="{_escape_label_value(method)}",'
                f'path_template="{_escape_label_value(path)}",'
                f'status="{_escape_label_value(status)}"'
            )
            http_samples.append((labels, value))
        lines: List[str] = []
        lines.extend(
            _render_counter(
                "veriflow_http_requests_total",
                "Total HTTP requests served, labeled by method, path template, and status.",
                http_samples,
            )
        )
        lines.extend(_render_histogram(_http_duration))
        lines.extend(
            _render_counter(
                "veriflow_audit_write_total",
                "Total audit rows written.",
                [("", _audit_write_total)],
            )
        )
        lines.extend(_render_histogram(_audit_verify_duration))
        lines.extend(_render_histogram(_evaluation_duration))
        return "\n".join(lines) + "\n"
