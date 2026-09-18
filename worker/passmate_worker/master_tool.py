from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import tempfile

from .manifest import MasterManifest
from .processor import _safe_segment, sha256_file


def _write_manifest(
    *,
    directory: Path,
    product_code: str,
    product_version: str,
    edition_year: int | None,
    master_file: str,
) -> Path:
    target = directory / master_file
    digest = sha256_file(target)
    payload = {
        "schema_version": 1,
        "product_code": product_code,
        "product_version": product_version,
        "edition_year": edition_year,
        "master_file": master_file,
        "master_sha256": digest,
    }

    directory.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        prefix="manifest.",
        suffix=".json.tmp",
        dir=directory,
        delete=False,
    ) as temp:
        json.dump(payload, temp, ensure_ascii=False, indent=2)
        temp.write("\n")
        temp_path = Path(temp.name)

    manifest_path = directory / "manifest.json"
    temp_path.replace(manifest_path)
    return manifest_path


def init_master(args: argparse.Namespace) -> int:
    code = _safe_segment(args.product_code, "product_code")
    version = _safe_segment(args.product_version, "product_version")
    root = Path(args.master_root).resolve()
    source = Path(args.source).resolve()

    if not source.is_file():
        raise SystemExit(f"source PDF not found: {source}")

    directory = (root / code / version).resolve()
    if root not in directory.parents:
        raise SystemExit("MASTER destination escaped root")

    # product/version is an immutable release identity. Once either the
    # registered PDF or its manifest exists, init must never mutate that
    # directory in place. Changed bytes require a new product_version.
    registered_paths = [
        directory / "master.pdf",
        directory / "manifest.json",
    ]
    if any(path.exists() for path in registered_paths):
        raise SystemExit(
            "MASTER version already registered; "
            "create a new product version instead of overwriting it"
        )

    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / "master.pdf"

    with tempfile.NamedTemporaryFile(
        prefix="master.",
        suffix=".pdf.tmp",
        dir=directory,
        delete=False,
    ) as temp:
        temp_path = Path(temp.name)

    try:
        shutil.copyfile(source, temp_path)
        temp_path.replace(destination)
    finally:
        temp_path.unlink(missing_ok=True)

    manifest = _write_manifest(
        directory=directory,
        product_code=code,
        product_version=version,
        edition_year=args.edition_year,
        master_file="master.pdf",
    )

    print(manifest)
    return 0


def verify_master(args: argparse.Namespace) -> int:
    directory = Path(args.directory).resolve()
    manifest = MasterManifest.load(directory)
    master = manifest.validate_for_job(
        product_code=manifest.product_code,
        product_version=manifest.product_version,
        edition_year=manifest.edition_year,
        directory=directory,
    )
    print(
        f"MASTER OK {manifest.product_code}/{manifest.product_version} "
        f"file={master.name} sha256={manifest.master_sha256}"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="PASSMATE MASTER manifest utility"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    init = sub.add_parser(
        "init",
        help="register a final PDF in a new immutable product/version directory",
    )
    init.add_argument("--master-root", required=True)
    init.add_argument("--source", required=True)
    init.add_argument("--product-code", required=True)
    init.add_argument("--product-version", required=True)
    init.add_argument("--edition-year", type=int)
    init.set_defaults(func=init_master)

    verify = sub.add_parser(
        "verify",
        help="verify an existing version directory against manifest.json",
    )
    verify.add_argument("--directory", required=True)
    verify.set_defaults(func=verify_master)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
