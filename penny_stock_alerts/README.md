# Penny Stock Alerts

Screens the market every day for potential penny stocks and sends you a
digest by **email** and **WhatsApp** at a scheduled time (default 9:00 AM).

## How it works

1. **Screen** — queries [Finviz](https://finviz.com)'s free screener for
   stocks under a price threshold (default: under $5) with enough average
   volume to be tradeable (default: over 500K shares/day), then ranks them
   by today's % change.
2. **Notify** — formats the top picks as a table and sends it by email
   (SMTP) and WhatsApp ([Twilio](https://www.twilio.com/whatsapp) API).
   Each channel fails independently — if WhatsApp delivery fails, you still
   get the email, and vice versa.
3. **Schedule** — runs automatically every day at a configured local time.

This is a screening tool, not investment advice. Penny stocks are highly
volatile and speculative; always do your own research.

## Setup

```bash
cd penny_stock_alerts
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with your own settings:

- **Email**: for Gmail, enable 2-Step Verification on your Google account,
  then create an [App Password](https://myaccount.google.com/apppasswords)
  and use that as `EMAIL_PASSWORD` (your normal password won't work).
- **WhatsApp**: create a free [Twilio](https://www.twilio.com/try-twilio)
  account, activate the [WhatsApp
  sandbox](https://www.twilio.com/docs/whatsapp/sandbox) (or an approved
  WhatsApp sender for production use), and copy your Account SID, Auth
  Token, and the sandbox/from number into `.env`. You must join the sandbox
  from your phone once by sending the join code Twilio gives you to the
  sandbox number.

Either channel can be turned off independently by setting
`EMAIL_ENABLED=false` or `WHATSAPP_ENABLED=false`.

## Usage

Test your setup by running the job once, immediately:

```bash
python -m penny_stock_alerts.main --once
```

Run it as a long-lived scheduler that fires every day at `SCHEDULE_TIME`
(interpreted in `SCHEDULE_TIMEZONE`):

```bash
python -m penny_stock_alerts.main
```

Leave this running in the background (e.g. `tmux`, a `systemd` service, or
a Docker container) and it will notify you every day at 9 AM.

### Alternative: run via cron instead of the built-in scheduler

If you'd rather not keep a process running continuously, use `--once` with
cron so your OS handles the scheduling:

```cron
0 9 * * * cd /path/to/penny_stock_alerts && /path/to/.venv/bin/python -m penny_stock_alerts.main --once >> alerts.log 2>&1
```

## Configuration reference

All settings live in `.env` (see `.env.example` for defaults):

| Variable | Purpose |
|---|---|
| `SCHEDULE_TIME` | Local time to run, `HH:MM` (24h) |
| `SCHEDULE_TIMEZONE` | IANA timezone for `SCHEDULE_TIME` |
| `PENNY_PRICE_FILTER` | Finviz price filter, e.g. `Under $5` |
| `PENNY_AVG_VOLUME_FILTER` | Finviz average volume filter, e.g. `Over 500K` |
| `PENNY_TOP_N` | How many stocks to include in the digest |
| `PENNY_MIN_PRICE` | Floor price to exclude near-worthless tickers |
| `EMAIL_ENABLED` / `WHATSAPP_ENABLED` | Toggle each channel |
| `SMTP_SERVER`, `SMTP_PORT`, `EMAIL_SENDER`, `EMAIL_PASSWORD`, `EMAIL_RECIPIENTS` | Email delivery |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `WHATSAPP_TO` | WhatsApp delivery |

## Running the tests

```bash
pip install pytest
pytest
```

Tests mock all network calls (Finviz, SMTP, Twilio), so they run offline.
