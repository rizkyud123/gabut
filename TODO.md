# TODO — Budget data pipeline (APBD & Dana Desa)

## Step 1 — Repo scan & design
- [x] Reviewed existing repo files (frontend + placeholder data JSON)
- [ ] Create scraping pipeline framework (modular fetchers + transformer + upsert)

## Step 2 — Scaffold production code
- [ ] Add Python package under `scripts/budget_pipeline/`
- [ ] Implement HTTP session + realistic headers + retry + 1–2s rate limit
- [ ] Implement endpoint inspection mode (`--inspect`) that saves raw responses to `data/raw/`
- [ ] Implement error logging to `error_log.json` per region/step

## Step 3 — Data mapping & outputs
- [ ] Implement transformer that maps extracted fields into the required JSON schema
- [ ] Implement file output to `data/budget/...`
- [ ] Implement generation of `data/apbd_daerah.json` used by the frontend

## Step 4 — Supabase/PostgreSQL UPSERT
- [ ] Add `--upsert` support using `.env` credentials
- [ ] Implement streaming UPSERT (no duplicates) and idempotent unique key

## Step 5 — Running & verification
- [ ] Add full `README.md` with installation + usage examples
- [ ] Run in inspection mode first to discover real payloads (no dummy data)

