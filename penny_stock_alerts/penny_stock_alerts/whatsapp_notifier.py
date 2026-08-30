"""Sends the daily digest over WhatsApp using Twilio's WhatsApp API."""
from __future__ import annotations

import logging

import pandas as pd
from twilio.rest import Client

from .config import WhatsAppConfig
from .formatter import build_plain_text
from .utils import retry

logger = logging.getLogger(__name__)

# Twilio WhatsApp messages cap out at 1600 characters.
_MAX_LEN = 1500


def _with_prefix(number: str) -> str:
    number = number.strip()
    return number if number.startswith("whatsapp:") else f"whatsapp:{number}"


@retry(times=3, initial_delay=5.0)
def _send_one(client: Client, from_number: str, to_number: str, body: str) -> None:
    client.messages.create(from_=_with_prefix(from_number), to=_with_prefix(to_number), body=body)


def send_whatsapp_alert(config: WhatsAppConfig, stocks: pd.DataFrame) -> None:
    if not config.enabled:
        logger.info("WhatsApp notifications disabled, skipping.")
        return
    if not config.account_sid or not config.auth_token or not config.from_number or not config.to_numbers:
        raise ValueError(
            "WhatsApp is enabled but TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, "
            "TWILIO_WHATSAPP_FROM or WHATSAPP_TO is missing."
        )

    body = build_plain_text(stocks)
    if len(body) > _MAX_LEN:
        body = body[: _MAX_LEN - 3] + "..."

    client = Client(config.account_sid, config.auth_token)
    for to_number in config.to_numbers:
        _send_one(client, config.from_number, to_number, body)
    logger.info("WhatsApp alert sent to %s", config.to_numbers)
