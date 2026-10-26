"""Register the base-sprite-referenced transformation artwork to Goku's lobby grid.

Usage: python apps/client/scripts/pack-goku-lobby.py
The generated source is intentionally immutable. Only registration, alpha cleanup,
edge isolation and uniform downsampling happen here; no hair or poses are drawn.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parents[1] / "concept/goku/lobby-transform-v3.source.png"
OUTPUT = ROOT / "public/sprites/goku-lobby.png"
CELL = (192, 207)
ANCHOR = (96, 194)
SCALE = 0.5
# Source anchors measured at the midpoint between the boots, not the aura bounds.
SOURCE_ANCHORS = (
    (192, 309), (178.5, 309), (151.5, 309), (140.5, 310),
    (192.5, 308), (176.5, 311), (149.5, 311), (139, 309),
    (186, 308), (177.5, 308), (143, 306), (144.5, 307),
    (192.5, 303), (176.5, 303), (148.5, 304), (147.5, 304),
)


def source_frame(source, index):
    """Extract one grid cell, retaining the body and its local aura components."""
    cx, ground = SOURCE_ANCHORS[index]
    column, row = index % 4, index // 4
    left, right = (round(source.width * x / 4) for x in (column, column + 1))
    top, bottom = (round(source.height * y / 4) for y in (row, row + 1))
    pixels = np.array(source.crop((left, top, right, bottom)))
    labels, _ = ndimage.label(pixels[:, :, 3] >= 32, structure=np.ones((3, 3)))
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    # Keep substantial flame fragments as well as the character. Single-pixel
    # generation debris is not animation content.
    keep = ndimage.binary_dilation(sizes[labels] >= 24, iterations=1)
    pixels[~keep | (pixels[:, :, 3] < 8)] = 0
    # Isolate only the transparent/aura seam; the body stays inside these margins.
    y, x = np.indices(pixels.shape[:2])
    distance = np.minimum.reduce((x, pixels.shape[1] - 1 - x, y, pixels.shape[0] - 1 - y))
    pixels[:, :, 3] = np.rint(pixels[:, :, 3] * np.clip(distance / 4, 0, 1)).astype(np.uint8)
    return Image.fromarray(pixels), (cx, ground)


def build_frames():
    with Image.open(SOURCE) as image:
        source = image.convert("RGBA")
    if source.size != (1266, 1243):
        raise ValueError("Source artwork changed; remeasure frame anchors before packing")
    frames = []
    for index in range(16):
        frame, (cx, ground) = source_frame(source, index)
        size = tuple(round(dimension * SCALE) for dimension in frame.size)
        frame = frame.resize(size, Image.Resampling.LANCZOS)
        cell = Image.new("RGBA", CELL)
        cell.alpha_composite(frame, (round(ANCHOR[0] - cx * SCALE), round(ANCHOR[1] - ground * SCALE)))
        pixels = np.array(cell)
        pixels[pixels[:, :, 3] < 8] = 0
        frames.append(Image.fromarray(pixels))
    # A deliberate resting hold closes the loop on precisely the same drawing.
    # All transformation/de-transformation action frames remain distinct.
    frames[-1] = frames[0].copy()
    return frames


def build_sheet():
    sheet = Image.new("RGBA", (CELL[0] * 16, CELL[1]))
    for index, frame in enumerate(build_frames()):
        sheet.alpha_composite(frame, (index * CELL[0], 0))
    return sheet


if __name__ == "__main__":
    build_sheet().save(OUTPUT)
    print(f"16 registered frames, anchor {ANCHOR}: {OUTPUT}")
