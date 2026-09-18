from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from passmate_worker.errors import WorkerError
from passmate_worker.models import IssuanceJob
from passmate_worker.processor import ReferenceCopyProcessor, sha256_file


def make_job(**overrides) -> IssuanceJob:
    values = {
        "schema_version": 1,
        "job_id": "job-1",
        "lease_token": "lease-1",
        "attempt": 1,
        "generation": 1,
        "order_id": "order-1",
        "order_item_id": "item-1",
        "product_code": "PM-C2",
        "product_version": "2027-v1.0",
        "edition_year": 2027,
        "artifact_code": "bundle",
    }
    values.update(overrides)
    return IssuanceJob(**values)


class ProcessorTests(unittest.TestCase):
    def test_reference_copy_hashes_and_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            master_root = root / "master"
            work_root = root / "work"
            output_root = root / "output"
            master = master_root / "PM-C2" / "2027-v1.0" / "master.pdf"
            master.parent.mkdir(parents=True)
            master.write_bytes(b"%PDF-1.7\nPASSMATE TEST\n")

            processor = ReferenceCopyProcessor(
                master_root,
                work_root,
                output_root,
                enabled=True,
            )
            result = processor.process(make_job())

            output = Path(result.local_path)
            self.assertTrue(output.is_file())
            self.assertEqual(result.sha256, sha256_file(output))
            self.assertEqual(result.size_bytes, output.stat().st_size)
            self.assertNotIn(str(master_root), result.storage_key)

    def test_missing_master_is_non_retryable(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            master_root = root / "master"
            master_root.mkdir()
            processor = ReferenceCopyProcessor(
                master_root,
                root / "work",
                root / "output",
                enabled=True,
            )

            with self.assertRaises(WorkerError) as ctx:
                processor.process(make_job())

            self.assertEqual(ctx.exception.code, "MASTER_NOT_FOUND")
            self.assertFalse(ctx.exception.retryable)

    def test_reference_processor_disabled_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            master_root = root / "master"
            master_root.mkdir()
            processor = ReferenceCopyProcessor(
                master_root,
                root / "work",
                root / "output",
                enabled=False,
            )

            with self.assertRaises(WorkerError) as ctx:
                processor.process(make_job())

            self.assertEqual(ctx.exception.code, "PDF_PROCESS_FAILED")
            self.assertFalse(ctx.exception.retryable)

    def test_path_traversal_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            master_root = root / "master"
            master_root.mkdir()
            processor = ReferenceCopyProcessor(
                master_root,
                root / "work",
                root / "output",
                enabled=True,
            )

            with self.assertRaises(WorkerError) as ctx:
                processor.process(
                    make_job(product_version="../../escape")
                )

            self.assertEqual(ctx.exception.code, "INVALID_JOB")


if __name__ == "__main__":
    unittest.main()
