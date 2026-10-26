"""Create lightweight, responsive copies of the current public unit photos.

No original photographs or private data are persisted.  The manifest retains
the exact source URL, allowing the UI to fall back when a unit changes photo.
Run with the bundled Python runtime, which already provides Pillow.
"""

import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageOps


API_URL = "https://upa-tempo-guaruja.vercel.app/atendimento"
OUT = Path(__file__).resolve().parents[1] / "frontend" / "images"
VARIANTS = ((480, 50_000), (960, 130_000))


def fetch(url):
    request = Request(url, headers={"User-Agent": "SaudeEmTempoReal-PhotoOptimization/1.0"})
    with urlopen(request, timeout=45) as response:
        return response.read()


def encode(image, max_bytes):
    # Photographs look good at this quality, with no extra decoding dependency.
    for quality in (78, 74, 70, 66, 62, 58):
        buffer = io.BytesIO()
        image.save(buffer, "WEBP", quality=quality, method=6)
        data = buffer.getvalue()
        if len(data) <= max_bytes:
            return data
    return data


def main():
    units = json.loads(fetch(API_URL))
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    failures = []
    for unit in units:
        try:
            source_url = unit.get("foto")
            if not source_url:
                continue
            source_data = fetch(source_url)
            with Image.open(io.BytesIO(source_data)) as source:
                image = ImageOps.exif_transpose(source).convert("RGB")
            item = {
                "id": unit["_id"],
                "name": unit.get("upa", ""),
                "originalURL": source_url,
                "original": {
                    "width": image.width,
                    "height": image.height,
                    "bytes": len(source_data),
                },
                "variants": [],
            }
            for target_width, max_bytes in VARIANTS:
                width = min(target_width, image.width)
                height = round(image.height * width / image.width)
                resized = image.resize((width, height), Image.Resampling.LANCZOS)
                data = encode(resized, max_bytes)
                filename = f"unit-{unit['_id']}-{target_width}.webp"
                (OUT / filename).write_bytes(data)
                item["variants"].append({
                    "width": width,
                    "height": height,
                    "bytes": len(data),
                    "file": filename,
                    "url": f"/images/{filename}",
                })
            manifest.append(item)
        except Exception as error:
            failures.append({"id": unit.get("_id"), "error": str(error)})

    (OUT / "units.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    totals = {
        "units": len(manifest),
        "originalBytes": sum(item["original"]["bytes"] for item in manifest),
        "smallBytes": sum(item["variants"][0]["bytes"] for item in manifest),
        "largeBytes": sum(item["variants"][1]["bytes"] for item in manifest),
        "failures": failures,
    }
    print(json.dumps(totals, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
