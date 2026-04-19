from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_TYPE = "access"
CONTENT_ACCESS_TOKEN_TYPE = "content_access"
CONTENT_ACCESS_AUDIENCE = "veriflow-content"
CONTENT_ACCESS_DEFAULT_TTL_SECONDS = 120

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


def create_content_access_token(
    *,
    document_id: int,
    organization_id: int,
    user_id: int,
    disposition: str,
    ttl_seconds: Optional[int] = None,
) -> tuple[str, datetime]:
    """Mint a short-lived signed token that authorizes a single direct
    content fetch for one document. The token carries its own audience
    and typ so it cannot be reused as a regular access token.
    """
    ttl = ttl_seconds or CONTENT_ACCESS_DEFAULT_TTL_SECONDS
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl)
    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": settings.jwt_issuer,
        "aud": CONTENT_ACCESS_AUDIENCE,
        "typ": CONTENT_ACCESS_TOKEN_TYPE,
        "jti": uuid4().hex,
        "doc": document_id,
        "org": organization_id,
        "disp": disposition,
    }
    token = jwt.encode(
        payload, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )
    return token, expires_at


def decode_content_access_token(token: str) -> Dict[str, Any]:
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=CONTENT_ACCESS_AUDIENCE,
            issuer=settings.jwt_issuer,
        )
    except JWTError as exc:
        raise TokenValidationError("Invalid or expired content-access token") from exc

    if claims.get("typ") != CONTENT_ACCESS_TOKEN_TYPE:
        raise TokenValidationError("Unexpected token type")
    if not isinstance(claims.get("doc"), int):
        raise TokenValidationError("Token is missing a document reference")
    if not isinstance(claims.get("org"), int):
        raise TokenValidationError("Token is missing an organization reference")
    disposition = claims.get("disp")
    if disposition not in {"inline", "attachment"}:
        raise TokenValidationError("Token has an invalid disposition claim")
    return claims
