"""Validate the frozen Bugs candidate atlas; accepts an optional candidate path.

Structural checks cannot establish visual identity or animation quality. Drawing
uniqueness ignores translation and invisible RGB, but does not detect recolors.
"""
import argparse
import hashlib
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
CONCEPT = ROOT / "concept/bugs/pixellab-preview/option-1.png"
DEFAULT_CANDIDATE = ROOT / "concept/bugs/pixellab-redraw/bugs-candidate.png"
CELL = 192
COLUMNS = 9
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)
NAMES = (
    "idle.down", "idle.side", "idle.up",
    "walk.down", "walk.side", "walk.up", "stun", "death",
    "cast.down", "cast.side", "cast.up",
    "carryIdle.down", "carryIdle.side", "carryIdle.up",
    "carryWalk.down", "carryWalk.side", "carryWalk.up", "lobby",
)
MIN_DISTINCT = (2, 2, 2, 4, 4, 4, 4, 5, 4, 4, 4, 2, 2, 2, 4, 4, 4, 6)


def drawing_key(cell, bounds):
    """Hash visible pixels at their native size, independent of cell offset."""
    drawing = cell.crop(bounds)
    drawing.putdata([
        pixel if pixel[3] else (0, 0, 0, 0)
        for pixel in drawing.getdata()
    ])
    return drawing.size, hashlib.sha256(drawing.tobytes()).digest()


def validate(candidate):
    errors = []
    if not CONCEPT.is_file():
        errors.append(f"approved concept missing: {CONCEPT}")
    if not candidate.is_file():
        return errors + [f"candidate missing: {candidate}"]
    try:
        with Image.open(candidate) as source:
            source.load()
            if source.format != "PNG":
                errors.append("candidate must be a PNG")
            if source.mode != "RGBA":
                return errors + [f"candidate must be real RGBA, got {source.mode}"]
            expected = (COLUMNS * CELL, len(COUNTS) * CELL)
            if source.size != expected:
                return errors + [f"atlas size {source.size}; expected {expected}"]
            if source.getchannel("A").getextrema() != (0, 255):
                errors.append("alpha must include transparent and fully opaque pixels")
            if CONCEPT.is_file():
                reference = Image.open(CONCEPT).convert("RGBA")
                approved_cell = Image.new("RGBA", (CELL, CELL))
                approved_cell.paste(reference, ((CELL - reference.width) // 2, 16))
                if source.crop((0, 0, CELL, CELL)).tobytes() != approved_cell.tobytes():
                    errors.append("first idle cell must preserve the exact approved option-1 pixels")
            for row, (name, count, minimum) in enumerate(zip(NAMES, COUNTS, MIN_DISTINCT)):
                drawings = set()
                for column in range(COLUMNS):
                    x, y = column * CELL, row * CELL
                    cell = source.crop((x, y, x + CELL, y + CELL))
                    bounds = cell.getchannel("A").getbbox()
                    location = f"row {row} ({name}), frame {column}"
                    if column >= count:
                        if bounds is not None:
                            errors.append(f"{location}: tail must be empty")
                        continue
                    if bounds is None:
                        errors.append(f"{location}: required frame is empty")
                        continue
                    left, top, right, bottom = bounds
                    if left < 1 or top < 1 or right > CELL - 1 or bottom > CELL - 1:
                        errors.append(f"{location}: requires 1px transparent margins; bounds={bounds}")
                    drawings.add(drawing_key(cell, bounds))
                if len(drawings) < minimum:
                    errors.append(f"row {row} ({name}): {len(drawings)} distinct drawings; need >= {minimum}")
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        errors.append(f"cannot read candidate: {error}")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidate", nargs="?", type=Path, default=DEFAULT_CANDIDATE)
    args = parser.parse_args()
    errors = validate(args.candidate)
    if errors:
        print("FAIL: Bugs candidate structural validation", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"PASS: {args.candidate} — 9x18 cells, 192x192, {sum(COUNTS)} occupied frames")
    print("Visual identity and actual motion require separate review.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
