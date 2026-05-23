from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import requests

from transformer import map_to_required_schema
from utils_http import request_text
from utils_money import parse_rupiah_to_int


# NOTE:
# Endpoint reverse-engineering is required for real data.
# This module currently provides the structure, parsing helpers, and inspect capture hooks.
# You must update BASE_ENDPOINTS and extractors once the real payloads are discovered.


DJBK_BASE = "https://djbk.kemenkeu.go.id/"


def fetch_apbd(
    session: requests.Session,
    tahun: int,
    *,
    inspect: bool,
    raw_dir: Path,
    error_log_path: Path,
    limit_provinces: int = 0,
) -> List[Dict[str, Any]]:
    """Fetch APBD real data for Provinces + Kabupaten/Kota.

    Returns: list of records mapped to required schema.
    """
    # TODO: implement endpoint discovery for provinces and regencies/kota
    # For now, returns empty list because real endpoint mapping isn't known yet.
    # inspect mode will capture raw responses once BASE_ENDPOINTS are configured.

    # Example placeholders for capturing homepage HTML.
    if inspect:
        try:
            html = request_text(
                session,
                DJBK_BASE,
                raw_capture_dir=raw_dir / "smoke" / "home",
                error_log_path=error_log_path,
            )
        except Exception:
            pass

    # No dummy data.
    return []

