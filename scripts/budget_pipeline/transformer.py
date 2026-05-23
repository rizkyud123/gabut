from typing import Any, Dict, List


REQUIRED_ALLOCATION_SECTORS = [
    "Pendidikan",
    "Kesehatan",
    "Infrastruktur",
    "Belanja Pegawai/Birokrasi",
]


def map_to_required_schema(extracted: Dict[str, Any]) -> Dict[str, Any]:
    """Map extracted raw fields into the dashboard JSON schema.

    `extracted` is expected to come from fetchers as:
    {
      tahun_anggaran, wilayah, level, parent_wilayah,
      pendapatan_total, belanja_total,
      sektor_nomalized: { sector_name: nominal }
    }

    If the portal provides more granular sectors, fetchers should aggregate into the 4 buckets.
    """
    tahun = int(extracted["tahun_anggaran"])
    wilayah = extracted["wilayah"]
    level = extracted["level"]
    parent = extracted.get("parent_wilayah")

    pendapatan_total = int(extracted.get("pendapatan_total", 0) or 0)
    belanja_total = int(extracted.get("belanja_total", 0) or 0)

    sektor_nom = extracted.get("sektor_nomalized", {}) or {}

    # Ensure numeric values
    sektor_nom_fixed = {k: int(v or 0) for k, v in sektor_nom.items()}

    # Build required buckets
    buckets = [
        {
            "nama_sektor": "Pendidikan",
            "anggaran_nominal": sektor_nom_fixed.get("Pendidikan", 0),
        },
        {
            "nama_sektor": "Kesehatan",
            "anggaran_nominal": sektor_nom_fixed.get("Kesehatan", 0),
        },
        {
            "nama_sektor": "Infrastruktur",
            "anggaran_nominal": sektor_nom_fixed.get("Infrastruktur", 0),
        },
        {
            "nama_sektor": "Belanja Pegawai/Birokrasi",
            "anggaran_nominal": sektor_nom_fixed.get("Belanja Pegawai/Birokrasi", 0),
        },
    ]

    # Add derived buckets: if total sectors do not sum to belanja_total, we still compute percentages
    # based on belanja_total (official total), not on sector sum.
    alloc = []
    for b in buckets:
        nominal = int(b["anggaran_nominal"])
        persentase = (nominal / belanja_total * 100.0) if belanja_total > 0 else 0.0
        alloc.append({
            "nama_sektor": b["nama_sektor"],
            "anggaran_nominal": nominal,
            "persentase": round(float(persentase), 3),
        })

    return {
        "tahun_anggaran": tahun,
        "wilayah": wilayah,
        "level": level,
        "parent_wilayah": parent,
        "total_pendapatan": pendapatan_total,
        "total_belanja": belanja_total,
        "alokasi_sektor": alloc,
    }


def provinces_to_frontend(provinces: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert required schema for app.js which expects an extra fields:
    - defisit
    - sector names/icons that app.js can render.

    app.js currently expects sector labels that differ slightly from required schema buckets.
    We'll map:
    - "Infrastruktur" -> "Infrastruktur & Fasilitas Umum"
    - "Belanja Pegawai/Birokrasi" -> "Belanja Pegawai (Gaji ASN/Dinas)"

    IMPORTANT: icons are not part of required JSON format.
    app.js uses icons from existing data. We provide icon keys for the frontend only.
    """
    ICON_MAP = {
        "Pendidikan": "graduation-cap",
        "Kesehatan": "heart-pulse",
        "Infrastruktur & Fasilitas Umum": "building-road",
        "Belanja Pegawai (Gaji ASN/Dinas)": "briefcase",
        "Lain-lain & Bansos": "hand-holding-heart",
    }

    out = []
    for p in provinces:
        defisit = int(p.get("total_belanja", 0) - p.get("total_pendapatan", 0))

        # Convert allocation sectors to the app's expected names (4-bucket + optional last)
        alloc_in = p.get("alokasi_sektor", []) or []
        alloc_map = {}
        for s in alloc_in:
            alloc_map[s.get("nama_sektor")] = s

        def rename_sector(name: str) -> str:
            if name == "Infrastruktur":
                return "Infrastruktur & Fasilitas Umum"
            if name == "Belanja Pegawai/Birokrasi":
                return "Belanja Pegawai (Gaji ASN/Dinas)"
            return name

        alloc_out = []
        for key in ["Pendidikan", "Kesehatan", "Infrastruktur", "Belanja Pegawai/Birokrasi"]:
            s = alloc_map.get(key)
            if not s:
                nominal = 0
                pct = 0.0
            else:
                nominal = int(s.get("anggaran_nominal", 0) or 0)
                pct = float(s.get("persentase", 0.0) or 0.0)
            renamed = rename_sector(key)
            alloc_out.append({
                "nama_sektor": renamed,
                "anggaran_nominal": nominal,
                "persentase": round(pct, 3),
                "icon": ICON_MAP.get(renamed),
            })

        # Compute residual bucket for "Lain-lain & Bansos" if belanja_total is higher than sum of known buckets.
        known_sum = sum(x["anggaran_nominal"] for x in alloc_out)
        total_belanja = int(p.get("total_belanja", 0) or 0)
        residual = max(0, total_belanja - known_sum)
        residual_pct = (residual / total_belanja * 100.0) if total_belanja > 0 else 0.0
        alloc_out.append({
            "nama_sektor": "Lain-lain & Bansos",
            "anggaran_nominal": residual,
            "persentase": round(float(residual_pct), 3),
            "icon": ICON_MAP.get("Lain-lain & Bansos"),
        })

        out.append({
            "tahun_anggaran": p.get("tahun_anggaran"),
            "wilayah": p.get("wilayah"),
            "level": p.get("level"),
            "total_pendapatan": int(p.get("total_pendapatan", 0) or 0),
            "total_belanja": total_belanja,
            "defisit": defisit,
            "alokasi_sektor": alloc_out,
        })

    return out

