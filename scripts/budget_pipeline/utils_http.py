import json
import os
import random
import time
from pathlib import Path
from typing import Any, Dict, Optional

import requests


DEFAULT_HEADERS = [
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.7,en;q=0.5",
        "Connection": "keep-alive",
    },
    {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.7,en;q=0.5",
        "Connection": "keep-alive",
    },
]


def setup_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(random.choice(DEFAULT_HEADERS))
    return s


def request_text(
    session: requests.Session,
    url: str,
    *,
    method: str = "GET",
    params: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None,
    json_body: Optional[Dict[str, Any]] = None,
    timeout: int = None,
    raw_capture_dir: Optional[Path] = None,
    error_log_path: Optional[Path] = None,
    extra_headers: Optional[Dict[str, str]] = None,
    rate_limit_sec: Optional[float] = None,
    max_retries: Optional[int] = None,
) -> str:
    timeout = timeout or int(os.getenv("TIMEOUT_SEC", "30"))
    max_retries = max_retries if max_retries is not None else int(os.getenv("MAX_RETRIES", "4"))
    rate_limit_sec = rate_limit_sec if rate_limit_sec is not None else float(os.getenv("REQUEST_DELAY_SEC", "1.5"))

    headers = {}
    if extra_headers:
        headers.update(extra_headers)

    last_exc = None
    for attempt in range(max_retries + 1):
        try:
            # Respect simple rate limit
            if attempt > 0 or rate_limit_sec > 0:
                time.sleep(rate_limit_sec)

            resp = session.request(
                method=method,
                url=url,
                params=params,
                data=data,
                json=json_body,
                headers=headers if headers else None,
                timeout=timeout,
            )

            # Capture raw
            if raw_capture_dir is not None:
                raw_capture_dir.mkdir(parents=True, exist_ok=True)
                snap_path = raw_capture_dir / f"{_safe_filename(url)}_attempt{attempt}.json"
                snap = {
                    "url": url,
                    "status": resp.status_code,
                    "headers": dict(resp.headers),
                    "text": resp.text[:5_000_000],
                }
                snap_path.write_text(json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")

            resp.raise_for_status()
            return resp.text

        except requests.HTTPError as e:
            # log 404/403 etc
            if error_log_path is not None:
                _append_error(error_log_path, {
                    "ts": _now_iso(),
                    "url": url,
                    "status": getattr(e.response, "status_code", None),
                    "stage": "http",
                    "attempt": attempt,
                    "error": str(e),
                })
            last_exc = e
            if getattr(e.response, "status_code", None) in (404, 410):
                raise
        except Exception as e:
            last_exc = e
            if attempt >= max_retries:
                break

    if last_exc:
        raise last_exc
    raise RuntimeError("Request failed unexpectedly")


def request_json(
    session: requests.Session,
    url: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None,
    json_body: Optional[Dict[str, Any]] = None,
    timeout: int = None,
    raw_capture_dir: Optional[Path] = None,
    error_log_path: Optional[Path] = None,
    extra_headers: Optional[Dict[str, str]] = None,
    rate_limit_sec: Optional[float] = None,
    max_retries: Optional[int] = None,
) -> Any:
    text = request_text(
        session,
        url,
        method="POST" if json_body is not None or data is not None else "GET",
        params=params,
        data=data,
        json_body=json_body,
        timeout=timeout,
        raw_capture_dir=raw_capture_dir,
        error_log_path=error_log_path,
        extra_headers=extra_headers,
        rate_limit_sec=rate_limit_sec,
        max_retries=max_retries,
    )
    return json.loads(text)


def _safe_filename(url: str) -> str:
    return url.replace("https://", "").replace("http://", "").replace("/", "_").replace("?", "_").replace("&", "_")


def _now_iso() -> str:
    from datetime import datetime
    return datetime.utcnow().isoformat() + "Z"


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

