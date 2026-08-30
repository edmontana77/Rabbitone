import pandas as pd

from penny_stock_alerts.config import Config
from penny_stock_alerts.job import run_daily_job


def test_run_daily_job_sends_both_notifications_and_survives_one_failing(monkeypatch):
    calls = []

    monkeypatch.setattr(
        "penny_stock_alerts.job.get_top_penny_stocks",
        lambda screener_config: pd.DataFrame({"Ticker": ["AAA"]}),
    )

    def failing_email(config, stocks):
        calls.append("email")
        raise RuntimeError("smtp down")

    def working_whatsapp(config, stocks):
        calls.append("whatsapp")

    monkeypatch.setattr("penny_stock_alerts.job.send_email_alert", failing_email)
    monkeypatch.setattr("penny_stock_alerts.job.send_whatsapp_alert", working_whatsapp)

    # Should not raise even though email fails.
    run_daily_job(Config())

    assert calls == ["email", "whatsapp"]


def test_run_daily_job_skips_notifications_when_screening_fails(monkeypatch):
    def boom(screener_config):
        raise RuntimeError("finviz down")

    calls = []
    monkeypatch.setattr("penny_stock_alerts.job.get_top_penny_stocks", boom)
    monkeypatch.setattr(
        "penny_stock_alerts.job.send_email_alert", lambda *a: calls.append("email")
    )
    monkeypatch.setattr(
        "penny_stock_alerts.job.send_whatsapp_alert", lambda *a: calls.append("whatsapp")
    )

    run_daily_job(Config())

    assert calls == []
