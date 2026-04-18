from typing import Optional

from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.repositories import user_repository


class AuthenticationError(Exception):
    pass


def authenticate(db: Session, email: str, password: str) -> User:
    user = user_repository.get_by_email(db, email)
    if user is None or not user.is_active:
        raise AuthenticationError("Invalid email or password")
    if not verify_password(password, user.hashed_password):
        raise AuthenticationError("Invalid email or password")
    return user


def issue_token(user: User) -> str:
    return create_access_token(
        subject=str(user.id),
        extra_claims={"role": user.role.value, "org": user.organization_id},
    )


def get_user_from_token_subject(db: Session, subject: Optional[str]) -> Optional[User]:
    if not subject:
        return None
    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        return None
    return user_repository.get_by_id(db, user_id)
