import re
from typing import Optional


def parse_rupiah_to_int(val: Optional[str]) -> int:
    """Parse Indonesian money strings into integer IDR.

    Examples:
    - "Rp 1,2 Milyar" -> 1200000000
    - "1.234.567" -> 1234567
    - "Rp1.234.567,89" -> 1234567 (drops decimals)
    - ""/None -> 0

    Notes:
    - This does NOT invent missing data.
    - Unit multipliers are best-effort.
    """
    if val is None:
        return 0
    s = str(val).strip()
    if not s:
        return 0

    s = s.replace("Rp", "").replace("IDR", "")

    # Normalize separators: keep digits, separators, and unit words.
    s = s.replace("\u00a0", " ")

    multiplier = 1
    lower = s.lower()

    def has_unit(*keywords: str) -> bool:
        return any(k in lower for k in keywords)

    # Order matters: check longer/more-specific units first to avoid false matches.
    # "t" alone is too broad (matches any word with 't'), so we only use explicit "triliun".
    if has_unit("triliun"):
        multiplier = 1_000_000_000_000
    elif has_unit("miliar", "milyar"):
        multiplier = 1_000_000_000
    elif has_unit("juta"):
        multiplier = 1_000_000
    elif has_unit("ribu"):
        multiplier = 1_000

    # Extract number part
    # Handle "1.2" or "1,2" as decimal; we will drop decimals.
    # Strategy: remove unit words, then take digits and separators.
    s_num = re.sub(r"[^0-9,\.]", "", s)
    if not s_num:
        return 0

    # If both '.' and ',' exist, assume '.' are thousand separators and ',' decimal.
    if "," in s_num and "." in s_num:
        if s_num.rfind(",") > s_num.rfind("."):
            # thousand '.' then decimal ','
            s_num = s_num.replace(".", "").replace(",", "")
        else:
            # thousand ',' then decimal '.'
            s_num = s_num.replace(",", "").replace(".", "")
    else:
        # Only one kind of separator: treat as thousand separator if multiple occurrences,
        # else as decimal and drop decimals.
        if "," in s_num:
            parts = s_num.split(",")
            if len(parts) > 2:
                s_num = "".join(parts)
            else:
                s_num = parts[0]  # drop decimal
        if "." in s_num:
            parts = s_num.split(".")
            if len(parts) > 2:
                s_num = "".join(parts)
            else:
                s_num = parts[0]

    digits = re.sub(r"\D", "", s_num)
    if not digits:
        return 0
    return int(digits) * multiplier

