from __future__ import annotations

import logging
import time
import uuid

from .errors import WorkerError
from .heartbeat import LeaseHeartbeat
from .models import IssuanceJob


logger = logging.getLogger("passmate.worker")


class PassmateWorker:
    def __init__(
        self,
        *,
        client,
        processor,
        worker_id: str,
        poll_seconds: int,
        lease_seconds: int,
        heartbeat_seconds: int,
        mode: str = "reference",
        version: str = "unknown",
        instance_id: str | None = None,
        sleep_fn=time.sleep,
    ) -> None:
        self.client = client
        self.processor = processor
        self.worker_id = worker_id
        self.poll_seconds = poll_seconds
        self.lease_seconds = lease_seconds
        self.heartbeat_seconds = heartbeat_seconds
        self.mode = mode
        self.version = version
        self.instance_id = instance_id or str(uuid.uuid4())
        self.sleep_fn = sleep_fn

    def _report_worker(self, current_job_id: str | None = None) -> None:
        report = getattr(self.client, "report_worker_node", None)
        if report is None:
            return

        try:
            report(
                worker_id=self.worker_id,
                instance_id=self.instance_id,
                mode=self.mode,
                version=self.version,
                current_job_id=current_job_id,
            )
        except Exception:
            logger.warning(
                "worker heartbeat report failed id=%s",
                self.worker_id,
                exc_info=True,
            )

    def _claim(self) -> IssuanceJob | None:
        return self.client.claim(
            self.worker_id,
            self.lease_seconds,
        )

    def run_once(self) -> bool:
        self._report_worker()

        try:
            self.client.reap_expired()
            job = self._claim()
        except Exception:
            logger.exception("queue poll failed")
            return False

        if job is None:
            return False

        self._report_worker(job.job_id)

        logger.info(
            "claimed job=%s product=%s version=%s attempt=%s generation=%s",
            job.job_id,
            job.product_code,
            job.product_version,
            job.attempt,
            job.generation,
        )

        heartbeat = LeaseHeartbeat(
            self.client,
            job,
            self.worker_id,
            self.lease_seconds,
            self.heartbeat_seconds,
            on_renew=lambda: self._report_worker(job.job_id),
        )
        heartbeat.start()
        try:
            result = self.processor.process(job)

            if heartbeat.lost:
                logger.warning(
                    "lease lost before completion job=%s; "
                    "leaving published output untouched",
                    job.job_id,
                )
                return True

            completed = self.client.complete(
                job,
                result.storage_key,
                result.sha256,
                result.size_bytes,
            )

            if not completed:
                logger.warning(
                    "completion rejected job=%s; "
                    "leaving published output untouched",
                    job.job_id,
                )
                return True

            logger.info(
                "completed job=%s storage_key=%s sha256=%s",
                job.job_id,
                result.storage_key,
                result.sha256,
            )
            return True

        except WorkerError as exc:
            if heartbeat.lost:
                logger.warning(
                    "lease lost while handling job=%s error=%s",
                    job.job_id,
                    exc.code,
                )
                return True

            try:
                outcome = self.client.fail(
                    job,
                    code=exc.code,
                    detail=exc.detail,
                    retryable=exc.retryable,
                )
                logger.warning(
                    "job failed job=%s code=%s outcome=%s",
                    job.job_id,
                    exc.code,
                    outcome,
                )
            except Exception:
                logger.exception(
                    "could not report failure job=%s",
                    job.job_id,
                )
            return True

        except Exception as exc:
            logger.exception(
                "unexpected processing error job=%s",
                job.job_id,
            )
            if not heartbeat.lost:
                try:
                    self.client.fail(
                        job,
                        code="PDF_PROCESS_FAILED",
                        detail=f"unexpected worker error: {exc}",
                        retryable=True,
                    )
                except Exception:
                    logger.exception(
                        "could not report unexpected failure job=%s",
                        job.job_id,
                    )
            return True

        finally:
            heartbeat.stop()
            self._report_worker()

    def run_forever(self) -> None:
        logger.info(
            "worker started id=%s mode=%s version=%s poll=%ss lease=%ss heartbeat=%ss",
            self.worker_id,
            self.mode,
            self.version,
            self.poll_seconds,
            self.lease_seconds,
            self.heartbeat_seconds,
        )

        while True:
            handled = self.run_once()
            if not handled:
                self.sleep_fn(self.poll_seconds)
