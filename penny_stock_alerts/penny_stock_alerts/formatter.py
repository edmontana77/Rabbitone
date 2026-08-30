"""Turns a screened DataFrame into the text/HTML bodies sent to the user."""
from __future__ import annotations

from datetime import date

import pandas as pd


def _row_line(row: pd.Series) -> str:
    change = row.get("Change")
    change_str = f"{change:+.2f}%" if pd.notna(change) else "n/a"
    price = row.get("Price")
    price_str = f"${price:.2f}" if pd.notna(price) else "n/a"
    volume = row.get("Volume")
    volume_str = f"{int(volume):,}" if pd.notna(volume) else "n/a"
    return f"{row.get('Ticker', '?')}  {price_str}  {change_str}  vol {volume_str}  {row.get('Company', '')}"


def build_plain_text(df: pd.DataFrame) -> str:
    header = f"Top Penny Stocks - {date.today().isoformat()}"
    if df.empty:
        return f"{header}\n\nNo stocks matched today's screening criteria."
    lines = [header, ""]
    for i, (_, row) in enumerate(df.iterrows(), start=1):
        lines.append(f"{i}. {_row_line(row)}")
    lines.append("")
    lines.append("Not financial advice. Do your own research before trading.")
    return "\n".join(lines)


def build_html(df: pd.DataFrame) -> str:
    header = f"Top Penny Stocks &mdash; {date.today().isoformat()}"
    if df.empty:
        return f"<h2>{header}</h2><p>No stocks matched today's screening criteria.</p>"

    rows_html = []
    for _, row in df.iterrows():
        change = row.get("Change")
        color = "#0a7d2f" if pd.notna(change) and change >= 0 else "#c0392b"
        rows_html.append(
            "<tr>"
            f"<td style='padding:6px 10px;font-weight:bold;'>{row.get('Ticker', '?')}</td>"
            f"<td style='padding:6px 10px;'>{row.get('Company', '')}</td>"
            f"<td style='padding:6px 10px;'>{row.get('Sector', '')}</td>"
            f"<td style='padding:6px 10px;'>${row.get('Price', 0):.2f}</td>"
            f"<td style='padding:6px 10px;color:{color};'>{change:+.2f}%</td>"
            f"<td style='padding:6px 10px;'>{int(row.get('Volume', 0)):,}</td>"
            "</tr>"
        )

    table = (
        "<table style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;'>"
        "<tr style='background:#222;color:#fff;'>"
        "<th style='padding:6px 10px;text-align:left;'>Ticker</th>"
        "<th style='padding:6px 10px;text-align:left;'>Company</th>"
        "<th style='padding:6px 10px;text-align:left;'>Sector</th>"
        "<th style='padding:6px 10px;text-align:left;'>Price</th>"
        "<th style='padding:6px 10px;text-align:left;'>Change</th>"
        "<th style='padding:6px 10px;text-align:left;'>Volume</th>"
        "</tr>" + "".join(rows_html) + "</table>"
    )
    return (
        f"<h2>{header}</h2>{table}"
        "<p style='color:#666;font-size:12px;'>Not financial advice. Do your own research before trading.</p>"
    )
