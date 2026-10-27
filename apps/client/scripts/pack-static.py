"""Pack the user's 2026-10-25 21:48 RGBA source into the existing animation roles."""
from functools import lru_cache
import importlib.util
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parents[1] / 'concept/static/supplied-20261025-214803.png'
OUTPUT = ROOT / 'public/sprites/static-final.png'
PROTECTION = ROOT / 'src/render/static-paint-regions.json'
CELL = (168, 186)
ANCHOR = (82, 170)
BODY_HEIGHT = 148
DISC_BODY_HEIGHT = 118
COUNTS = (12, 14, 12, 10, 11, 9, 11, 10, 10)
ROW_EDGES = (0, 210, 360, 520, 685, 850, 975, 1140, 1280, 1536)
MAP = [
    (0, [0, 1, 2, 3]), (0, [4, 5, 6, 7]), (0, [8, 9, 10, 11]),
    (1, [0, 1, 2, 3, 4]), (1, [5, 6, 7, 8]), (1, [9, 10, 11, 12, 13]),
    (4, [0, 1, 0, 1, 0, 1]), (5, [0, 1, 2, 3, 4, 4, 4]),
    (3, [0, 1, 3, 6, 7, 8]), (3, [0, 1, 3, 6, 6, 7, 8]), (0, [8, 9, 10, 11]),
    (6, [4, 5, 6, 7]), (0, [4, 5, 6, 7]), (0, [8, 9, 10, 11]),
    (6, [4, 5, 6, 7, 6, 5]), (1, [5, 6, 7, 8, 7, 6]), (1, [9, 10, 11, 12, 13, 12]),
    (7, list(range(10))), (6, list(range(11))),
]


@lru_cache(maxsize=1)
def geometry():
    pixels = np.array(Image.open(SOURCE).convert('RGBA'))
    if pixels.shape != (1536, 1024, 4):
        raise ValueError('Review the changed source dimensions before packing')
    labels, _ = ndimage.label(pixels[:, :, 3] >= 64)
    counts = np.bincount(labels.ravel())
    large = counts >= 900
    large[0] = False
    cores = large[labels]
    distance, nearest = ndimage.distance_transform_edt(~cores, return_indices=True)
    owners = np.where(distance <= 2, labels[nearest[0], nearest[1]], 0)
    owners[pixels[:, :, 3] == 0] = 0
    regions = ndimage.find_objects(owners)
    rows = [[] for _ in COUNTS]
    for label in np.flatnonzero(large):
        region = regions[label - 1]
        top, bottom = region[0].start, region[0].stop
        left, right = region[1].start, region[1].stop
        cy = (top + bottom) / 2
        row = next(i for i in range(len(COUNTS)) if ROW_EDGES[i] <= cy < ROW_EDGES[i + 1])
        rows[row].append(((left, top, right, bottom), int(label)))
    for row, count in zip(rows, COUNTS):
        row.sort(key=lambda item: item[0][0])
        if len(row) != count:
            raise ValueError(f'Expected {count} source poses, found {len(row)}')
    return owners, rows


def boxes():
    return [[box for box, _ in row] for row in geometry()[1]]


def extract(source, box, owner=None):
    pixels = np.array(source.crop(box).convert('RGBA'))
    if owner is not None:
        pixels[~owner, 3] = 0
    image = Image.fromarray(pixels)
    bounds = image.getchannel('A').getbbox()
    return image.crop(bounds) if bounds else image


def rectangles(mask, x, y):
    regions, active = [], {}
    for py, line in enumerate(mask):
        current = {}
        changes = np.diff(np.pad(line.astype(int), 1))
        for left, right in zip(np.where(changes == 1)[0], np.where(changes == -1)[0]):
            key = (int(left), int(right))
            region = active.get(key)
            if region is None:
                region = {'left': x + key[0], 'top': y + py, 'right': x + key[1], 'bottom': y + py + 1}
                regions.append(region)
            else:
                region['bottom'] = y + py + 1
            current[key] = region
        active = current
    return regions


def frame_protection(frame, x, y, disc=False):
    pixels = np.array(frame)
    rgb = pixels[:, :, :3].astype(int)
    visible = pixels[:, :, 3] > 0
    ys, xs = np.indices(visible.shape)
    head = xs < round(frame.width * .4) if frame.width > frame.height else ys < round(frame.height * .45)
    hair = visible & head & (rgb.max(2) - rgb.min(2) < 80) & (rgb[:, :, 2] >= rgb[:, :, 0])
    regions = rectangles(hair, x, y)
    if disc:
        silver = visible & (ys > frame.height * .55) & (rgb.min(2) > 45) & (rgb.max(2) - rgb.min(2) < 65)
        labels, count = ndimage.label(silver)
        if not count:
            raise ValueError('Missing silver disc')
        sizes = np.bincount(labels.ravel())
        sizes[0] = 0
        board = ndimage.binary_fill_holes(ndimage.binary_closing(labels == sizes.argmax(), iterations=2))
        board = ndimage.binary_dilation(board, iterations=2) & visible
        regions.extend(rectangles(board, x, y))
    return regions


def build(protection_rows=None):
    approved = ROOT.parents[1] / 'concept/static/option4-redraw'
    if (approved / 'integration.json').exists():
        spec = importlib.util.spec_from_file_location('static_approved', Path(__file__).with_name('pack-static-approved.py'))
        current = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(current)
        contract = json.loads((approved / 'contract.json').read_text(encoding='utf-8'))
        manifest = json.loads((approved / 'measurements.json').read_text(encoding='utf-8'))
        atlas, report = current.build_sheet(approved, contract, manifest=manifest)
        if protection_rows is not None:
            protection_rows.extend(report['paint_regions']['rows'])
        return atlas
    source = Image.open(SOURCE).convert('RGBA')
    spec = importlib.util.spec_from_file_location('static_carry', Path(__file__).with_name('pack-static-carry.py'))
    carry = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(carry)
    carry_frames = carry.frames()
    owners, inventory = geometry()
    atlas = Image.new('RGBA', (CELL[0] * 14, CELL[1] * len(MAP)))
    for row, (source_row, columns) in enumerate(MAP):
        row_regions = []
        for column, index in enumerate(columns):
            if row in carry_frames:
                frame = carry_frames[row][column]
                atlas.alpha_composite(frame, (column * CELL[0], row * CELL[1]))
                left, top, right, bottom = frame.getchannel('A').getbbox()
                row_regions.append(frame_protection(frame.crop((left, top, right, bottom)), left, top, row == 17))
                continue
            box, label = inventory[source_row][index]
            left, top, right, bottom = box
            frame = extract(source, box, owners[top:bottom, left:right] == label)
            if source_row == 1:
                scale = BODY_HEIGHT / 129
                frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.NEAREST)
            if frame.width >= CELL[0] or frame.height >= CELL[1]:
                raise ValueError(f'Frame would clip: {row}/{column} {frame.size}')
            x, y = ANCHOR[0] - frame.width // 2, ANCHOR[1] - frame.height
            atlas.alpha_composite(frame, (column * CELL[0] + x, row * CELL[1] + y))
            row_regions.append(frame_protection(frame, x, y, row == 17))
        if protection_rows is not None:
            protection_rows.append(row_regions)
    return atlas


if __name__ == '__main__':
    rows = []
    atlas = build(rows)
    atlas.save(OUTPUT)
    PROTECTION.write_text(json.dumps({'frameW': atlas.width // 14, 'frameH': atlas.height // len(MAP), 'rows': rows}, separators=(',', ':')) + '\n', encoding='utf-8')
    print(OUTPUT)
