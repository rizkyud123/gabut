#!/usr/bin/env python3
import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path
from datetime import datetime

try:
    from dotenv import load_dotenv  # type: ignore
except Exception:  # pragma: no cover
    def load_dotenv(*args, **kwargs):
        return False

from transformer import provinces_to_frontend
from scraper_apbd_djpk import fetch_apbd
from scraper_dana_desa_kemendesa import fetch_dana_desa
from db_upsert import upsert_records
from utils_http import setup_session


def parse_args():
    p = argparse.ArgumentParser(description="Fetch real APBD & Dana Desa data and normalize to dashboard JSON schema.")
    p.add_argument("--tahun", type=int, required=True, help="Anggaran tahun (e.g. 2025/2026)")
    p.add_argument("--source", choices=["apbd", "dana_desa", "both"], default="both")
    p.add_argument("--inspect", action="store_true", help="Save raw responses for reverse engineering. No final upsert.")
    p.add_argument("--output", type=str, default=None, help="Base output directory for JSON files")
    p.add_argument("--upsert", action="store_true", help="Upsert into Supabase/Postgres (requires .env)")
    p.add_argument("--emit-frontend-json", action="store_true", help="Regenerate data/apbd_daerah.json for the frontend")
    p.add_argument("--limit-provinces", type=int, default=0, help="Debug: limit number of provinces processed")
    return p.parse_args()


def main():
    load_dotenv()

    args = parse_args()
    run_id = os.getenv("RUN_ID") or str(uuid.uuid4())

    data_dir = Path(os.getenv("DATA_DIR", "data"))
    raw_dir = Path(os.getenv("RAW_DIR", data_dir / "raw"))
    error_log_path = Path(os.getenv("ERROR_LOG", "error_log.json"))

    # Output base directories
    tahun = args.tahun
    output_base = Path(args.output) if args.output else (data_dir / "budget" / ("apbd" if args.source == "apbd" else "dana_desa" if args.source == "dana_desa" else "apbd") / str(tahun))

    session = setup_session()

    records = []
    summary = {
        "run_id": run_id,
        "started_at": datetime.utcnow().isoformat() + "Z",
        "tahun": tahun,
        "source": args.source,
        "inspect": args.inspect,
        "results": {},
    }

    try:
        if args.source in ("apbd", "both"):
            apbd_records = fetch_apbd(
                session=session,
                tahun=tahun,
                inspect=args.inspect,
                raw_dir=raw_dir / "apbd" / str(tahun) / run_id,
                error_log_path=error_log_path,
                limit_provinces=args.limit_provinces,
            )
            records.extend(apbd_records)
            summary["results"]["apbd"] = len(apbd_records)

        if args.source in ("dana_desa", "both"):
            dd_records = fetch_dana_desa(
                session=session,
                tahun=tahun,
                inspect=args.inspect,
                raw_dir=raw_dir / "dana_desa" / str(tahun) / run_id,
                error_log_path=error_log_path,
            )
            records.extend(dd_records)
            summary["results"]["dana_desa"] = len(dd_records)

        # In inspect mode, don't write final outputs / upsert
        if args.inspect:
            (data_dir / "runs").mkdir(parents=True, exist_ok=True)
            with open(data_dir / "runs" / f"summary_{tahun}_{run_id}.json", "w", encoding="utf-8") as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
            print(f"Inspect completed. Raw payloads in: {raw_dir / '...'}")
            return

        # Write JSON outputs
        if args.source in ("apbd", "both"):
            out_apbd = data_dir / "budget" / "apbd" / str(tahun)
            out_apbd.mkdir(parents=True, exist_ok=True)
            apbd_only = [r for r in records if r.get("level") in ("Provinsi", "Kabupaten", "Kota")]
            _write_records_by_file(apbd_only, out_apbd)

        if args.source in ("dana_desa", "both"):
            out_dd = data_dir / "budget" / "dana_desa" / str(tahun)
            out_dd.mkdir(parents=True, exist_ok=True)
            dd_only = [r for r in records if r.get("level") == "Desa"]
            _write_records_by_file(dd_only, out_dd)

        # Optional upsert
        if args.upsert:
            upsert_records(records)

        # Optional frontend JSON emission
        if args.emit_frontend_json:
            prov = [r for r in records if r.get("level") == "Provinsi"]
            frontend = provinces_to_frontend(prov)
            out_frontend = Path("data/apbd_daerah.json")
            out_frontend.parent.mkdir(parents=True, exist_ok=True)
            out_frontend.write_text(json.dumps(frontend, ensure_ascii=False, indent=2), encoding="utf-8")

        summary["ended_at"] = datetime.utcnow().isoformat() + "Z"
        (data_dir / "runs").mkdir(parents=True, exist_ok=True)
        with open(data_dir / "runs" / f"summary_{tahun}_{run_id}.json", "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

    except KeyboardInterrupt:
        print("Interrupted.")
    except Exception as e:
        # log to error_log.json as pipeline error
        _append_error(error_log_path, {
            "ts": datetime.utcnow().isoformat() + "Z",
            "stage": "pipeline",
            "error": str(e),
            "run_id": run_id,
        })
        raise


def _write_records_by_file(records, out_dir: Path):
    # Write chunked files: one file per 500 records
    chunk_size = 500
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i+chunk_size]
        name = f"records_{i//chunk_size:04d}_{min(i+chunk_size, len(records))}.json"
        (out_dir / name).write_text(json.dumps(chunk, ensure_ascii=False, indent=2), encoding="utf-8")


def _append_error(path: Path, entry: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(data, list):
                data = [data]
        except Exception:
            data = []
    else:
        data = []
    data.append(entry)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

