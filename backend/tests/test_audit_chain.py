"""Tamper-evidence tests for the audit chain.

Seeds a small, isolated chain inside the test itself (rather than
leaning on the demo seed) so the assertions key on exactly three
audit rows and can identify the middle row by id. Both directions
of tamper — payload mutation and previous_hash mutation — must be
detected by `audit_service.verify_chain`.
"""

from __future__ import annotations

from sqlalchemy.orm.attributes import flag_modified

from app.models.audit import AuditLog
from app.models.organization import Organization
from app.services import audit_service


def _seed_chain(db_session) -> list[AuditLog]:
    org = (
        db_session.query(Organization)
        .filter(Organization.slug == "veriflow-demo")
        .one()
    )
    rows: list[AuditLog] = []
    for payload in (
        {"step": "one", "marker": "first"},
        {"step": "two", "marker": "middle"},
        {"step": "three", "marker": "last"},
    ):
        row = audit_service.record_event(
            db_session,
            action="record.evaluated",
            entity_type="record",
            organization_id=org.id,
            actor_user_id=None,
            record_id=None,
            payload=payload,
        )
        rows.append(row)
    db_session.commit()
    for row in rows:
        db_session.refresh(row)
    return rows


def test_verify_chain_happy_path(db_session):
    rows = _seed_chain(db_session)
    org_id = rows[0].organization_id

    report = audit_service.verify_chain(db_session, org_id)

    assert report["ok"] is True
    assert report["broken_entries"] == []
    assert report["broken_links"] == []
    assert report["checked"] >= 3


def test_verify_chain_detects_mutated_payload(db_session):
    rows = _seed_chain(db_session)
    middle = rows[1]
    org_id = middle.organization_id

    # Mutate the middle row's payload out-of-band. `flag_modified` is
    # required so SQLAlchemy notices the in-place JSON mutation.
    middle.payload = {"step": "two", "marker": "tampered"}
    flag_modified(middle, "payload")
    db_session.flush()
    db_session.commit()

    report = audit_service.verify_chain(db_session, org_id)

    assert report["ok"] is False
    broken_ids = {entry["audit_id"] for entry in report["broken_entries"]}
    assert middle.id in broken_ids


def test_verify_chain_detects_mutated_previous_hash(db_session):
    rows = _seed_chain(db_session)
    middle = rows[1]
    org_id = middle.organization_id

    middle.previous_hash = "0" * 64
    db_session.flush()
    db_session.commit()

    report = audit_service.verify_chain(db_session, org_id)

    assert report["ok"] is False
    broken_link_ids = {entry["audit_id"] for entry in report["broken_links"]}
    assert middle.id in broken_link_ids
