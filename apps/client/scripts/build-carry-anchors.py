"""Track inspected palms on final packed cells; emit native-cell carry sockets.

Run from any directory: python apps/client/scripts/build-carry-anchors.py [--check]
Requires Pillow and numpy, already used by the character art tooling. Seeds were
manually inspected on cells stretched to 180 x 180, not aspect-fit thumbnails.
Each target is matched directly against its direction's carry-idle frame zero,
except Spider-Man's visibly different raised side palm (idle frame two).
There is no recursive tracking drift or synthetic breathing offset. Diagnostics
go to stderr and do not change the runtime JSON contract.
"""
import argparse
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image


CLIENT = Path(__file__).resolve().parents[1]
OUTPUT = CLIENT / "src/render/carry-anchors.json"
COUNTS = (4, 4, 4, 6, 6, 6)
SEEDS = {
    "captain": (((52, 53), (122, 53)), ((96, 58),), ((57, 49), (123, 49))),
    "thor": (((64, 12), (112, 12)), ((95, 6),), ((68, 6), (112, 6))),
    "goku": (((65, 25), (112, 25)), ((96, 20),), ((70, 27), (125, 27))),
    "naruto": (((67.5, 41.9), (117, 41.9)), ((108, 34.1),), ((67.5, 45), (112.5, 45))),
    "spider": (((40, 73), (137, 73)), ((95, 82),), ((38, 73), (138, 73))),
    "pikachu": (((58, 85), (117, 85)), ((103, 83),), ((55, 85), (125, 85))),
    "static": (((64 * 180 / 168, 87 * 180 / 186),),
               ((73 * 180 / 168, 127 * 180 / 186),),
               ((109 * 180 / 168, 127 * 180 / 186),)),
    "flash": (((58, 46), (124, 46)), ((93, 52),), ((52, 72), (127, 72))),
    "bugs": (((48, 80), (141, 80)), ((96, 80),), ((49, 79), (136, 79))),
    "lantern": (((42, 79), (143, 79)), ((101, 79),), ((40, 79), (142, 79))),
    "donatello": (((51, 51), (125, 51)), ((95, 55),), ((56, 58), (128, 58))),
    "penelope": (((58, 70), (124, 70)), ((103, 73),), ((57, 63), (126, 63))),
    "panther": (((50, 40), (127, 40)), ((101, 49),), ((54, 38), (127, 38))),
    "harry": (((41, 56), (136, 56)), ((86, 61),), ((42, 50), (137, 50))),
    "optimus": (((41, 37), (137, 37)), ((80, 39),), ((43, 37), (142, 37))),
    "pele": (((51.75, 83.25), (126, 83.25)), ((121.5, 78.75),), ((55.125, 127.125), (122.625, 60.75))),
    "lula": (((44, 66), (141, 66)), ((76, 60),), ((38, 62), (139, 62))),
    "bomber": (((50, 85), (137, 85)), ((78, 82),), ((43, 77), (136, 77))),
}

# Pixel review of the flagged overlays: these matches remain on the intended
# hands despite changes in shading, fingers or adjacent flat-color regions.
REVIEWED = {
    "thor": {(15, 1, 0), (15, 4, 0), (16, 1, 0), (16, 1, 1), (16, 4, 0), (16, 4, 1)},
    "flash": {(12, 2, 0), (12, 3, 0), (15, 3, 0)},
    "donatello": {(11, 2, 0), (11, 3, 0), (14, 1, 0), (14, 3, 0), (16, 4, 1)},
    "panther": {(14, 2, 0)},
}


def reference_pose(name, row, col, palm):
    direction = (row - 11) % 3
    if name == "spider" and ((row == 12 and col >= 2) or (row == 15 and col >= 1)):
        return 12, 2, (111, 55)
    return 11 + direction, 0, SEEDS[name][direction][palm]


