from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import SESSION_COOKIE_NAME, get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserPublic
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str, ttl_seconds: int) -> None:
    settings = get_settings()
    secure = not settings.is_dev_like
    response.set_cookie(
        SESSION_COOKIE_NAME,
        value=token,
        max_age=ttl_seconds,
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/api",
    )


def _clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    secure = not settings.is_dev_like
    response.set_cookie(
        SESSION_COOKIE_NAME,
        value="",
        max_age=0,
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/api",
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[
        Depends(
            rate_limit(
                "auth.login",
                max_requests=lambda: get_settings().rate_limit_login_per_minute,
                window_seconds=60.0,
            )
        )
    ],
)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    try:
        user = auth_service.authenticate(db, payload.email, payload.password)
    except auth_service.AuthenticationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    settings = get_settings()
    token = auth_service.issue_token(user)
    ttl_seconds = settings.jwt_expires_minutes * 60
    # Mint both the cookie and the JSON body during the rollout window
    # so existing clients keep working while the frontend migrates to
    # cookie-only.
    _set_session_cookie(response, token, ttl_seconds)
    return TokenResponse(access_token=token, expires_in=ttl_seconds)


@router.post("/rotate", response_model=TokenResponse)
def rotate(
    response: Response,
    current_user: User = Depends(get_current_user),
) -> TokenResponse:
    """Reissue the session token with the same cookie posture. Lets
    the frontend extend a session without forcing the operator to
    re-enter credentials."""
    settings = get_settings()
    token = auth_service.issue_token(current_user)
    ttl_seconds = settings.jwt_expires_minutes * 60
    _set_session_cookie(response, token, ttl_seconds)
    return TokenResponse(access_token=token, expires_in=ttl_seconds)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    """Best-effort logout: clears the session cookie. JWTs are
    stateless so there is no server-side revocation — the cookie
    removal plus the frontend clearing its profile cache is the
    end of the session."""
    _clear_session_cookie(response)
    return None


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
