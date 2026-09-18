from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import re
import socket


class ConfigError(ValueError):
    pass


_WORKER_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{3,128}$")
_BUCKET_RE = re.compile(r"^[A-Za-z0-9._-]{3,63}$")
_PROCESSOR_MODES = {"disabled", "reference", "production"}


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ConfigError(f"{name} is required")
    return value


def _server_key() -> tuple[str, bool]:
    secret_key = os.getenv("SUPABASE_SECRET_KEY", "").strip()
    if secret_key:
        if not secret_key.startswith("sb_secret_"):
            raise ConfigError(
                "SUPABASE_SECRET_KEY must use the sb_secret_ key format"
            )
        return secret_key, False

    legacy_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if legacy_key:
        return legacy_key, True

    raise ConfigError(
        "SUPABASE_SECRET_KEY is required "
        "(legacy SUPABASE_SERVICE_ROLE_KEY is accepted only for migration/preflight)"
    )


def _positive_int(name: str, default: int, minimum: int = 1) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} must be an integer") from exc

    if value < minimum:
        raise ConfigError(f"{name} must be >= {minimum}")
    return value


def _bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    server_key: str
    worker_id: str
    master_root: Path
    work_root: Path
    output_root: Path
    processor_mode: str = "disabled"
    storage_bucket: str = "passmate-artifacts"
    poll_seconds: int = 10
    lease_seconds: int = 300
    heartbeat_seconds: int = 60
    request_timeout_seconds: int = 30
    allow_reference_copy: bool = False
    legacy_server_key: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        worker_id = os.getenv(
            "PASSMATE_WORKER_ID",
            f"nas-{socket.gethostname()}",
        ).strip()

        if not _WORKER_ID_RE.fullmatch(worker_id):
            raise ConfigError(
                "PASSMATE_WORKER_ID contains unsupported characters"
            )

        supabase_url = _required("SUPABASE_URL").rstrip("/")
        if not supabase_url.startswith("https://"):
            raise ConfigError("SUPABASE_URL must use https")

        processor_mode = os.getenv(
            "PASSMATE_PROCESSOR_MODE",
            "disabled",
        ).strip().lower()
        if processor_mode not in _PROCESSOR_MODES:
            raise ConfigError(
                "PASSMATE_PROCESSOR_MODE must be one of "
                "disabled, reference, production"
            )

        server_key, legacy_server_key = _server_key()

        if processor_mode == "production" and legacy_server_key:
            raise ConfigError(
                "production mode requires SUPABASE_SECRET_KEY; "
                "legacy SUPABASE_SERVICE_ROLE_KEY is not allowed"
            )

        storage_bucket = os.getenv(
            "PASSMATE_STORAGE_BUCKET",
            "passmate-artifacts",
        ).strip()
        if not _BUCKET_RE.fullmatch(storage_bucket):
            raise ConfigError(
                "PASSMATE_STORAGE_BUCKET contains unsupported characters"
            )

        lease_seconds = _positive_int(
            "PASSMATE_LEASE_SECONDS",
            300,
            minimum=60,
        )
        heartbeat_seconds = _positive_int(
            "PASSMATE_HEARTBEAT_SECONDS",
            60,
            minimum=10,
        )

        if heartbeat_seconds >= lease_seconds:
            raise ConfigError(
                "PASSMATE_HEARTBEAT_SECONDS must be smaller than lease seconds"
            )

        if lease_seconds > 1800:
            raise ConfigError("PASSMATE_LEASE_SECONDS must be <= 1800")

        allow_reference_copy = _bool(
            "PASSMATE_ALLOW_REFERENCE_COPY",
            False,
        )

        if processor_mode == "production" and allow_reference_copy:
            raise ConfigError(
                "PASSMATE_ALLOW_REFERENCE_COPY must be false in production mode"
            )

        return cls(
            supabase_url=supabase_url,
            server_key=server_key,
            worker_id=worker_id,
            master_root=Path(
                os.getenv("PASSMATE_MASTER_ROOT", "/data/master")
            ),
            work_root=Path(
                os.getenv("PASSMATE_WORK_ROOT", "/data/work")
            ),
            output_root=Path(
                os.getenv("PASSMATE_OUTPUT_ROOT", "/data/output")
            ),
            processor_mode=processor_mode,
            storage_bucket=storage_bucket,
            poll_seconds=_positive_int(
                "PASSMATE_POLL_SECONDS",
                10,
                minimum=1,
            ),
            lease_seconds=lease_seconds,
            heartbeat_seconds=heartbeat_seconds,
            request_timeout_seconds=_positive_int(
                "PASSMATE_REQUEST_TIMEOUT_SECONDS",
                30,
                minimum=5,
            ),
            allow_reference_copy=allow_reference_copy,
            legacy_server_key=legacy_server_key,
        )

    def validate_filesystem(self) -> None:
        if not self.master_root.exists():
            raise ConfigError(
                f"MASTER root does not exist: {self.master_root}"
            )

        if not self.master_root.is_dir():
            raise ConfigError(
                f"MASTER root is not a directory: {self.master_root}"
            )

        self.work_root.mkdir(parents=True, exist_ok=True)
        self.output_root.mkdir(parents=True, exist_ok=True)

    def validate_runtime_enabled(self) -> None:
        if self.processor_mode == "disabled":
            raise ConfigError(
                "PASSMATE_PROCESSOR_MODE=disabled; "
                "set production only after NAS preflight succeeds"
            )

        if self.processor_mode == "production" and self.legacy_server_key:
            raise ConfigError(
                "production mode requires SUPABASE_SECRET_KEY"
            )
