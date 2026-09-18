from __future__ import annotations

import json
from typing import Any
from urllib import error, request

from .models import IssuanceJob


class RpcError(RuntimeError):
    pass


class SupabaseRpcClient:
    def __init__(
        self,
        base_url: str,
        service_role_key: str,
        timeout_seconds: int = 30,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout_seconds = timeout_seconds

    def _rpc(self, function_name: str, payload: dict[str, Any]) -> Any:
        url = f"{self.base_url}/rest/v1/rpc/{function_name}"
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url,
            data=body,
            method="POST",
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "passmate-nas-worker/0.1",
            },
        )

        try:
            with request.urlopen(
                req,
                timeout=self.timeout_seconds,
            ) as response:
                raw = response.read()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RpcError(
                f"RPC {function_name} failed: HTTP {exc.code}: {detail[:500]}"
            ) from exc
        except error.URLError as exc:
            raise RpcError(
                f"RPC {function_name} network error: {exc.reason}"
            ) from exc

        if not raw:
            return None

        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RpcError(
                f"RPC {function_name} returned invalid JSON"
            ) from exc

    def reap_expired(self) -> int:
        result = self._rpc("reap_expired_issuance_jobs", {})
        return int(result or 0)

    def claim(
        self,
        worker_id: str,
        lease_seconds: int,
    ) -> IssuanceJob | None:
        result = self._rpc(
            "claim_issuance_job",
            {
                "p_worker_id": worker_id,
                "p_lease_seconds": lease_seconds,
            },
        )

        if not result:
            return None

        if isinstance(result, list):
            if not result:
                return None
            payload = result[0]
        elif isinstance(result, dict):
            payload = result
        else:
            raise RpcError("claim_issuance_job returned unexpected payload")

        return IssuanceJob.from_payload(payload)

    def renew(
        self,
        job: IssuanceJob,
        worker_id: str,
        lease_seconds: int,
    ) -> bool:
        return bool(
            self._rpc(
                "renew_issuance_lease",
                {
                    "p_job_id": job.job_id,
                    "p_lease_token": job.lease_token,
                    "p_worker_id": worker_id,
                    "p_lease_seconds": lease_seconds,
                },
            )
        )

    def complete(
        self,
        job: IssuanceJob,
        storage_key: str,
        sha256: str,
        size_bytes: int,
    ) -> bool:
        return bool(
            self._rpc(
                "complete_issuance_job",
                {
                    "p_job_id": job.job_id,
                    "p_lease_token": job.lease_token,
                    "p_storage_key": storage_key,
                    "p_sha256": sha256,
                    "p_size_bytes": size_bytes,
                },
            )
        )

    def fail(
        self,
        job: IssuanceJob,
        *,
        code: str,
        detail: str,
        retryable: bool,
    ) -> str:
        result = self._rpc(
            "fail_issuance_job",
            {
                "p_job_id": job.job_id,
                "p_lease_token": job.lease_token,
                "p_error_code": code,
                "p_error_detail": detail[:1000],
                "p_retryable": retryable,
            },
        )
        return str(result or "lease_lost")
