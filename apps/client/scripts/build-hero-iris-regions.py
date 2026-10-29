"""Reproduce measured Captain/Thor iris-only masks; run with --check in CI.

Windows are half-open and local to each production cell. Empty lists mark hidden
or closed irises; null cells are unoccupied. Source hashes require explicit review
when artwork changes. No source artwork is modified.
"""
import argparse
import colorsys
import hashlib
import json
from pathlib import Path
from PIL import Image

CLIENT = Path(__file__).resolve().parents[1]
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)


def pair(left, right, top, bottom, width=7):
    return [(left, top, left + width, bottom), (right, top, right + width, bottom)]


CAPTAIN = {
    0: [pair(48, 68, 42, 51), pair(48, 68, 40, 49), pair(48, 68, 39, 48), pair(48, 68, 41, 50)],
    1: [[(81, 39, 89, 48)]] * 4,
    3: [pair(49, 69, 40, 48), pair(49, 69, 40, 48), pair(49, 69, 39, 47), pair(49, 69, 40, 48), pair(49, 69, 39, 47), pair(49, 69, 39, 47)],
    4: [[(80, 39, 84, 45)], [(80, 39, 84, 45)], [(80, 38, 84, 44)], [(80, 38, 84, 44)], [(80, 37, 84, 43)], [(80, 38, 84, 44)]],
    6: [[(43, 56, 50, 63), (25, 56, 30, 61)], [(43, 48, 50, 55), (27, 47, 32, 52)], [(49, 29, 52, 35)], [(46, 32, 49, 38)], [(38, 43, 42, 48)], [(40, 59, 47, 65), (25, 57, 30, 62)]],
    8: [pair(49, 69, 42, 51), pair(49, 69, 42, 51), pair(49, 69, 40, 48), [(49, 46, 50, 48), (74, 47, 76, 50)], [], [], [], [], []],
    9: [[(81, 42, 85, 48)], [(81, 42, 85, 49)], [(81, 42, 85, 49)], [], [], [], [], [], []],
    11: [pair(49, 69, 60, 66, 5), pair(49, 69, 58, 64, 5), pair(49, 69, 57, 63, 5), pair(49, 69, 59, 65, 5)],
    12: [[(83, 62, 86, 65)], [(81, 60, 84, 63)], [(79, 59, 82, 62)], [(82, 62, 85, 65)]],
    14: [pair(49, 69, 58, 64, 5), pair(49, 69, 57, 63, 5), pair(49, 69, 58, 64, 5), pair(49, 69, 58, 64, 5), pair(49, 69, 57, 63, 5), pair(49, 69, 58, 64, 5)],
    15: [[(79, 60, 82, 62)], [(79, 59, 82, 61)], [(79, 60, 82, 62)], [(79, 60, 82, 62)], [(79, 59, 82, 61)], [(79, 60, 82, 62)]],
    17: [pair(49, 69, 43, 50), [(49, 50, 56, 53), (70, 50, 77, 53)], pair(49, 69, 46, 53), pair(49, 70, 41, 49, 6), [], [], [], []],
}

