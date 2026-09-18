from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re

from .errors import WorkerError
from .processor import sha256_file

_SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


@dataclass(frozen=True)
class MasterManifest:
    schema_version: int
    product_code: str
    product_version: str
    edition_year: int | None
    master_file: str
    master_sha256: str

    @classmethod
    def load(cls, directory: Path) -> "MasterManifest":
        path = directory / "manifest.json"
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise WorkerError(
                "MASTER_NOT_FOUND",
                f"MASTER manifest not found: {path}",
                retryable=False,
            ) from exc
        except (OSError, json.JSONDecodeError) as exc:
            raise WorkerError(
                "INVALID_JOB",
                f"invalid MASTER manifest: {exc}",
                retryable=False,
            ) from exc

        required = {
            "schema_version",
            "product_code",
            "product_version",
            "edition_year",
            "master_file",
            "master_sha256",
        }
        missing = sorted(required.difference(payload))
        if missing:
            raise WorkerError(
                "INVALID_JOB",
                f"MASTER manifest missing fields: {', '.join(missing)}",
                retryable=False,
            )

        if payload["schema_version"] != 1:
            raise WorkerError(
                "MASTER_VERSION_MISMATCH",
                f"unsupported MASTER manifest schema: {payload['schema_version']}",
                retryable=False,
            )

        digest = str(payload["master_sha256"])
        if not _SHA256_RE.fullmatch(digest):
            raise WorkerError(
                "INVALID_JOB",
                "MASTER manifest has invalid sha256",
                retryable=False,
            )

        master_file = str(payload["master_file"])
        if Path(master_file).name != master_file:
            raise WorkerError(
                "INVALID_JOB",
                "MASTER manifest master_file must be a file name only",
                retryable=False,
            )

        edition_year = payload.get("edition_year")
        return cls(
            schema_version=1,
            product_code=str(payload["product_code"]),
            product_version=str(payload["product_version"]),
            edition_year=int(edition_year) if edition_year is not None else None,
            master_file=master_file,
            master_sha256=digest,
        )

    def validate_for_job(
        self,
        *,
        product_code: str,
        product_version: str,
        edition_year: int | None,
        directory: Path,
    ) -> Path:
        if self.product_code != product_code:
            raise WorkerError(
                "MASTER_VERSION_MISMATCH",
                "MASTER product_code does not match job",
                retryable=False,
            )

        if self.product_version != product_version:
            raise WorkerError(
                "MASTER_VERSION_MISMATCH",
                "MASTER product_version does not match job",
                retryable=False,
            )

        if (
            edition_year is not None
            and self.edition_year is not None
            and self.edition_year != edition_year
        ):
            raise WorkerError(
                "MASTER_VERSION_MISMATCH",
                "MASTER edition_year does not match job",
                retryable=False,
            )

        master_path = (directory / self.master_file).resolve()
        root = directory.resolve()
        if root not in master_path.parents:
            raise WorkerError(
                "INVALID_JOB",
                "MASTER file escaped version directory",
                retryable=False,
            )

        if not master_path.is_file():
            raise WorkerError(
                "MASTER_NOT_FOUND",
                f"MASTER file not found: {master_path.name}",
                retryable=False,
            )

        actual = sha256_file(master_path)
        if actual != self.master_sha256:
            raise WorkerError(
                "MASTER_VERSION_MISMATCH",
                "MASTER sha256 does not match manifest",
                retryable=False,
            )

        return master_path
