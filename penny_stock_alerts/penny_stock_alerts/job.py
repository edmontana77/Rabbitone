"""The daily job: screen the market, then notify over every enabled channel."""
from __future__ import annotations

import logging

from .config import Config
from .email_notifier import send_email_alert
from .screener import get_top_penny_stocks
from .whatsapp_notifier import send_whatsapp_alert

logger = logging.getLogger(__name__)


def run_daily_job(config: Config) -> None:
    logger.info("Running daily penny stock screen...")
    try:
        stocks = get_top_penny_stocks(config.screener)
    except Exception:
        logger.exception("Screening failed; no alert will be sent this run.")
        return

    logger.info("Found %d candidate(s).", len(stocks))

    # Each channel is independent: a failure on one must not stop the other.
    try:
        send_email_alert(config.email, stocks)
    except Exception:
        logger.exception("Email notification failed.")

    try:
        send_whatsapp_alert(config.whatsapp, stocks)
    except Exception:
        logger.exception("WhatsApp notification failed.")
