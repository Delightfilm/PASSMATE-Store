from __future__ import annotations

import unittest

from passmate_worker.models import IssuanceJob


class IssuanceJobModelTests(unittest.TestCase):
    def test_claim_payload_parses(self) -> None:
        job = IssuanceJob.from_payload(
            {
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
        )

        self.assertEqual(job.product_code, "PM-C2")
        self.assertEqual(job.edition_year, 2027)

    def test_unknown_schema_rejected(self) -> None:
        payload = {
            "schema_version": 2,
            "job_id": "job-1",
            "lease_token": "lease-1",
            "attempt": 1,
            "generation": 1,
            "order_id": "order-1",
            "order_item_id": "item-1",
            "product_code": "PM-C2",
            "product_version": "2027-v1.0",
            "artifact_code": "bundle",
        }

        with self.assertRaises(ValueError):
            IssuanceJob.from_payload(payload)


if __name__ == "__main__":
    unittest.main()
