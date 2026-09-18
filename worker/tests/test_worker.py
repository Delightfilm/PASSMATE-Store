from __future__ import annotations

import unittest

from passmate_worker.models import ArtifactResult, IssuanceJob
from passmate_worker.worker import PassmateWorker


def job() -> IssuanceJob:
    return IssuanceJob(
        schema_version=1,
        job_id="job-1",
        lease_token="lease-1",
        attempt=1,
        generation=1,
        order_id="order-1",
        order_item_id="item-1",
        product_code="PM-C2",
        product_version="2027-v1.0",
        edition_year=2027,
        artifact_code="bundle",
    )


class FakeClient:
    def __init__(self, *, complete_ok: bool = True) -> None:
        self.claimed = False
        self.complete_ok = complete_ok
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
        return job()

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

    def test_rejected_completion_discards_output(self) -> None:
        client = FakeClient(complete_ok=False)
        processor = FakeProcessor()
        worker = self.build(client, processor)

        self.assertTrue(worker.run_once())
        self.assertEqual(
            processor.discarded,
            ["issued/output.pdf"],
        )

    def test_empty_queue_returns_false(self) -> None:
        client = FakeClient()
        client.claimed = True
        processor = FakeProcessor()
        worker = self.build(client, processor)

        self.assertFalse(worker.run_once())
        self.assertEqual(len(client.completed), 0)


if __name__ == "__main__":
    unittest.main()
