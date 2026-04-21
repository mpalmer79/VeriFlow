"""Audit event writer with tamper-evident hash chaining.

Every event persisted through `record_event` is linked to the previous event
in the same organization scope via `previous_hash`, and carries its own
deterministic SHA-256 `entry_hash`. The hash material is a stable
concatenation of the event's identifying fields plus a canonicalized JSON
payload so two writers computing the same event independently produce the
same hash.

This is not an immutability guarantee. It is a tamper-evident chain: any
row that is later altered out-of-band will break the chain so an auditor
can detect the gap. No third-party signing, blockchain, or queue
infrastructure is introduced.
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import metrics
from app.models.audit import AuditLog
from app.models.record import Record


def _canonical_payload(payload: Optional[Dict[str, Any]]) -> str:
    if payload is None:
        return ""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def _latest_hash_in_scope(db: Session, organization_id: Optional[int]) -> Optional[str]:
    stmt = (
        select(AuditLog.entry_hash)
        .where(AuditLog.organization_id == organization_id)
        .order_by(AuditLog.id.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def compute_entry_hash(
    *,
    previous_hash: Optional[str],
    action: str,
    entity_type: str,
    entity_id: Optional[int],
    organization_id: Optional[int],
    actor_user_id: Optional[int],
    record_id: Optional[int],
    payload: Optional[Dict[str, Any]],
) -> str:
    material = "\n".join(
        [
            previous_hash or "",
            action,
            entity_type,
            "" if entity_id is None else str(entity_id),
            "" if organization_id is None else str(organization_id),
            "" if actor_user_id is None else str(actor_user_id),
            "" if record_id is None else str(record_id),
            _canonical_payload(payload),
        ]
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def verify_chain(
    db: Session, organization_id: Optional[int]
) -> Dict[str, Any]:
    """Walk every audit row in the organization scope and report any
    entries whose stored hash does not match a recomputed one, or whose
    `previous_hash` does not match the prior row's `entry_hash`.

    Returns a dict (suitable for direct JSON serialization). The check
    is read-only; it never mutates audit rows.
    """
    started = time.perf_counter()
    stmt = (
        select(AuditLog)
        .where(AuditLog.organization_id == organization_id)
        .order_by(AuditLog.id.asc())
    )
    rows = list(db.execute(stmt).scalars().all())
    broken_entries: list[Dict[str, Any]] = []
    broken_links: list[Dict[str, Any]] = []
    prev_hash: Optional[str] = None
    for row in rows:
        recomputed = compute_entry_hash(
            previous_hash=row.previous_hash,
            action=row.action,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            organization_id=row.organization_id,
            actor_user_id=row.actor_user_id,
            record_id=row.record_id,
            payload=row.payload,
        )
        if recomputed != row.entry_hash:
            broken_entries.append(
                {
                    "audit_id": row.id,
                    "stored_entry_hash": row.entry_hash,
                    "recomputed_entry_hash": recomputed,
                }
            )
        if row.previous_hash != prev_hash:
            broken_links.append(
                {
                    "audit_id": row.id,
                    "stored_previous_hash": row.previous_hash,
                    "expected_previous_hash": prev_hash,
                }
            )
        prev_hash = row.entry_hash
    metrics.observe_audit_verify(time.perf_counter() - started)
    return {
        "organization_id": organization_id,
        "checked": len(rows),
        "ok": not broken_entries and not broken_links,
        "broken_entries": broken_entries,
        "broken_links": broken_links,
    }


def list_for_record(
    db: Session, record: Record, *, limit: int = 100
) -> List[AuditLog]:
    stmt = (
        select(AuditLog)
        .where(AuditLog.record_id == record.id)
        .order_by(AuditLog.id.desc())
        .limit(limit)
    )
    return list(db.execute(stmt).scalars().all())


def record_event(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    organization_id: Optional[int] = None,
    actor_user_id: Optional[int] = None,
    record_id: Optional[int] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    previous_hash = _latest_hash_in_scope(db, organization_id)
    entry_hash = compute_entry_hash(
        previous_hash=previous_hash,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        record_id=record_id,
        payload=payload,
    )
    log = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        record_id=record_id,
        payload=payload,
        previous_hash=previous_hash,
        entry_hash=entry_hash,
    )
    db.add(log)
    db.flush()
    metrics.observe_audit_write()
    return log
