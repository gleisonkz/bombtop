"""Register the user-supplied Pele cartela without redrawing or upscaling it.

Run from the repository root: python apps/client/scripts/pack-pele.py
The source rows are irregular and mix action families. MAP is the reviewed
semantic mapping; repeated entries are explicit holds, not generated poses.
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parents[1] / "concept/pele/supplied-final-atlas.png"
OUTPUT = ROOT.parents[1] / "concept/pele/packed-supplied-final.png"
CELL = 160
ANCHOR = (80, 148)
BODY_HEIGHT = 128
SOURCE_ROWS = (
    (0, 136), (136, 266), (266, 407), (407, 546),
    (546, 672), (672, 802), (802, 950), (950, 1088),
    (1088, 1223), (1223, 1359), (1359, 1510),
)
# Long falling poses and the celebration extend beyond the nominal column grid.
# Isolate connected characters first, then sort by x rather than slicing cells.
MAP = (
    (0, (0, 1, 2, 3)), (1, (0, 1, 2, 3)), (2, (0, 1, 2, 3)),
    (3, (0, 1, 2, 3, 4, 5)), (4, (0, 1, 2, 3, 4, 5)), (5, (0, 1, 2, 3, 4, 5)),
    (0, (0, 1, 2, 3, 2, 1)),
    (6, (5, 5, 6, 6, 7, 8, 8)),
    (7, (1, 3, 4, 5, 6, 5, 4, 3, 1)),
    (6, (0, 1, 2, 3, 4, 3, 2, 1, 0)),
    (2, (0, 0, 1, 1, 2, 2, 1, 1, 0)),
    (7, (0, 2, 8, 9)), (8, (4, 4, 4, 4)), (8, (6, 7, 8, 7)),
    (7, (0, 2, 8, 9, 8, 2)), (8, (4, 4, 4, 4, 4, 4)), (9, (4, 5, 6, 7, 6, 5)),
    (7, (0, 1, 2, 3, 4, 8, 9)),
)


def extract(source, row, column):
    top, bottom = SOURCE_ROWS[row]
    pixels = np.array(source.crop((0, top, source.width, bottom)))
    if row == 6:
        yy, xx = np.ogrid[top:bottom, :source.width]
        for x, y in ((88, 918), (209, 923), (423, 924), (548, 927)):
            pixels[(xx - x) ** 2 + (yy - y) ** 2 <= 18 ** 2] = 0
    labels, _ = ndimage.label(pixels[:, :, 3] >= 128, structure=np.ones((3, 3)))
    areas = np.bincount(labels.ravel())
    objects = ndimage.find_objects(labels)
    characters = [index for index in range(1, len(areas)) if areas[index] > 2000]
    characters.sort(key=lambda index: objects[index - 1][1].start)
    body = labels == characters[column]
    keep = ndimage.binary_dilation(body, iterations=2)
    pixels[~keep | (pixels[:, :, 3] < 16)] = 0
    image = Image.fromarray(pixels)
    return image.crop(image.getchannel("A").getbbox())


def build_frames():
    with Image.open(SOURCE) as image:
        source = image.convert("RGBA")
    if source.size != (1024, 1536):
        raise ValueError("Source changed: review cell boundaries before packing")
    frames = []
    for source_row, columns in MAP:
        row = []
        for column in columns:
            frame = extract(source, source_row, column)
            bounds = frame.getchannel("A").point(lambda alpha: 255 if alpha >= 64 else 0).getbbox()
            left, top, right, bottom = bounds
            cell = Image.new("RGBA", (CELL, CELL))
            # Translation only: preserve the source's native pixels and scale.
            cell.alpha_composite(frame, (round(ANCHOR[0] - (left + right) / 2), ANCHOR[1] - bottom))
            row.append(cell)
        frames.append(row)
    return frames


def build_sheet():
    sheet = Image.new("RGBA", (CELL * 9, CELL * len(MAP)))
    for row, frames in enumerate(build_frames()):
        for column, frame in enumerate(frames):
            sheet.alpha_composite(frame, (column * CELL, row * CELL))
    return sheet


if __name__ == "__main__":
    build_sheet().save(OUTPUT)
    print(f"Packed {sum(len(columns) for _, columns in MAP)} poses: {OUTPUT}")
