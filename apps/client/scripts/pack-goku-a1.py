"""Pack 108 A1 native frames using the Lanterna restart-skeleton geometry.

jobs.json is a list, or {"rows": [...]}, with 18 zero-based rows containing
{row, direction, poses: ["rXX-cYY", ...], job_id}. Every cell is explicit.
Sources are raw/<pose>.png beside jobs.json: native 128x160 RGBA PNG only.
The approved 60x104 reference must already be padded by the generation owner.
No resizing, recoloring, cleanup, alpha masking, mirroring or inferred holds.

--anchor X Y is required: supply measured native pixel-edge coordinates.
The reported packed anchor adds two pixels; it never translates the artwork.
Default writes candidate/contact/GIF/report into .agent/goku-a1-packer only.
--write additionally promotes gameplay goku.png; lobby and runtime metadata
remain coordinator-owned. A structural pass does not prove A1/COCO provenance
or visual identity: the coordinator reviews job inputs and generated pixels.
"""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[3]
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)
NATIVE = (128, 160)
CELL = (132, 164)
ATLAS = (1188, 2952)
MARGIN = 2
DEFAULT_JOBS = ROOT / "concept/goku/a1-redraw/jobs.json"
OUTPUT = ROOT / ".agent/goku-a1-packer"
PUBLIC = ROOT / "apps/client/public/sprites/goku.png"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def read_jobs(path):
    payload = path.read_bytes()
    data = json.loads(payload.decode("utf-8-sig"))
    rows = data.get("rows") if isinstance(data, dict) else data
    if not isinstance(rows, list) or len(rows) != len(COUNTS):
        raise ValueError("jobs must supply exactly 18 rows")
    indexed = {}
    for item in rows:
        if not isinstance(item, dict):
            raise ValueError("each job row must be an object")
        row = item.get("row")
        if type(row) is not int or not 0 <= row < len(COUNTS) or row in indexed:
            raise ValueError("unknown or duplicate row")
        if item.get("direction") not in ("south", "east", "north", "west"):
            raise ValueError(f"row {row}: invalid direction")
        if not isinstance(item.get("job_id"), str) or not item["job_id"].strip():
            raise ValueError(f"row {row}: nonempty job_id required")
        expected = [f"r{row:02}-c{col:02}" for col in range(COUNTS[row])]
        if item.get("poses") != expected:
            raise ValueError(f"row {row}: poses must map every cell in column order: {expected}")
        indexed[row] = item
    return indexed, sha256(payload)


def load_native(path):
    payload = path.read_bytes()
    with Image.open(io.BytesIO(payload)) as image:
        if image.format != "PNG" or image.mode != "RGBA" or image.size != NATIVE:
            raise ValueError(f"{path.name}: expected native 128x160 RGBA PNG")
        if getattr(image, "n_frames", 1) != 1:
            raise ValueError(f"{path.name}: animated input is not a native frame")
        alpha = image.getchannel("A")
        if alpha.getbbox() is None:
            raise ValueError(f"{path.name}: blank frame")
        if alpha.getextrema()[0] != 0:
            raise ValueError(f"{path.name}: transparent background required")
        return image.copy(), sha256(payload)


def measured_anchor(anchor):
    if not isinstance(anchor, (tuple, list)) or len(anchor) != 2:
        raise ValueError("anchor must contain two measured native coordinates")
    for coordinate, limit in zip(anchor, NATIVE):
        if (type(coordinate) not in (int, float) or not math.isfinite(coordinate)
                or not 0 <= coordinate <= limit):
            raise ValueError("anchor must be finite native pixel-edge coordinates")
    return list(anchor)


def build(jobs_path, anchor):
    native_anchor = measured_anchor(anchor)
    jobs_path = jobs_path.resolve()
    rows, jobs_hash = read_jobs(jobs_path)
    source_root = jobs_path.parent
    sheet = Image.new("RGBA", ATLAS)
    frames = []
    seen = {}
    for row, count in enumerate(COUNTS):
        job = rows[row]
        for col in range(count):
            pose = job["poses"][col]
            relative = f"raw/{pose}.png"
            path = (source_root / relative).resolve()
            if not path.is_relative_to(source_root):
                raise ValueError(f"{pose}: source escapes jobs directory")
            image, file_hash = load_native(path)
            # Ignore invisible RGB for duplicate detection only, never for packing.
            visible = bytes(channel if pixel[3] else 0
                            for pixel in image.getdata() for channel in pixel)
            pixel_hash = sha256(visible)
            hold = job.get("holds", {}).get(pose)
            if pixel_hash in seen:
                if row not in (0, 1, 2, 11, 12, 13) or hold != seen[pixel_hash]:
                    raise ValueError(f"{pose}: duplicate authored pixels of {seen[pixel_hash]}")
            elif hold:
                raise ValueError(f"{pose}: declared hold does not match its source pixels")
            else:
                seen[pixel_hash] = pose
            x, y = col * CELL[0] + MARGIN, row * CELL[1] + MARGIN
            sheet.paste(image, (x, y))
            frames.append(dict(row=row, col=col, pose=pose, direction=job["direction"],
                               job_id=job.get("overrides", {}).get(pose, {}).get("job_id", job["job_id"]),
                               hold_of=hold, source=relative, sha256=file_hash,
                               visible_rgba_sha256=pixel_hash,
                               bounds=list(image.getchannel("A").getbbox())))
    report = dict(width=ATLAS[0], height=ATLAS[1], frameW=CELL[0], frameH=CELL[1],
                  native_frame=list(NATIVE), padding=[MARGIN, MARGIN], counts=list(COUNTS),
                  occupied=len(frames), unique_poses=len(seen), native_anchor=native_anchor,
                  packed_anchor=[value + MARGIN for value in native_anchor],
                  jobs=str(jobs_path), jobs_sha256=jobs_hash, source_root=str(source_root),
                  frames=frames, validation="structural; visual/provenance review required",
                  lobby="deferred; no transformation or lobby configuration inferred")
    return sheet, report


