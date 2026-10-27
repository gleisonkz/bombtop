"""Prepare, pack and promote only the approved native Flash redraw.

Run without flags to prepare; --pack also packs; --promote packs and integrates.
All selected sources must exist. FX-free replacements never fall back to old art.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
CLIENT = PROJECT / "apps/client"
CACHE_URL = "sprites/flash.png?v=20261026-option1-v1"
VIEWS = (("down", "south"), ("side", "east"), ("up", "north"))


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def image(path):
    with Image.open(path) as source:
        if source.mode != "RGBA" or not all(0 < n <= 512 for n in source.size):
            raise ValueError(f"Expected native RGBA <=512: {path}")
        result = source.copy()
    if result.getchannel("A").getbbox() is None:
        raise ValueError(f"Empty frame: {path}")
    return result


def anchor(path):
    im = image(path)
    bottom = im.getchannel("A").getbbox()[3]
    xs = [x for y in range(max(0, bottom - 4), bottom) for x in range(im.width)
          if im.getpixel((x, y))[3] > 128]
    if not xs:
        raise ValueError(f"No opaque foot pixels: {path}")
    return [round((min(xs) + max(xs) + 1) / 2), bottom]


def palms(im, direction):
    """Find upper peripheral red gloves, excluding the central cowl/face.

    Side poses have a single visible support; front/back need both sides.
    The top fifth is above the face, even when the side glove overlaps the cowl.
    """
    left, top, right, bottom = im.getchannel("A").getbbox()
    width, height = right - left, bottom - top
    points = []
    for y in range(top, top + max(1, min(14, round(height * .09)))):
        for x in range(left, right):
            r, g, b, a = im.getpixel((x, y))
            peripheral = x < left + width * .28 or x >= right - width * .28
            if a > 200 and r > 65 and r > g * 1.7 and r > b * 1.25:
                if direction == "east" or peripheral:
                    points.append((x, y))
    groups = [points] if direction == "east" else [
        [p for p in points if p[0] < (left + right) / 2],
        [p for p in points if p[0] >= (left + right) / 2],
    ]
    centers = []
    for group in groups:
        if len(group) < 5:
            raise ValueError(f"Raised red glove not found: {direction}")
        cx = sum(x for x, _ in group) / len(group)
        cy = sum(y for _, y in group) / len(group)
        centers.append(list(min(group, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)))
    return centers


def select(name, action, indices):
    paths = [f"frames/{action}/{index}.png" for index in indices]
    sources = [image(ROOT / path) for path in paths]
    row = {"name": name, "frames": paths, "anchor": anchor(ROOT / f"frames/{action}/0.png"),
           "source_action": action, "source_indices": indices}
    if name.startswith(("carryIdle.", "carryWalk.")):
        row["palms"] = [palms(im, action.rsplit("-", 1)[1]) for im in sources]
    return row


def prepare():
    rows = []
    for prefix, action, indices in (("idle", "idle", list(range(4))),
                                    ("walk", "walk", list(range(1, 7)))):
        for view, direction in VIEWS:
            rows.append(select(f"{prefix}.{view}", f"{action}-{direction}", indices))
    rows.extend((select("stun", "stun", list(range(1, 7))),
                 select("death", "death-fxfree", list(range(7)))))
    for view, direction in VIEWS:
        action = "cast-south-fxfree" if direction == "south" else f"cast-{direction}"
        rows.append(select(f"cast.{view}", action, list(range(9))))
    for prefix, action, indices in (("carryIdle", "carry-idle2", list(range(4))),
                                    ("carryWalk", "carry-loop2", list(range(1, 7)))):
        for view, direction in VIEWS:
            rows.append(select(f"{prefix}.{view}", f"{action}-{direction}", indices))
    rows.append(select("lobby", "lobby", [0, *range(2, 17)]))
    manifest = {"source_root": ".", "approved_reference": "../pixellab-preview/option-1.png",
                "pixel_scale": 1, "rows": rows,
                "effects": "character poses only; game renders effects separately"}
    write(ROOT / "manifest.json", manifest)
    return manifest


def pack():
    spec = importlib.util.spec_from_file_location("flash_packer", CLIENT / "scripts/pack-flash-pixellab.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.pack(ROOT / "manifest.json", ROOT)


def replace_once(text, pattern, value):
    result, count = re.subn(pattern, lambda _: value, text, flags=re.M | re.S)
    if count != 1:
        raise ValueError(f"Expected one edit, got {count}: {pattern}")
    return result


def update_json_entry(path, value, parent=None):
    # Preserve every other character's formatting and concurrent metadata.
    source = path.read_text(encoding="utf-8")
    data = read(path)
    old = (data[parent] if parent else data)["flash"]
    decoder = json.JSONDecoder()
    key = re.search(r'"flash"\s*:\s*', source)
    if not key:
        raise ValueError(f"Missing Flash entry: {path}")
    parsed, length = decoder.raw_decode(source[key.end():])
    if parsed != old:
        raise ValueError(f"Flash metadata changed while reading: {path}")
    line_start = source.rfind("\n", 0, key.start()) + 1
    indentation = source[line_start:key.start()]
    encoded = json.dumps(value, indent=2).replace("\n", "\n" + indentation) if isinstance(value, dict) else json.dumps(value)
    path.write_text(source[:key.end()] + encoded + source[key.end() + length:], encoding="utf-8")


def protection(manifest, report):
    """Exact per-cell runs protect warm skin and neutral eye pixels, never a global mask."""
    rows = []
    for row, measurement in zip(manifest["rows"], report["rows"]):
        dx, dy = measurement["offset"]
        cells = []
        for path in row["frames"]:
            im = image(ROOT / path)
            regions = []
            for y in range(im.height):
                start = None
                for x in range(im.width + 1):
                    keep = False
                    if x < im.width:
                        r, g, b, a = im.getpixel((x, y))
                        skin = (r > 85 and g > 45 and b > 20 and r > g * 1.08
                                and g > b * 1.08 and b > g * .45 and g > r * .35)
                        neutral = min(r, g, b) > 150 and max(r, g, b) - min(r, g, b) < 45
                        keep = a > 0 and (skin or neutral)
                    if keep and start is None:
                        start = x
                    elif not keep and start is not None:
                        regions.append({"left": start + dx, "top": y + dy,
                                        "right": x + dx, "bottom": y + dy + 1})
                        start = None
            cells.append(regions or None)
        rows.append(cells + [None] * (16 - len(cells)))
    return {"frameW": 224, "frameH": 224, "rows": rows}


def promote(manifest, report):
    palms_data = {"frameW": 224, "frameH": 224, "rows": {}}
    for index, row in enumerate(manifest["rows"]):
        if "palms" in row:
            dx, dy = report["rows"][index]["offset"]
            palms_data["rows"][str(index)] = [
                [[x + dx, y + dy] for x, y in frame] for frame in row["palms"]]
    boxes = report["rows"][17]["bounds"]
    bounds = [min(b[0] for b in boxes), max(b[2] for b in boxes)]
    front = image(ROOT / manifest["rows"][0]["frames"][0])
    top = front.getchannel("A").getbbox()[1]
    head = front.crop((0, top, front.width, min(front.height, top + 64))).getchannel("A").getbbox()
    dx, dy = report["rows"][0]["offset"]
    x, y = max(0, head[0] + dx - 2), max(0, top + dy - 2)
    crop = [x, y, min(224 - x, head[2] - head[0] + 4), min(68, 224 - y)]
    metadata = {"bodyH": report["bodyH"], "scale": 21.509 / report["bodyH"],
                "menuBodyH": report["menuBodyH"], "horizontalBounds": bounds,
                "portraitCrop": crop, "frame": [224, 224], "anchor": [111.5, 211]}
    # Resolve and validate edits before publishing. Read shared files afresh.
    sprites_path = CLIENT / "src/render/sprites.ts"
    source = sprites_path.read_text(encoding="utf-8")
    block = re.search(r'^  flash: \{.*?^  \},', source, re.M | re.S)
    if not block:
        raise ValueError("Missing Flash sheet block")
    updated = block.group()
    fields = {"url": json.dumps(CACHE_URL), "width": 3584, "height": 4032,
              "frameW": 224, "frameH": 224, "anchorX": 111.5, "anchorY": 211,
              "bodyH": report["bodyH"], "scale": metadata["scale"]}
    for key, value in fields.items():
        updated = replace_once(updated, rf'^    {key}: [^\n]+', f"    {key}: {value},")
    if "colorProtection:" not in updated:
        updated = updated.replace('    hues: [335, 12],',
                                  '    hues: [335, 12],\n    colorProtection: flashPaintRegions,')
    updated = replace_once(updated, r'^    lobby: [^\n]+',
                           f'    lobby: {{ row: 17, frames: 16, bodyH: {report["menuBodyH"]} }},')
    layout_path = CLIENT / "src/ui/cast-layout.ts"
    layout = replace_once(layout_path.read_text(encoding="utf-8"), r'\bflash: [^,\n]+',
                          f'flash: {report["menuBodyH"]}')
    art_path = CLIENT / "src/ui/sheet-art.ts"
    art = art_path.read_text(encoding="utf-8")
    condition = '\n    || (character === "flash" && pose.row === SHEETS.flash.lobby.row)'
    art = art.replace(condition, "")
    portraits_path = CLIENT / "src/render/score-portraits.json"
    portrait = read(portraits_path)["flash"]
    portrait.update(frame=[224, 224], crop=crop, url="sprites/flash.png")
    paint_regions = protection(manifest, report)
    backup = ROOT / "before-redraw"
    backup.mkdir(exist_ok=True)
    original = CLIENT / "public/sprites/flash.png"
    if not (backup / "flash.png").exists():
        shutil.copyfile(original, backup / "flash.png")
    write(ROOT / "palms.json", palms_data)
    write(CLIENT / "src/render/flash-paint-regions.json", paint_regions)
    update_json_entry(portraits_path, portrait)
    update_json_entry(CLIENT / "src/ui/cast-animation-bounds.json", bounds)
    source = source[:block.start()] + updated + source[block.end():]
    if 'import flashPaintRegions from "./flash-paint-regions.json";' not in source:
        source = 'import flashPaintRegions from "./flash-paint-regions.json";\n' + source
    sprites_path.write_text(source, encoding="utf-8")
    layout_path.write_text(layout, encoding="utf-8")
    art_path.write_text(art, encoding="utf-8")
    shutil.copyfile(ROOT / "flash-candidate.png", CLIENT / "public/sprites/flash.png")
    subprocess.run([sys.executable, "-B", str(CLIENT / "scripts/build-carry-anchors.py"),
                    "--character", "flash"], check=True, cwd=PROJECT)
    write(ROOT / "runtime-metadata.json", metadata)
    return metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pack", action="store_true")
    parser.add_argument("--promote", action="store_true")
    args = parser.parse_args()
    try:
        selected = prepare()
        result = pack() if args.pack or args.promote else None
        if args.promote:
            print(json.dumps(promote(selected, result)))
        else:
            print("Prepared 18 rows / 116 frames" + (" and packed candidate" if args.pack else ""))
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"Flash integration: {exc}\n")
