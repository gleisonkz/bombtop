"""Pack Lantern reskins without resampling, translation or alpha compositing.

Defaults: concept/lantern/redraw/{pose-map.json,generated/,candidate.png,report.json}.
Cells are already padded 132x164 RGBA images; repeated pose names are holds.
Only structural checks are performed. Occupied edge pixels are valid.
"""
import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MAP = ROOT / "concept/lantern/redraw/pose-map.json"
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)
CELL = (132, 164)
SIZE = (1188, 2952)


def read_map(path):
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict) or data.get("counts") != list(COUNTS):
        raise ValueError("counts must match the 18 Lantern rows (108 cells)")
    cells = data.get("cells")
    if not isinstance(cells, list) or len(cells) != sum(COUNTS):
        raise ValueError("cells must contain exactly 108 mappings")
    mapped = {}
    for cell in cells:
        if not isinstance(cell, dict):
            raise ValueError("each cell must contain row, col and pose")
        row, col, pose = (cell.get(key) for key in ("row", "col", "pose"))
        if (type(row) is not int or type(col) is not int
                or not 0 <= row < 18 or not 0 <= col < COUNTS[row]):
            raise ValueError(f"invalid cell coordinates: {row}, {col}")
        if (not isinstance(pose, str) or not pose or pose in (".", "..")
                or any(char in pose for char in '/\\:')):
            raise ValueError(f"invalid pose name: {pose!r}")
        if (row, col) in mapped:
            raise ValueError(f"duplicate cell: {row}, {col}")
        mapped[row, col] = pose
    return mapped


def load_pose(path):
    try:
        with Image.open(path) as source:
            if source.mode != "RGBA":
                raise ValueError(f"{path}: expected RGBA with alpha, got {source.mode}")
            if source.size != CELL:
                raise ValueError(f"{path}: expected 132x164, got {source.size}")
            image = source.copy()
    except OSError as error:
        raise ValueError(f"cannot read pose: {path}") from error
    if image.getchannel("A").getbbox() is None:
        raise ValueError(f"empty alpha: {path}")
    return image


def build_sheet(pose_map):
    path = Path(pose_map)
    mapped = read_map(path)
    poses = {pose: load_pose(path.parent / "generated" / f"{pose}.png")
             for pose in sorted(set(mapped.values()))}
    sheet = Image.new("RGBA", SIZE)
    rows = []
    for row, count in enumerate(COUNTS):
        bounds = []
        names = []
        for col in range(count):
            pose = mapped[row, col]
            image = poses[pose]
            sheet.paste(image, (col * CELL[0], row * CELL[1]))
            bounds.append(list(image.getchannel("A").getbbox()))
            names.append(pose)
        rows.append({"row": row, "count": count, "poses": names, "bounds": bounds,
                     "union": [min(b[0] for b in bounds), min(b[1] for b in bounds),
                               max(b[2] for b in bounds), max(b[3] for b in bounds)]})
    report = {
        "width": SIZE[0], "height": SIZE[1], "frameW": CELL[0], "frameH": CELL[1],
        "columns": 9, "rowCount": 18, "count": sum(COUNTS), "counts": list(COUNTS),
        "unique_poses": len(poses), "pixel_scale": 1,
        "bodyH": max(b[3] - b[1] for row in rows[:3] for b in row["bounds"]),
        "rows": rows,
    }
    return sheet, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pose-map", type=Path, default=DEFAULT_MAP)
    args = parser.parse_args()
    try:
        sheet, report = build_sheet(args.pose_map)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    sheet.save(args.pose_map.parent / "candidate.png")
    (args.pose_map.parent / "report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
