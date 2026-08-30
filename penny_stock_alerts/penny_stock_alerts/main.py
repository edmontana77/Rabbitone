"""Entry point.

Run once (e.g. from cron, or to test your setup):
    python -m penny_stock_alerts.main --once

Run as a long-lived daily scheduler (e.g. under systemd or Docker):
    python -m penny_stock_alerts.main
"""
from __future__ import annotations

import argparse
import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import load_config
from .job import run_daily_job
from .utils import setup_logging

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run the screen-and-notify job immediately and exit (useful for cron or testing).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_config()
    setup_logging(config.log_level)

    if args.once:
        run_daily_job(config)
        return

    hour, minute = (int(part) for part in config.schedule_time.split(":"))
    scheduler = BlockingScheduler(timezone=config.timezone)
    scheduler.add_job(
        run_daily_job,
        trigger=CronTrigger(hour=hour, minute=minute, timezone=config.timezone),
        args=[config],
        misfire_grace_time=3600,
        coalesce=True,
        id="daily_penny_stock_alert",
    )
    logger.info(
        "Scheduler started. Will run every day at %s (%s).", config.schedule_time, config.timezone
    )
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Shutting down.")


if __name__ == "__main__":
    main()
