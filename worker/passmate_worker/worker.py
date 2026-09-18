from __future__ import annotations

import logging
import time

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
        sleep_fn=time.sleep,
    ) -> None:
        self.client = client
        self.processor = processor
        self.worker_id = worker_id
        self.poll_seconds = poll_seconds
        self.lease_seconds = lease_seconds
        self.heartbeat_seconds = heartbeat_seconds
        self.sleep_fn = sleep_fn

    def _claim(self) -> IssuanceJob | None:
        return self.client.claim(
            self.worker_id,
            self.lease_seconds,
        )

    def run_once(self) -> bool:
        try:
            self.client.reap_expired()
            job = self._claim()
        except Exception:
            logger.exception("queue poll failed")
            return False

        if job is None:
            return False

        logger.info(
            "claimed job=%s product=%s version=%s attempt=%s",
            job.job_id,
            job.product_code,
            job.product_version,
            job.attempt,
        )

        heartbeat = LeaseHeartbeat(
            self.client,
            job,
            self.worker_id,
            self.lease_seconds,
            self.heartbeat_seconds,
        )
        heartbeat.start()
        result = None

        try:
            result = self.processor.process(job)

            if heartbeat.lost:
                logger.warning(
                    "lease lost before completion job=%s; discarding output",
                    job.job_id,
                )
                self.processor.discard(result)
                return True

            completed = self.client.complete(
                job,
                result.storage_key,
                result.sha256,
                result.size_bytes,
            )

            if not completed:
                logger.warning(
                    "completion rejected job=%s; discarding output",
                    job.job_id,
                )
                self.processor.discard(result)
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

    def run_forever(self) -> None:
        logger.info(
            "worker started id=%s poll=%ss lease=%ss heartbeat=%ss",
            self.worker_id,
            self.poll_seconds,
            self.lease_seconds,
            self.heartbeat_seconds,
        )

        while True:
            handled = self.run_once()
            if not handled:
                self.sleep_fn(self.poll_seconds)
