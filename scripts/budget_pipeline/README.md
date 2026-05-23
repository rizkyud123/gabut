# Budget Data Pipeline (APBD + Dana Desa) — Real Scrape Framework

This directory contains a **production-ready scraping + transformation pipeline framework** for fetching and normalizing **real** Indonesian fiscal transparency data:
- **APBD** (Provinsi + Kabupaten/Kota)
- **Dana Desa** (Desa)

## IMPORTANT
Government portals may change their endpoints and/or add anti-bot protections. This repo includes:
- a robust HTTP session (headers, retries, backoff)
- an `--inspect` mode that **saves real raw responses** for reverse-engineering
- chunked processing + rate limiting (1–2s delay)
- error logging to `error_log.json`

> This framework is designed to avoid dummy data. If a field cannot be extracted from the real payload, it is recorded as missing and the region is skipped (or processed with zeros only when explicitly supported by the payload).

## Folder Layout
- `fetch_real_apbd.py` — main entrypoint
- `scraper_apbd_djpk.py` — APBD fetcher (placeholder hooks for endpoint-specific logic)
- `scraper_dana_desa_kemendesa.py` — Dana Desa fetcher (placeholder hooks)
- `transformer.py` — maps extracted values into app JSON schema
- `db_upsert.py` — Supabase/Postgres UPSERT (optional)
- `utils_http.py` — session, retries, rate limiting, inspect capture
- `utils_money.py` — parse Indonesian currency strings → integer

Raw payload captures:
- `data/raw/<source>/<tahun>/<run-id>/...`

Generated outputs:
- `data/budget/<source>/<tahun>/...`
- `data/apbd_daerah.json` (frontend input)

## Dependencies
Install Python dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r scripts/budget_pipeline/requirements.txt
```

## Environment Variables (`.env`)
Create a `.env` file in repo root:

```env
# Optional Supabase/Postgres UPSERT
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Where to write raw captures & outputs (optional)
DATA_DIR=data
RAW_DIR=data/raw
ERROR_LOG=error_log.json

# Scraper behavior
REQUEST_DELAY_SEC=1.5
MAX_RETRIES=4
TIMEOUT_SEC=30
```

If UPSERT credentials are missing, UPSERT is skipped and the script writes JSON files to disk.

## Run: Inspect Real Endpoints (RECOMMENDED)
Start by inspecting the remote endpoints without writing final database outputs:

```bash
python scripts/budget_pipeline/fetch_real_apbd.py --tahun 2026 --inspect --source apbd
```

This will:
- call the configured APBD endpoints
- save raw HTML/JSON payloads to `data/raw/...`
- log discovered endpoint URLs and extraction failures

For Dana Desa:

```bash
python scripts/budget_pipeline/fetch_real_apbd.py --tahun 2026 --inspect --source dana_desa
```

## Run: Generate Outputs (JSON files)
Once endpoints are known/working:

APBD only:
```bash
python scripts/budget_pipeline/fetch_real_apbd.py --tahun 2026 --source apbd --output data/budget/apbd/2026
```

Dana Desa only:
```bash
python scripts/budget_pipeline/fetch_real_apbd.py --tahun 2026 --source dana_desa --output data/budget/dana_desa/2026
```

## Run: Upsert to Supabase/Postgres
```bash
python scripts/budget_pipeline/fetch_real_apbd.py --tahun 2026 --source apbd --upsert
```

The UPSERT uses a natural unique key `(tahun_anggaran, wilayah, level)`.

## Frontend Integration: `data/apbd_daerah.json`
When APBD extraction succeeds for at least the Provinsi level, the pipeline can emit the current frontend format:

```bash
python scripts/budget_pipeline/fetch_real_apbd.py --tahun 2026 --source apbd --emit-frontend-json
```

This regenerates `data/apbd_daerah.json` by mapping extracted provinces into:
- `tahun_anggaran`
- `wilayah`
- `level`
- `total_pendapatan`
- `total_belanja`
- `defisit` (computed)
- `alokasi_sektor` (4 buckets)

## Notes on “Reverse Engineering”
Endpoints may require:
- pagination/IDs lists
- dynamic query parameters
- POST payloads discovered via captured network requests

The `--inspect` mode is intended for that workflow.

## Troubleshooting
- 403/Cloudflare: verify headers, increase delay, and re-run inspect.
- JSON parse failures: check raw captures under `data/raw/...`.
- Missing values: transformer requires fields that exist in the payload; inspect to update mapping rules.

## Disclaimer
This tool interacts with public government sites. Always respect their Terms of Service, robots.txt, and implement conservative request rates.

