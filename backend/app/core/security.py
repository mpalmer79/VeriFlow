from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_TYPE = "access"

RESERVED_CLAIMS = frozenset(
    {"sub", "iat", "nbf", "exp", "iss", "aud", "typ", "jti"}
)


class TokenValidationError(ValueError):
    """Raised when a token fails signature, structure, or claim validation."""


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    subject: str,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_minutes: Optional[int] = None,
) -> str:
    expire_delta = timedelta(minutes=expires_minutes or settings.jwt_expires_minutes)
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + expire_delta).timestamp()),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "typ": ACCESS_TOKEN_TYPE,
        "jti": uuid4().hex,
    }
    if extra_claims:
        for key, value in extra_claims.items():
            if key in RESERVED_CLAIMS:
                continue
            payload[key] = value
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
    except JWTError as exc:
        raise TokenValidationError("Invalid or expired token") from exc

    if claims.get("typ") != ACCESS_TOKEN_TYPE:
        raise TokenValidationError("Unexpected token type")
    return claims
