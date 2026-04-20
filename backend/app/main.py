from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routes import audit as audit_routes
from app.api.routes import auth, documents, records, workflows
from app.core.config import get_settings


_INTERACTIVE_DOC_PATHS = {"/docs", "/redoc", "/openapi.json"}

_BASE_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    # `X-Frame-Options` is intentionally not set: frame embedding is
    # governed by CSP `frame-ancestors` which can express per-origin
    # allowances. Modern browsers prefer CSP when both are present,
    # but Safari has historically let `X-Frame-Options: DENY` win, so
    # keeping it unset avoids breaking cross-origin preview iframes.
}


def _build_csp(cors_origins: list[str]) -> str:
    """Compose the CSP applied to non-interactive responses.

    The frontend's CORS origins are added to `frame-ancestors` so the
    Next.js preview modal can iframe signed-content responses. Every
    other directive clamps to 'none' because this API never emits HTML
    that loads fonts, scripts, images, or styles of its own.
    """
    origins = [origin.strip() for origin in cors_origins if origin.strip()]
    tokens = ["'self'", *origins] if origins else ["'none'"]
    frame_ancestors = " ".join(tokens)
    return (
        "default-src 'none'; "
        f"frame-ancestors {frame_ancestors}; "
        "base-uri 'none'; "
        "form-action 'none'"
    )


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    csp_header = _build_csp(settings.cors_origins)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        for header, value in _BASE_SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        # Leave the interactive docs alone so Swagger / ReDoc assets load.
        if request.url.path not in _INTERACTIVE_DOC_PATHS:
            response.headers.setdefault("Content-Security-Policy", csp_header)
        return response

    app.include_router(auth.router, prefix=settings.api_v1_prefix)
    app.include_router(records.router, prefix=settings.api_v1_prefix)
    app.include_router(documents.router, prefix=settings.api_v1_prefix)
    app.include_router(workflows.router, prefix=settings.api_v1_prefix)
    app.include_router(audit_routes.router, prefix=settings.api_v1_prefix)

    @app.get("/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok", "service": settings.app_name, "version": __version__}

    return app


app = create_app()
