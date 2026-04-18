from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_by_email(db: Session, email: str) -> Optional[User]:
    return db.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()


def get_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.get(User, user_id)
