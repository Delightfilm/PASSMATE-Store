from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from passmate_worker.config import Settings
from passmate_worker.final_processor import ProductionPdfProcessor
from passmate_worker.main import build_worker
from passmate_worker.storage import SupabaseArtifactStore
from passmate_worker.transformer import PypdfRewriteTransformer


class ProductionWiringTests(unittest.TestCase):
    def test_production_mode_wires_final_processor_and_private_store(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            master = root / "master"
            work = root / "work"
            output = root / "output"
            master.mkdir()

            settings = Settings(
                supabase_url="https://example.supabase.co",
                server_key="sb_secret_test-secret",
                worker_id="nas-prod-01",
                master_root=master,
                work_root=work,
                output_root=output,
                processor_mode="production",
                storage_bucket="passmate-artifacts",
            )

            worker = build_worker(settings)

            self.assertEqual(worker.mode, "production")
            self.assertIsInstance(worker.processor, ProductionPdfProcessor)
            self.assertIsInstance(worker.processor.store, SupabaseArtifactStore)
            self.assertIsInstance(
                worker.processor.transformer,
                PypdfRewriteTransformer,
            )


if __name__ == "__main__":
    unittest.main()
