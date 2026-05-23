from __future__ import annotations

import os
from typing import Any, Dict, Iterable, List

import requests


def upsert_records(records: List[Dict[str, Any]]):
    """UPSERT records into Supabase/Postgres.

    Requires:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY

    Expected table name (configurable later):
    - `budget_allocations`

    Unique key:
    - (tahun_anggaran, wilayah, level)

    The actual database schema/table/columns must match the payload keys.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("UPSERT skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return

    # Supabase REST endpoint
    table = os.getenv("SUPABASE_TABLE", "budget_allocations")
    upsert_url = f"{url}/rest/v1/{table}"

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    # Stream in batches
    batch_size = int(os.getenv("UPSERT_BATCH_SIZE", "200"))

    for i in range(0, len(records), batch_size):
        chunk = records[i:i+batch_size]
        payload = []
        for r in chunk:
            payload.append(_record_to_row(r))

        resp = requests.post(upsert_url, headers=headers, json=payload, timeout=60)
        if resp.status_code >= 400:
            raise RuntimeError(f"UPSERT failed: {resp.status_code} {resp.text[:500]}")


def _record_to_row(r: Dict[str, Any]) -> Dict[str, Any]:
    # The transformer schema matches DB columns if you create them with same names.
    # We'll flatten alokasi_sektor into JSONB column.
    total_pendapatan = r.get("total_pendapatan") or 0
    total_belanja = r.get("total_belanja") or 0
    # Compute defisit if not already present (positive = deficit, negative = surplus)
    defisit = r.get("defisit", total_belanja - total_pendapatan)
    return {
        "tahun_anggaran": r.get("tahun_anggaran"),
        "wilayah": r.get("wilayah"),
        "level": r.get("level"),
        "parent_wilayah": r.get("parent_wilayah"),
        "total_pendapatan": total_pendapatan,
        "total_belanja": total_belanja,
        "defisit": defisit,
        "alokasi_sektor": r.get("alokasi_sektor"),
    }

