"""Pack original generated ground art with one stable transform per animation."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CONCEPT = ROOT.parents[1] / "concept" / "ground-effects"
OUTPUT = ROOT / "public" / "sprites" / "ground-effects.png"


def pack_row(name, bottom):
    source = Image.open(CONCEPT / name).convert("RGBA")
    width = source.width // 6
    frames = [source.crop((i * width, 0, (i + 1) * width, bottom)) for i in range(6)]
    bounds = []
    for frame in frames:
        pixels = np.array(frame)
        pixels[pixels[:, :, 3] < 64] = 0
        frame.paste(Image.fromarray(pixels))
        y, x = np.where(np.asarray(frame)[:, :, 3] > 32)
        bounds.append((int(x.min()), int(y.min()), int(x.max()) + 1, int(y.max()) + 1))
    box = (min(b[0] for b in bounds), min(b[1] for b in bounds),
           max(b[2] for b in bounds), max(b[3] for b in bounds))
    scale = min(120 / (box[2] - box[0]), 120 / (box[3] - box[1]))
    size = (round((box[2] - box[0]) * scale), round((box[3] - box[1]) * scale))
    row = Image.new("RGBA", (768, 128))
    for i, frame in enumerate(frames):
        # Correct source-sheet spacing drift without scaling individual frames.
        dx = round((bounds[i][0] + bounds[i][2] - box[0] - box[2]) / 2)
        dy = round((bounds[i][1] + bounds[i][3] - box[1] - box[3]) / 2)
        crop = (box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy)
        packed = frame.crop(crop).resize(size, Image.Resampling.LANCZOS)
        row.alpha_composite(packed, (i * 128 + (128 - size[0]) // 2, (128 - size[1]) // 2))
    return row


def build_sheet():
    sheet = Image.new("RGBA", (768, 256))
    sheet.alpha_composite(pack_row("portal-source.png", 406), (0, 0))
    sheet.alpha_composite(pack_row("protection-source.png", 724), (0, 128))
    return sheet


if __name__ == "__main__":
    build_sheet().save(OUTPUT)
    print(OUTPUT)