THOR = {
    0: [[(57, 48, 81, 54)], [(59, 46, 81, 51)], [(59, 44, 81, 49)], [(59, 46, 81, 51)]],
    1: [[(92, 47, 96, 51)], [(88, 45, 92, 50)], [(85, 43, 90, 48)], [(88, 45, 93, 51)]],
    3: [[(58, 48, 82, 54)], [(58, 47, 80, 53)], [(58, 47, 81, 52)], [(58, 47, 82, 53)], [(60, 47, 83, 52)], [(59, 47, 82, 52)]],
    4: [[(84, 42, 90, 51)]] * 6,
    6: [[(39, 59, 56, 63)], [(40, 52, 55, 55)], [], [], [(27, 46, 39, 51)], [(37, 67, 41, 69)]],
    7: [[(39, 64, 55, 67)], [(41, 63, 57, 65)], [(58, 43, 75, 47)], [(70, 45, 86, 50)], [(76, 50, 92, 55)], [(65, 58, 82, 60)], [(45, 67, 60, 71)]],
    8: [[(59, 43, 82, 49)]] * 4 + [[(60, 45, 82, 50)]] + [[(58, 47, 82, 52)]] * 4,
    9: [[(84, 44, 89, 53)]] * 4 + [[]] + [[(85, 47, 89, 53)]] * 4,
    11: [[(59, 43, 82, 49)]] * 4,
    12: [[(85, 45, 88, 50)]] * 4,
    14: [[(59, 43, 82, 49)]] * 6,
    15: [[(85, 44, 88, 50)]] * 6,
    17: [[]] + [[(59, 45, 82, 50)]] + [[(59, 42, 82, 47)]] * 6,
}
SOURCES = {
    'captain': (124, 138, 9, COUNTS, 'fa7534ce029a39110d836d66a5ab6d971fa1d320cdfd2d0728d3bc7dfae3733b', CAPTAIN),
    'thor': (140, 146, 9, COUNTS, '068d2a1ed2dfedee380005afc3e148bb4ce0f2083f98d6776e7434a8f9f61f2d', THOR),
    'thor-lobby': (180, 204, 16, (16,), 'de14c7057540a4ef35e23e8b5412e5704104c968cca77e120f816900f4bf146c', {0: [[(79, y, 102, y + 5)] for y in [92, 92, 92, 92, 94, 94, 94, 96, 100, 104, 104, 104, 104, 104, 96, 92]]}),
}


def selected(pixel, name):
    if not pixel[3]:
        return False
    hue, _, saturation = colorsys.rgb_to_hls(*(v / 255 for v in pixel[:3]))
    low, high = (200, 232) if name == 'captain' else (205, 226)
    return saturation >= .2 and low <= hue * 360 <= high


def generate(name, spec):
    fw, fh, columns, counts, expected_hash, windows = spec
    source = CLIENT / f'public/sprites/{name}.png'
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if source_hash != expected_hash:
        raise ValueError(f'{name}: source changed; remeasure irises')
    with Image.open(source) as image:
        image = image.convert('RGBA')
        if image.size != (fw * columns, fh * len(counts)):
            raise ValueError(f'{name}: atlas dimensions changed')
        rows = []
        for row, count in enumerate(counts):
            eye_windows = windows.get(row, [[] for _ in range(count)])
            if len(eye_windows) != count:
                raise ValueError(f'{name}: incorrect window count at row {row}')
            cells = []
            for column in range(columns):
                frame = image.crop((column * fw, row * fh, (column + 1) * fw, (row + 1) * fh))
                if bool(frame.getchannel('A').getbbox()) != (column < count):
                    raise ValueError(f'{name}: unexpected occupied cell {row}/{column}')
                if column >= count:
                    cells.append(None)
                    continue
                points = {(x, y) for left, top, right, bottom in eye_windows[column]
                          for y in range(top, bottom) for x in range(left, right)
                          if selected(frame.getpixel((x, y)), name)}
                regions = []
                for y in sorted({y for x, y in points}):
                    xs = sorted(x for x, py in points if py == y)
                    start = previous = xs[0]
                    for x in xs[1:] + [fw + 1]:
                        if x != previous + 1:
                            regions.append(dict(left=start, top=y, right=previous + 1, bottom=y + 1))
                            start = x
                        previous = x
                cells.append(regions)
            rows.append(cells)
    return dict(sourceSha256=source_hash, frameW=fw, frameH=fh, rows=rows)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name, spec in SOURCES.items():
        result = generate(name, spec)
        output = CLIENT / f'src/render/{name}-paint-regions.json'
        if args.check:
            if json.loads(output.read_text(encoding='utf-8')) != result:
                raise SystemExit(f'{name}: stale iris regions')
            print(f'{name}: iris regions match the production atlas')
        else:
            output.write_text(json.dumps(result, separators=(',', ':')) + '\n', encoding='utf-8')
            print(f'Wrote {output}')
