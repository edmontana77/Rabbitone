# BigFix Inventory Sync API

A small REST API that pulls computer and software-instance data from
**HCL BigFix Inventory**'s REST API, caches it locally in SQLite, and
exposes clean JSON endpoints for internal reports/dashboards (like the
`Windows11_Version_Dashboard.html` and `Unix environment report.html`
files in this repo) instead of having each dashboard hit BigFix Inventory
directly.

```
BigFix Inventory  --(REST, token/basic auth)-->  this API  --(sync)-->  SQLite cache
                                                       |
                                                       +--(REST, API key)--> dashboards / other apps
```

## Setup

```bash
cd api
npm install
cp .env.example .env   # then fill in your BigFix Inventory details
npm start               # or: npm run dev (auto-restart on file changes)
```

Requires Node.js 22.5+ (uses the built-in `node:sqlite` module, no native
build step required).

## Configuration (`.env`)

| Variable | Description |
|---|---|
| `PORT` | Port this API listens on (default `3000`). |
| `API_KEY` | Required bearer token clients must send to call `/api/*` routes. Leave empty only for local dev. |
| `BIGFIX_INVENTORY_BASE_URL` | Base URL of the BigFix Inventory REST API, e.g. `https://bfi-host:9081/api/v1`. |
| `BIGFIX_INVENTORY_TOKEN` | Preferred auth: a personal API token (BigFix Inventory UI → profile icon → Profile → Show token). Sent as a `token` query parameter, as required by BigFix Inventory. |
| `BIGFIX_INVENTORY_USERNAME` / `BIGFIX_INVENTORY_PASSWORD` | Fallback HTTP Basic auth, used only if no token is set. |
| `BIGFIX_INVENTORY_TLS_VERIFY` | Set `false` only for lab servers with self-signed certs. |
| `SYNC_CRON` | Standard 5-field cron expression for automatic background sync (e.g. `0 */6 * * *`). Leave empty to disable and sync only via the API. |
| `SYNC_PAGE_SIZE` | Page size used when paging through BigFix Inventory list endpoints. |
| `DB_PATH` | Path to the local SQLite cache file. |

Credentials are read from environment variables only — nothing is hardcoded
or committed (`.env` is gitignored).

## API

All `/api/*` routes require `Authorization: Bearer <API_KEY>`.

### Sync

- `POST /api/sync` — triggers an on-demand sync from BigFix Inventory
  (fetches all computers + software instances, upserts them into the local
  cache). Returns `202` immediately if a sync is already running.
- `GET /api/sync/status` — whether a sync is currently running, plus the
  most recent sync run.
- `GET /api/sync/history?limit=20` — recent sync run history (status,
  timing, counts, error messages).

### Reports

- `GET /api/reports/computers?limit=&offset=` — paginated list of synced
  computers.
- `GET /api/reports/software?computerId=&name=&limit=&offset=` — synced
  software instances, optionally filtered by computer or name.
- `GET /api/reports/os-summary` — computer counts grouped by OS name +
  version (feeds OS-version style dashboards).
- `GET /api/reports/security-agents?names=CrowdStrike,Trellix` — per-computer
  install status for the requested software/agent names, mirroring the
  detection logic in `bf-cs-trellix-report.bes`. Defaults to
  `CrowdStrike, Trellix, Rapid7 Insight Agent, BES Client` if `names` is
  omitted.

`GET /health` is unauthenticated and returns `{"status":"ok"}`.

## How syncing works

`src/bigfixInventory/client.js` pages through BigFix Inventory's
`/computers` and `/swInstances` REST endpoints (`limit`/`offset` paging),
retries transient 5xx/network failures with backoff, and normalizes a few
common response envelope shapes BigFix Inventory may return
(`[...]`, `{data:[...]}`, `{items:[...]}`, `{resources:[...]}`).

Field names for computers/software instances are mapped defensively in
`src/bigfixInventory/fieldMapping.js` — each field tries a short list of
common candidate keys (e.g. `computerId` or `id` or `computer_id`). BigFix
Inventory's exact field names can vary by version/configuration; if your
server uses different names, add them to the candidate lists in that one
file rather than changing the sync logic.

`src/syncService.js` orchestrates a sync (fetch → upsert → record run
history) and ensures only one sync runs at a time. `src/scheduler.js` runs
it automatically on `SYNC_CRON` if set.

## Testing

```bash
npm test
```

Tests run against an in-memory SQLite database and a stubbed BigFix
Inventory client/fetch (no live BigFix Inventory server required), covering
pagination/field-mapping, retry/auth behavior, the sync upsert flow, and
the HTTP routes end-to-end.

## Known limitations

- Endpoint paths and field names target the standard BigFix Inventory v1
  REST API; some deployments may need small adjustments (see
  `fieldMapping.js`) — this hasn't been validated against a live server.
- Only computers and software instances are synced. Other BigFix Inventory
  data (e.g. license/sub-capacity reports) isn't pulled yet.
- The sync is a full re-pull each run (no incremental/delta sync).
