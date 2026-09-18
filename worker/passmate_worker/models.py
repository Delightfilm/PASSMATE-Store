from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class IssuanceJob:
    schema_version: int
    job_id: str
    lease_token: str
    attempt: int
    generation: int
    order_id: str
    order_item_id: str
    product_code: str
    product_version: str
    edition_year: int | None
    artifact_code: str

    @classmethod
    def from_payload(cls, payload: dict) -> "IssuanceJob":
        required = {
            "schema_version",
            "job_id",
            "lease_token",
            "attempt",
            "generation",
            "order_id",
            "order_item_id",
            "product_code",
            "product_version",
            "artifact_code",
        }
        missing = sorted(required.difference(payload))
        if missing:
            raise ValueError(
                f"claim payload missing fields: {', '.join(missing)}"
            )

        if payload["schema_version"] != 1:
            raise ValueError(
                f"unsupported schema_version: {payload['schema_version']}"
            )

        return cls(
            schema_version=1,
            job_id=str(payload["job_id"]),
            lease_token=str(payload["lease_token"]),
            attempt=int(payload["attempt"]),
            generation=int(payload["generation"]),
            order_id=str(payload["order_id"]),
            order_item_id=str(payload["order_item_id"]),
            product_code=str(payload["product_code"]),
            product_version=str(payload["product_version"]),
            edition_year=(
                int(payload["edition_year"])
                if payload.get("edition_year") is not None
                else None
            ),
            artifact_code=str(payload["artifact_code"]),
        )


@dataclass(frozen=True)
class ArtifactResult:
    storage_key: str
    sha256: str
    size_bytes: int
    local_path: str
