"""Structural acceptance for the frozen Pikachu atlas; does not judge visual identity.

Run: python apps/client/scripts/test-pikachu-pixellab.py [candidate.png]
Relative candidate paths resolve from the repository root, independent of cwd.
"""
import argparse
import hashlib
from pathlib import Path
import sys

from PIL import Image, UnidentifiedImageError


ROOT = Path(__file__).resolve().parents[3]
CONCEPT = ROOT / "concept/pikachu-pixellab-redraw/pikachu-smaller-paws-v2-black-eyes.png"
DEFAULT = "concept/pikachu-pixellab-redraw/pikachu-candidate.png"
CELL_W, CELL_H = 180, 164
COLS, ROWS = 9, 18
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)
NAMES = (
    "idle.down", "idle.side", "idle.up",
    "walk.down", "walk.side", "walk.up", "stun", "death",
    "cast.down", "cast.side", "cast.up",
    "carryIdle.down", "carryIdle.side", "carryIdle.up",
    "carryWalk.down", "carryWalk.side", "carryWalk.up", "lobby",
)
MIN_DISTINCT = (2, 2, 2, 4, 4, 4, 4, 5, 4, 4, 4, 2, 2, 2, 4, 4, 4, 6)


def pose_signature(frame, bounds):
    """Ignore translation and RGB under zero alpha when comparing drawings."""
    pose = frame.crop(bounds)
    canonical = Image.new("RGBA", pose.size)
    visible = pose.getchannel("A").point(lambda alpha: 255 if alpha else 0)
    canonical.paste(pose, (0, 0), visible)
    return pose.size, hashlib.sha256(canonical.tobytes()).digest()


def inspect_rows(atlas, failures):
    for row, (name, count, minimum) in enumerate(zip(NAMES, COUNTS, MIN_DISTINCT)):
        poses = set()
        occupied = 0
        bounds_report = []
        row_failures = []
        for col in range(COLS):
            x, y = col * CELL_W, row * CELL_H
            frame = atlas.crop((x, y, x + CELL_W, y + CELL_H))
            bounds = frame.getchannel("A").getbbox()
            if col >= count:
                if bounds is not None:
                    row_failures.append(f"unused frame {col + 1} contains visible pixels")
                continue
            bounds_report.append(bounds)
            if bounds is None:
                row_failures.append(f"frame {col + 1} is empty")
                continue
            occupied += 1
            poses.add(pose_signature(frame, bounds))
            left, top, right, bottom = bounds
            if left < 1 or top < 1 or right > CELL_W - 1 or bottom > CELL_H - 1:
                row_failures.append(f"frame {col + 1} touches cell edge: {bounds}")
        if len(poses) < minimum:
            row_failures.append(f"distinct drawings {len(poses)} < required {minimum}")
        label = "FAIL" if row_failures else "PASS"
        print(f"{label} row {row:02d} {name:15s} occupied={occupied}/{count} "
              f"distinct={len(poses)}/{minimum} empty-tail={COLS - count}")
        print(f"     alpha bounds (exclusive right/bottom): {bounds_report}")
        failures.extend(f"row {row} {name}: {message}" for message in row_failures)


def inspect_approved_eyes(atlas, failures):
    for label, box in (("left", (65, 67, 84, 85)), ("right", (95, 67, 115, 85))):
        pixels = list(atlas.crop(box).getdata())
        dark = sum(alpha > 128 and max(red, green, blue) < 50 for red, green, blue, alpha in pixels)
        white = sum(alpha > 128 and min(red, green, blue) > 230 for red, green, blue, alpha in pixels)
        if dark < 60 or white < 3:
            failures.append(f"{label} eye must retain black fill and white catchlight: dark={dark}, white={white}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidate", nargs="?", default=DEFAULT)
    args = parser.parse_args()
    candidate = Path(args.candidate)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    failures = []
    if not CONCEPT.is_file():
        failures.append(f"approved concept missing: {CONCEPT}")
    print(f"Candidate: {candidate}")
    if not candidate.is_file():
        failures.append(f"candidate missing: {candidate}")
    else:
        try:
            with Image.open(candidate) as atlas:
                atlas.load()
                print(f"Image: mode={atlas.mode} size={atlas.size} format={atlas.format}")
                if atlas.mode != "RGBA":
                    failures.append(f"expected native RGBA, got {atlas.mode}; conversion is not accepted")
                if atlas.size != (COLS * CELL_W, ROWS * CELL_H):
                    failures.append(f"expected dimensions 1620x2952, got {atlas.size}")
                if atlas.mode == "RGBA":
                    low, high = atlas.getchannel("A").getextrema()
                    if low != 0 or high == 0:
                        failures.append(f"expected actual transparent and visible pixels; alpha range={low}..{high}")
                    if atlas.size == (COLS * CELL_W, ROWS * CELL_H):
                        inspect_rows(atlas, failures)
                        inspect_approved_eyes(atlas, failures)
        except (OSError, ValueError, UnidentifiedImageError) as error:
            failures.append(f"cannot decode candidate: {error}")
    for failure in failures:
        print(f"FAIL: {failure}", file=sys.stderr)
    if failures:
        print(f"REJECTED: {len(failures)} structural failure(s)", file=sys.stderr)
        return 1
    print("ACCEPTED: structural checks passed; visual identity and motion still require review.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
