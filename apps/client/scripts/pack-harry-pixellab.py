"""Pack native Harry RGBA strips without scaling or per-frame registration.

Frame paths resolve from source_root (default '.') relative to the manifest.
Rows use canonical gameplay names; lobby and victory are separate objects.
Optional strip anchors use native pixel-edge coordinates, mapping to [112,212]
(pixel-center registration [111.5,211]). Fractional translations are rejected.
All sources are validated before any outputs are created or overwritten.
"""
import argparse
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DIR = ROOT / "concept/harry/pixellab-redraw"
CELL = 224
ROW_NAMES = (
    "idle.down", "idle.side", "idle.up", "walk.down", "walk.side", "walk.up",
    "stun", "death", "cast.down", "cast.side", "cast.up", "carryIdle.down",
    "carryIdle.side", "carryIdle.up", "carryWalk.down", "carryWalk.side", "carryWalk.up",
)
FRAME_COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6)


def read_manifest(path):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or not isinstance(data.get("rows"), list):
        raise ValueError("manifest must contain a rows list")
    source_root = data.get("source_root", ".")
    if not isinstance(source_root, str) or not source_root:
        raise ValueError("source_root must be a nonempty path")
    named = {}
    for row in data["rows"]:
        if not isinstance(row, dict) or row.get("name") not in ROW_NAMES:
            raise ValueError("unknown gameplay row")
        name = row["name"]
        if name in named:
            raise ValueError(f"duplicate row: {name}")
        named[name] = row
    if set(named) != set(ROW_NAMES):
        raise ValueError("missing gameplay rows")
    strips = [(name, named[name], count) for name, count in zip(ROW_NAMES, FRAME_COUNTS)]
    strips.extend((name, data.get(name), count) for name, count in (("lobby", 8), ("victory", 16)))
    for name, strip, count in strips:
        frames = strip.get("frames") if isinstance(strip, dict) else None
        if not isinstance(frames, list) or len(frames) != count:
            raise ValueError(f"{name}: expected {count} frames")
        if any(not isinstance(frame, str) or not frame for frame in frames):
            raise ValueError(f"{name}: frame paths must be nonempty strings")
    return path.parent / source_root, strips


def load_frame(path, label):
    try:
        with Image.open(path) as source:
            if source.mode != "RGBA":
                raise ValueError(f"{label}: expected RGBA, got {source.mode}")
            if not all(0 < size <= 512 for size in source.size):
                raise ValueError(f"{label}: native dimensions must be <=512: {source.size}")
            frame = source.copy()
    except OSError as exc:
        raise ValueError(f"{label}: cannot read {path}: {exc}") from exc
    bbox = frame.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"{label}: empty alpha")
    return frame, bbox


def build_strip(source_root, name, strip):
    frames = []
    bounds = []
    sizes = []
    offset = None
    for index, frame_path in enumerate(strip["frames"]):
        frame, bbox = load_frame(source_root / frame_path, f"{name} frame {index}")
        if offset is None:
            anchor = strip.get("anchor", [(bbox[0] + bbox[2]) / 2, bbox[3]])
            if (not isinstance(anchor, list) or len(anchor) != 2
                    or any(type(value) not in (int, float) or not math.isfinite(value) for value in anchor)):
                raise ValueError(f"{name}: anchor must be two finite native edge coordinates")
            delta = (112 - anchor[0], 212 - anchor[1])
            if any(value != int(value) for value in delta):
                raise ValueError(f"{name}: anchor must produce an integer translation")
            offset = tuple(int(value) for value in delta)
        translated = [bbox[0] + offset[0], bbox[1] + offset[1],
                      bbox[2] + offset[0], bbox[3] + offset[1]]
        left, top, right, bottom = translated
        if left < 0 or top < 0 or right > CELL or bottom > CELL:
            raise ValueError(f"{name} frame {index}: alpha bounds {translated} clip cell {CELL}")
        frames.append((frame.crop(bbox), (left, top)))
        bounds.append(translated)
        sizes.append(list(frame.size))
    return frames, {"name": name, "sourcepaths": strip["frames"], "offset": list(offset),
                    "bounds": bounds, "source_sizes": sizes}


def pack(manifest=DEFAULT_DIR / "manifest.json", output_dir=DEFAULT_DIR):
    source_root, strips = read_manifest(Path(manifest))
    # Prepare every strip first, including the final victory frame, before writing.
    prepared = [build_strip(source_root, name, strip) for name, strip, _ in strips]
    gameplay = Image.new("RGBA", (2016, 3808))
    lobby = Image.new("RGBA", (1792, CELL))
    victory = Image.new("RGBA", (3584, CELL))
    for row, (frames, _) in enumerate(prepared):
        sheet = gameplay if row < 17 else (lobby if row == 17 else victory)
        y = row * CELL if row < 17 else 0
        for column, (frame, (left, top)) in enumerate(frames):
            # Unmasked paste preserves source RGBA bytes, including partial alpha.
            sheet.paste(frame, (column * CELL + left, y + top))
    rows = [measurement for _, measurement in prepared[:17]]
    lobby_report, victory_report = prepared[17][1], prepared[18][1]
    lobby_report["bodyH"] = lobby_report["bounds"][0][3] - lobby_report["bounds"][0][1]
    lobby_report["bodyH_basis"] = "initial lobby source alpha height"
    report = {
        "geometry": {"columns": 9, "rows": 17, "cell": [CELL, CELL],
                     "size": [2016, 3808], "anchor": [111.5, 211], "anchor_edge": [112, 212]},
        "pixel_scale": 1, "frame_counts": list(FRAME_COUNTS),
        "bodyH": max(b[3] - b[1] for row in rows[:3] for b in row["bounds"]),
        "bodyH_basis": "maximum alpha height across the three standing idle rows",
        "rows": rows, "lobby": lobby_report, "victory": victory_report,
    }
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    for sheet, filename in ((gameplay, "harry-candidate.png"), (lobby, "harry-lobby-candidate.png"),
                            (victory, "harry-victory-candidate.png")):
        sheet.save(output_dir / filename, format="PNG")
    (output_dir / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_DIR / "manifest.json")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_DIR)
    args = parser.parse_args()
    try:
        pack(args.manifest, args.output_dir)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Harry atlas: {exc}\n")


if __name__ == "__main__":
    main()
