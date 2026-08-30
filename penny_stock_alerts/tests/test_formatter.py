import pandas as pd

from penny_stock_alerts.formatter import build_html, build_plain_text


def _sample_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Ticker": ["AAA"],
            "Company": ["Alpha Inc"],
            "Sector": ["Tech"],
            "Price": [1.23],
            "Change": [12.5],
            "Volume": [1_200_000],
        }
    )


def test_build_plain_text_includes_ticker_and_change():
    text = build_plain_text(_sample_df())
    assert "AAA" in text
    assert "+12.50%" in text


def test_build_plain_text_handles_empty_df():
    text = build_plain_text(pd.DataFrame())
    assert "No stocks matched" in text


def test_build_html_includes_table_row():
    html = build_html(_sample_df())
    assert "<table" in html
    assert "AAA" in html


def test_build_html_handles_empty_df():
    html = build_html(pd.DataFrame())
    assert "No stocks matched" in html
