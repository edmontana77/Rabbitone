#!/usr/bin/env python3
"""
Cyber Threat Analyzer + HTML Report Generator
Uses CISA Known Exploited Vulnerabilities (KEV) catalog
"""

import argparse
import json
import logging
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Dict, Any

import requests

# ---------------- Configuration ----------------
CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
CACHE_FILE = Path("kev_cache.json")
CACHE_HOURS = 6
USER_AGENT = "CyberThreatAnalyzer/1.3"

# ---------------- Helpers ----------------
def setup_logging(verbose=False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s | %(levelname)-8s | %(message)s",
                        datefmt="%H:%M:%S")

def fetch_kev(force=False) -> Dict[str, Any]:
    if not force and CACHE_FILE.exists():
        age = datetime.now(timezone.utc) - datetime.fromtimestamp(CACHE_FILE.stat().st_mtime, tz=timezone.utc)
        if age < timedelta(hours=CACHE_HOURS):
            logging.info("Using cached KEV data")
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))

    logging.info("Downloading latest CISA KEV catalog...")
    resp = requests.get(CISA_KEV_URL, headers={"User-Agent": USER_AGENT}, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    CACHE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data

def classify(v: dict) -> str:
    text = (v.get("vulnerabilityName", "") + " " + v.get("shortDescription", "")).lower()
    if "ransomware" in text or v.get("knownRansomwareCampaignUse", "").lower() == "known":
        return "Ransomware"
    if any(x in text for x in ["remote code", "rce", "code execution", "command injection"]):
        return "Remote Code Execution"
    if any(x in text for x in ["auth", "authentication", "credential"]):
        return "Authentication"
    if "sql" in text:
        return "SQL Injection"
    if "xss" in text or "cross-site" in text:
        return "XSS"
    if "ssrf" in text:
        return "SSRF"
    if "path traversal" in text or "directory traversal" in text:
        return "Path Traversal"
    return "Other"

def analyze(data: dict, recent_days=30):
    vulns = data.get("vulnerabilities", [])
    now = datetime.now(timezone.utc)

    recent = []
    for v in vulns:
        try:
            added = datetime.strptime(v["dateAdded"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            if (now - added).days <= recent_days:
                recent.append(v)
        except Exception:
            pass

    ransomware = [v for v in vulns if v.get("knownRansomwareCampaignUse", "").lower() == "known"]
    vendors = Counter(v.get("vendorProject", "Unknown") for v in vulns)
    products = Counter(f"{v.get('vendorProject')} :: {v.get('product')}" for v in vulns)
    categories = Counter(classify(v) for v in vulns)

    # Sort recent by date (newest first)
    recent_sorted = sorted(recent, key=lambda x: x.get("dateAdded", ""), reverse=True)

    return {
        "generated": now.strftime("%Y-%m-%d %H:%M UTC"),
        "total": len(vulns),
        "recent_count": len(recent),
        "ransomware_count": len(ransomware),
        "top_vendors": vendors.most_common(15),
        "top_products": products.most_common(12),
        "categories": categories.most_common(),
        "recent": recent_sorted[:25],
        "catalog_version": data.get("catalogVersion", "N/A"),
        "date_released": data.get("dateReleased", "N/A")[:10],
    }

# ---------------- HTML Report ----------------
def generate_html(report: dict, output_path: Path):
    # Simple & clean CSS
    css = """
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
           margin: 0; padding: 0; background: #f4f6f9; color: #222; }
    .container { max-width: 1100px; margin: 30px auto; background: white;
                 border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
    header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 30px 40px; }
    header h1 { margin: 0 0 8px 0; font-size: 28px; }
    header p { margin: 0; opacity: 0.85; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;
             padding: 25px 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .stat-card { background: white; border-radius: 10px; padding: 18px; text-align: center;
                 box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .stat-card .number { font-size: 28px; font-weight: 700; color: #e11d48; }
    .stat-card .label { font-size: 13px; color: #64748b; margin-top: 4px; }
    section { padding: 30px 40px; }
    h2 { margin-top: 0; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-weight: 600; color: #334155; }
    tr:hover { background: #f8fafc; }
    .tag { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .tag-ransom { background: #fee2e2; color: #b91c1c; }
    .tag-rce { background: #ffedd5; color: #c2410c; }
    .tag-other { background: #e0e7ff; color: #3730a3; }
    .footer { padding: 20px 40px; background: #f8fafc; font-size: 13px; color: #64748b;
              border-top: 1px solid #e2e8f0; }
    """

    # Stats cards
    stats_html = f"""
    <div class="stats">
      <div class="stat-card"><div class="number">{report['total']}</div><div class="label">Total KEV Entries</div></div>
      <div class="stat-card"><div class="number">{report['recent_count']}</div><div class="label">Added last 30 days</div></div>
      <div class="stat-card"><div class="number">{report['ransomware_count']}</div><div class="label">Ransomware-related</div></div>
      <div class="stat-card"><div class="number">{len(report['top_vendors'])}</div><div class="label">Top Vendors Shown</div></div>
    </div>
    """

    # Vendors table
    vendors_rows = "".join(
        f"<tr><td>{i}</td><td>{name}</td><td><strong>{cnt}</strong></td></tr>"
        for i, (name, cnt) in enumerate(report["top_vendors"], 1)
    )

    # Products table
    products_rows = "".join(
        f"<tr><td>{i}</td><td>{name}</td><td><strong>{cnt}</strong></td></tr>"
        for i, (name, cnt) in enumerate(report["top_products"], 1)
    )

    # Categories
    cat_rows = "".join(
        f"<tr><td>{name}</td><td><strong>{cnt}</strong></td></tr>"
        for name, cnt in report["categories"]
    )

    # Recent vulnerabilities
    recent_rows = ""
    for v in report["recent"]:
        ransom = v.get("knownRansomwareCampaignUse", "").lower() == "known"
        tag = '<span class="tag tag-ransom">RANSOMWARE</span>' if ransom else ""
        recent_rows += f"""
        <tr>
          <td><code>{v.get('cveID')}</code></td>
          <td>{v.get('vendorProject')} / {v.get('product')}</td>
          <td>{v.get('vulnerabilityName')} {tag}</td>
          <td>{v.get('dateAdded')}</td>
        </tr>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cyber Threat Analysis Report</title>
  <style>{css}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Cybersecurity Threat Analysis Report</h1>
      <p>Based on CISA Known Exploited Vulnerabilities (KEV) Catalog</p>
      <p style="margin-top:8px; font-size:14px;">Generated: {report['generated']} &nbsp;|&nbsp; Catalog: {report['catalog_version']} ({report['date_released']})</p>
    </header>

    {stats_html}

    <section>
      <h2>Top Vendors (by number of known exploited vulnerabilities)</h2>
      <table>
        <thead><tr><th>#</th><th>Vendor</th><th>Count</th></tr></thead>
        <tbody>{vendors_rows}</tbody>
      </table>
    </section>

    <section>
      <h2>Top Products</h2>
      <table>
        <thead><tr><th>#</th><th>Product</th><th>Count</th></tr></thead>
        <tbody>{products_rows}</tbody>
      </table>
    </section>

    <section>
      <h2>Threat Categories (heuristic)</h2>
      <table>
        <thead><tr><th>Category</th><th>Count</th></tr></thead>
        <tbody>{cat_rows}</tbody>
      </table>
    </section>

    <section>
      <h2>Recent High-Priority Entries (last 30 days)</h2>
      <table>
        <thead>
          <tr>
            <th>CVE</th>
            <th>Vendor / Product</th>
            <th>Vulnerability</th>
            <th>Date Added</th>
          </tr>
        </thead>
        <tbody>{recent_rows}</tbody>
      </table>
    </section>

    <div class="footer">
      Data source: <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank">CISA KEV Catalog</a><br>
      This report is for defensive security and prioritization purposes only.
    </div>
  </div>
</body>
</html>
"""
    output_path.write_text(html, encoding="utf-8")
    logging.info(f"HTML report saved → {output_path.resolve()}")

# ---------------- Main ----------------
def main():
    parser = argparse.ArgumentParser(description="Cyber Threat Analyzer + HTML Report")
    parser.add_argument("--html", default="report.html", help="Output HTML file (default: report.html)")
    parser.add_argument("--refresh", action="store_true", help="Force download of latest KEV data")
    parser.add_argument("--recent", type=int, default=30, help="Days considered recent (default 30)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    setup_logging(args.verbose)

    try:
        data = fetch_kev(force=args.refresh)
        report = analyze(data, recent_days=args.recent)
        generate_html(report, Path(args.html))
        print(f"\n✅ Done! Open the report:  {Path(args.html).resolve()}\n")
    except Exception as e:
        logging.exception("Error")
        sys.exit(1)

if __name__ == "__main__":
    main()