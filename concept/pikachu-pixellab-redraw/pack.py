"""Pack generated Pikachu poses into the game's existing 18-row animation contract."""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
CELL = (180, 164)
SCALE = 0.84
SCALED = tuple(round(value * SCALE) for value in CELL)
OFFSET = (round(96 * (1 - SCALE)), 157 - SCALED[1])
ROWS = [
    ("idle-south", 4), ("idle-east", 4), ("idle-north", 4),
    ("walk-south", 6), ("walk-east", 6), ("walk-north", 6),
    ("stun-south", 6), ("death-south", 7),
    ("cast-south", 9), ("cast-east", 9), ("cast-north", 9),
    ("carryIdle-south", 4), ("carryIdle-east", 4), ("carryIdle-north", 4),
    ("carryWalk-south", 6), ("carryWalk-east", 6), ("carryWalk-north", 6),
    ("lobby-south", 8),
]


def source_frames(name, count):
    files = sorted((ROOT / "generated" / name).glob("*.png"))
    required = count + 1 if name.startswith(("walk-", "stun-", "carryWalk-")) else count
    if len(files) < required:
        raise ValueError(f"{name}: {len(files)} source frames, need {required}")
    if name.startswith(("walk-", "stun-", "carryWalk-")):
        files = files[1:count + 1]
    else:
        files = files[:count]
    if name == "cast-north":
        for index in range(5, 9):
            correction = ROOT / "corrections" / f"cast-north-{index}.png"
            if not correction.exists():
                raise ValueError(f"Missing reviewed animal-paw correction: {correction}")
            files[index] = correction
    return files


def packed_frame(path):
    source = Image.open(path).convert("RGBA")
    if source.size != CELL:
        raise ValueError(f"{path}: unexpected source size {source.size}")
    frame = Image.new("RGBA", CELL)
    frame.alpha_composite(source.resize(SCALED, Image.Resampling.NEAREST), OFFSET)
    return frame


def main():
    atlas = Image.new("RGBA", (CELL[0] * 9, CELL[1] * len(ROWS)))
    review = Image.new("RGBA", (CELL[0] * 9, (CELL[1] + 20) * len(ROWS)), (48, 54, 63, 255))
    labels = ImageDraw.Draw(review)
    manifest = {"cell": CELL, "columns": 9, "scale": SCALE, "offset": OFFSET,
                "anchor": [96, 157], "bodyH": round(153 * SCALE), "rows": []}
    for row, (name, count) in enumerate(ROWS):
        sources = source_frames(name, count)
        entries = []
        labels.text((2, row * 184 + 2), f"{row:02} {name}", fill="white")
        for col, path in enumerate(sources):
            frame = packed_frame(path)
            atlas.alpha_composite(frame, (col * CELL[0], row * CELL[1]))
            review.alpha_composite(frame, (col * CELL[0], row * 184 + 20))
            entries.append({"source": str(path.relative_to(ROOT)),
                            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                            "bounds": frame.getchannel("A").getbbox()})
        manifest["rows"].append({"row": row, "name": name, "frames": entries})
    atlas.save(ROOT / "pikachu-candidate.png")
    review.convert("RGB").save(ROOT / "sheet-review.png")
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Packed {sum(count for _, count in ROWS)} generated poses: {atlas.size}, fixed scale {SCALE}")


if __name__ == "__main__":
    main()
