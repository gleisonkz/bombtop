"""Pack native Panther PNGs without resampling or runtime edits.

Usage: python pack.py --manifest manifest.json --output candidate.png
Writes candidate.png, candidate-lobby.png (if supplied), candidate-report.json.
Rows follow CONTRACT below; lobby is optional. Frames are relative PNG paths
(e.g. generated/idle-south/frame_000.png) or explicit {"hold": earlier_index}.
Each row anchor [x,y] is its shared source registration point, default [112,208].
Output anchor is always [112,208]. One integer translation applies to the entire
row, including optional head/palms metadata on frame objects with a `path` key.
Metadata uses {x,y,...} points or lists thereof; other fields are retained.
Cells use 224px, automatically growing to 256px if necessary; one pixel alpha
gutters are mandatory. Fully transparent oversized source padding is harmless.
Structural acceptance does not certify anatomy, motion, identity or absence of FX.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image

CONTRACT = tuple(
    (f"{name}.{direction}", count)
    for name, count in (("idle", 4), ("walk", 6))
    for direction in ("down", "side", "up")
) + (("stun", 6), ("death", 7)) + tuple(
    (f"{name}.{direction}", count)
    for name, count in (("cast", 6), ("carryIdle", 4), ("carryWalk", 6))
    for direction in ("down", "side", "up")
) + (("lobby", 16),)
ANCHOR = (112, 208)


def translation(anchor):
    if not isinstance(anchor, list) or len(anchor) != 2:
        raise ValueError("anchor must be [x,y]")
    if any(type(value) not in (int, float) for value in anchor):
        raise ValueError("anchor must be numeric")
    delta = [target - source for target, source in zip(ANCHOR, anchor)]
    if any(not float(value).is_integer() for value in delta):
        raise ValueError("anchor translation must use integer pixels")
    return tuple(map(int, delta))


def transform(value, delta):
    if isinstance(value, list):
        return [transform(item, delta) for item in value]
    if isinstance(value, dict):
        result = dict(value)
        if "x" in result and "y" in result:
            result["x"] += delta[0]
            result["y"] += delta[1]
        return result
    raise ValueError("head/palms must be point objects or lists of points")


def load_rows(path):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    rows = data.get("rows")
    if not isinstance(rows, list) or len(rows) not in (17, 18):
        raise ValueError("expected 17 gameplay rows and optional lobby row")
    loaded = []
    for row, (name, count) in zip(rows, CONTRACT):
        if row.get("name") != name:
            raise ValueError(f"expected row {name}")
        frames = row.get("frames")
        if not isinstance(frames, list) or len(frames) != count:
            raise ValueError(f"{name}: expected {count} frames")
        delta = translation(row.get("anchor", data.get("anchor", list(ANCHOR))))
        images, records, hashes = [], [], set()
        for index, frame in enumerate(frames):
            if isinstance(frame, dict) and "hold" in frame:
                hold = frame["hold"]
                if type(hold) is not int or not 0 <= hold < index or len(frame) != 1:
                    raise ValueError(f"{name}: hold must reference an earlier frame")
                images.append(images[hold])
                records.append({**records[hold], "hold": hold})
                continue
            filename = frame.get("path") if isinstance(frame, dict) else frame
            if not isinstance(filename, str) or not filename:
                raise ValueError(f"{name}: frame path required")
            source = path.parent / filename
            try:
                with Image.open(source) as image:
                    if image.mode != "RGBA":
                        raise ValueError(f"{source}: RGBA required")
                    image = image.copy()
            except OSError as error:
                raise ValueError(f"cannot read {source}") from error
            bounds = image.getchannel("A").getbbox()
            if bounds is None:
                raise ValueError(f"{source}: empty alpha")
            # Include registration/canvas geometry when comparing source frames.
            digest = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
            if digest in hashes:
                raise ValueError(f"{name}: duplicate frame requires explicit hold")
            hashes.add(digest)
            record = {"path": filename, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                      "bounds": [bounds[0] + delta[0], bounds[1] + delta[1],
                                 bounds[2] + delta[0], bounds[3] + delta[1]]}
            if isinstance(frame, dict):
                for key in ("head", "palms"):
                    if key in frame:
                        record[key] = transform(frame[key], delta)
            images.append(image)
            records.append(record)
        loaded.append((name, delta, images, records))
    return loaded


def build_sheet(manifest):
    loaded = load_rows(Path(manifest))
    bounds = [frame["bounds"] for _, _, _, frames in loaded for frame in frames]
    if any(min(box[:2]) < 1 for box in bounds):
        raise ValueError("translated alpha bounds cross the top/left gutter")
    extent = max(max(box[2:]) for box in bounds)
    cell = next((size for size in (224, 256) if extent < size), None)
    if cell is None:
        raise ValueError("alpha bounds exceed 256px cell/gutter; cannot clip")
    atlas = Image.new("RGBA", (7 * cell, 17 * cell))
    lobby = Image.new("RGBA", (16 * cell, cell)) if len(loaded) == 18 else None
    reports = []
    for row_index, (name, delta, images, records) in enumerate(loaded):
        target = lobby if name == "lobby" else atlas
        y = 0 if name == "lobby" else row_index * cell
        for col, image in enumerate(images):
            box = image.getchannel("A").getbbox()
            # Copy raw RGBA (no mask/compositing), retaining exact alpha and RGB.
            target.paste(image.crop(box), (col * cell + box[0] + delta[0], y + box[1] + delta[1]))
        reports.append({"name": name, "row": 0 if name == "lobby" else row_index,
                        "count": len(images), "translation": list(delta), "frames": records})
    report = {"width": atlas.width, "height": atlas.height, "frameW": cell, "frameH": cell,
              "anchorX": ANCHOR[0], "anchorY": ANCHOR[1], "pixel_scale": 1,
              "columns": 7, "rowCount": 17, "count": sum(len(r[2]) for r in loaded),
              "gameplayCount": 91, "rows": reports[:17],
              "lobby": {"width": lobby.width, "height": lobby.height, **reports[17]} if lobby else None}
    return atlas, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        atlas, report = build_sheet(args.manifest)
        # Repack the optional lobby with the same validated contract and cell size.
        lobby = None
        if report["lobby"]:
            _, delta, images, _ = load_rows(args.manifest)[17]
            cell = report["frameW"]
            lobby = Image.new("RGBA", (16 * cell, cell))
            for col, image in enumerate(images):
                box = image.getchannel("A").getbbox()
                lobby.paste(image.crop(box), (col * cell + box[0] + delta[0], box[1] + delta[1]))
        args.output.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(args.output)
        if lobby:
            lobby.save(args.output.with_name(args.output.stem + "-lobby.png"))
        args.output.with_name(args.output.stem + "-report.json").write_text(
            json.dumps(report, indent=2) + "\n", encoding="utf-8")
    except (ValueError, OSError, TypeError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
