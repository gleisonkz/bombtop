"""Pack raw generated Lula frames without resizing, cropping, or synthesizing poses."""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
CELL = (192, 192)
COLUMNS = 9
SCALE = 0.1806  # Runtime display scale only; source pixels are never scaled.
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
    return selected


def packed_frame(path):
    with Image.open(path) as image:
        if image.format != "PNG" or image.size not in ((128, 160), (160, 160)):
            raise ValueError(f"{path}: expected PNG canvas 128x160 or 160x160, got {image.size}")
        if image.mode != "RGBA":
            raise ValueError(f"{path}: source must be true RGBA")
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
    reference_path = ROOT.parent / "pele-style-preview/option-1.png"
    try:
        approved = packed_frame(reference_path)
        with Image.open(reference_path) as reference:
            if reference.size != (128, 160):
                raise ValueError("approved option-1 must be native 128x160")
        if prepared and prepared[0][0][0].parent.name == "idle-south" and prepared[0][0][1].tobytes() != approved.tobytes():
            errors.append("first idle must equal approved option-1 pixels placed at x32,y16")
    except (OSError, ValueError) as error:
        errors.append(str(error))
    if errors:
        raise ValueError("Cannot pack Lula sources:\n- " + "\n- ".join(errors))

    atlas = Image.new("RGBA", (CELL[0] * COLUMNS, CELL[1] * len(ROWS)))
    review = Image.new("RGBA", (atlas.width, (CELL[1] + 20) * len(ROWS)), (48, 54, 63, 255))
    labels = ImageDraw.Draw(review)
    manifest = {
        "cell": CELL, "columns": COLUMNS, "atlas": atlas.size,
        "scale": SCALE, "anchor": [96, 155], "bodyH": 120,
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
    # Validate in memory before writing any export (no fabricated repeated motion).
    import importlib.util
    validator_path = ROOT.parents[2] / "apps/client/scripts/test-lula-option1.py"
    spec = importlib.util.spec_from_file_location("lula_validator", validator_path)
    validator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(validator)
    for row, ((name, count), frames) in enumerate(zip(ROWS, prepared)):
        drawings = set()
        for path, frame in frames:
            bounds = frame.getchannel("A").getbbox()
            if bounds[0] < 1 or bounds[1] < 1 or bounds[2] > 191 or bounds[3] > 191:
                raise ValueError(f"{path}: requires transparent cell margins")
            drawings.add(validator.drawing_key(frame, bounds))
        if len(drawings) < validator.MIN_DISTINCT[row]:
            raise ValueError(f"{name}: insufficient distinct drawings; no repeated fake frames")
    atlas.save(ROOT / "lula-candidate.png")
    review.convert("RGB").save(ROOT / "sheet-review.png")
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Packed {sum(count for _, count in ROWS)} raw poses: {atlas.size}, RGBA; runtime scale {SCALE}")


if __name__ == "__main__":
    main()
