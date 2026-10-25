from pathlib import Path
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SIZE = 128
FRAMES = 5
VARIANTS = 4
ROWS = 6
SOURCE = ROOT.parents[1] / "concept/flames/flames-volume-source.png"
SOURCE_SIZE = (1145, 1374)
Y_EDGES = (0, 344, 566, 793, 1010, 1215, 1374)
BODY_X = (0, 260, 507, 738, 955, 1145)
CENTER_X = (0, 286, 540, 774, 968, 1145)
END_X = (0, 292, 546, 775, 985, 1145)
CENTER_DIAMETERS = (118, 120, 113, 100, 84)
JOIN_WIDTH = 12


def main_silhouette(image: Image.Image) -> Image.Image:
    pixels = np.asarray(image).copy()
    labels, count = ndimage.label(pixels[:, :, 3] > 24)
    if not count:
        raise ValueError("Empty flame source cell")
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    mask = ndimage.binary_dilation(labels == sizes.argmax(), iterations=2)
    pixels[~mask] = 0
    return Image.fromarray(pixels)


def source_cell(source: Image.Image, frame: int, row: int) -> Image.Image:
    edges = BODY_X
    if row == 0:
        edges = CENTER_X
    elif row == ROWS - 1:
        edges = END_X
    image = main_silhouette(source.crop((edges[frame] + 2, Y_EDGES[row] + 2, edges[frame + 1] - 2, Y_EDGES[row + 1] - 2)))
    if row == 0:
        image = image.crop(image.getbbox())
        image.thumbnail((CENTER_DIAMETERS[frame], CENTER_DIAMETERS[frame]), Image.Resampling.LANCZOS)
        target = Image.new("RGBA", (SIZE, SIZE))
        target.alpha_composite(image, ((SIZE - image.width) // 2, (SIZE - image.height) // 2))
        return target
    alpha = np.asarray(image.getchannel("A"))
    _, xs = np.where(alpha > 64)
    right = int(xs.max()) + 1 if row < ROWS - 1 else image.width
    image = image.crop((int(xs.min()), 0, right, image.height))
    return image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def compatible_joins(cells: list[Image.Image]) -> list[Image.Image]:
    pixels = [np.asarray(cell, dtype=float).copy() for cell in cells]
    edges = [edge for cell in pixels[:VARIANTS] for edge in (cell[:, 0], cell[:, -1])]
    profile = max(edges, key=lambda edge: np.sum(edge[:, 3] * edge[:, 1])).copy()
    weights = (profile[:, :3] @ np.array([0.2126, 0.7152, 0.0722])) ** 3 * profile[:, 3]
    center_y = int(round(np.average(np.arange(SIZE), weights=weights)))
    shifted = np.zeros_like(profile)
    shift = SIZE // 2 - center_y
    start, end = max(0, shift), min(SIZE, SIZE + shift)
    shifted[start:end] = profile[start - shift:end - shift]
    profile = shifted
    profile[profile[:, 3] > 220, 3] = 255
    for row, cell in enumerate(pixels):
        for distance in range(JOIN_WIDTH):
            t = distance / (JOIN_WIDTH - 1)
            weight = t * t * (3 - 2 * t)
            cell[:, distance] = profile * (1 - weight) + cell[:, distance] * weight
            if row < VARIANTS:
                cell[:, -1 - distance] = profile * (1 - weight) + cell[:, -1 - distance] * weight
    return [Image.fromarray(np.clip(cell, 0, 255).astype(np.uint8)) for cell in pixels]


def build_sheet() -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != SOURCE_SIZE:
        raise ValueError(f"Unexpected flame source size: {source.size}")
    sheet = Image.new("RGBA", (SIZE * FRAMES, SIZE * ROWS))
    for frame in range(FRAMES):
        cells = [source_cell(source, frame, row) for row in range(ROWS)]
        cells[1:] = compatible_joins(cells[1:])
        for row, cell in enumerate(cells):
            sheet.alpha_composite(cell, (frame * SIZE, row * SIZE))
    return sheet


def build_preview(sheet: Image.Image, reach: int = 4) -> Image.Image:
    tile = 16
    drawn = 16
    side = reach * 2 + 1
    preview = Image.new("RGBA", (FRAMES * tile * side, tile * side), (24, 60, 30, 255))
    for frame in range(FRAMES):
        def cell(row: int) -> Image.Image:
            part = sheet.crop((frame * SIZE, row * SIZE, (frame + 1) * SIZE, (row + 1) * SIZE))
            return part.resize((drawn, drawn), Image.Resampling.LANCZOS)

        center = cell(0).resize((20, 20), Image.Resampling.LANCZOS)
        end = cell(ROWS - 1)
        offset_x = frame * tile * side

        def put(image: Image.Image, gx: int, gy: int, rotation: int = 0) -> None:
            if rotation:
                image = image.rotate(rotation, expand=False)
            x = offset_x + gx * tile + (tile - image.width) // 2
            y = gy * tile + (tile - image.height) // 2
            preview.alpha_composite(image, (x, y))

        put(center, reach, reach)
        for distance in range(1, reach + 1):
            for dx, dy, rotation in ((1, 0, 0), (-1, 0, 180), (0, -1, 90), (0, 1, 270)):
                gx, gy = reach + dx * distance, reach + dy * distance
                variant = (gx + 3 * gy + gx // 4 + 2 * (gy // 4)) % VARIANTS
                part = end if distance == reach else cell(1 + variant)
                put(part, gx, gy, rotation)

    return preview.resize((preview.width * 3, preview.height * 3), Image.Resampling.NEAREST)


def main() -> None:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public/sprites/flames.png"
    sheet = build_sheet()
    sheet.save(output)
    if len(sys.argv) > 2:
        build_preview(sheet).save(sys.argv[2])


if __name__ == "__main__":
    main()
