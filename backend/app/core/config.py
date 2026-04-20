from functools import lru_cache
from typing import List, Tuple, Type

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings.sources import EnvSettingsSource, PydanticBaseSettingsSource


DEFAULT_JWT_SECRET = "change-me-in-production"
DEV_ENVIRONMENTS = frozenset({"development", "dev", "test", "testing", "ci"})

# Fields whose env value is a plain comma-separated string rather than
# a JSON list. pydantic-settings' default EnvSettingsSource tries to
# JSON-decode any value whose annotation is a collection type, which
# breaks `CORS_ORIGINS=http://localhost:3000` long before our
# `field_validator(..., mode="before")` can see it. The custom source
# below skips that decode for these names so the validator receives the
# raw string and splits it itself.
_CSV_ENV_FIELDS = frozenset(
    {"cors_origins", "cors_allow_methods", "cors_allow_headers"}
)


class _CsvEnvSettingsSource(EnvSettingsSource):
    def prepare_field_value(self, field_name, field, value, value_is_complex):
        if field_name in _CSV_ENV_FIELDS and isinstance(value, str):
            # Pass the raw string straight through; the validator on
            # Settings handles the CSV split and JSON-list fallback.
            return value
        return super().prepare_field_value(
            field_name, field, value, value_is_complex
        )


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

    cors_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )
    cors_allow_methods: List[str] = Field(
        default_factory=lambda: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    )
    cors_allow_headers: List[str] = Field(
        default_factory=lambda: ["Authorization", "Content-Type", "Accept", "Range"]
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: Type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> Tuple[PydanticBaseSettingsSource, ...]:
        return (
            init_settings,
            _CsvEnvSettingsSource(settings_cls),
            dotenv_settings,
            file_secret_settings,
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
        if not isinstance(value, str):
            return value
        stripped = value.strip()
        # Tolerate JSON-list form in env values too, so a caller that
        # uses `CORS_ORIGINS=["http://a","http://b"]` still works.
        if stripped.startswith("[") and stripped.endswith("]"):
            import json
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except ValueError:
                pass
        return [part.strip() for part in stripped.split(",") if part.strip()]

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
