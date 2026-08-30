"""Sends the daily digest by email over SMTP (defaults tuned for Gmail)."""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import pandas as pd

from .config import EmailConfig
from .formatter import build_html, build_plain_text
from .utils import retry

logger = logging.getLogger(__name__)


@retry(times=3, initial_delay=5.0)
def _send(config: EmailConfig, subject: str, text_body: str, html_body: str) -> None:
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = config.sender
    message["To"] = ", ".join(config.recipients)
    message.attach(MIMEText(text_body, "plain"))
    message.attach(MIMEText(html_body, "html"))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(config.smtp_server, config.smtp_port, context=context) as server:
        server.login(config.sender, config.password)
        server.sendmail(config.sender, config.recipients, message.as_string())


def send_email_alert(config: EmailConfig, stocks: pd.DataFrame) -> None:
    if not config.enabled:
        logger.info("Email notifications disabled, skipping.")
        return
    if not config.sender or not config.password or not config.recipients:
        raise ValueError(
            "Email is enabled but EMAIL_SENDER, EMAIL_PASSWORD or EMAIL_RECIPIENTS is missing."
        )

    subject = f"Top Penny Stocks - {len(stocks)} picks"
    _send(config, subject, build_plain_text(stocks), build_html(stocks))
    logger.info("Email alert sent to %s", config.recipients)
