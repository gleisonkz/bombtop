from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


SOURCE = Path(__file__).resolve().parents[1] / "public/sprites/bomber.png"
OUTPUT = SOURCE.with_name("bomber-atlas.png")
ROWS = 18
COLS = 9
FRAME_W = 104
FRAME_H = 144
FOOT_Y = 139
MIN_PADDING = 2
EXPECTED = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)
SOURCE_BOUNDS = (0, 118, 222, 339, 449, 565, 684, 795, 918, 1043, 1170, 1289, 1407, 1525, 1641, 1751, 1851, 1983)
SOURCE_ROWS = (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 12, 11, 13, 14, 15, 16)
SOURCE_COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 8, 4, 4, 6, 6, 6, 8)
FRAME_SEQUENCE = (
    (0, 1, 2, 3),
    (0, 1, 2, 3),
    (0, 1, 2, 3),
    (0, 1, 2, 3, 4, 5),
    (0, 1, 2, 3, 4, 5),
    (0, 1, 2, 3, 4, 5),
    (0, 1, 2, 3, 4, 5),
    (0, 1, 2, 3, 4, 5, 6),
    (0, 1, 2, 3, 4, 5, 6, 7, 7),
    (0, 1, 2, 3, 4, 5, 6, 7, 7),
    (0, 1, 2, 3, 4, 5, 6, 7, 7),
    (0, 1, 2, 3),
    (0, 1, 2, 3),
    (0, 1, 2, 3),
    (0, 1, 2, 3, 4, 5),
    (0, 1, 2, 3, 4, 5),
    (0, 1, 2, 3, 4, 5),
    (0, 1, 2, 3, 4, 5, 6, 7),
)


def horizontal_runs(mask):
    columns = np.flatnonzero(mask.any(axis=0))
    if columns.size == 0:
        return []
    groups = np.split(columns, np.where(np.diff(columns) > 1)[0] + 1)
    return [(int(group[0]), int(group[-1]) + 1) for group in groups if group.size >= 4]


def isolate_pose(region, grounded):
    rgba = np.asarray(region).copy()
    if grounded:
        occupied = np.flatnonzero((rgba[:, :, 3] > 32).sum(axis=1) >= 12)
        if occupied.size:
            spans = np.split(occupied, np.where(np.diff(occupied) > 1)[0] + 1)
            main_span = max(spans, key=len)
            rgba[int(main_span[-1]) + 1:, :, 3] = 0
    opaque = rgba[:, :, 3] > 32
    labels, count = ndimage.label(opaque, structure=np.ones((3, 3), dtype=bool))
    if count == 0:
        raise ValueError("Empty pose")
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    main = int(np.argmax(sizes))
    body = labels == main
    nearby = ndimage.binary_dilation(body, iterations=10)
    keep = body.copy()
    for component in range(1, count + 1):
        component_mask = labels == component
        if component != main and component_mask.any() and (component_mask & nearby).any() and sizes[component] >= 8:
            keep |= component_mask
    rgba[~keep] = 0
    cleaned = Image.fromarray(rgba, "RGBA")
    bounds = cleaned.getbbox()
    if bounds is None:
        raise ValueError("Empty isolated pose")
    return cleaned.crop(bounds)


def pack():
    source = Image.open(SOURCE).convert("RGBA")
    pixels = np.asarray(source)
    target = Image.new("RGBA", (COLS * FRAME_W, ROWS * FRAME_H))
    for row, frame_count in enumerate(EXPECTED):
        source_row = SOURCE_ROWS[row]
        top = SOURCE_BOUNDS[source_row]
        bottom = SOURCE_BOUNDS[source_row + 1]
        mask = pixels[top:bottom, :, 3] > 20
        runs = horizontal_runs(mask)
        runs = [run for run in runs if run[1] - run[0] >= 15]
        if len(runs) != SOURCE_COUNTS[source_row]:
            raise ValueError(f"Source row {source_row} has {len(runs)} sprites, expected {SOURCE_COUNTS[source_row]}")
        if len(FRAME_SEQUENCE[row]) != frame_count:
            raise ValueError(f"Row {row} has an invalid playback sequence")
        for col, frame_index in enumerate(FRAME_SEQUENCE[row]):
            start, end = runs[frame_index]
            region = source.crop((start, top, end, bottom))
            frame = isolate_pose(region, grounded=row in (0, 1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16))
            x = col * FRAME_W + (FRAME_W - frame.width) // 2
            y = row * FRAME_H + FOOT_Y - frame.height + 1
            if x < col * FRAME_W or x + frame.width > (col + 1) * FRAME_W:
                raise ValueError(f"Frame {row}:{col} exceeds its cell")
            if y < row * FRAME_H:
                raise ValueError(f"Frame {row}:{col} exceeds cell height")
            target.alpha_composite(frame, (x, y))
    alpha = np.asarray(target.getchannel("A"))
    for row, frame_count in enumerate(EXPECTED):
        for col in range(frame_count):
            cell = alpha[row * FRAME_H:(row + 1) * FRAME_H, col * FRAME_W:(col + 1) * FRAME_W]
            visible = np.argwhere(cell > 0)
            if not visible.size:
                raise ValueError(f"Empty packed frame {row}:{col}")
            if visible[:, 0].max() != FOOT_Y:
                raise ValueError(f"Incorrect foot anchor in frame {row}:{col}")
            if visible[:, 1].min() < MIN_PADDING or visible[:, 1].max() >= FRAME_W - MIN_PADDING:
                raise ValueError(f"Insufficient horizontal padding in frame {row}:{col}")
            if visible[:, 0].min() < MIN_PADDING or (cell[FOOT_Y + 1:, :] != 0).any():
                raise ValueError(f"Vertical frame bleed in frame {row}:{col}")
    target.save(OUTPUT)
    print(f"Packed {OUTPUT}: {target.width}x{target.height}")


if __name__ == "__main__":
    pack()
