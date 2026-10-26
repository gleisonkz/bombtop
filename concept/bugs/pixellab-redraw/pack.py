"""Pack raw PixelLab Bugs frames without resizing, cropping, or synthesizing poses."""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
CELL = (192, 192)
COLUMNS = 9
SCALE = 0.17  # Runtime display scale only; source pixels are never scaled.
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
    """Require the complete raw sequence, including the unused base of motion clips."""
    directory = ROOT / "generated" / name
    skip_base = name.startswith(("walk-", "stun-", "carryWalk-"))
    extra_frame = skip_base or name.startswith(("idle-", "carryIdle-", "lobby-"))
    required = count + int(extra_frame)
    expected = [directory / f"{index:02}.png" for index in range(required)]
    actual = sorted(directory.glob("*.png"))
    if actual != expected:
        missing = [path.name for path in expected if path not in actual]
        extra = [path.name for path in actual if path not in expected]
        raise ValueError(
            f"{name}: expected exactly {required} source frames 00..{required - 1:02}; "
            f"found {len(actual)}; missing={missing}; extra={extra}"
        )
    selected = expected[1:] if skip_base else expected[:count]
    if name == "carryWalk-north":
        for column in range(1, count):
            correction = ROOT / "corrected/carryWalk-north" / f"{column + 1:02}.png"
            if not correction.is_file():
                raise ValueError(f"Missing reviewed rear-ear correction: {correction}")
            selected[column] = correction
    return selected


def packed_frame(path):
    with Image.open(path) as image:
        if image.format != "PNG" or image.size not in ((128, 160), (160, 160)):
            raise ValueError(f"{path}: expected PNG canvas 128x160 or 160x160, got {image.size}")
        if "A" not in image.getbands() and "transparency" not in image.info:
            raise ValueError(f"{path}: source has no alpha transparency")
        source = image.convert("RGBA")
    alpha = source.getchannel("A")
    if alpha.getbbox() is None or alpha.getextrema()[0] != 0:
        raise ValueError(f"{path}: source must contain visible pixels and transparent background")
    frame = Image.new("RGBA", CELL)
    frame.paste(source, ((CELL[0] - source.width) // 2, 16))
    return frame


def main():
    # Complete preflight first so a missing/invalid input never writes partial exports.
    prepared = []
    errors = []
    for name, count in ROWS:
        try:
            sources = source_frames(name, count)
            prepared.append([(path, packed_frame(path)) for path in sources])
        except (OSError, ValueError) as error:
            errors.append(str(error))
    if errors:
        raise ValueError("Cannot pack Bugs sources:\n- " + "\n- ".join(errors))

    atlas = Image.new("RGBA", (CELL[0] * COLUMNS, CELL[1] * len(ROWS)))
    review = Image.new("RGBA", (atlas.width, (CELL[1] + 20) * len(ROWS)), (48, 54, 63, 255))
    labels = ImageDraw.Draw(review)
    manifest = {
        "cell": CELL, "columns": COLUMNS, "atlas": atlas.size,
        "scale": SCALE, "anchor": [96, 163], "bodyH": 127,
        "placement": {"horizontal": "center full source canvas", "verticalOffset": 16},
        "rows": [],
    }
    for row, ((name, count), frames) in enumerate(zip(ROWS, prepared)):
        entries = []
        labels.text((2, row * 212 + 2), f"{row:02} {name}", fill="white")
        for column, (path, frame) in enumerate(frames):
            atlas.paste(frame, (column * CELL[0], row * CELL[1]))
            review.alpha_composite(frame, (column * CELL[0], row * 212 + 20))
            labels.text((column * CELL[0] + 130, row * 212 + 2), path.stem, fill="white")
            entries.append({
                "column": column, "source": path.relative_to(ROOT).as_posix(),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "bounds": frame.getchannel("A").getbbox(),
            })
        manifest["rows"].append({"row": row, "name": name, "count": count, "frames": entries})
    atlas.save(ROOT / "bugs-candidate.png")
    review.convert("RGB").save(ROOT / "sheet-review.png")
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Packed {sum(count for _, count in ROWS)} raw poses: {atlas.size}, RGBA; runtime scale {SCALE}")


if __name__ == "__main__":
    main()
