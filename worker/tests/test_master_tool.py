from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from pypdf import PdfWriter

from passmate_worker.master_tool import init_master, verify_master


class Args:
    pass


class MasterToolTests(unittest.TestCase):
    def test_init_and_verify_master_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source.pdf"
            master_root = root / "master"

            writer = PdfWriter()
            writer.add_blank_page(width=595, height=842)
            writer.write(source)

            args = Args()
            args.master_root = str(master_root)
            args.source = str(source)
            args.product_code = "PM-C2"
            args.product_version = "2027-v1.0"
            args.edition_year = 2027

            self.assertEqual(init_master(args), 0)

            version_dir = master_root / "PM-C2" / "2027-v1.0"
            payload = json.loads(
                (version_dir / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual(payload["product_code"], "PM-C2")
            self.assertEqual(len(payload["master_sha256"]), 64)

            verify_args = Args()
            verify_args.directory = str(version_dir)
            self.assertEqual(verify_master(verify_args), 0)


if __name__ == "__main__":
    unittest.main()
