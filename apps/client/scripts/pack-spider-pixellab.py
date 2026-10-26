"""Pack explicitly mapped PixelLab Spider frames into the existing 9x18 contract.

Usage: python apps/client/scripts/pack-spider-pixellab.py --output candidate.png
--manifest defaults to concept/spider/pixellab/manifest.json in this repository.
source_root is relative to the manifest; frame paths are relative to source_root.
An optional row anchor [x,y] uses native pixel-edge coordinates: bbox horizontal
midpoint and exclusive bottom by default. These map to edge coordinates [65,156],
whose pixel-center registration is [64.5,155]. Only exact integer translations
are accepted. The first frame determines one translation for the entire row.
Explicit repeated frame paths are allowed; missing frames are never synthesized.
"""
import argparse
import json
import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MANIFEST = ROOT / "concept/spider/pixellab/manifest.json"
CELL = (130, 161)
SIZE = (1170, 2898)
ANCHOR = (64.5, 155)
ROW_NAMES = (
    "idle.down", "idle.side", "idle.up", "walk.down", "walk.side", "walk.up",
    "stun", "death", "cast.down", "cast.side", "cast.up", "carryIdle.down",
    "carryIdle.side", "carryIdle.up", "carryWalk.down", "carryWalk.side",
    "carryWalk.up", "lobby",
)
FRAME_COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)


def read_manifest(path):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict):
        raise ValueError("manifest must be a JSON object")
    if type(data.get("pixel_scale")) is not int or data["pixel_scale"] != 2:
        raise ValueError("pixel_scale must be integer 2")
    source_root = data.get("source_root")
    if not isinstance(source_root, str) or not source_root:
        raise ValueError("source_root must be a nonempty path")
    rows = data.get("rows")
    if not isinstance(rows, list):
        raise ValueError("rows must be a list of the 18 named Spider rows")
    named = {}
    for row in rows:
        if not isinstance(row, dict) or row.get("name") not in ROW_NAMES:
            raise ValueError("rows contain an unknown Spider row")
        name = row["name"]
        if name in named:
            raise ValueError(f"rows contain duplicate {name}")
        named[name] = row
    missing = set(ROW_NAMES) - named.keys()
    if missing:
        raise ValueError(f"missing rows: {', '.join(sorted(missing))}")
    for name, count in zip(ROW_NAMES, FRAME_COUNTS):
        frames = named[name].get("frames")
        if not isinstance(frames, list) or len(frames) != count:
            raise ValueError(f"{name}: expected {count} frames")
        if any(not isinstance(frame, str) or not frame for frame in frames):
            raise ValueError(f"{name}: frame paths must be nonempty strings")
    return path.parent / source_root, named


def load_frame(path, label):
    try:
        with Image.open(path) as source:
            if source.mode != "RGBA":
                raise ValueError(f"{label}: expected RGBA, got {source.mode}: {path}")
            if source.size not in ((64, 64), (88, 88), (96, 96)):
                raise ValueError(f"{label}: expected native 64x64, 88x88 or 96x96, got {source.size}: {path}")
            frame = source.copy()
    except OSError as exc:
        raise ValueError(f"{label}: cannot read source {path}: {exc}") from exc
    bbox = frame.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"{label}: empty alpha: {path}")
    return frame, bbox


def row_translation(row, bbox):
    anchor = row.get("anchor", [(bbox[0] + bbox[2]) / 2, bbox[3]])
    if (not isinstance(anchor, list) or len(anchor) != 2
            or any(type(value) not in (int, float) or not math.isfinite(value) for value in anchor)):
        raise ValueError(f"{row['name']}: anchor must be two finite native pixel-edge coordinates")
    offset = (65 - anchor[0] * 2, 156 - anchor[1] * 2)
    if any(value != int(value) for value in offset):
        raise ValueError(f"{row['name']}: anchor must produce an integer translation at scale 2")
    return tuple(int(value) for value in offset)


def build_sheet(manifest):
    source_root, rows = read_manifest(Path(manifest))
    sheet = Image.new("RGBA", SIZE)
    measurements = []
    standing_heights = []
    for index, name in enumerate(ROW_NAMES):
        row = rows[name]
        offset = None
        bounds = []
        source_sizes = []
        for column, frame_path in enumerate(row["frames"]):
            frame, bbox = load_frame(source_root / frame_path, f"{name} frame {column}")
            if offset is None:
                offset = row_translation(row, bbox)
            left, top, right, bottom = (
                bbox[0] * 2 + offset[0], bbox[1] * 2 + offset[1],
                bbox[2] * 2 + offset[0], bbox[3] * 2 + offset[1],
            )
            if left < 0 or top < 0 or right > CELL[0] or bottom > CELL[1]:
                raise ValueError(f"{name} frame {column}: alpha bounds {(left, top, right, bottom)} "
                                 f"clips outside cell {CELL}: {frame_path}")
            scaled = frame.resize((frame.width * 2, frame.height * 2), Image.Resampling.NEAREST)
            # Crop only after validating visible bounds; the row translation stays fixed.
            visible = scaled.crop((bbox[0] * 2, bbox[1] * 2, bbox[2] * 2, bbox[3] * 2))
            sheet.paste(visible, (column * CELL[0] + left, index * CELL[1] + top))
            bounds.append([left, top, right, bottom])
            source_sizes.append(list(frame.size))
            if index < 3:
                standing_heights.append(bottom - top)
        measurements.append({"name": name, "row": index, "offset": list(offset),
                             "bounds": bounds, "source_sizes": source_sizes})
    return sheet, {
        "geometry": {"columns": 9, "rows": 18, "cell": list(CELL), "size": list(SIZE),
                     "anchor": list(ANCHOR)},
        "pixel_scale": 2, "frame_counts": list(FRAME_COUNTS),
        "bodyH": max(standing_heights),
        "bodyH_basis": "maximum alpha height across the three standing idle rows",
        "rows": measurements,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        sheet, report = build_sheet(args.manifest)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(args.output, format="PNG")
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Spider atlas: {exc}\n")
    print(json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
