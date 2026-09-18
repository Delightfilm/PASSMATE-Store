from __future__ import annotations

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from passmate_worker.errors import WorkerError
from passmate_worker.final_processor import PdfTransformer, ProductionPdfProcessor
from passmate_worker.models import ArtifactResult, IssuanceJob
from passmate_worker.storage import LocalArtifactStore
from passmate_worker.worker import PassmateWorker


def job(*, lease_token: str = "lease-1", attempt: int = 1) -> IssuanceJob:
    return IssuanceJob(
        schema_version=1,
        job_id="job-1",
        lease_token=lease_token,
        attempt=attempt,
        generation=1,
        order_id="order-1",
        order_item_id="item-1",
        product_code="PM-C2",
        product_version="2027-v1.0",
        edition_year=2027,
        artifact_code="bundle",
    )


class FakeClient:
    def __init__(
        self,
        *,
        complete_ok: bool = True,
        claimed_job: IssuanceJob | None = None,
    ) -> None:
        self.claimed = False
        self.complete_ok = complete_ok
        self.claimed_job = claimed_job or job()
        self.completed = []
        self.failed = []
        self.reaped = 0

    def reap_expired(self):
        self.reaped += 1
        return 0

    def claim(self, worker_id, lease_seconds):
        if self.claimed:
            return None
        self.claimed = True
        return self.claimed_job

    def renew(self, job, worker_id, lease_seconds):
        return True

    def complete(self, job, storage_key, sha256, size_bytes):
        self.completed.append((job.job_id, storage_key))
        return self.complete_ok

    def fail(self, job, *, code, detail, retryable):
        self.failed.append((code, retryable))
        return "retry_wait"


class FakeProcessor:
    def __init__(self) -> None:
        self.discarded = []

    def process(self, job):
        return ArtifactResult(
            storage_key="issued/output.pdf",
            sha256="a" * 64,
            size_bytes=100,
            local_path="/tmp/output.pdf",
        )

    def discard(self, result):
        self.discarded.append(result.storage_key)


class FailingProcessor(FakeProcessor):
    def process(self, job):
        raise WorkerError(
            "MASTER_NOT_FOUND",
            "missing master",
            retryable=False,
        )


class MarkerTransformer(PdfTransformer):
    def transform(self, *, source: Path, destination: Path, job: IssuanceJob) -> None:
        destination.write_bytes(source.read_bytes() + b"\n% PASSMATE issued\n")


class WorkerTests(unittest.TestCase):
    def build(self, client, processor):
        return PassmateWorker(
            client=client,
            processor=processor,
            worker_id="nas-test",
            poll_seconds=1,
            lease_seconds=300,
            heartbeat_seconds=60,
            sleep_fn=lambda _: None,
        )

    def test_success_completes_once(self) -> None:
        client = FakeClient()
        processor = FakeProcessor()
        worker = self.build(client, processor)

        self.assertTrue(worker.run_once())
        self.assertEqual(len(client.completed), 1)
        self.assertEqual(processor.discarded, [])

    def test_rejected_completion_leaves_published_output_untouched(self) -> None:
        client = FakeClient(complete_ok=False)
        processor = FakeProcessor()
        worker = self.build(client, processor)

        self.assertTrue(worker.run_once())
        self.assertEqual(processor.discarded, [])

    def test_stale_worker_cannot_delete_successor_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            master_root = root / "master"
            work_root = root / "work"
            store_root = root / "store"
            version_dir = master_root / "PM-C2" / "2027-v1.0"
            version_dir.mkdir(parents=True)

            master = version_dir / "master.pdf"
            master.write_bytes(b"%PDF-1.4\nPASSMATE MASTER\n%%EOF\n")
            (version_dir / "manifest.json").write_text(
                json.dumps(
                    {
                        "schema_version": 1,
                        "product_code": "PM-C2",
                        "product_version": "2027-v1.0",
                        "edition_year": 2027,
                        "master_file": "master.pdf",
                        "master_sha256": hashlib.sha256(
                            master.read_bytes()
                        ).hexdigest(),
                    }
                ),
                encoding="utf-8",
            )

            production_processor = ProductionPdfProcessor(
                master_root=master_root,
                work_root=work_root,
                store=LocalArtifactStore(store_root),
                transformer=MarkerTransformer(),
            )
            successor_client = FakeClient(
                claimed_job=job(lease_token="lease-2", attempt=2)
            )
            successor_worker = self.build(
                successor_client,
                production_processor,
            )
            state = {"successor_completed": False}

            class CoordinatedHeartbeat:
                def __init__(self, _client, claimed_job, *_args, **_kwargs):
                    self.job = claimed_job

                @property
                def lost(self):
                    return (
                        self.job.attempt == 1
                        and state["successor_completed"]
                    )

                def start(self):
                    pass

                def stop(self):
                    pass

            class SupersededProcessor:
                def process(self, claimed_job):
                    result = production_processor.process(claimed_job)
                    self_test.assertTrue(successor_worker.run_once())
                    state["successor_completed"] = True
                    return result

                def discard(self, result):
                    production_processor.discard(result)

            self_test = self
            stale_client = FakeClient()
            stale_worker = self.build(stale_client, SupersededProcessor())

            with patch(
                "passmate_worker.worker.LeaseHeartbeat",
                CoordinatedHeartbeat,
            ):
                self.assertTrue(stale_worker.run_once())

            self.assertEqual(stale_client.completed, [])
            self.assertEqual(len(successor_client.completed), 1)
            storage_key = successor_client.completed[0][1]
            self.assertTrue((store_root / storage_key).is_file())

    def test_empty_queue_returns_false(self) -> None:
        client = FakeClient()
        client.claimed = True
        processor = FakeProcessor()
        worker = self.build(client, processor)

        self.assertFalse(worker.run_once())
        self.assertEqual(len(client.completed), 0)

    def test_typed_processor_error_is_reported(self) -> None:
        client = FakeClient()
        processor = FailingProcessor()
        worker = self.build(client, processor)

        self.assertTrue(worker.run_once())
        self.assertEqual(
            client.failed,
            [("MASTER_NOT_FOUND", False)],
        )
        self.assertEqual(client.completed, [])


if __name__ == "__main__":
    unittest.main()
