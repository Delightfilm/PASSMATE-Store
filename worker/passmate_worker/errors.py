from __future__ import annotations


class WorkerError(Exception):
    def __init__(
        self,
        code: str,
        detail: str,
        *,
        retryable: bool,
    ) -> None:
        super().__init__(detail)
        self.code = code
        self.detail = detail
        self.retryable = retryable


class LeaseLost(WorkerError):
    def __init__(self, detail: str = "lease lost") -> None:
        super().__init__(
            "LEASE_LOST",
            detail,
            retryable=False,
        )
