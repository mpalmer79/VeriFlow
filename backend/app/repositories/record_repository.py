from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.record import Record


def list_for_organization(
    db: Session,
    organization_id: int,
    limit: int = 100,
    offset: int = 0,
) -> List[Record]:
    stmt = (
        select(Record)
        .where(Record.organization_id == organization_id)
        .options(selectinload(Record.assigned_user))
        .order_by(Record.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(stmt).scalars().all())


def get(db: Session, record_id: int) -> Optional[Record]:
    stmt = (
        select(Record)
        .where(Record.id == record_id)
        .options(selectinload(Record.assigned_user))
    )
    return db.execute(stmt).scalar_one_or_none()


def add(db: Session, record: Record) -> Record:
    db.add(record)
    db.flush()
    db.refresh(record)
    return record


def save(db: Session, record: Record) -> Record:
    db.add(record)
    db.flush()
    db.refresh(record)
    return record
