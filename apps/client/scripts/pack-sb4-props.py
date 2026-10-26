import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "concept/tiles/sb4-battle"
OUTPUT = ROOT / "apps/client/public/sprites/sb4-battle"
PROPS = (
    ("clock", 2, (20, 30, 355, 385)),
    ("rolling-ball", 3, (390, 30, 715, 385)),
    ("forest-pit", 4, (720, 30, 1080, 390)),
    ("electric-fence", 5, (1090, 60, 1448, 390)),
    ("direction-panel", 6, (30, 390, 360, 700)),
    ("foliage", 7, (380, 390, 715, 700)),
    ("slots", 8, (720, 390, 1085, 700)),
    ("slot-switch", 8, (1090, 390, 1448, 700)),
    ("seesaw", 9, (0, 740, 390, 1050)),
    ("costume-mask", 10, (395, 700, 715, 1050)),
    ("trolley", 11, (720, 705, 1085, 1050)),
    ("flag", 12, (1090, 695, 1448, 1050)),
)


def main():
    path = ART / "props-source.png"
    source = Image.open(path).convert("RGBA")
    if source.size != (1448, 1086) or source.getchannel("A").getextrema() != (0, 255):
        raise ValueError("Expected the reviewed 1448x1086 transparent prop source")
    atlas = Image.new("RGBA", (128 * 12, 128))
    entries = []
    for index, (name, stage, box) in enumerate(PROPS):
        region = source.crop(box)
        bounds = region.getchannel("A").point(lambda alpha: 255 if alpha > 64 else 0).getbbox()
        if bounds is None:
            raise ValueError(f"Empty prop: {name}")
        left, top, right, bottom = bounds
        bounds = (max(0, left - 4), max(0, top - 4), min(region.width, right + 4), min(region.height, bottom + 4))
        prop = region.crop(bounds)
        size = (round(prop.width * 128 / 432), round(prop.height * 128 / 432))
        prop = prop.resize(size, Image.Resampling.LANCZOS)
        cell = Image.new("RGBA", (128, 128))
        cell.alpha_composite(prop, ((128 - size[0]) // 2, (128 - size[1]) // 2))
        cell.save(OUTPUT / f"prop-{name}.png", optimize=True)
        atlas.paste(cell, (index * 128, 0))
        entries.append({"name": name, "stage": stage, "cell": index, "sourceRegion": list(box), "occupiedSourceBounds": list(bounds), "anchor": [64, 64], "frames": 1, "runtime": "not-integrated"})
    atlas.save(OUTPUT / "props.png", optimize=True)
    manifest = {"cellSize": 128, "columns": 12, "rows": 1, "sourceSize": list(source.size), "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(), "scale": "128/432 shared by all props", "props": entries}
    (ART / "props-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("Packed 12 transparent static props; no gameplay or animation implied")


if __name__ == "__main__":
    main()
