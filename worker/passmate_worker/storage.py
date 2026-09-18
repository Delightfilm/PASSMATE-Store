from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile
from urllib import error, parse, request

from .errors import WorkerError
from .processor import sha256_file

_SAFE_KEY = re.compile(r"^[A-Za-z0-9._/-]+$")


@dataclass(frozen=True)
class StoredArtifact:
    storage_key: str
    sha256: str
    size_bytes: int


def validate_storage_key(key: str) -> str:
    if not key or key.startswith("/") or "\\" in key:
        raise WorkerError(
            "STORAGE_UPLOAD_FAILED",
            "invalid storage key",
            retryable=False,
        )

    path = Path(key)
    if ".." in path.parts or not _SAFE_KEY.fullmatch(key):
        raise WorkerError(
            "STORAGE_UPLOAD_FAILED",
            "unsafe storage key",
            retryable=False,
        )
    return key


class ArtifactStore(ABC):
    @abstractmethod
    def put(self, source: Path, storage_key: str) -> StoredArtifact:
        raise NotImplementedError

    @abstractmethod
    def delete(self, storage_key: str) -> None:
        raise NotImplementedError


class LocalArtifactStore(ArtifactStore):
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _target(self, storage_key: str) -> Path:
        key = validate_storage_key(storage_key)
        target = (self.root / key).resolve()
        if self.root not in target.parents:
            raise WorkerError(
                "STORAGE_UPLOAD_FAILED",
                "resolved storage path escaped root",
                retryable=False,
            )
        return target

    def put(self, source: Path, storage_key: str) -> StoredArtifact:
        target = self._target(storage_key)
        target.parent.mkdir(parents=True, exist_ok=True)

        try:
            with tempfile.NamedTemporaryFile(
                prefix=f"{target.name}.",
                suffix=".tmp",
                dir=target.parent,
                delete=False,
            ) as temp:
                temp_path = Path(temp.name)

            shutil.copyfile(source, temp_path)
            temp_path.replace(target)
            digest = sha256_file(target)
            size = target.stat().st_size
        except OSError as exc:
            raise WorkerError(
                "STORAGE_UPLOAD_FAILED",
                f"local artifact store failed: {exc}",
                retryable=True,
            ) from exc
        finally:
            if "temp_path" in locals() and temp_path.exists():
                temp_path.unlink(missing_ok=True)

        return StoredArtifact(
            storage_key=storage_key,
            sha256=digest,
            size_bytes=size,
        )

    def delete(self, storage_key: str) -> None:
        try:
            self._target(storage_key).unlink(missing_ok=True)
        except OSError:
            pass


class SupabaseArtifactStore(ArtifactStore):
    """Private Supabase Storage adapter using a backend server credential.

    Standard upload is used with immutable object keys. If a retry finds an
    existing object, its bytes are fetched and verified before treating the
    operation as idempotently successful.
    """

    def __init__(
        self,
        base_url: str,
        server_key: str,
        *,
        bucket: str = "passmate-artifacts",
        timeout_seconds: int = 60,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.server_key = server_key
        self.bucket = bucket
        self.timeout_seconds = timeout_seconds

    def _headers(self, **extra: str) -> dict[str, str]:
        headers = {
            "apikey": self.server_key,
            "User-Agent": "passmate-nas-worker/0.4",
        }
        if not self.server_key.startswith("sb_secret_"):
            headers["Authorization"] = f"Bearer {self.server_key}"
        headers.update(extra)
        return headers

    def _object_url(self, storage_key: str, *, authenticated: bool = False) -> str:
        key = validate_storage_key(storage_key)
        bucket = parse.quote(self.bucket, safe="")
        encoded_key = parse.quote(key, safe="/")
        segment = "object/authenticated" if authenticated else "object"
        return f"{self.base_url}/storage/v1/{segment}/{bucket}/{encoded_key}"

    def _read_existing(self, storage_key: str) -> bytes:
        req = request.Request(
            self._object_url(storage_key, authenticated=True),
            method="GET",
            headers=self._headers(Accept="application/pdf"),
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                return response.read()
        except (error.HTTPError, error.URLError) as exc:
            raise WorkerError(
                "STORAGE_UPLOAD_FAILED",
                f"existing artifact verification failed: {exc}",
                retryable=True,
            ) from exc

    def put(self, source: Path, storage_key: str) -> StoredArtifact:
        key = validate_storage_key(storage_key)
        if not source.is_file() or source.stat().st_size <= 0:
            raise WorkerError(
                "STORAGE_UPLOAD_FAILED",
                "artifact source is missing or empty",
                retryable=False,
            )

        payload = source.read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        size = len(payload)

        req = request.Request(
            self._object_url(key),
            data=payload,
            method="POST",
            headers=self._headers(
                **{
                    "Content-Type": "application/pdf",
                    "x-upsert": "false",
                    "cache-control": "private, max-age=0",
                }
            ),
        )

        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                response.read()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            if exc.code in {400, 409} and "exist" in detail.lower():
                existing = self._read_existing(key)
                if (
                    len(existing) == size
                    and hashlib.sha256(existing).hexdigest() == digest
                ):
                    return StoredArtifact(
                        storage_key=key,
                        sha256=digest,
                        size_bytes=size,
                    )
                raise WorkerError(
                    "STORAGE_UPLOAD_FAILED",
                    "existing artifact differs from retry output",
                    retryable=False,
                ) from exc

            raise WorkerError(
                "STORAGE_UPLOAD_FAILED",
                f"storage upload failed: HTTP {exc.code}: {detail[:500]}",
                retryable=500 <= exc.code < 600,
            ) from exc
        except error.URLError as exc:
            raise WorkerError(
                "STORAGE_UPLOAD_FAILED",
                f"storage upload network error: {exc.reason}",
                retryable=True,
            ) from exc

        return StoredArtifact(
            storage_key=key,
            sha256=digest,
            size_bytes=size,
        )

    def delete(self, storage_key: str) -> None:
        key = validate_storage_key(storage_key)
        bucket = parse.quote(self.bucket, safe="")
        body = json.dumps({"prefixes": [key]}).encode("utf-8")
        req = request.Request(
            f"{self.base_url}/storage/v1/object/{bucket}",
            data=body,
            method="DELETE",
            headers=self._headers(
                **{
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }
            ),
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                response.read()
        except (error.HTTPError, error.URLError):
            # discard() is best-effort; the DB lease remains the source of truth.
            pass
