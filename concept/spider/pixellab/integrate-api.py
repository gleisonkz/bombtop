"""Map reviewed PixelLab poses to the existing game rows without resampling."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def glove(image, box):
    left, top, right, bottom = box
    pixels = image.load()
    choices = []
    for y in range(top + 2, bottom - 2):
        for x in range(left + 2, right - 2):
            red, green, blue, alpha = pixels[x, y]
            if alpha != 255 or red < 80 or red < green * 1.3 or red < blue * 1.3:
                continue
            score = sum(1 for dy in range(-2, 3) for dx in range(-2, 3)
                        if pixels[x + dx, y + dy][3] > 128
                        and pixels[x + dx, y + dy][0] > pixels[x + dx, y + dy][2] * 1.3)
            choices.append((score, -y, x, y))
    if not choices:
        raise ValueError(f"No red glove in {box}")
    _, _, x, y = max(choices)
    return [x, y]


def normalize(action, direction, indices):
    paths, heads, palms, hashes = [], [], [], []
    for index in indices:
        source = ROOT / "api-generated" / f"{action}-{direction}" / f"{index}.png"
        image = Image.open(source).convert("RGBA")
        bounds = image.getbbox()
        if bounds[2] > 96 or bounds[3] > 96:
            raise ValueError(f"Visible pixels outside normalization canvas: {source}")
        canvas = Image.new("RGBA", (96, 96))
        canvas.paste(image.crop((0, 0, min(96, image.width), min(96, image.height))), (0, 0))
        path = ROOT / "api-generated" / "packed-sources" / f"{action}-{direction}-{index}.png"
        path.parent.mkdir(exist_ok=True)
        canvas.save(path)
        paths.append(path.relative_to(ROOT).as_posix())
        hashes.append(hashlib.sha256(source.read_bytes()).hexdigest())
        # Mask position is independent of the raised fingers at the outer edges.
        if direction == "east":
            head = [32, 29, 61, 59]
            grip = [glove(canvas, (43, 8, 65, 32))]
        else:
            center_top = min(y for y in range(10, 55) for x in range(38, 48)
                             if canvas.getpixel((x, y))[3] > 128)
            head = [27, center_top, 60, center_top + 30]
            grip = [glove(canvas, (8, 8, 29, 36)), glove(canvas, (58, 8, 80, 36))]
        heads.append(head)
        palms.append(grip)
    return paths, heads, palms, hashes


def main():
    manifest = read(ROOT / "before-api-redraw/manifest.json")
    provenance = []
    selections = {"south": [7, 8, 9, 10, 11, 12],
                  "east": [5, 6, 7, 8, 9, 10],
                  "north": [5, 6, 7, 8, 9, 10]}
    for row_index, action, count in ((11, "carry-idle", 4), (14, "carry-walk", 6)):
        for offset, direction in enumerate(("south", "east", "north")):
            indices = [1, 2, 3, 4] if count == 4 else selections[direction]
            paths, heads, palms, hashes = normalize(action, direction, indices)
            anchor_y = {"south": 91, "east": 94 if count == 4 else 89, "north": 86}[direction]
            row = manifest["rows"][row_index + offset]
            row.update(frames=paths, anchor=[43.5, anchor_y], head_bounds=heads,
                       palms=palms, status="PixelLab API; empty hands; no baked effects")
            provenance.append({"row": row["name"], "action": action, "direction": direction,
                               "indices": indices, "source_sha256": hashes})
    for row_index, action, indices, anchor in (
            (10, "cast-north", [0, 1, 2, 3, 4, 5, 7, 9, 10], [43.5, 73]),
            (17, "lobby", [0, 2, 3, 4, 5, 6, 7, 8], [43.5, 74])):
        row = manifest["rows"][row_index]
        row.update(frames=[f"api-generated/{action}/{index}.png" for index in indices],
                   anchor=anchor, head_bounds=[[28, 12, 60, 44] for _ in indices],
                   status="PixelLab API; character poses only; no effects")
        if row_index == 10:
            row["wrist"] = [61, 29]
        provenance.append({"row": row["name"], "action": action, "indices": indices})
    manifest.update(status="api-candidate", generation_method="PixelLab API v2",
                    effect_policy="character poses only; no baked objects or effects")
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (ROOT / "api-generated/provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print("Mapped 47 new PixelLab poses; preserved free-tier rows 0..9 (61 frames).")


if __name__ == "__main__":
    main()
