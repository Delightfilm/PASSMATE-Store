from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from pypdf import PdfReader, PdfWriter

from passmate_worker.errors import WorkerError
from passmate_worker.models import IssuanceJob
from passmate_worker.transformer import PypdfRewriteTransformer


def job() -> IssuanceJob:
    return IssuanceJob(
        schema_version=1,
        job_id="job-001",
        lease_token="lease-001",
        attempt=1,
        generation=1,
        order_id="order-001",
        order_item_id="item-001",
        product_code="PM-C2",
        product_version="2027-v1.0",
        edition_year=2027,
        artifact_code="bundle",
    )


class TransformerTests(unittest.TestCase):
    def test_rewrite_preserves_page_count_and_sets_generic_producer(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "master.pdf"
            output = root / "issued.pdf"

            writer = PdfWriter()
            writer.add_blank_page(width=595, height=842)
            writer.add_blank_page(width=595, height=842)
            writer.write(source)

            transformer = PypdfRewriteTransformer()
            transformer.transform(
                source=source,
                destination=output,
                job=job(),
            )

            self.assertNotEqual(source.read_bytes(), output.read_bytes())
            result = PdfReader(output, strict=True)
            self.assertEqual(len(result.pages), 2)
            self.assertEqual(
                str(result.metadata.get("/Producer")),
                "PASSMATE PDF Processor",
            )

    def test_invalid_pdf_is_non_retryable(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "broken.pdf"
            output = root / "issued.pdf"
            source.write_bytes(b"not-a-pdf")

            with self.assertRaises(WorkerError) as ctx:
                PypdfRewriteTransformer().transform(
                    source=source,
                    destination=output,
                    job=job(),
                )

            self.assertEqual(ctx.exception.code, "PDF_PROCESS_FAILED")
            self.assertFalse(ctx.exception.retryable)


if __name__ == "__main__":
    unittest.main()