def reviewed_point(name, row, col, palm):
    if name == "static":
        # Reviewed on pack-static.py output: native 168 x 186, anchor (82, 170).
        # Front carry uses source row 7 (the supplied gesture sequence).
        # Side/rear reuse ordinary idle/walk art: these are actual visible gloves,
        # not invented raised sockets. Convert each axis to the 180 convention.
        front = ((64, 87), (61, 122), (115, 111), (99, 99))
        side_idle = ((73, 127), (76, 127), (73, 127), (77, 127))
        rear_idle = ((109, 127), (109, 127), (111, 127), (110, 127))
        side_walk = ((89, 120), (85, 120), (76, 121), (84, 123), (76, 121), (85, 120))
        rear_walk = ((109, 125), (109, 125), (110, 126), (109, 126), (110, 126), (109, 126))
        if row in (11, 14):
            native = front[(0, 1, 2, 3, 2, 1)[col]]
        elif row == 12:
            native = side_idle[col]
        elif row == 13:
            native = rear_idle[col]
        elif row == 15:
            native = side_walk[col]
        elif row == 16:
            native = rear_walk[col]
        else:
            return None, None
        return (native[0] * 180 / 168, native[1] * 180 / 186), "manual: visible glove center inspected on final 168x186 Static cell; side/rear lack raised carry art"
    if name == "pele":
        # Inspected visible palms in pele-final.png, native 160px cells.
        # Source gestures change hand height; idle-patch tracking is unsuitable.
        # Rear idle frame zero has one lowered hand: retain its actual position.
        front = (
            ((46, 74), (112, 74)), ((48, 75), (112, 75)),
            ((46, 62), (114, 62)), ((48, 56), (116, 56)),
        )
        rear_idle = (
            ((49, 113), (109, 54)), ((47, 55), (111, 55)),
            ((47, 55), (111, 55)), ((47, 55), (111, 55)),
        )
        rear_walk = (
            ((47, 58), (113, 58)), ((47, 58), (113, 58)),
            ((47, 58), (113, 58)), ((44, 51), (118, 51)),
            ((47, 58), (113, 58)), ((47, 58), (113, 58)),
        )
        if row in (11, 14):
            native = front[(0, 1, 2, 3, 2, 1)[col]][palm]
        elif row in (12, 15):
            native = (108, 70)
        elif row == 13:
            native = rear_idle[col][palm]
        elif row == 16:
            native = rear_walk[col][palm]
        else:
            return None, None
        return tuple(value * 180 / 160 for value in native), "manual: visible palm center inspected on final 160px Pele carry cell"
    if (name, row, col, palm) == ("donatello", 16, 1, 1):
        return (128, 58), "manual: right palm at head edge; rejected lower-forearm patch"
    if (name, row, col) == ("naruto", 14, 5):
        return ((63, 47) if palm == 0 else (117, 47)), "occluded: palms absent behind hair; visible sleeve-tip fallback"
    return None, None


def layouts():
    """Read only the production layout fields from the existing TS source."""
    source = (CLIENT / "src/render/sprites.ts").read_text(encoding="utf-8")
    result = {}
    for name in SEEDS:
        match = re.search(r"^  " + name + r": \{(.*?)(?=^  \},)", source, re.M | re.S)
        if not match:
            raise ValueError(f"Missing sheet layout: {name}")
        block = match.group(1)
        dimensions = {}
        for key in ("width", "height", "frameW", "frameH"):
            field = re.search(r"^    " + key + r": (\d+),", block, re.M)
            if not field:
                raise ValueError(f"Missing {name}.{key}")
            dimensions[key] = int(field.group(1))
        url = re.search(r'^    url: "([^"]+)"', block, re.M)
        if not url:
            raise ValueError(f"Missing {name}.url")
        result[name] = (CLIENT / "public" / url.group(1).split("?")[0], dimensions)
    return result


