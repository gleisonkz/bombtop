"""Register sixteen generated aura poses. Crop/translate only; no repainting."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CELL = 320
ANCHOR = (160, 304)
SOURCE = HERE / "source.generated.png"


def main():
    source = Image.open(SOURCE).convert("RGBA")
    pixels = np.array(source)
    height, width = pixels.shape[:2]
    frames = [None] * 16
    records = [None] * 16
    for column in range(4):
        left, right = round(column * width / 4), round((column + 1) * width / 4)
        projection = (pixels[:, left:right, 3] >= 128).sum(1)
        bands = [0]
        for row in range(1, 4):
            middle = round(height * row / 4)
            start, end = max(0, middle - 65), min(height, middle + 65)
            empty = np.where(projection[start:end] == 0)[0] + start
            gaps = [g for g in np.split(empty, np.where(np.diff(empty) > 1)[0] + 1) if len(g)]
            if not gaps:
                raise ValueError("Adjacent aura cores touch; generation must be replaced")
            best = min(gaps, key=lambda g: abs(float(g.mean()) - middle))
            bands.append(round(float(best.mean())))
        bands.append(height)
        for row in range(4):
            top, bottom = bands[row:row + 2]
            alpha = pixels[top:bottom, left:right, 3]
            yy, xx = np.where(alpha >= 32)
            if not len(xx):
                raise ValueError("Empty aura pose")
            x0, x1 = int(xx.min()), int(xx.max()) + 1
            y0, y1 = int(yy.min()), int(yy.max()) + 1
            base_y, base_x = np.where((alpha >= 128) & (np.indices(alpha.shape)[0] >= y1 - 7))
            origin_x = left + float(base_x.mean())
            origin_y = top + y1
            box = (max(left, left + x0 - 6), max(top, top + y0 - 6),
                   min(right, left + x1 + 6), min(bottom, top + y1 + 6))
            offset = (round(ANCHOR[0] - (origin_x - box[0])), round(ANCHOR[1] - (origin_y - box[1])))
            crop = source.crop(box)
            if offset[0] < 0 or offset[1] < 0 or offset[0] + crop.width > CELL or offset[1] + crop.height > CELL:
                raise ValueError(f"Aura {row * 4 + column} exceeds native cell; never rescale individual poses")
            frame = Image.new("RGBA", (CELL, CELL))
            frame.paste(crop, offset)
            index = row * 4 + column
            frames[index] = frame
            records[index] = {"frame": index, "source_box": list(box), "source_anchor": [origin_x, origin_y],
                              "offset": list(offset), "core_size": [x1 - x0, y1 - y0],
                              "core_pixels": int((alpha >= 32).sum())}
    sheet = Image.new("RGBA", (CELL * 4, CELL * 4))
    hashes = set()
    (HERE / "frames").mkdir(exist_ok=True)
    for index, frame in enumerate(frames):
        sheet.paste(frame, ((index % 4) * CELL, (index // 4) * CELL))
        frame.save(HERE / "frames" / f"{index:02d}.png")
        a = np.array(frame)
        a[a[:, :, 3] < 32] = 0
        hashes.add(hashlib.sha256(a.tobytes()).hexdigest())
        assert frame.getchannel("A").getextrema()[0] == 0
        assert not any(frame.getchannel("A").crop((0, 0, CELL, 2)).getdata())
        assert not any(frame.getchannel("A").crop((0, CELL - 2, CELL, CELL)).getdata())
    if len(hashes) != 16:
        raise ValueError("Repeated visible aura drawings")
    public = ROOT / "apps/client/public/sprites"
    sheet.save(public / "goku-ssj-aura.png")
    average_height = sum(r["core_size"][1] for r in records[8:]) / 8
    contract = {"image": "sprites/goku-ssj-aura.png", "width": CELL * 4, "height": CELL * 4,
                "frameW": CELL, "frameH": CELL, "columns": 4, "rows": 4, "frames": 16,
                "anchorX": ANCHOR[0], "anchorY": ANCHOR[1], "fps": 20,
                "intro": list(range(8)), "loop": list(range(8, 16)), "release": list(range(7, -1, -1)),
                "layer": "behind-character", "blendMode": "add", "referenceBodyH": 104,
                "fullAuraHeight": average_height, "desiredAuraToBodyHeight": 1.45,
                "nativeScaleForA1": 104 * 1.45 / average_height, "containsCharacter": False,
                "generator": "built-in image_gen; no PixelLab", "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest()}
    (public / "goku-ssj-aura.json").write_text(json.dumps(contract, indent=2) + "\n")
    (HERE / "packing.json").write_text(json.dumps({"contract": contract, "frames": records}, indent=2) + "\n")
    playback = list(range(8)) + list(range(8, 16)) * 3 + list(range(7, -1, -1))
    preview = []
    for index in playback:
        background = Image.new("RGB", (CELL, CELL), "#343d49")
        background.paste(frames[index], (0, 0), frames[index])
        preview.append(background)
    preview[0].save(HERE / "aura-preview.gif", save_all=True, append_images=preview[1:],
                    duration=50, loop=0, disposal=2)
    print("Aura: 16 distinct registered frames, true alpha, 320x320 cells, 1280x1280 atlas; no resampling")


if __name__ == "__main__":
    main()
