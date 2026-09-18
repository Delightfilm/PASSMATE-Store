from __future__ import annotations

import hashlib
from pathlib import Path
import re
import shutil
import tempfile

from .errors import WorkerError
from .models import ArtifactResult, IssuanceJob


_SAFE_SEGMENT = re.compile(r"^[A-Za-z0-9._-]+$")


def _safe_segment(value: str, label: str) -> str:
    if not _SAFE_SEGMENT.fullmatch(value):
        raise WorkerError(
            "INVALID_JOB",
            f"{label} contains unsupported characters",
            retryable=False,
        )
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as exc:
        raise WorkerError(
            "HASH_FAILED",
            f"could not hash output: {exc}",
            retryable=True,
        ) from exc
    return digest.hexdigest()


class ReferenceCopyProcessor:
    """
    Integration-test processor.

    This intentionally does NOT implement customer watermarking or final
    production storage. It copies a versioned MASTER PDF into the configured
    output tree so the queue/lease lifecycle can be tested end-to-end.

    It is disabled unless PASSMATE_ALLOW_REFERENCE_COPY=true.
    """

    def __init__(
        self,
        master_root: Path,
        work_root: Path,
        output_root: Path,
        *,
        enabled: bool,
    ) -> None:
        self.master_root = master_root.resolve()
        self.work_root = work_root.resolve()
        self.output_root = output_root.resolve()
        self.enabled = enabled

    def _master_path(self, job: IssuanceJob) -> Path:
        code = _safe_segment(job.product_code, "product_code")
        version = _safe_segment(job.product_version, "product_version")
        candidate = (
            self.master_root / code / version / "master.pdf"
        ).resolve()

        if self.master_root not in candidate.parents:
            raise WorkerError(
                "INVALID_JOB",
                "resolved MASTER path escaped master root",
                retryable=False,
            )
        return candidate

    def process(self, job: IssuanceJob) -> ArtifactResult:
        if not self.enabled:
            raise WorkerError(
                "PDF_PROCESS_FAILED",
                "reference processor is disabled; set "
                "PASSMATE_ALLOW_REFERENCE_COPY=true only for integration tests",
                retryable=False,
            )

        if job.artifact_code != "bundle":
            raise WorkerError(
                "INVALID_JOB",
                f"unsupported artifact_code: {job.artifact_code}",
                retryable=False,
            )

        master = self._master_path(job)
        if not master.is_file():
            raise WorkerError(
                "MASTER_NOT_FOUND",
                f"MASTER PDF not found for "
                f"{job.product_code}/{job.product_version}",
                retryable=False,
            )

        self.work_root.mkdir(parents=True, exist_ok=True)
        self.output_root.mkdir(parents=True, exist_ok=True)

        output_dir = (
            self.output_root
            / _safe_segment(job.product_code, "product_code")
            / _safe_segment(job.product_version, "product_version")
            / _safe_segment(job.order_id, "order_id")
        )
        output_dir.mkdir(parents=True, exist_ok=True)
        final_path = output_dir / f"{job.job_id}.pdf"

        try:
            with tempfile.NamedTemporaryFile(
                prefix=f"{job.job_id}.",
                suffix=".tmp",
                dir=self.work_root,
                delete=False,
            ) as temp:
                temp_path = Path(temp.name)

            shutil.copyfile(master, temp_path)
            temp_path.replace(final_path)
        except OSError as exc:
            raise WorkerError(
                "PDF_PROCESS_FAILED",
                f"reference copy failed: {exc}",
                retryable=True,
            ) from exc
        finally:
            if "temp_path" in locals() and temp_path.exists():
                temp_path.unlink(missing_ok=True)

        digest = sha256_file(final_path)
        try:
            size_bytes = final_path.stat().st_size
        except OSError as exc:
            raise WorkerError(
                "PDF_PROCESS_FAILED",
                f"could not stat output: {exc}",
                retryable=True,
            ) from exc

        storage_key = final_path.relative_to(
            self.output_root
        ).as_posix()

        return ArtifactResult(
            storage_key=storage_key,
            sha256=digest,
            size_bytes=size_bytes,
            local_path=str(final_path),
        )

    def discard(self, result: ArtifactResult) -> None:
        try:
            Path(result.local_path).unlink(missing_ok=True)
        except OSError:
            pass
