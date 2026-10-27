"""Review native Lula head rectangles, then export the existing ColorProtection contract.

Run without arguments for available raw-frame QA. Once packed, review ALL sheets in
qa/color, then run --write --reviewed SHA printed by the review run. Overrides use
--boxes qa/color/manual-boxes.json: {"death-south/04": [left,top,right,bottom]}.
Boxes are CELL coordinates, with exclusive right/bottom. No source pixels change.
Requires Pillow only; packing selection/placement comes from the local pack.py.
"""
import argparse
import colorsys
import hashlib
import json
import runpy
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
QA = ROOT / "qa/color"
PACK = runpy.run_path(str(ROOT / "pack.py"))
CELL = 192


def infer_box(frame):
    # Bright neutral hair/beard, never the dark trousers. Eight-connected islands
    # preserve the separated beard; spatial gating excludes distant gray objects.
    pixels = frame.load()
    neutral = {(x, y) for y in range(CELL) for x in range(CELL)
               if pixels[x, y][3] > 128 and min(pixels[x, y][:3]) >= 95
               and max(pixels[x, y][:3]) - min(pixels[x, y][:3]) <= 55}
    components = []
    while neutral:
        seed = neutral.pop()
        component, pending = {seed}, [seed]
        while pending:
            x, y = pending.pop()
            for dx, dy in ((-1, -1), (0, -1), (1, -1), (-1, 0),
                           (1, 0), (-1, 1), (0, 1), (1, 1)):
                point = (x + dx, y + dy)
                if point in neutral:
                    neutral.remove(point)
                    component.add(point)
                    pending.append(point)
        components.append(component)
    if not components:
        raise ValueError("No bright gray hair; supply a manual box")
    hair = max(components, key=len)
    center_x = sum(x for x, _ in hair) / len(hair)
    hair_top = min(y for _, y in hair)
    head = {point for component in components for point in component
            if abs(point[0] - center_x) <= 30 and hair_top <= point[1] <= hair_top + 57}
    xs, ys = zip(*head)
    return [max(0, min(xs) - 4), max(0, min(ys) - 3),
            min(CELL, max(xs) + 5), min(CELL, max(ys) + 3)]


def red(pixel):
    hue, _, saturation = colorsys.rgb_to_hls(*(channel / 255 for channel in pixel[:3]))
    # Match shadeHues' HSL saturation threshold, including wrapped red hues.
    return pixel[3] > 0 and saturation >= 0.2 and (hue * 360 >= 336 or hue * 360 <= 6)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--boxes", type=Path)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--reviewed", help="Review digest from the last QA run")
    args = parser.parse_args()
    overrides = json.loads(args.boxes.read_text(encoding="utf-8")) if args.boxes else {}
    candidate = ROOT / "lula-candidate.png"
    atlas = Image.open(candidate).convert("RGBA") if candidate.exists() else None
    if atlas and atlas.size != (1728, 3456):
        raise ValueError("Candidate must be 1728x3456")
    QA.mkdir(parents=True, exist_ok=True)
    rows, report, missing = [], [], []
    digest = hashlib.sha256()
    if atlas:
        digest.update(atlas.tobytes())
    for row, (name, count) in enumerate(PACK["ROWS"]):
        regions = [None] * 9
        review = Image.new("RGBA", (9 * CELL, CELL + 24), (48, 54, 63, 255))
        draw = ImageDraw.Draw(review)
        # Match pack.py, including skipped base poses. Partial raw review never
        # silently becomes a complete runtime export.
        start = int(name.startswith(("walk-", "stun-", "carryWalk-")))
        for column in range(count):
            key = f"{name}/{column + start:02}"
            source = ROOT / "generated" / name / f"{column + start:02}.png"
            if not source.exists():
                missing.append(key)
                continue
            frame = PACK["packed_frame"](source)
            if atlas:
                actual = atlas.crop((column * CELL, row * CELL,
                                    (column + 1) * CELL, (row + 1) * CELL))
                if actual.tobytes() != frame.tobytes():
                    raise ValueError(f"Candidate/source mismatch: {key}")
                frame = actual
            box = overrides[key] if key in overrides else infer_box(frame)
            if (len(box) != 4 or any(type(value) is not int for value in box)
                    or not 0 <= box[0] < box[2] <= CELL
                    or not 0 <= box[1] < box[3] <= CELL):
                raise ValueError(f"Invalid cell rectangle: {key}: {box}")
            left, top, right, bottom = box
            regions[column] = [dict(zip(("left", "top", "right", "bottom"), box))]
            protected = dyeable = 0
            tinted = frame.copy()
            for y in range(CELL):
                for x in range(CELL):
                    pixel = frame.getpixel((x, y))
                    if not red(pixel):
                        continue
                    if left <= x < right and top <= y < bottom:
                        protected += 1
                    else:
                        dyeable += 1
                        tinted.putpixel((x, y), (40, 180, 80, pixel[3]))
            # Back-facing heads may legitimately contain no red face pixels.
            if not dyeable:
                raise ValueError(f"{key}: no dyeable shirt reds; inspect/use --boxes")
            review.alpha_composite(tinted, (column * CELL, 24))
            draw.rectangle((column * CELL + left, top + 24,
                            column * CELL + right - 1, bottom + 23), outline="cyan")
            draw.text((column * CELL + 2, 2), key, fill="white")
            entry = {"key": key, "box": box, "protectedRed": protected,
                     "dyeableRed": dyeable, "sha256": hashlib.sha256(frame.tobytes()).hexdigest()}
            report.append(entry)
            digest.update(json.dumps(entry, sort_keys=True).encode())
        rows.append(regions)
        if atlas and count < 9:
            tail = atlas.crop((count * CELL, row * CELL, 9 * CELL, (row + 1) * CELL))
            if tail.getchannel("A").getbbox():
                raise ValueError(f"{name}: candidate has occupied tail cells")
        if any(regions):
            review.save(QA / f"{row:02}-{name}.png")
    token = digest.hexdigest()
    summary = {"candidate": bool(atlas), "reviewDigest": token,
               "frames": report, "missing": missing}
    (QA / "report.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"Reviewed {len(report)}/108 selected frames; missing {len(missing)}; candidate={bool(atlas)}")
    print(f"Review digest: {token}")
    if args.write:
        if not atlas or missing or len(report) != 108:
            raise ValueError("Complete candidate required; only QA written")
        if args.reviewed != token:
            raise ValueError("Inspect every QA frame, adjust manual boxes, then pass its --reviewed digest")
        output = {"sourceSha256": hashlib.sha256(candidate.read_bytes()).hexdigest(),
                  "frameW": CELL, "frameH": CELL, "rows": rows}
        (ROOT / "lula-paint-regions.json").write_text(
            json.dumps(output, separators=(",", ":")) + "\n", encoding="utf-8")
        print("Wrote lula-paint-regions.json")


if __name__ == "__main__":
    main()