def verify_inputs(report):
    jobs = Path(report["jobs"])
    if sha256(jobs.read_bytes()) != report["jobs_sha256"]:
        raise ValueError("jobs changed during packing; rebuild required")
    source_root = Path(report["source_root"])
    for frame in report["frames"]:
        path = (source_root / frame["source"]).resolve()
        if not path.is_relative_to(source_root) or sha256(path.read_bytes()) != frame["sha256"]:
            raise ValueError(f"{frame['pose']}: input changed during packing; rebuild required")


def diagnostics(sheet, destination):
    contact = Image.new("RGB", (ATLAS[0], 18 * (CELL[1] + 20)), "#576271")
    draw = ImageDraw.Draw(contact)
    for row, count in enumerate(COUNTS):
        y = row * (CELL[1] + 20)
        draw.text((2, y + 2), f"r{row:02}: {count} native poses", fill="white")
        band = sheet.crop((0, row * CELL[1], ATLAS[0], (row + 1) * CELL[1]))
        contact.paste(band, (0, y + 20), band)
    contact.save(destination / "contact.png")
    previews = []
    for tick in range(72):
        panel = Image.new("RGB", (6 * CELL[0], 3 * (CELL[1] + 20)), "#576271")
        draw = ImageDraw.Draw(panel)
        for row, count in enumerate(COUNTS):
            col = tick % count
            pose = sheet.crop((col * CELL[0], row * CELL[1], (col + 1) * CELL[0], (row + 1) * CELL[1]))
            x, y = row % 6 * CELL[0], row // 6 * (CELL[1] + 20)
            draw.text((x + 2, y + 2), f"r{row:02}-c{col:02}", fill="white")
            panel.paste(pose, (x, y + 20), pose)
        previews.append(panel)
    previews[0].save(destination / "preview.gif", save_all=True, append_images=previews[1:],
                     duration=120, loop=0, disposal=2)


def export(sheet, report, destination):
    destination = destination.resolve()
    source_root = Path(report["source_root"]).resolve()
    if destination.is_relative_to(source_root) or source_root.is_relative_to(destination):
        raise ValueError("output must not overlap the input directory")
    targets = [destination / name for name in ("candidate.png", "contact.png", "preview.gif", "report.json")]
    if any(target.is_symlink() for target in targets):
        raise ValueError("output files must not be symbolic links")
    verify_inputs(report)
    destination.mkdir(parents=True, exist_ok=True)
    sheet.save(destination / "candidate.png")
    diagnostics(sheet, destination)
    verify_inputs(report)
    exported = dict(report, candidate_sha256=sha256((destination / "candidate.png").read_bytes()))
    (destination / "report.json").write_text(json.dumps(exported, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--jobs", type=Path, default=DEFAULT_JOBS)
    parser.add_argument("--anchor", type=float, nargs=2, required=True, metavar=("X", "Y"))
    parser.add_argument("--write", action="store_true", help="Promote validated gameplay only; coordinator reviews first")
    args = parser.parse_args()
    try:
        sheet, report = build(args.jobs, args.anchor)
        export(sheet, report, OUTPUT)
        if args.write:
            verify_inputs(report)
            if PUBLIC.is_symlink():
                raise ValueError("public destination must not be a symbolic link")
            PUBLIC.write_bytes((OUTPUT / "candidate.png").read_bytes())
    except (ValueError, OSError, TypeError) as exc:
        parser.exit(1, f"Goku A1: {exc}\n")
    print(f"108 occupied cells, {report['unique_poses']} distinct drawings, explicit idle holds; 1188x2952 candidate: {OUTPUT}")


if __name__ == "__main__":
    main()
