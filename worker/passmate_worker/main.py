from __future__ import annotations

import argparse
import logging
import sys

from .client import SupabaseRpcClient
from .config import ConfigError, Settings
from .processor import ReferenceCopyProcessor
from .worker import PassmateWorker


def build_worker(settings: Settings) -> PassmateWorker:
    client = SupabaseRpcClient(
        settings.supabase_url,
        settings.service_role_key,
        timeout_seconds=settings.request_timeout_seconds,
    )
    processor = ReferenceCopyProcessor(
        settings.master_root,
        settings.work_root,
        settings.output_root,
        enabled=settings.allow_reference_copy,
    )
    return PassmateWorker(
        client=client,
        processor=processor,
        worker_id=settings.worker_id,
        poll_seconds=settings.poll_seconds,
        lease_seconds=settings.lease_seconds,
        heartbeat_seconds=settings.heartbeat_seconds,
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="PASSMATE NAS Worker reference implementation"
    )
    parser.add_argument(
        "--check-config",
        action="store_true",
        help="validate environment and filesystem, then exit",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="poll and process at most one queue item, then exit",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    try:
        settings = Settings.from_env()
        settings.validate_filesystem()
    except ConfigError as exc:
        logging.error("configuration error: %s", exc)
        return 2

    if args.check_config:
        logging.info(
            "configuration OK worker_id=%s reference_copy=%s",
            settings.worker_id,
            settings.allow_reference_copy,
        )
        return 0

    worker = build_worker(settings)

    if args.once:
        worker.run_once()
        return 0

    try:
        worker.run_forever()
    except KeyboardInterrupt:
        logging.info("worker stopped")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
