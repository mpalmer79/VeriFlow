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
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit import AuditLog


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
    return log
