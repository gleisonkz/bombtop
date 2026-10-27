"""Install the approved Lula option-1 candidate; run only after coordinator review."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import importlib.util

from PIL import Image

ROOT = Path(__file__).resolve().parent
CLIENT = ROOT.parents[2] / "apps/client"
URL = "sprites/lula.png?v=20261026-pele-style-option1-v1"
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 8)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def replace_once(text, pattern, replacement):
    updated, count = re.subn(pattern, lambda _: replacement, text, flags=re.M | re.S)
    if count != 1:
        raise ValueError(f"Expected exactly one Lula match: {pattern}")
    return updated


def json_entry(text, value):
    """Replace only Lula's value, preserving other entries and their formatting."""
    parsed = json.loads(text)
    if "lula" not in parsed:
        raise ValueError("Lula JSON entry missing")
    match = re.search(r'"lula"\s*:\s*', text)
    start = match.end()
    _, length = json.JSONDecoder().raw_decode(text[start:])
    return text[:start] + json.dumps(value, ensure_ascii=False) + text[start + length:]


def main():
    validator_path = CLIENT / "scripts/test-lula-option1.py"
    spec = importlib.util.spec_from_file_location("lula_validator", validator_path)
    validator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(validator)
    candidate = ROOT / "lula-candidate.png"
    errors = validator.validate(candidate)
    if errors:
        raise ValueError("Candidate validation failed: " + "; ".join(errors))
    target = CLIENT / "public/sprites/lula.png"
    before = ROOT / "before-integration/lula.png"
    receipt = ROOT / "installed-sha256.txt"
    current_hash = digest(target)
    candidate_hash = digest(candidate)
    regions_path = ROOT / "lula-paint-regions.json"
    regions = json.loads(regions_path.read_text(encoding="utf-8"))
    if regions.get("sourceSha256") != candidate_hash or (regions["frameW"], regions["frameH"]) != (192, 192):
        raise ValueError("Color protection must be reviewed against this exact Lula candidate")
    permitted = {digest(before), candidate_hash}
    if receipt.is_file():
        installed = receipt.read_text(encoding="utf-8").strip()
        if not re.fullmatch(r"[0-9a-f]{64}", installed):
            raise ValueError("Invalid Lula installation receipt")
        permitted.add(installed)
    if current_hash not in permitted:
        raise ValueError("Production Lula changed during generation; inspect before replacing")
    with Image.open(candidate) as source:
        source.load()
        if source.format != "PNG" or source.mode != "RGBA" or source.size != (1728, 3456):
            raise ValueError("Candidate must be a 1728x3456 RGBA PNG")
        image = source.copy()
    with Image.open(ROOT.parent / "pele-style-preview/option-1.png") as approved:
        if approved.mode != "RGBA" or approved.size != (128, 160):
            raise ValueError("Approved concept must be native 128x160 RGBA")
        first = Image.new("RGBA", (192, 192))
        first.paste(approved, (32, 16))
    if image.crop((0, 0, 192, 192)).tobytes() != first.tobytes():
        raise ValueError("First idle must preserve the approved option-1 pixels")
    lobby_boxes = []
    for row, count in enumerate(COUNTS):
        for column in range(9):
            box = image.crop((column * 192, row * 192, (column + 1) * 192,
                              (row + 1) * 192)).getchannel("A").getbbox()
            if (box is not None) != (column < count):
                raise ValueError(f"Unexpected occupied/empty cell: row {row}, column {column}")
            if row == 17 and box is not None:
                lobby_boxes.append(box)
    bounds = [min(box[0] for box in lobby_boxes), max(box[2] for box in lobby_boxes)]
    sprites = CLIENT / "src/render/sprites.ts"
    original = sprites.read_text(encoding="utf-8")
    match = re.search(r"^  lula: \{.*?^  \},", original, re.M | re.S)
    if not match:
        raise ValueError("Lula runtime block missing")
    block = match[0]
    fields = {"width": 1728, "height": 3456, "frameW": 192, "frameH": 192,
              "anchorX": 96, "anchorY": 155, "bodyH": 120, "scale": 0.1806}
    for field, value in fields.items():
        block = replace_once(block, r"^    " + field + r": [\d.]+,", f"    {field}: {value},")
    block = replace_once(block, r'^    url: "[^"\n]+",', f'    url: "{URL}",')
    block = replace_once(block, r"^    lobby: \{ row: 17, frames: \d+ \},",
                         "    lobby: { row: 17, frames: 8 },")
    if "colorProtection:" not in block:
        block = block.replace("    hues:", "    colorProtection: lulaPaintRegions,\n    hues:")
    block = block.replace("His red t-shirt (the yellow star and the reds of his face stay his own: build-character-sheet.py face_reds).",
                          "His red shirt is recolored; the reviewed head regions preserve the face and beard.")
    updated_sprites = original[:match.start()] + block + original[match.end():]
    if 'import lulaPaintRegions from "./lula-paint-regions.json";' not in updated_sprites:
        updated_sprites = 'import lulaPaintRegions from "./lula-paint-regions.json";\n' + updated_sprites
    updates = {sprites: (original, updated_sprites)}
    for path, value in (
        (CLIENT / "src/ui/cast-animation-bounds.json", bounds),
        (CLIENT / "src/render/score-portraits.json", {
            "frame": [192, 192], "crop": [70, 35, 53, 59], "url": "sprites/lula.png",
        }),
    ):
        original = path.read_text(encoding="utf-8")
        updates[path] = (original, json_entry(original, value))
    menu = CLIENT / "src/ui/cast-layout.ts"
    original = menu.read_text(encoding="utf-8")
    updates[menu] = (original, replace_once(original, r"\blula: \d+", "lula: 120"))
    # Preflight every output before writing; fail on concurrent changes, never restore stale files.
    for path, (original, _) in updates.items():
        if path.read_text(encoding="utf-8") != original:
            raise ValueError(f"Metadata changed during preflight: {path}")
    if digest(target) != current_hash or digest(candidate) != candidate_hash:
        raise ValueError("Lula production/candidate changed during preflight")
    if not before.is_file():
        raise ValueError("Required immutable before-integration/lula.png backup missing")
    shutil.copyfile(candidate, target)
    shutil.copyfile(regions_path, CLIENT / "src/render/lula-paint-regions.json")
    receipt.write_text(candidate_hash + "\n", encoding="utf-8")
    for path, (original, updated) in updates.items():
        if path.read_text(encoding="utf-8") != original:
            raise ValueError(f"Metadata changed during installation: {path}; rerun after review")
        path.write_text(updated, encoding="utf-8")
    print(f"Installed Lula option 1: {image.size}; lobby alpha bounds={bounds}")


if __name__ == "__main__":
    main()
