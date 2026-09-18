from __future__ import annotations

from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from passmate_worker.storage import SupabaseArtifactStore


class FakeResponse:
    def __init__(self, body: bytes = b"{}") -> None:
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self) -> bytes:
        return self.body


class SupabaseArtifactStoreTests(unittest.TestCase):
    def test_upload_uses_private_bucket_and_no_upsert(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "issued.pdf"
            source.write_bytes(b"%PDF-1.4\nPASSMATE\n%%EOF\n")
            store = SupabaseArtifactStore(
                "https://example.supabase.co",
                "service-secret",
            )

            captured = []

            def fake_urlopen(req, timeout):
                captured.append(req)
                return FakeResponse()

            with patch(
                "passmate_worker.storage.request.urlopen",
                side_effect=fake_urlopen,
            ):
                result = store.put(
                    source,
                    "issued/PM-C2/2027-v1.0/order/job-g1.pdf",
                )

            self.assertEqual(len(result.sha256), 64)
            self.assertGreater(result.size_bytes, 0)
            self.assertEqual(len(captured), 1)
            self.assertIn(
                "/storage/v1/object/passmate-artifacts/issued/PM-C2/",
                captured[0].full_url,
            )
            self.assertEqual(
                captured[0].headers.get("X-upsert"),
                "false",
            )

    def test_delete_uses_storage_api(self) -> None:
        store = SupabaseArtifactStore(
            "https://example.supabase.co",
            "service-secret",
        )
        captured = []

        def fake_urlopen(req, timeout):
            captured.append(req)
            return FakeResponse()

        with patch(
            "passmate_worker.storage.request.urlopen",
            side_effect=fake_urlopen,
        ):
            store.delete("issued/PM-C2/v1/order/job.pdf")

        self.assertEqual(captured[0].method, "DELETE")
        self.assertTrue(
            captured[0].full_url.endswith(
                "/storage/v1/object/passmate-artifacts"
            )
        )


if __name__ == "__main__":
    unittest.main()
