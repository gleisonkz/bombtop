"""Locate glowing eyes and fuse flames; red head contours remain repaintable.

python apps/client/scripts/build-bomber-paint-regions.py [--check]
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


CLIENT = Path(__file__).resolve().parents[1]
SOURCE = CLIENT / "public/sprites/bomber-atlas.png"
OUTPUT = CLIENT / "src/render/bomber-paint-regions.json"
FW, FH = 104, 144


def frame_region(frame, has_eyes=True):
    rgb = frame[:, :, :3].astype(float)
    maximum, minimum = rgb.max(2), rgb.min(2)
    ys, xs = np.indices(maximum.shape)
    iron = (frame[:, :, 3] > 128) & (maximum < 150) & (maximum - minimum < 35) & (ys < 120)
    labels, count = ndimage.label(iron)
    if not count:
        return None
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    hy, hx = np.where(labels == sizes.argmax())
    left, top, right, bottom = int(hx.min()), int(hy.min()), int(hx.max() + 1), int(hy.max() + 1)
    warm = (frame[:, :, 3] > 32) & (rgb[:, :, 0] > 80) & (rgb[:, :, 0] > rgb[:, :, 1] * .9) & (rgb[:, :, 1] > rgb[:, :, 2] * 1.2) & (ys < top + 3)
    flames, _ = ndimage.label(warm)
    seeds = warm & (rgb[:, :, 1] > 150) & (abs(xs - (left + right) / 2) < FW / 4)
    seed_labels = flames[seeds]
    flame = None
    if seed_labels.size:
        chosen = np.bincount(seed_labels).argmax()
        fy, fx = np.where(flames == chosen)
        flame = {"left": max(0, int(fx.min()) - 4), "top": max(0, int(fy.min()) - 4), "right": min(FW, int(fx.max()) + 5), "bottom": min(FH, int(fy.max()) + 5)}
    dx = (xs + .5 - (left + right) / 2) / ((right - left) / 2 + 1)
    dy = (ys + .5 - (top + bottom) / 2) / ((bottom - top) / 2 + 1)
    face = (dx * dx + dy * dy <= 1) & (ys > top + (bottom - top) * .3) & (ys < top + (bottom - top) * .8) & has_eyes
    glow = face & (frame[:, :, 3] > 128) & (rgb[:, :, 0] > 70) & (rgb[:, :, 0] > rgb[:, :, 1] * 1.15) & (rgb[:, :, 0] > rgb[:, :, 2] * 1.2)
    eye_labels, _ = ndimage.label(glow)
    bright = glow & (rgb[:, :, 0] > 220) & (rgb[:, :, 1] > 140) & (rgb[:, :, 1] > rgb[:, :, 0] * .55) & (rgb[:, :, 2] < 120)
    regions = []
    for label in np.unique(eye_labels[bright]):
        ey, ex = np.where(eye_labels == label)
        regions.append({"left": max(0, int(ex.min()) - 1), "top": max(0, int(ey.min()) - 1), "right": min(FW, int(ex.max()) + 2), "bottom": min(FH, int(ey.max()) + 2)})
    if flame:
        regions.append(flame)
    return regions


def generate():
    with Image.open(SOURCE) as image:
        pixels = np.asarray(image.convert("RGBA"))
    back_rows = {2, 5, 10, 13, 16}
    rows = [[frame_region(pixels[y:y + FH, x:x + FW], y // FH not in back_rows) for x in range(0, pixels.shape[1], FW)] for y in range(0, pixels.shape[0], FH)]
    return {"sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "frameW": FW, "frameH": FH, "rows": rows}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    result = generate()
    if arguments.check:
        if json.loads(OUTPUT.read_text(encoding="utf-8")) != result:
            raise SystemExit("Bomber paint regions are stale; regenerate after packing the atlas")
        print("Bomber paint regions match the packed atlas")
    else:
        OUTPUT.write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"Wrote {OUTPUT}")
