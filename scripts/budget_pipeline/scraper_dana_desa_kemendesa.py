from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import requests


# NOTE:
# Real endpoint reverse-engineering is required.


SID_KEMENDESA = "https://sid.kemendesa.go.id/"


def fetch_dana_desa(
    session: requests.Session,
    tahun: int,
    *,
    inspect: bool,
    raw_dir: Path,
    error_log_path: Path,
) -> List[Dict[str, Any]]:
    # Placeholder structure only; no dummy data.
    if inspect:
        try:
            # capture homepage for reverse engineering
            session.get(SID_KEMENDESA, timeout=30)
        except Exception:
            pass
    return []

