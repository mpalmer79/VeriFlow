import time
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import __version__
from app.api.routes import audit as audit_routes
from app.api.routes import auth, documents, records, workflows
from app.core import database as db_module
from app.core import metrics
from app.core.config import get_settings
from app.core.logging import (
    actor_id_ctx,
    configure_logging,
    get_logger,
    request_id_ctx,
)


_INTERACTIVE_DOC_PATHS = {"/docs", "/redoc", "/openapi.json"}
_METRICS_PATH = "/metrics"

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
    origins = [origin.strip() for origin in cors_origins if origin.strip()]
    tokens = ["'self'", *origins] if origins else ["'none'"]
    frame_ancestors = " ".join(tokens)
    return (
        "default-src 'none'; "
        f"frame-ancestors {frame_ancestors}; "
        "base-uri 'none'; "
        "form-action 'none'"
    )


def _request_path_template(request: Request) -> str:
    """Return the FastAPI route template when available.

    Keeping Prometheus labels capped at the *template*
    (`/api/records/{record_id}`) rather than the expanded URL keeps
    cardinality bounded. Falls back to the raw path when no route
    matched (404, health probes, /metrics).
    """
    route = request.scope.get("route")
    if route is not None and hasattr(route, "path"):
        return route.path
    return request.url.path


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.app_env)
    logger = get_logger("veriflow.http")

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
        allow_methods=settings.cors_allow_methods,
        allow_headers=settings.cors_allow_headers,
        expose_headers=[
            "Content-Disposition",
            "Content-Range",
            "Accept-Ranges",
            "X-Request-Id",
        ],
    )

    csp_header = _build_csp(settings.cors_origins)
    dev_like = settings.is_dev_like

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        # Honor an incoming X-Request-Id only in dev-like environments.
        # Production always generates a fresh id so clients cannot
        # forge one and confuse log correlation.
        incoming = request.headers.get("X-Request-Id")
        if dev_like and incoming:
            rid = incoming[:64]
        else:
            rid = uuid4().hex[:16]
        rid_token = request_id_ctx.set(rid)
        actor_token = actor_id_ctx.set(None)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration = time.perf_counter() - start
            metrics.observe_http_request(
                request.method, _request_path_template(request), 500, duration
            )
            logger.exception(
                "request failed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": 500,
                    "duration_ms": round(duration * 1000, 2),
                },
            )
            request_id_ctx.reset(rid_token)
            actor_id_ctx.reset(actor_token)
            raise

        duration = time.perf_counter() - start
        status_code = response.status_code
        path_template = _request_path_template(request)
        metrics.observe_http_request(
            request.method, path_template, status_code, duration
        )
        response.headers["X-Request-Id"] = rid
        for header, value in _BASE_SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        # Leave interactive docs and /metrics untouched so Swagger /
        # ReDoc assets load and Prometheus scrapers get plain text.
        if (
            request.url.path not in _INTERACTIVE_DOC_PATHS
            and request.url.path != _METRICS_PATH
        ):
            response.headers.setdefault("Content-Security-Policy", csp_header)
        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": status_code,
                "duration_ms": round(duration * 1000, 2),
            },
        )
        request_id_ctx.reset(rid_token)
        actor_id_ctx.reset(actor_token)
        return response

    app.include_router(auth.router, prefix=settings.api_v1_prefix)
    app.include_router(records.router, prefix=settings.api_v1_prefix)
    app.include_router(documents.router, prefix=settings.api_v1_prefix)
    app.include_router(workflows.router, prefix=settings.api_v1_prefix)
    app.include_router(audit_routes.router, prefix=settings.api_v1_prefix)

    def _liveness_body() -> dict:
        return {"status": "ok", "service": settings.app_name, "version": __version__}

    @app.get("/health/liveness", tags=["health"])
    def liveness() -> dict:
        """Liveness probe: confirms the process is accepting requests."""
        return _liveness_body()

    @app.get("/health", tags=["health"])
    def health_alias() -> dict:
        """Backward-compatible alias of /health/liveness.

        Pinned by a test so it cannot be accidentally removed.
        """
        return _liveness_body()

    @app.get("/health/readiness", tags=["health"])
    def readiness() -> JSONResponse:
        """Readiness probe: confirms the database is reachable."""
        try:
            with db_module.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except SQLAlchemyError as exc:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "unavailable",
                    "service": settings.app_name,
                    "version": __version__,
                    "database": "unreachable",
                    "detail": str(exc.__class__.__name__),
                },
            )
        return JSONResponse(
            status_code=200,
            content={
                "status": "ready",
                "service": settings.app_name,
                "version": __version__,
                "database": "ok",
            },
        )

    @app.get(_METRICS_PATH, include_in_schema=False)
    def metrics_endpoint() -> PlainTextResponse:
        """Prometheus exposition format. Unauthenticated (standard
        Prometheus posture). Only process-level counters and
        histograms; labels are capped at method, path_template, and
        status so no org- or user-scoped data leaks out.
        """
        return PlainTextResponse(
            content=metrics.render_prometheus(),
            media_type="text/plain; version=0.0.4; charset=utf-8",
        )

    return app


app = create_app()
