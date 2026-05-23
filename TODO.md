# TODO — Budget data pipeline (APBD & Dana Desa)

## Step 1 — Repo scan & design
- [x] Reviewed existing repo files (frontend + placeholder data JSON)
- [x] Create scraping pipeline framework (modular fetchers + transformer + upsert)

## Step 2 — Scaffold production code
- [x] Add Python package under `scripts/budget_pipeline/`
- [x] Implement HTTP session + realistic headers + retry + 1–2s rate limit
- [x] Implement endpoint inspection mode (`--inspect`) that saves raw responses to `data/raw/`
- [x] Implement error logging to `error_log.json` per region/step

## Step 3 — Data mapping & outputs
- [x] Implement transformer that maps extracted fields into the required JSON schema
- [x] Implement file output to `data/budget/...`
- [x] Implement generation of `data/apbd_daerah.json` used by the frontend
- [ ] Implement real scraper logic in `scraper_apbd_djpk.py` (endpoint discovery required)
- [ ] Implement real scraper logic in `scraper_dana_desa_kemendesa.py` (endpoint discovery required)

## Step 4 — Supabase/PostgreSQL UPSERT
- [x] Add `--upsert` support using `.env` credentials
- [x] Implement streaming UPSERT (no duplicates) and idempotent unique key
- [x] Fix: include `defisit` field in upsert row

## Step 5 — Running & verification
- [x] Add full `README.md` with installation + usage examples
- [ ] Run in inspection mode first to discover real payloads (no dummy data)
  - Inspect run attempted: `data/runs/summary_2026_00e4b54d-56ab-4093-a353-d8051d6989be.json`
  - Result: `apbd: 0` — endpoint DJBK belum ditemukan, perlu reverse-engineering lebih lanjut

## Step 6 — Bug fixes (done)
- [x] Fix `app.js`: mutasi array `alokasi_sektor` di `buildLeaderboardCard` & `renderCompareResult`
- [x] Fix `app.js`: label Defisit/Surplus di modal detail (sebelumnya selalu "Defisit")
- [x] Fix `app.js`: `formatRupiah` label `M` → `Md` (Miliar) agar tidak ambigu dengan Juta
- [x] Fix `app.js`: `loadData` HTTP error handling (cek `response.ok`)
- [x] Fix `utils_money.py`: urutan check unit triliun (bug `"t"` terlalu broad)
- [x] Fix `db_upsert.py`: tambah field `defisit` di `_record_to_row`
- [x] Fix `style.css`: mobile compare panel layout (VS tetap tampil, padding benar)

## Next Steps
1. Jalankan `--inspect` dan analisis raw captures di `data/raw/` untuk menemukan endpoint DJBK/SIKD
2. Implementasi `scraper_apbd_djpk.py` berdasarkan payload real
3. Implementasi `scraper_dana_desa_kemendesa.py` berdasarkan payload real
4. Buat `.env` dari template di README untuk konfigurasi Supabase
5. Test `--emit-frontend-json` setelah data real masuk
