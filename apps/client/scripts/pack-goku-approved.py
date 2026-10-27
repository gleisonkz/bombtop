"""Pack explicitly mapped approved Goku frames; never extract ZIPs or modify inputs.

Manifest v1: source_root relative to manifest; rows contains all ROW_NAMES.
Each row: name, frames (local PNG paths), pivot [x,y] in original canvas
coordinates OR anchor_frame path (alpha bbox center / exclusive bottom),
optional indices (zero-based playback selection), optional
reference_index identifying the V3 template. Supply measured pivots, not bounds
normalized independently per frame. Already-filtered lists need no indices.
Lobby has the same fields except name and supplies seven transformation poses;
its first keypose is copied pixel-for-pixel from packed gameplay idle.

Manifest scale optionally overrides 140/104 globally, with a required nonempty
scale_basis describing the explicit measurement. No per-family scale overrides.
One nominal scale applies to every original canvas. Pillow rounds the
scaled V3 canvas to 199x199, corrected 128x128 to 172x172, and native
60x104 to 81x140; pivots use each
rounded canvas's effective axis scales. Coordinates use
pixel-edge units consistently; integer translation has at most .5px rounding.
Default exports candidates/contact sheets/GIFs/report to .agent/goku-approved.
Only --write promotes both complete atlases. No runtime metadata is changed.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MANIFEST = ROOT / "concept/goku/approved-taller/manifest.json"
CELL = (146, 192)
ANCHOR = (71.5, 186)
LOBBY_CELL = (128, 207)
LOBBY_ANCHOR = (64, 194)
SCALE = 140 / 104
CANVAS = 148
SCALED_CANVAS = round(CANVAS * SCALE)
EFFECTIVE_SCALE = SCALED_CANVAS / CANVAS
ROW_NAMES = (
    "idle.down", "idle.side", "idle.up", "walk.down", "walk.side", "walk.up",
    "stun", "death", "cast.down", "cast.side", "cast.up", "carryIdle.down",
    "carryIdle.side", "carryIdle.up", "carryWalk.down", "carryWalk.side",
    "carryWalk.up", "celebrate",
)
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)
PLAYBACK = (0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0, 0)


def selected_frames(row, count, label):
    frames = row.get("frames")
    if not isinstance(frames, list) or not frames or any(not isinstance(p, str) or not p for p in frames):
        raise ValueError(f"{label}: frames must be nonempty local paths")
    indices = row.get("indices", list(range(len(frames))))
    if (not isinstance(indices, list) or len(indices) != count
            or any(type(i) is not int or not 0 <= i < len(frames) for i in indices)
            or len(set(indices)) != count):
        raise ValueError(f"{label}: invalid selection/count; expected {count} distinct indices")
    reference = row.get("reference_index")
    if reference is not None:
        if type(reference) is not int or not 0 <= reference < len(frames):
            raise ValueError(f"{label}: invalid reference_index")
        retain = label == "death" or label.startswith("cast.")
        if (reference in indices) != retain:
            raise ValueError(f"{label}: reference must be {'retained' if retain else 'excluded'}")
    selected = [frames[i] for i in indices]
    if len(set(selected)) != count:
        raise ValueError(f"{label}: duplicate selected frame paths")
    return list(zip(indices, selected))


def read_manifest(path):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or type(data.get("version")) is not int or data["version"] != 1:
        raise ValueError("manifest version must be 1")
    source = data.get("source_root")
    if not isinstance(source, str) or not source or Path(source).is_absolute():
        raise ValueError("source_root must be a relative local path")
    rows = data.get("rows")
    if not isinstance(rows, list) or len(rows) != 18:
        raise ValueError("rows must contain exactly 18 named rows")
    named = {}
    for row in rows:
        if not isinstance(row, dict) or row.get("name") not in ROW_NAMES or row["name"] in named:
            raise ValueError("unknown or duplicate row name")
        named[row["name"]] = row
    if not isinstance(data.get("lobby"), dict):
        raise ValueError("lobby must supply seven transformation poses")
    return (path.parent / source).resolve(), named, data["lobby"]


def load_frame(source_root, name, label):
    if not isinstance(name, str) or not name:
        raise ValueError(f"{label}: frame path must be nonempty")
    path = (source_root / name).resolve()
    if not path.is_relative_to(source_root):
        raise ValueError(f"{label}: frame escapes source_root: {name}")
    with Image.open(path) as source:
        if source.mode != "RGBA" or source.size not in ((192, 192), (148, 148), (128, 128), (128, 160), (60, 104)):
            raise ValueError(f"{label}: unsupported native RGBA canvas: {name}")
        frame = source.copy()
    alpha = frame.getchannel("A")
    if alpha.getbbox() is None:
        raise ValueError(f"{label}: blank alpha: {name}")
    if alpha.getextrema()[0] != 0:
        raise ValueError(f"{label}: missing transparent background: {name}")
    frame.paste((0, 0, 0, 0), mask=alpha.point(lambda value: 255 if value == 0 else 0))
    return frame, hashlib.sha256(path.read_bytes()).hexdigest()


def register_strip(source_root, row, count, label, cell, anchor, *, scale=SCALE):
    selection = selected_frames(row, count, label)
    anchor_name = row.get("anchor_frame")
    if anchor_name is not None and "pivot" in row:
        raise ValueError(f"{label}: supply pivot OR anchor_frame")
    reference, reference_hash = load_frame(source_root, anchor_name if anchor_name is not None else selection[0][1], label)
    bounds = reference.getchannel("A").getbbox()
    pivot = [(bounds[0] + bounds[2]) / 2, bounds[3]] if anchor_name is not None else row.get("pivot")
    if (not isinstance(pivot, list) or len(pivot) != 2
            or any(type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v <= size for v, size in zip(pivot, reference.size))):
        raise ValueError(f"{label}: pivot must contain two finite canvas coordinates")
    scaled_size = tuple(round(size * scale) for size in reference.size)
    if min(scaled_size) < 1:
        raise ValueError(f"{label}: scale produces empty canvas")
    axis_scales = tuple(target / size for target, size in zip(scaled_size, reference.size))
    offset = tuple(round(a - p * scale) for a, p, scale in zip(anchor, pivot, axis_scales))
    cells, records = [], []
    hashes = set()
    for index, name in selection:
        frame, source_hash = load_frame(source_root, name, label)
        if frame.size != reference.size:
            raise ValueError(f"{label}: mixed canvas sizes within row")
        digest = hashlib.sha256(frame.tobytes()).hexdigest()
        if digest in hashes:
            raise ValueError(f"{label}: duplicate authored pixels: {name}")
        hashes.add(digest)
        scaled = frame.resize(scaled_size, Image.Resampling.NEAREST)
        bounds = scaled.getchannel("A").getbbox()
        placed = [bounds[0] + offset[0], bounds[1] + offset[1], bounds[2] + offset[0], bounds[3] + offset[1]]
        if placed[0] < 1 or placed[1] < 1 or placed[2] > cell[0] - 1 or placed[3] > cell[1] - 2:
            raise ValueError(f"{label} source {index}: overflow/gutter violation {placed} in {cell}")
        output = Image.new("RGBA", cell)
        output.paste(scaled.crop(bounds), (placed[0], placed[1]))
        cells.append(output)
        records.append({"name": label, "source_index": index, "path": name,
                        "sha256": source_hash, "anchor_frame": anchor_name,
                        "anchor_sha256": reference_hash, "source_size": frame.size,
                        "axis_scales": axis_scales,
                        "pivot": pivot, "offset": offset, "bounds": placed})
    return cells, records


def build(manifest):
    source_root, rows, lobby = read_manifest(Path(manifest))
    data = json.loads(Path(manifest).read_text(encoding="utf-8-sig"))
    scale = data.get("scale", SCALE)
    if type(scale) not in (int, float) or not math.isfinite(scale) or not 0 < scale <= 4:
        raise ValueError("scale must be finite and within (0, 4]")
    basis = data.get("scale_basis")
    if "scale" in data and (not isinstance(basis, str) or not basis.strip()):
        raise ValueError("explicit scale requires measured scale_basis")
    gameplay = Image.new("RGBA", (CELL[0] * 9, CELL[1] * 18))
    report = {"nominal_scale": scale, "scale_basis": basis or "140 target / 104 native reference height",
              "native_reference": [60, 104], "gameplay_cell": CELL, "gameplay_anchor": ANCHOR,
              "lobby_cell": LOBBY_CELL, "lobby_anchor": LOBBY_ANCHOR,
              "manifest_sha256": hashlib.sha256(Path(manifest).read_bytes()).hexdigest(),
              "gameplay": [], "playback": PLAYBACK}
    for row_index, (name, count) in enumerate(zip(ROW_NAMES, COUNTS)):
        cells, records = register_strip(source_root, rows[name], count, name, CELL, ANCHOR, scale=scale)
        for column, (cell, record) in enumerate(zip(cells, records)):
            gameplay.paste(cell, (column * CELL[0], row_index * CELL[1]))
            report["gameplay"].append({**record, "row": row_index, "column": column})
    idle = gameplay.crop((0, 0, *CELL))
    idle_offset = tuple(round(a - b) for a, b in zip(LOBBY_ANCHOR, ANCHOR))
    bounds = idle.getchannel("A").getbbox()
    if (bounds[0] + idle_offset[0] < 1 or bounds[2] + idle_offset[0] > LOBBY_CELL[0] - 1
            or bounds[1] + idle_offset[1] < 1 or bounds[3] + idle_offset[1] > LOBBY_CELL[1] - 2):
        raise ValueError("gameplay idle overflow in lobby cell")
    rest = Image.new("RGBA", LOBBY_CELL)
    rest.paste(idle, idle_offset)
    poses, report["lobby"] = register_strip(source_root, lobby, 7, "lobby", LOBBY_CELL, LOBBY_ANCHOR, scale=scale)
    poses.insert(0, rest)
    strip = Image.new("RGBA", (LOBBY_CELL[0] * 16, LOBBY_CELL[1]))
    for column, pose in enumerate(PLAYBACK):
        strip.paste(poses[pose], (column * LOBBY_CELL[0], 0))
    report["idle_lobby_offset"] = idle_offset
    report["idle_anchor_rounding_error"] = [idle_offset[i] + ANCHOR[i] - LOBBY_ANCHOR[i] for i in range(2)]
    return gameplay, strip, report


def diagnostics(sheet, cell, counts, prefix):
    contact = Image.new("RGB", (sheet.width, len(counts) * (cell[1] + 20)), "#576271")
    draw = ImageDraw.Draw(contact)
    for row, count in enumerate(counts):
        y = row * (cell[1] + 20)
        draw.text((2, y + 2), f"row {row}: {count} frames", fill="white")
        band = sheet.crop((0, row * cell[1], sheet.width, (row + 1) * cell[1]))
        contact.paste(band, (0, y + 20), band)
    contact.save(str(prefix) + "-contact.png")
    frames = []
    columns = min(6, len(counts))
    for tick in range(72 if len(counts) > 1 else 16):
        image = Image.new("RGB", (cell[0] * columns, (cell[1] + 20) * math.ceil(len(counts) / columns)), "#576271")
        draw = ImageDraw.Draw(image)
        for row, count in enumerate(counts):
            col = tick % count
            pose = sheet.crop((col * cell[0], row * cell[1], (col + 1) * cell[0], (row + 1) * cell[1]))
            x, y = row % columns * cell[0], row // columns * (cell[1] + 20)
            draw.text((x + 2, y + 2), f"row {row} frame {col}", fill="white")
            image.paste(pose, (x, y + 20), pose)
        frames.append(image)
    frames[0].save(str(prefix) + "-preview.gif", save_all=True, append_images=frames[1:], duration=120, loop=0, disposal=2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--write", action="store_true", help="Promote both validated atlases")
    args = parser.parse_args()
    try:
        gameplay, lobby, report = build(args.manifest)
        destination = ROOT / ".agent/goku-approved"
        source_root, _, _ = read_manifest(args.manifest)
        if source_root == destination or source_root.is_relative_to(destination) or destination.is_relative_to(source_root):
            raise ValueError("candidate output must not overlap source_root")
        destination.mkdir(parents=True, exist_ok=True)
        for name, image, cell, counts in (("goku", gameplay, CELL, COUNTS), ("goku-lobby", lobby, LOBBY_CELL, (16,))):
            image.save(destination / f"{name}-candidate.png")
            diagnostics(image, cell, counts, destination / name)
        (destination / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        if args.write:
            gameplay.save(ROOT / "apps/client/public/sprites/goku.png")
            lobby.save(ROOT / "apps/client/public/sprites/goku-lobby.png")
    except (ValueError, OSError, TypeError) as exc:
        parser.exit(1, f"Approved Goku: {exc}\n")
    print(f"108 gameplay frames; 8 lobby keyposes / 16 playback frames: {destination}")


if __name__ == "__main__":
    main()
