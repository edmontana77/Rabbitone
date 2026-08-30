"""Configuration loaded from environment variables (or a local .env file)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _get_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


def _get_int(name: str, default: int) -> int:
    val = os.getenv(name)
    return int(val) if val else default


@dataclass
class ScreenerConfig:
    price_filter: str = os.getenv("PENNY_PRICE_FILTER", "Under $5")
    avg_volume_filter: str = os.getenv("PENNY_AVG_VOLUME_FILTER", "Over 500K")
    country: str = os.getenv("PENNY_COUNTRY_FILTER", "USA")
    top_n: int = _get_int("PENNY_TOP_N", 10)
    min_price: float = float(os.getenv("PENNY_MIN_PRICE", "0.10"))


@dataclass
class EmailConfig:
    enabled: bool = _get_bool("EMAIL_ENABLED", True)
    smtp_server: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port: int = _get_int("SMTP_PORT", 465)
    sender: str = os.getenv("EMAIL_SENDER", "")
    password: str = os.getenv("EMAIL_PASSWORD", "")
    recipients: list[str] = field(
        default_factory=lambda: [
            addr.strip()
            for addr in os.getenv("EMAIL_RECIPIENTS", "").split(",")
            if addr.strip()
        ]
    )


@dataclass
class WhatsAppConfig:
    enabled: bool = _get_bool("WHATSAPP_ENABLED", True)
    account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    from_number: str = os.getenv("TWILIO_WHATSAPP_FROM", "")
    to_numbers: list[str] = field(
        default_factory=lambda: [
            num.strip()
            for num in os.getenv("WHATSAPP_TO", "").split(",")
            if num.strip()
        ]
    )


@dataclass
class Config:
    timezone: str = os.getenv("SCHEDULE_TIMEZONE", "America/New_York")
    schedule_time: str = os.getenv("SCHEDULE_TIME", "09:00")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    screener: ScreenerConfig = field(default_factory=ScreenerConfig)
    email: EmailConfig = field(default_factory=EmailConfig)
    whatsapp: WhatsAppConfig = field(default_factory=WhatsAppConfig)


def load_config() -> Config:
    return Config()
