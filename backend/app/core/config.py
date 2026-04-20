from functools import lru_cache
from typing import List

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_JWT_SECRET = "change-me-in-production"
DEV_ENVIRONMENTS = frozenset({"development", "dev", "test", "testing", "ci"})


class UnsafeConfigurationError(RuntimeError):
    """Raised at startup when production config is missing required secrets."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    app_name: str = "VeriFlow"
    api_v1_prefix: str = "/api"

    database_url: str = "sqlite+pysqlite:///./veriflow.db"

    jwt_secret: str = DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60
    jwt_issuer: str = "veriflow"
    jwt_audience: str = "veriflow-api"

    evidence_storage_dir: str = "./evidence"
    max_upload_bytes: int = 25 * 1024 * 1024
    content_access_ttl_seconds: int = 120

    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    cors_allow_methods: List[str] = Field(
        default_factory=lambda: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    )
    cors_allow_headers: List[str] = Field(
        default_factory=lambda: ["Authorization", "Content-Type", "Accept", "Range"]
    )

    # Rate-limit windows. `0` disables a limiter; individual routes still
    # choose which bucket to apply. These defaults are conservative but
    # realistic for an internal operations tool.
    rate_limit_login_per_minute: int = 10
    rate_limit_upload_per_minute: int = 30
    rate_limit_signed_access_per_minute: int = 60

    @field_validator("cors_origins", "cors_allow_methods", "cors_allow_headers", mode="before")
    @classmethod
    def split_csv(cls, value):
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value

    @model_validator(mode="after")
    def _validate_secrets(self) -> "Settings":
        env = (self.app_env or "").strip().lower()
        if env not in DEV_ENVIRONMENTS and self.jwt_secret == DEFAULT_JWT_SECRET:
            raise UnsafeConfigurationError(
                "JWT_SECRET must be set to a non-default value in non-dev environments. "
                f"Current APP_ENV is {self.app_env!r}; refusing to start with the default secret."
            )
        return self

    @property
    def is_dev_like(self) -> bool:
        return (self.app_env or "").strip().lower() in DEV_ENVIRONMENTS


@lru_cache
def get_settings() -> Settings:
    return Settings()
