from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
import re
import shutil
import tempfile

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
