from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader, PdfWriter

from .errors import WorkerError
from .final_processor import PdfTransformer
from .models import IssuanceJob


class PypdfRewriteTransformer(PdfTransformer):
    """Production baseline transformer without buyer-specific identifiers."""

    PRODUCER = "PASSMATE PDF Processor"

    def transform(
        self,
        *,
        source: Path,
        destination: Path,
        job: IssuanceJob,
    ) -> None:
        try:
            reader = PdfReader(source, strict=True)
        except Exception as exc:
            raise WorkerError(
                "PDF_PROCESS_FAILED",
                f"MASTER PDF could not be parsed: {exc}",
                retryable=False,
            ) from exc

        if reader.is_encrypted:
            raise WorkerError(
                "PDF_PROCESS_FAILED",
                "encrypted MASTER PDFs are not supported",
                retryable=False,
            )

        page_count = len(reader.pages)
        if page_count <= 0:
            raise WorkerError(
                "PDF_PROCESS_FAILED",
                "MASTER PDF contains no pages",
                retryable=False,
            )

        try:
            writer = PdfWriter(clone_from=reader)
            metadata: dict[str, str] = {}

            if reader.metadata:
                for key, value in reader.metadata.items():
                    if (
                        isinstance(key, str)
                        and key.startswith("/")
                        and value is not None
                    ):
                        metadata[key] = str(value)

            metadata["/Producer"] = self.PRODUCER
            writer.add_metadata(metadata)

            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open("wb") as target:
                writer.write(target)
        except WorkerError:
            raise
        except Exception as exc:
            raise WorkerError(
                "PDF_PROCESS_FAILED",
                f"PDF rewrite failed: {exc}",
                retryable=True,
            ) from exc

        try:
            verification = PdfReader(destination, strict=True)
            output_pages = len(verification.pages)
        except Exception as exc:
            raise WorkerError(
                "PDF_PROCESS_FAILED",
                f"issued PDF verification failed: {exc}",
                retryable=True,
            ) from exc

        if output_pages != page_count:
            raise WorkerError(
                "PDF_PROCESS_FAILED",
                "issued PDF page count differs from MASTER",
                retryable=False,
            )
