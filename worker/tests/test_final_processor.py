from __future__ import annotations

import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from passmate_worker.errors import WorkerError
from passmate_worker.final_processor import PdfTransformer, ProductionPdfProcessor
from passmate_worker.models import IssuanceJob
from passmate_worker.storage import LocalArtifactStore, validate_storage_key


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


class MarkerTransformer(PdfTransformer):
    def transform(self, *, source: Path, destination: Path, job: IssuanceJob) -> None:
        destination.write_bytes(source.read_bytes() + b"\n% PASSMATE issued\n")


class CopyTransformer(PdfTransformer):
    def transform(self, *, source: Path, destination: Path, job: IssuanceJob) -> None:
        destination.write_bytes(source.read_bytes())


class FinalProcessorTests(unittest.TestCase):
    def make_fixture(self, root: Path) -> tuple[Path, Path, Path]:
        master_root = root / "master"
        work_root = root / "work"
        store_root = root / "store"
        version_dir = master_root / "PM-C2" / "2027-v1.0"
        version_dir.mkdir(parents=True)

        master = version_dir / "master.pdf"
        master.write_bytes(b"%PDF-1.4\nPASSMATE MASTER\n%%EOF\n")
        digest = hashlib.sha256(master.read_bytes()).hexdigest()

        (version_dir / "manifest.json").write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "product_code": "PM-C2",
                    "product_version": "2027-v1.0",
                    "edition_year": 2027,
                    "master_file": "master.pdf",
                    "master_sha256": digest,
                }
            ),
            encoding="utf-8",
        )
        return master_root, work_root, store_root

    def test_valid_output_is_stored(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            master_root, work_root, store_root = self.make_fixture(Path(temp))
            processor = ProductionPdfProcessor(
                master_root=master_root,
                work_root=work_root,
                store=LocalArtifactStore(store_root),
                transformer=MarkerTransformer(),
            )
            result = processor.process(job())
            self.assertTrue((store_root / result.storage_key).is_file())
            self.assertEqual(len(result.sha256), 64)
            self.assertGreater(result.size_bytes, 0)

    def test_discard_does_not_delete_published_output(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            master_root, work_root, store_root = self.make_fixture(Path(temp))
            processor = ProductionPdfProcessor(
                master_root=master_root,
                work_root=work_root,
                store=LocalArtifactStore(store_root),
                transformer=MarkerTransformer(),
            )
            result = processor.process(job())

            processor.discard(result)

            self.assertTrue((store_root / result.storage_key).is_file())

    def test_identical_master_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            master_root, work_root, store_root = self.make_fixture(Path(temp))
            processor = ProductionPdfProcessor(
                master_root=master_root,
                work_root=work_root,
                store=LocalArtifactStore(store_root),
                transformer=CopyTransformer(),
            )
            with self.assertRaises(WorkerError) as ctx:
                processor.process(job())
            self.assertEqual(ctx.exception.code, "PDF_PROCESS_FAILED")

    def test_manifest_hash_mismatch_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            master_root, work_root, store_root = self.make_fixture(Path(temp))
            master = master_root / "PM-C2" / "2027-v1.0" / "master.pdf"
            master.write_bytes(master.read_bytes() + b"tampered")
            processor = ProductionPdfProcessor(
                master_root=master_root,
                work_root=work_root,
                store=LocalArtifactStore(store_root),
                transformer=MarkerTransformer(),
            )
            with self.assertRaises(WorkerError) as ctx:
                processor.process(job())
            self.assertEqual(ctx.exception.code, "MASTER_VERSION_MISMATCH")

    def test_unsafe_storage_keys_are_rejected(self) -> None:
        with self.assertRaises(WorkerError):
            validate_storage_key("../escape.pdf")
        with self.assertRaises(WorkerError):
            validate_storage_key("/absolute.pdf")


if __name__ == "__main__":
    unittest.main()
