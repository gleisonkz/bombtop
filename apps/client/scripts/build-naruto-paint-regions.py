"""Build iris-only protection from reviewed eye windows in the production atlas.

Run: python -B apps/client/scripts/build-naruto-paint-regions.py [--check]
The windows were measured from every occupied cell, including the lobby row.
Back views, blinks, stun and death poses have no exposed blue irises. Windows
exclude the headband above the eyes and the raised sleeves beside side-view eyes.
Only dyeable source pixels inside those windows become horizontal one-pixel-high
regions; no clothing or source artwork is generated or modified.
"""
import argparse
import colorsys
import hashlib
import json
from pathlib import Path

from PIL import Image


CLIENT = Path(__file__).resolve().parents[1]
SOURCE = CLIENT / "public/sprites/naruto.png"
OUTPUT = CLIENT / "src/render/naruto-paint-regions.json"
FW, FH = 96, 128
MEASURED_SOURCE_SHA256 = "1d5e51ad3019100ecac1e486753a855789bb28bb6131d2f7ba609e87409fc22f"
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)

# Local, half-open eye windows. None denotes an occupied blink/closed-eye cell.
# Rows absent here are back views or closed-eye reactions; they stay repaintable.
EYES = {
    0: [(37, 49, 59, 56), (37, 49, 59, 56), None, (38, 49, 60, 56)],
    1: [(54, 52, 64, 59), (54, 52, 64, 59), None, (53, 52, 63, 59)],
    3: [(36, 48, 59, 55), (35, 47, 57, 55), (35, 47, 57, 55),
        (35, 47, 57, 55), (38, 48, 60, 55), (40, 48, 61, 55)],
    4: [(55, 50, 64, 58), (54, 50, 64, 58), (56, 50, 66, 58),
        (57, 51, 66, 58), (54, 50, 63, 58), (53, 50, 63, 58)],
    8: [(36, 52, 59, 61), (32, 53, 54, 61), (34, 52, 57, 61),
        (37, 53, 60, 61), (36, 53, 58, 61), (42, 54, 65, 62),
        (38, 53, 62, 62), (37, 53, 61, 62), (36, 52, 60, 61)],
    9: [(69, 59, 78, 66), (72, 59, 80, 66), (73, 60, 81, 67),
        (74, 60, 82, 67), (70, 59, 78, 66), (67, 59, 75, 66),
        (67, 59, 76, 66), (67, 59, 75, 66), (63, 60, 72, 67)],
    11: [(36, 50, 60, 58), (36, 50, 60, 58), None, (36, 50, 60, 58)],
    12: [(56, 55, 65, 63), (56, 53, 65, 61), None, (56, 53, 65, 61)],
    14: [(41, 48, 65, 56), (38, 49, 62, 57), (37, 48, 61, 56),
         (39, 49, 61, 56), (40, 48, 62, 55), (40, 49, 63, 57)],
    15: [(54, 51, 63, 59), (56, 50, 65, 58), (55, 51, 65, 59),
         (55, 51, 65, 59), (54, 50, 64, 58), (53, 51, 63, 59)],
    17: [(38, 48, 59, 55), (39, 47, 60, 55), None, None, None, None,
         (37, 47, 58, 55), (39, 48, 60, 55)],
}


def dyeable(rgba):
    if rgba[3] == 0:
        return False
    hue, _, saturation = colorsys.rgb_to_hls(*(v / 255 for v in rgba[:3]))
    return saturation >= .2 and 205 <= hue * 360 <= 232


def eye_regions(frame, window):
    if window is None:
        return []
    left, top, right, bottom = window
    regions = []
    for y in range(top, bottom):
        start = None
        for x in range(left, right + 1):
            selected = x < right and dyeable(frame.getpixel((x, y)))
            if selected and start is None:
                start = x
            elif not selected and start is not None:
                regions.append(dict(left=start, top=y, right=x, bottom=y + 1))
                start = None
    if not regions:
        raise ValueError(f"Measured open-eye window has no dyeable pixels: {window}")
    return regions


def generate():
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if source_hash != MEASURED_SOURCE_SHA256:
        raise ValueError("Naruto source changed; remeasure eyes before accepting the new source hash")
    with Image.open(SOURCE) as image:
        image = image.convert("RGBA")
        if image.size != (FW * 9, FH * len(COUNTS)):
            raise ValueError("Naruto atlas geometry changed; review the eye windows")
        rows = []
        for row, count in enumerate(COUNTS):
            windows = EYES.get(row, [None] * count)
            if len(windows) != count:
                raise ValueError(f"Eye window count does not match row {row}")
            cells = []
            for column in range(9):
                frame = image.crop((column * FW, row * FH, (column + 1) * FW, (row + 1) * FH))
                if bool(frame.getchannel("A").getbbox()) != (column < count):
                    raise ValueError(f"Unexpected occupied Naruto cell {row}/{column}")
                cells.append(eye_regions(frame, windows[column]) if column < count else None)
            rows.append(cells)
    return dict(sourceSha256=source_hash,
                frameW=FW, frameH=FH, rows=rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result = generate()
    if args.check:
        if json.loads(OUTPUT.read_text(encoding="utf-8")) != result:
            raise SystemExit("Naruto eye regions are stale; review and regenerate after changing the atlas")
        print("Naruto eye regions match the production atlas")
    else:
        OUTPUT.write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"Wrote {OUTPUT}")
