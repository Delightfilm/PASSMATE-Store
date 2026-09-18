from __future__ import annotations

import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from passmate_worker.config import ConfigError, Settings


BASE_ENV = {
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "test-secret",
    "PASSMATE_WORKER_ID": "nas-test-01",
    "PASSMATE_LEASE_SECONDS": "300",
    "PASSMATE_HEARTBEAT_SECONDS": "60",
}


class ConfigTests(unittest.TestCase):
    def test_valid_config_and_filesystem(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            master = root / "master"
            master.mkdir()

            env = {
                **BASE_ENV,
                "PASSMATE_MASTER_ROOT": str(master),
                "PASSMATE_WORK_ROOT": str(root / "work"),
                "PASSMATE_OUTPUT_ROOT": str(root / "output"),
            }

            with patch.dict(os.environ, env, clear=True):
                settings = Settings.from_env()
                settings.validate_filesystem()

            self.assertTrue(settings.work_root.is_dir())
            self.assertTrue(settings.output_root.is_dir())

    def test_http_supabase_url_rejected(self) -> None:
        env = {
            **BASE_ENV,
            "SUPABASE_URL": "http://insecure.example",
        }
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaises(ConfigError):
                Settings.from_env()

    def test_heartbeat_must_be_less_than_lease(self) -> None:
        env = {
            **BASE_ENV,
            "PASSMATE_LEASE_SECONDS": "60",
            "PASSMATE_HEARTBEAT_SECONDS": "60",
        }
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaises(ConfigError):
                Settings.from_env()

    def test_processor_is_disabled_by_default(self) -> None:
        with patch.dict(os.environ, BASE_ENV, clear=True):
            settings = Settings.from_env()

        self.assertEqual(settings.processor_mode, "disabled")
        with self.assertRaises(ConfigError):
            settings.validate_runtime_enabled()

    def test_production_rejects_reference_copy_gate(self) -> None:
        env = {
            **BASE_ENV,
            "PASSMATE_PROCESSOR_MODE": "production",
            "PASSMATE_ALLOW_REFERENCE_COPY": "true",
        }
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaises(ConfigError):
                Settings.from_env()

    def test_production_mode_is_explicit(self) -> None:
        env = {
            **BASE_ENV,
            "PASSMATE_PROCESSOR_MODE": "production",
        }
        with patch.dict(os.environ, env, clear=True):
            settings = Settings.from_env()
            settings.validate_runtime_enabled()

        self.assertEqual(settings.processor_mode, "production")
        self.assertFalse(settings.allow_reference_copy)


if __name__ == "__main__":
    unittest.main()
