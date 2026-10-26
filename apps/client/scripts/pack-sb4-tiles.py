import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "concept/tiles/sb4-battle"
OUTPUT = ROOT / "apps/client/public/sprites/sb4-battle"
SIZE = 128
SOURCE_ROWS = (0, 120, 238, 354, 474, 589, 707, 825, 944, 1061, 1182, 1299, 1448)
NAMES = (
    "Usual", "Fast 'n Slow", "Rolling Sugedama", "Push and Fall",
    "Numb Bomb", "Surprise Floor", "Hide and Blow Seek", "Spinny Slots",
    "Seesaw", "Costume/Cosplay", "Trolley", "Flag Tag",
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_cell(source, column, row):
    if column == 6 and row in (7, 9):
        row = 16 - row
    left = round(column * source.width / 9) + 2
    top = SOURCE_ROWS[row] + 4
    right = round((column + 1) * source.width / 9) - 2
    bottom = SOURCE_ROWS[row + 1] - 4
    return source.crop((left, top, right, bottom)).resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def burn_cells(block, overlays, standard):
    current = block.copy()
    frames = []
    for index, dimensions in enumerate(((128, 128), (126, 123), (122, 116))):
        side = overlays.height
        overlay = overlays.crop((index * side, 0, (index + 1) * side, side))
        overlay = overlay.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        overlay.paste((0, 0, 0, 0), (0, 0, SIZE, SIZE // 4))
        current.alpha_composite(overlay)
        frame = Image.new("RGBA", (SIZE, SIZE))
        width, height = dimensions
        frame.alpha_composite(current.resize(dimensions, Image.Resampling.LANCZOS), ((SIZE - width) // 2, SIZE - height))
        frames.append(frame)
    frames.extend(standard.crop((index * SIZE, 0, (index + 1) * SIZE, SIZE)) for index in (12, 13, 14))
    return frames


def sample(cells):
    image = Image.new("RGBA", (15 * 32, 13 * 32))
    small = [cell.resize((32, 32), Image.Resampling.LANCZOS) for cell in cells]
    for y in range(13):
        for x in range(15):
            if x in (0, 14) or y in (0, 12):
                index = 8
            elif x % 2 == 0 and y % 2 == 0:
                index = 7
            elif (x * 5 + y * 7) % 4 == 0 and (x, y) not in ((1, 1), (13, 11)):
                index = 6
            else:
                index = (0 if (x + y) % 2 == 0 else 3) + ((x * 11 + y * 5) % 3)
            image.paste(small[index], (x * 32, y * 32))
    return image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?", type=Path, default=ART / "tiles-source.png")
    args = parser.parse_args()
    source = Image.open(args.source).convert("RGBA")
    if source.size != (1086, 1448):
        raise ValueError("Expected the measured 1086x1448 nine-column, twelve-row source")
    overlay_path = ROOT / "concept/tiles/block-ignition-overlays.png"
    standard_path = OUTPUT.parent / "tiles.png"
    overlays = Image.open(overlay_path).convert("RGBA")
    standard = Image.open(standard_path).convert("RGBA")
    if overlays.width != overlays.height * 3 or standard.size != (1920, 128):
        raise ValueError("Unexpected standard destruction source dimensions")
    ART.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    contact = Image.new("RGBA", (480 * 4, 416 * 3))
    entries = []
    for row, name in enumerate(NAMES):
        cells = [source_cell(source, column, row) for column in range(9)]
        cells.extend(burn_cells(cells[6], overlays, standard))
        atlas = Image.new("RGBA", (SIZE * 15, SIZE))
        for index, cell in enumerate(cells):
            atlas.paste(cell, (index * SIZE, 0))
        path = OUTPUT / f"tiles-{row + 1:02}.png"
        atlas.save(path, optimize=True)
        preview = sample(cells)
        preview.save(OUTPUT / f"art-preview-{row + 1:02}.png", optimize=True)
        contact.paste(preview, ((row % 4) * 480, (row // 4) * 416))
        entries.append({"number": row + 1, "name": name, "file": path.name, "sha256": digest(path)})
    contact.save(ART / "materials-preview.png", optimize=True)
    manifest = {
        "cellSize": SIZE, "columns": 15, "rows": 1,
        "source": {"file": "tiles-source.png", "sha256": digest(args.source), "size": list(source.size), "grid": [9, 12], "rowBoundaries": list(SOURCE_ROWS), "cropInset": {"x": 2, "y": 4}, "blockCellRemap": {"8": 10, "10": 8}},
        "cells": {"floorA": [0, 1, 2], "floorB": [3, 4, 5], "block": 6, "pillar": 7, "border": 8, "burn": [9, 10, 11, 12, 13, 14]},
        "destruction": {"early": "stage block plus existing flame overlays, progressively compressed at the floor baseline", "late": "three shared standard rubble/ember/ash cells", "overlaySha256": digest(overlay_path), "standardSha256": digest(standard_path)},
        "previews": "Material samples on a shared demonstration grid; not original stage layouts or gameplay validation",
        "stages": entries,
    }
    (ART / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Packed {len(entries)} atlases at 1920x128, 12 material previews and source manifest")


if __name__ == "__main__":
    main()