def rgba(frame):
    pixels = np.asarray(frame, dtype=np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    return pixels


def track(reference, target, seed):
    """Bounded RGBA SSD; exact ties prefer the smallest seed displacement."""
    height, width = reference.shape[:2]
    sx, sy = seed[0] * width / 180, seed[1] * height / 180
    cx, cy = round(sx), round(sy)
    px, py = max(2, round(8 * width / 180)), max(2, round(8 * height / 180))
    rx, ry = max(12, math.ceil(12 * width / 180)), max(12, math.ceil(12 * height / 180))
    # Clip template offsets once, retaining the same shape for every candidate.
    left, right = max(-px, -cx), min(px, width - 1 - cx)
    top, bottom = max(-py, -cy), min(py, height - 1 - cy)
    template = reference[cy + top:cy + bottom + 1, cx + left:cx + right + 1]
    if float(template[:, :, 3].max()) < 0.2:
        raise ValueError(f"Seed patch has no visible palm: {seed}")
    candidates = []
    for dy in range(-ry, ry + 1):
        for dx in range(-rx, rx + 1):
            x, y = cx + dx, cy + dy
            if x + left < 0 or x + right >= width or y + top < 0 or y + bottom >= height:
                continue
            patch = target[y + top:y + bottom + 1, x + left:x + right + 1]
            error = float(np.mean((patch - template) ** 2))
            candidates.append((error, dx * dx + dy * dy, dy, dx))
    if not candidates:
        raise ValueError(f"No candidates for seed {seed}")
    candidates.sort()
    error, _, dy, dx = candidates[0]
    alternative = next((c[0] for c in candidates if (c[3] - dx) ** 2 + (c[2] - dy) ** 2 >= 16), float("inf"))
    reasons = []
    if abs(dx) == rx or abs(dy) == ry:
        reasons.append("search-boundary")
    if error > 0.04:
        reasons.append("weak-patch")
    if alternative <= error * 1.05 + 0.0005:
        reasons.append("competing-patch")
    return (sx + dx, sy + dy), {"error": round(error, 6), "shift": [dx, dy], "flags": reasons}


def build(only=None):
    characters, diagnostics = {}, []
    for name, (path, dimensions) in layouts().items():
        if only is not None and name != only:
            continue
        width, height = dimensions["frameW"], dimensions["frameH"]
        with Image.open(path) as image:
            if image.mode != "RGBA" or image.size != (dimensions["width"], dimensions["height"]):
                raise ValueError(f"Sheet differs from runtime layout: {path}")
            if image.width % width or image.height % height or image.height < 17 * height:
                raise ValueError(f"Incomplete sheet grid: {path}")
            rows = {}
            for row, count in zip(range(11, 17), COUNTS):
                direction = (row - 11) % 3
                sockets = []
                for col in range(count):
                    target = rgba(image.crop((col * width, row * height, (col + 1) * width, (row + 1) * height)))
                    palms = []
                    for palm in range(len(SEEDS[name][direction])):
                        ref_row, ref_col, seed = reference_pose(name, row, col, palm)
                        reference = rgba(image.crop((ref_col * width, ref_row * height, (ref_col + 1) * width, (ref_row + 1) * height)))
                        point, report = track(reference, target, seed)
                        correction, note = reviewed_point(name, row, col, palm)
                        if correction is not None:
                            point = (correction[0] * width / 180, correction[1] * height / 180)
                            report["review"] = note
                            report["flags"] = ["occluded-palm"] if note.startswith("occluded:") else []
                        elif (row, col, palm) in REVIEWED.get(name, set()):
                            report["review"] = "overlay checked: point remains on intended hand region"
                        if (ref_row, ref_col) != (11 + direction, 0):
                            report["reference"] = [ref_row, ref_col]
                        palms.append(point)
                        diagnostics.append({"character": name, "row": row, "frame": col, "palm": palm, **report})
                    x, y = np.mean(palms, axis=0)
                    span = abs(palms[-1][0] - palms[0][0])
                    sockets.append({"x": round(float(x), 3), "y": round(float(y), 3), "span": round(span, 3)})
                rows[str(row)] = sockets
        characters[name] = {"frameW": width, "frameH": height, "rows": rows}
    return {"characters": characters}, diagnostics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Compare deterministic output without writing")
    parser.add_argument("--diagnostics", action="store_true", help="Print every flagged palm match to stderr")
    parser.add_argument("--character", choices=SEEDS, help="Update only this character, preserving all other profiles")
    args = parser.parse_args()
    data, diagnostics = build(args.character)
    if args.character:
        current = json.loads(OUTPUT.read_text(encoding="utf-8"))
        current["characters"].update(data["characters"])
        data = current
    content = json.dumps(data, indent=2, allow_nan=False) + "\n"
    flagged = [item for item in diagnostics if item["flags"]]
    unresolved = [item for item in flagged if "review" not in item or "occluded-palm" in item["flags"]]
    socket_count = sum(len(sockets) for character in data["characters"].values() for sockets in character["rows"].values())
    print(f"Tracked {socket_count} sockets / {len(diagnostics)} palms; {len(flagged)} flagged matches, {len(unresolved)} unresolved", file=sys.stderr)
    for name in SEEDS:
        issues = [item for item in flagged if item["character"] == name]
        if issues:
            print(f"  {name}: {len(issues)} flagged palms", file=sys.stderr)
    if args.diagnostics:
        for item in flagged:
            print(json.dumps(item), file=sys.stderr)
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != content:
            raise SystemExit("Carry anchors are missing or stale")
        print("Carry anchors match packed sheets")
    else:
        OUTPUT.write_text(content, encoding="utf-8", newline="\n")
        print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
