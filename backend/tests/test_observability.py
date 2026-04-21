"""Phase 4 observability smoke tests.

Three surfaces to pin:

- Every response carries an X-Request-Id response header.
- /metrics returns a plain-text Prometheus document with the named
  metric families.
- /health split: /health/liveness is the primary probe,
  /health/readiness is unchanged, and /health remains as an alias of
  /health/liveness.
"""

from __future__ import annotations

import pytest

from app.core import metrics


@pytest.fixture(autouse=True)
def _reset_metrics():
    metrics.reset()
    yield


def test_response_carries_request_id(client):
    response = client.get("/health/liveness")
    assert response.status_code == 200
    assert response.headers.get("X-Request-Id")
    # The middleware shortens to 16 hex chars when it mints its own.
    assert len(response.headers["X-Request-Id"]) >= 8


def test_health_alias_points_at_liveness_body(client):
    alias = client.get("/health").json()
    liveness = client.get("/health/liveness").json()
    assert alias == liveness
    assert alias["status"] == "ok"


def test_readiness_probe_is_separate(client):
    """/health/readiness must not be replaced by the alias rename."""
    response = client.get("/health/readiness")
    # With SQLite in-memory the DB is always reachable; this asserts
    # the route still exists and reports 200.
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_metrics_endpoint_returns_prometheus_document(client):
    # Drive a couple of requests so the counters have something to
    # render.
    client.get("/health/liveness")
    client.get("/health/liveness")

    response = client.get("/metrics")
    assert response.status_code == 200
    content_type = response.headers.get("Content-Type", "")
    assert content_type.startswith("text/plain"), content_type

    body = response.text
    # HELP and TYPE preamble on each metric family.
    for family in (
        "veriflow_http_requests_total",
        "veriflow_http_request_duration_seconds",
        "veriflow_audit_write_total",
        "veriflow_audit_verify_duration_seconds",
        "veriflow_evaluation_duration_seconds",
    ):
        assert f"# HELP {family}" in body, f"missing HELP for {family}"
        assert f"# TYPE {family}" in body, f"missing TYPE for {family}"

    # At least one http_requests_total sample with our labels.
    assert 'path_template="/health/liveness"' in body
    assert 'method="GET"' in body
    assert 'status="200"' in body


def test_metrics_uses_path_templates_not_expanded_urls(
    client, auth_headers, db_session
):
    """Prometheus label cardinality must stay bounded — the route
    template (/api/records/{record_id}) is the right label, not the
    expanded URL (/api/records/42).
    """
    # Grab any record id that exists via the records listing.
    listing = client.get("/api/records", headers=auth_headers).json()
    assert listing, "seed should produce at least one record"
    record_id = listing[0]["id"]
    client.get(f"/api/records/{record_id}", headers=auth_headers)

    body = client.get("/metrics").text
    assert 'path_template="/api/records/{record_id}"' in body
    # The expanded URL must not leak into a label value.
    assert f'path_template="/api/records/{record_id}"' not in body
