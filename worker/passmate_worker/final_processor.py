from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
import tempfile

from .errors import WorkerError
from .manifest import MasterManifest
from .models import ArtifactResult, IssuanceJob
from .processor import _safe_segment, sha256_file
from .storage import ArtifactStore


class PdfTransformer(ABC):
    @abstractmethod
    def transform(
        self,
        *,
        source: Path,
        destination: Path,
        job: IssuanceJob,
    ) -> None:
        raise NotImplementedError


class ProductionPdfProcessor:
    def __init__(
        self,
        *,
        master_root: Path,
        work_root: Path,
        store: ArtifactStore,
        transformer: PdfTransformer,
        require_output_differs_from_master: bool = True,
    ) -> None:
        self.master_root = master_root.resolve()
        self.work_root = work_root.resolve()
        self.store = store
        self.transformer = transformer
        self.require_output_differs_from_master = require_output_differs_from_master

    def _version_directory(self, job: IssuanceJob) -> Path:
        code = _safe_segment(job.product_code, "product_code")
        version = _safe_segment(job.product_version, "product_version")
        directory = (self.master_root / code / version).resolve()
        if self.master_root not in directory.parents:
            raise WorkerError(
                "INVALID_JOB",
                "resolved MASTER version path escaped root",
                retryable=False,
            )
        return directory

    def _storage_key(self, job: IssuanceJob) -> str:
        code = _safe_segment(job.product_code, "product_code")
        version = _safe_segment(job.product_version, "product_version")
        return (
            f"issued/{code}/{version}/"
            f"{job.order_id}/{job.job_id}-g{job.generation}.pdf"
        )

    def process(self, job: IssuanceJob) -> ArtifactResult:
        if job.artifact_code != "bundle":
            raise WorkerError(
                "INVALID_JOB",
                f"unsupported artifact_code: {job.artifact_code}",
                retryable=False,
            )

        version_dir = self._version_directory(job)
        manifest = MasterManifest.load(version_dir)
        master = manifest.validate_for_job(
            product_code=job.product_code,
            product_version=job.product_version,
            edition_year=job.edition_year,
            directory=version_dir,
        )

        self.work_root.mkdir(parents=True, exist_ok=True)

        with tempfile.TemporaryDirectory(
            prefix=f"{job.job_id}.",
            dir=self.work_root,
        ) as temp_dir:
            output = Path(temp_dir) / "output.pdf"

            try:
                self.transformer.transform(
                    source=master,
                    destination=output,
                    job=job,
                )
            except WorkerError:
                raise
            except Exception as exc:
                raise WorkerError(
                    "PDF_PROCESS_FAILED",
                    f"transformer failed: {exc}",
                    retryable=True,
                ) from exc

            if not output.is_file() or output.stat().st_size <= 0:
                raise WorkerError(
                    "PDF_PROCESS_FAILED",
                    "transformer did not create a non-empty PDF",
                    retryable=True,
                )

            master_sha = sha256_file(master)
            output_sha = sha256_file(output)
            if (
                self.require_output_differs_from_master
                and output_sha == master_sha
            ):
                raise WorkerError(
                    "PDF_PROCESS_FAILED",
                    "issued output is byte-identical to MASTER",
                    retryable=False,
                )

            stored = self.store.put(output, self._storage_key(job))

        return ArtifactResult(
            storage_key=stored.storage_key,
            sha256=stored.sha256,
            size_bytes=stored.size_bytes,
            local_path="",
        )

    def discard(self, result: ArtifactResult) -> None:
        if result.storage_key:
            self.store.delete(result.storage_key)
