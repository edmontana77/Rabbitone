"""Screens the market for potential penny stocks using Finviz's free screener."""
from __future__ import annotations

import logging

import pandas as pd
from finvizfinance.screener.overview import Overview

from .config import ScreenerConfig
from .utils import retry

logger = logging.getLogger(__name__)


def _clean_numeric(series: pd.Series) -> pd.Series:
    """Turn Finviz's formatted strings ("12.3%", "1,234,567") into floats."""
    return (
        series.astype(str)
        .str.replace("%", "", regex=False)
        .str.replace(",", "", regex=False)
        .replace({"-": None, "nan": None})
        .astype(float)
    )


@retry(times=3, initial_delay=5.0)
def _fetch_raw(config: ScreenerConfig) -> pd.DataFrame:
    overview = Overview()
    filters = {
        "Price": config.price_filter,
        "Average Volume": config.avg_volume_filter,
    }
    if config.country:
        filters["Country"] = config.country
    overview.set_filter(filters_dict=filters)
    return overview.screener_view()


def get_top_penny_stocks(config: ScreenerConfig) -> pd.DataFrame:
    """Return the top ``config.top_n`` penny stocks ranked by today's % change.

    Raises whatever the underlying fetch raises after retries are exhausted;
    callers decide how to handle a screening failure.
    """
    raw = _fetch_raw(config)
    if raw is None or raw.empty:
        logger.warning("Screener returned no rows for filters=%s", config)
        return pd.DataFrame(columns=["Ticker", "Company", "Sector", "Price", "Change", "Volume"])

    df = raw.copy()
    df["Price"] = _clean_numeric(df["Price"])
    df["Change"] = _clean_numeric(df["Change"])
    df["Volume"] = _clean_numeric(df["Volume"])

    df = df[df["Price"] >= config.min_price]
    df = df.dropna(subset=["Price", "Change"])
    df = df.sort_values("Change", ascending=False)

    columns = [c for c in ["Ticker", "Company", "Sector", "Price", "Change", "Volume"] if c in df.columns]
    return df[columns].head(config.top_n).reset_index(drop=True)
