from __future__ import annotations

import threading
from typing import Callable

from .models import IssuanceJob


class LeaseHeartbeat:
    def __init__(
        self,
        client,
        job: IssuanceJob,
        worker_id: str,
        lease_seconds: int,
        heartbeat_seconds: int,
        on_renew: Callable[[], None] | None = None,
    ) -> None:
        self.client = client
        self.job = job
        self.worker_id = worker_id
        self.lease_seconds = lease_seconds
        self.heartbeat_seconds = heartbeat_seconds
        self.on_renew = on_renew
        self._stop = threading.Event()
        self._lost = threading.Event()
        self._thread: threading.Thread | None = None

    @property
    def lost(self) -> bool:
        return self._lost.is_set()

    def start(self) -> None:
        self._thread = threading.Thread(
            target=self._run,
            name=f"lease-heartbeat-{self.job.job_id}",
            daemon=True,
        )
        self._thread.start()

    def _run(self) -> None:
        while not self._stop.wait(self.heartbeat_seconds):
            try:
                renewed = self.client.renew(
                    self.job,
                    self.worker_id,
                    self.lease_seconds,
                )
            except Exception:
                self._lost.set()
                return

            if not renewed:
                self._lost.set()
                return

            if self.on_renew is not None:
                try:
                    self.on_renew()
                except Exception:
                    pass

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2)
