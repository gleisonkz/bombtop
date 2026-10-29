"""Pack the approved FX pixels only. Run with Python + Pillow from any directory."""
import hashlib
import json
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[3]
DIRECTORY = ROOT / "concept/optimus/special-fx"
SOURCE = DIRECTORY / "optimus-effects-concept-v1.png"
OUTPUT = ROOT / "apps/client/public/sprites/optimus-effects-pixel-v1.png"
# Measured separators lie in transparent gaps, not the nominal 362px grid.
ROWS = (
    ("dust", (0, 380), (0, 360, 700, 1100, 1448)),
    ("speed", (380, 680), (0, 383, 729, 1117, 1448)),
    ("shift", (680, 1086), (0, 350, 720, 1100, 1448)),
)
THRESHOLD = 128
CELL = 64
GUTTER = 2


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pack():
    source = Image.open(SOURCE)
    if source.mode != "RGBA" or source.size != (1448, 1086):
        raise ValueError("Approved source must remain 1448x1086 RGBA")
    alpha = source.getchannel("A")
    histogram = Counter(alpha.getdata())
    clean = source.copy()
    clean.putalpha(alpha.point(lambda value: 255 if value >= THRESHOLD else 0))
    atlas = Image.new("RGBA", (256, 192))
    report = {
        "source": str(SOURCE.relative_to(ROOT)), "source_sha256": digest(SOURCE),
        "source_dimensions": list(source.size), "source_mode": source.mode,
        "source_alpha_histogram": dict(sorted(histogram.items())),
        "alpha_policy": "Original RGB unchanged; alpha >=128 becomes 255, otherwise 0. No compositing, redraw or component filtering.",
        "pillow_version": pillow_version, "cell": [64, 64], "grid": [4, 3],
        "minimum_gutter": GUTTER, "resampling": "NEAREST",
        "rows": [],
    }
    retained = 0
    for row_index, (name, (top, bottom), splits) in enumerate(ROWS):
        frames = []
        for left, right in zip(splits, splits[1:]):
            window = (left, top, right, bottom)
            local = clean.crop(window).getchannel("A").getbbox()
            if local is None:
                raise ValueError(f"Empty frame in {name}")
            bounds = (left + local[0], top + local[1], left + local[2], top + local[3])
            retained += clean.crop(window).getchannel("A").histogram()[255]
            frames.append((window, bounds))
        width = max(b[2] - b[0] for _, b in frames)
        row_top = min(b[1] for _, b in frames)
        baseline = max(b[3] for _, b in frames)
        height = baseline - row_top if name != "shift" else max(b[3] - b[1] for _, b in frames)
        scale = min(60 / width, 60 / height)
        target = (round(width * scale), round(height * scale))
        destination = ((CELL - target[0]) // 2,
                       (CELL - target[1]) // 2 if name == "shift" else 62 - target[1])
        row_report = {"name": name, "scale": scale,
                      "source_canvas": [width, height], "resized_canvas": list(target),
                      "effective_scale_xy": [target[0] / width, target[1] / height],
                      "anchor": [32, 32] if name == "shift" else [32, 62],
                      "anchor_convention": "canvas center" if name == "shift" else "bottom-exclusive baseline, horizontal canvas center",
                      "source_baseline_exclusive": None if name == "shift" else baseline,
                      "frames": []}
        for column, (window, bounds) in enumerate(frames):
            # Pad to a common source canvas BEFORE resizing: one transform per row.
            # Keep every disconnected fleck; never select only the largest component.
            tile = Image.new("RGBA", (width, height))
            art = clean.crop(bounds)
            x = (width - art.width) // 2
            y = (height - art.height) // 2 if name == "shift" else bounds[1] - row_top
            tile.paste(art, (x, y))
            tile = tile.resize(target, Image.Resampling.NEAREST)
            cell = Image.new("RGBA", (CELL, CELL))
            cell.paste(tile, destination)
            occupied = cell.getchannel("A").getbbox()
            if occupied is None or min(occupied[0], occupied[1], CELL - occupied[2], CELL - occupied[3]) < GUTTER:
                raise ValueError(f"Empty or clipped {name} frame {column + 1}")
            atlas.paste(cell, (column * CELL, row_index * CELL))
            row_report["frames"].append({"frame": column + 1, "source_window": window,
                                         "source_bounds": bounds, "source_offset": [x, y],
                                         "packed_bounds": occupied,
                                         "packed_opaque_pixels": cell.getchannel("A").histogram()[255]})
        report["rows"].append(row_report)
    if retained != clean.getchannel("A").histogram()[255]:
        raise ValueError("Source windows lost or duplicated cleaned pixels")
    if set(atlas.getchannel("A").getdata()) != {0, 255}:
        raise ValueError("Atlas alpha must be binary")
    atlas.save(OUTPUT)
    report["output_sha256"] = digest(OUTPUT)
    report["clean_source_opaque_pixels"] = retained
    # QA background/grid exists only in the contact, never in the runtime atlas.
    contact = Image.new("RGB", (256, 192))
    draw = ImageDraw.Draw(contact)
    for y in range(0, 192, 8):
        for x in range(0, 256, 8):
            shade = 46 if (x // 8 + y // 8) % 2 else 64
            draw.rectangle((x, y, x + 7, y + 7), fill=(shade,) * 3)
    contact.paste(atlas, (0, 0), atlas)
    draw = ImageDraw.Draw(contact)
    for x in range(0, 256, 64):
        draw.line((x, 0, x, 191), fill=(100, 100, 100))
    for y in range(0, 192, 64):
        draw.line((0, y, 255, y), fill=(100, 100, 100))
    contact.resize((1024, 768), Image.Resampling.NEAREST).save(DIRECTORY / "optimus-effects-packing-contact.png")
    (DIRECTORY / "optimus-effects-packing-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT.relative_to(ROOT)), "sha256": report["output_sha256"],
                      "rows": [{"name": row["name"], "scale": row["scale"], "anchor": row["anchor"]} for row in report["rows"]]}, indent=2))


if __name__ == "__main__":
    pack()
