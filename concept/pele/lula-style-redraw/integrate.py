"""Install the approved Pele option-4 candidate; run only after coordinator review."""
import hashlib
import json
from pathlib import Path
import re
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parent
CLIENT = ROOT.parents[2] / "apps/client"
URL = "sprites/pele-final.png?v=20261026-lula-option4-v1"
COUNTS = (4, 4, 4, 6, 6, 6, 6, 7, 9, 9, 9, 4, 4, 4, 6, 6, 6, 7)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def replace_once(text, pattern, replacement):
    updated, count = re.subn(pattern, lambda _: replacement, text, flags=re.M | re.S)
    if count != 1:
        raise ValueError(f"Expected exactly one Pele match: {pattern}")
    return updated


def json_entry(text, value):
    """Replace only Pele's value, preserving other entries and their formatting."""
    parsed = json.loads(text)
    if "pele" not in parsed:
        raise ValueError("Pele JSON entry missing")
    match = re.search(r'"pele"\s*:\s*', text)
    start = match.end()
    _, length = json.JSONDecoder().raw_decode(text[start:])
    return text[:start] + json.dumps(value, ensure_ascii=False) + text[start + length:]


def main():
    candidate = ROOT / "pele-candidate.png"
    target = CLIENT / "public/sprites/pele-final.png"
    before = ROOT / "before-integration/pele-final.png"
    receipt = ROOT / "installed-sha256.txt"
    current_hash = digest(target)
    candidate_hash = digest(candidate)
    permitted = {digest(before), candidate_hash}
    if receipt.is_file():
        installed = receipt.read_text(encoding="utf-8").strip()
        if not re.fullmatch(r"[0-9a-f]{64}", installed):
            raise ValueError("Invalid Pele installation receipt")
        permitted.add(installed)
    if current_hash not in permitted:
        raise ValueError("Production Pele changed during generation; inspect before replacing")
    with Image.open(candidate) as source:
        source.load()
        if source.format != "PNG" or source.mode != "RGBA" or source.size != (1728, 3456):
            raise ValueError("Candidate must be a 1728x3456 RGBA PNG")
        image = source.copy()
    with Image.open(ROOT.parent / "lula-style-preview/option-4.png") as approved:
        if approved.mode != "RGBA" or approved.size != (128, 160):
            raise ValueError("Approved concept must be native 128x160 RGBA")
        first = Image.new("RGBA", (192, 192))
        first.paste(approved, (32, 16))
    if image.crop((0, 0, 192, 192)).tobytes() != first.tobytes():
        raise ValueError("First idle must preserve the approved option-4 pixels")
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
    match = re.search(r"^  pele: \{.*?^  \},", original, re.M | re.S)
    if not match:
        raise ValueError("Pele runtime block missing")
    block = match[0]
    fields = {"width": 1728, "height": 3456, "frameW": 192, "frameH": 192,
              "anchorX": 96, "anchorY": 156, "bodyH": 119, "scale": 0.1815126}
    for field, value in fields.items():
        block = replace_once(block, r"^    " + field + r": [\d.]+,", f"    {field}: {value},")
    block = replace_once(block, r'^    url: "[^"\n]+",', f'    url: "{URL}",')
    block = replace_once(block, r"^    lobby: \{ row: 17, frames: \d+ \},",
                         "    lobby: { row: 17, frames: 7 },")
    block = block.replace("The supplied raised-arm celebration, packed with the gameplay poses by scripts/pack-pele.py.",
                          "The approved option-4 redraw celebration, packed with the gameplay poses.")
    updates = {sprites: (original, original[:match.start()] + block + original[match.end():])}
    for path, value in (
        (CLIENT / "src/ui/cast-animation-bounds.json", bounds),
        (CLIENT / "src/render/score-portraits.json", {
            "frame": [192, 192], "crop": [74, 36, 46, 55], "url": "sprites/pele-final.png",
        }),
    ):
        original = path.read_text(encoding="utf-8")
        updates[path] = (original, json_entry(original, value))
    menu = CLIENT / "src/ui/cast-layout.ts"
    original = menu.read_text(encoding="utf-8")
    updates[menu] = (original, replace_once(original, r"\bpele: \d+", "pele: 119"))
    # Preflight every output before writing; fail on concurrent changes, never restore stale files.
    for path, (original, _) in updates.items():
        if path.read_text(encoding="utf-8") != original:
            raise ValueError(f"Metadata changed during preflight: {path}")
    if digest(target) != current_hash or digest(candidate) != candidate_hash:
        raise ValueError("Pele production/candidate changed during preflight")
    shutil.copyfile(candidate, target)
    receipt.write_text(candidate_hash + "\n", encoding="utf-8")
    for path, (original, updated) in updates.items():
        if path.read_text(encoding="utf-8") != original:
            raise ValueError(f"Metadata changed during installation: {path}; rerun after review")
        path.write_text(updated, encoding="utf-8")
    print(f"Installed Pele option 4: {image.size}; lobby alpha bounds={bounds}")


if __name__ == "__main__":
    main()
