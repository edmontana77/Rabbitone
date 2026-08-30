import pandas as pd
import pytest

from penny_stock_alerts.config import ScreenerConfig
from penny_stock_alerts.screener import get_top_penny_stocks


def _fake_raw_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Ticker": ["AAA", "BBB", "CCC", "DDD"],
            "Company": ["Alpha Inc", "Beta Corp", "Gamma LLC", "Delta Co"],
            "Sector": ["Tech", "Healthcare", "Energy", "Finance"],
            "Price": ["1.20", "0.05", "4.99", "3.10"],
            "Change": ["12.5%", "-3.0%", "25.0%", "8.0%"],
            "Volume": ["1,200,000", "500,000", "3,400,000", "900,000"],
        }
    )


def test_get_top_penny_stocks_ranks_by_change_and_applies_min_price(monkeypatch):
    monkeypatch.setattr(
        "penny_stock_alerts.screener._fetch_raw", lambda config: _fake_raw_df()
    )

    config = ScreenerConfig(top_n=2, min_price=0.10)
    result = get_top_penny_stocks(config)

    # BBB is below min_price ($0.05) and should be excluded entirely.
    assert "BBB" not in result["Ticker"].values
    # Remaining rows should be sorted by % change, descending.
    assert list(result["Ticker"]) == ["CCC", "AAA"]
    assert result.iloc[0]["Change"] == pytest.approx(25.0)


def test_get_top_penny_stocks_handles_empty_result(monkeypatch):
    monkeypatch.setattr(
        "penny_stock_alerts.screener._fetch_raw", lambda config: pd.DataFrame()
    )

    result = get_top_penny_stocks(ScreenerConfig())
    assert result.empty
