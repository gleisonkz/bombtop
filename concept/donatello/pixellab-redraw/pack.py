"""Pack explicit native Donatello frames; never promote to production.

Run python concept/donatello/pixellab-redraw/pack.py [--selections selections.json]
[--output-dir DIRECTORY]. Outputs default beside selections.json. Input is an
object with 18 named rows, each with frames (paths relative to selections.json).
Optional anchor [x,y] is a native pixel-edge coordinate mapped to [128,208].
Without it, the first alpha bbox's floored horizontal midpoint and exclusive
bottom determine one integer translation for the entire row, even when source
canvas sizes differ. No scaling or individual frame alignment is performed.
Optional palms is one list of [x,y] sockets per frame; headbounds is one native
[left,top,right,bottom] box per frame (null allowed). Both are translated into
cell-local coordinates. metadata is retained verbatim. Head bounds are never
guessed from the full silhouette, which may include a staff.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent
CELL = (256, 224)
ANCHOR = (128, 208)
COLUMNS = 12
ROW_NAMES = (
    "idle-south", "idle-east", "idle-north", "walk-south", "walk-east",
    "walk-north", "stun-south", "death-south", "cast-south", "cast-east",
    "cast-north", "carryIdle-south", "carryIdle-east", "carryIdle-north",
    "carryWalk-south", "carryWalk-east", "carryWalk-north", "lobby-south",
)
FRAME_COUNTS = (4, 4, 4, 6, 6, 6, 6, 6, 9, 9, 9, 4, 4, 4, 6, 6, 6, 12)


def coordinates(value, count, label):
    if (not isinstance(value, list) or len(value) != count
            or any(type(n) not in (int, float) or not math.isfinite(n) for n in value)):
        raise ValueError(f"{label}: expected {count} finite coordinates")
    return value


def read_selections(path):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or not isinstance(data.get("rows"), list):
        raise ValueError("selections must be an object with rows")
    named = {}
    for row in data["rows"]:
        if not isinstance(row, dict) or row.get("name") not in ROW_NAMES:
            raise ValueError("rows contain an unknown name")
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
            raise ValueError(f"{name}: frames must be nonempty relative paths")
    return named


def load_frame(root, relative, label):
    path = (root / relative).resolve()
    if Path(relative).is_absolute() or not path.is_relative_to(root.resolve()):
        raise ValueError(f"{label}: source must be relative and inside selections directory: {relative}")
    try:
        with Image.open(path) as source:
            if source.mode != "RGBA":
                raise ValueError(f"{label}: expected RGBA, got {source.mode}: {relative}")
            frame = source.copy()
    except OSError as exc:
        raise ValueError(f"{label}: cannot read {relative}: {exc}") from exc
    bbox = frame.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"{label}: empty alpha: {relative}")
    return frame, bbox, hashlib.sha256(path.read_bytes()).hexdigest()


def row_translation(row, bbox):
    anchor = coordinates(row.get("anchor", [(bbox[0] + bbox[2]) // 2, bbox[3]]),
                         2, f"{row['name']} anchor")
    offset = [target - native for target, native in zip(ANCHOR, anchor)]
    if any(value != int(value) for value in offset):
        raise ValueError(f"{row['name']}: anchor must produce integer translation")
    return [int(value) for value in offset]


def translated_metadata(row, offset):
    result = {}
    if "metadata" in row:
        result["metadata"] = row["metadata"]
    for key in ("palms", "headbounds"):
        if key not in row:
            continue
        values = row[key]
        if not isinstance(values, list) or len(values) != len(row["frames"]):
            raise ValueError(f"{row['name']} {key}: expected one entry per frame")
        converted = []
        for value in values:
            if value is None:
                converted.append(None)
            elif key == "palms":
                if not isinstance(value, list):
                    raise ValueError(f"{row['name']} palms: expected list of sockets")
                points = [coordinates(point, 2, "palms") for point in value]
                converted.append([[x + offset[0], y + offset[1]] for x, y in points])
            else:
                left, top, right, bottom = coordinates(value, 4, "headbounds")
                if left >= right or top >= bottom:
                    raise ValueError("headbounds: expected nonempty box")
                converted.append([left + offset[0], top + offset[1],
                                  right + offset[0], bottom + offset[1]])
        result[key] = converted
    return result


def build_sheet(selections):
    path = Path(selections)
    named = read_selections(path)
    sheet = Image.new("RGBA", (CELL[0] * COLUMNS, CELL[1] * len(ROW_NAMES)))
    measurements = []
    idle_heights = []
    for index, name in enumerate(ROW_NAMES):
        row = named[name]
        offset = None
        entries = []
        for column, relative in enumerate(row["frames"]):
            label = f"{name} frame {column}"
            source, bbox, digest = load_frame(path.parent, relative, label)
            if offset is None:
                offset = row_translation(row, bbox)
            left, top, right, bottom = [value + offset[axis % 2]
                                        for axis, value in enumerate(bbox)]
            if left < 0 or top < 0 or right > CELL[0] or bottom > CELL[1]:
                raise ValueError(f"{label}: alpha bounds {(left, top, right, bottom)} clips outside {CELL}")
            sheet.paste(source.crop(bbox), (column * CELL[0] + left, index * CELL[1] + top))
            entries.append({"source": relative, "sha256": digest,
                            "source_size": list(source.size), "source_bounds": list(bbox),
                            "bounds": [left, top, right, bottom]})
            if index < 3:
                idle_heights.append(bottom - top)
        measurements.append({"row": index, "name": name, "offset": offset,
                             "frames": entries, "bounds": [entry["bounds"] for entry in entries],
                             **translated_metadata(row, offset)})
    return sheet, {
        "cell": list(CELL), "columns": COLUMNS, "size": list(sheet.size),
        "anchor": list(ANCHOR), "pixel_scale": 1, "frame_counts": list(FRAME_COUNTS),
        "frame_count": sum(FRAME_COUNTS), "bodyH": max(idle_heights),
        "bodyH_basis": "maximum alpha height across the first three idle rows; includes held props",
        "rowoffsets": [row["offset"] for row in measurements], "rows": measurements,
    }


def review_sheet(sheet, report):
    label_height = 24
    review = Image.new("RGB", (sheet.width, (CELL[1] + label_height) * len(ROW_NAMES)), (48, 54, 63))
    draw = ImageDraw.Draw(review)
    for row in report["rows"]:
        index = row["row"]
        y = index * (CELL[1] + label_height)
        draw.text((4, y + 4), f"{index:02} {row['name']} ({len(row['frames'])})", fill="white")
        strip = sheet.crop((0, index * CELL[1], sheet.width, (index + 1) * CELL[1]))
        review.paste(strip, (0, y + label_height), strip.getchannel("A"))
    return review


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--selections", type=Path, default=ROOT / "selections.json")
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    try:
        sheet, report = build_sheet(args.selections)
        review = review_sheet(sheet, report)
        manifest_text = json.dumps(report, indent=2, allow_nan=False) + "\n"
        destination = args.output_dir or args.selections.parent
        destination.mkdir(parents=True, exist_ok=True)
        sheet.save(destination / "donatello-candidate.png")
        review.save(destination / "sheet-review.png")
        (destination / "manifest.json").write_text(
            manifest_text, encoding="utf-8")
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Donatello atlas: {exc}\n")
    print(f"Packed {report['frame_count']} cells into {sheet.width}x{sheet.height}: {destination}")


if __name__ == "__main__":
    main()
