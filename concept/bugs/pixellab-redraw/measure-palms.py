"""Measure exposed white glove support pixels on the packed carry poses."""
from collections import deque
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent


def glove_contact(frame, right):
    pixels = np.asarray(frame)
    rgb = pixels[:, :, :3].astype(int)
    mask = (pixels[:, :, 3] > 128) & (rgb.min(2) > 175) & ((rgb.max(2) - rgb.min(2)) < 45)
    mask[105:] = False
    if right:
        mask[:, :112] = False
    else:
        mask[:, 80:] = False
    seen = np.zeros(mask.shape, dtype=bool)
    components = []
    for y, x in zip(*np.where(mask)):
        if seen[y, x]:
            continue
        queue = deque([(int(x), int(y))])
        seen[y, x] = True
        points = []
        while queue:
            px, py = queue.popleft()
            points.append((px, py))
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = px + dx, py + dy
                if 0 <= nx < 192 and 0 <= ny < 192 and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((nx, ny))
        if len(points) >= 8:
            components.append(points)
    if not components:
        raise ValueError("No exposed white overhead glove in expected half of frame")
    glove = min(components, key=lambda points: min(y for _, y in points))
    center_x = sum(x for x, _ in glove) / len(glove)
    center_y = sum(y for _, y in glove) / len(glove)
    def palm_score(point):
        x, y = point
        density = int(mask[max(0, y - 2):y + 3, max(0, x - 2):x + 3].sum())
        return -density, (x - center_x) ** 2 + (y - center_y) ** 2
    return min(glove, key=palm_score)


def main():
    atlas = Image.open(ROOT / "bugs-candidate.png")
    result = {"frameW": 192, "frameH": 192, "rows": {}}
    preview = Image.new("RGBA", (1152, 6 * 212), (48, 54, 63, 255))
    draw = ImageDraw.Draw(preview)
    for row in range(11, 17):
        side = (row - 11) % 3 == 1
        poses = []
        for column in range(4 if row < 14 else 6):
            frame = atlas.crop((column * 192, row * 192, (column + 1) * 192, (row + 1) * 192))
            palms = [glove_contact(frame, True)] if side else [glove_contact(frame, False), glove_contact(frame, True)]
            poses.append(palms)
            ox, oy = column * 192, (row - 11) * 212 + 20
            preview.alpha_composite(frame, (ox, oy))
            draw.text((ox + 4, oy - 16), f"{row}/{column}", fill="white")
            for x, y in palms:
                draw.ellipse((ox + x - 2, oy + y - 2, ox + x + 2, oy + y + 2), fill="magenta")
        result["rows"][str(row)] = poses
    (ROOT / "palms.json").write_text(json.dumps(result, indent=2) + "\n")
    preview.convert("RGB").save(ROOT / "palm-review.png")
    print("Registered 50 visible glove contacts in 30 carry poses; review palm-review.png")


if __name__ == "__main__":
    main()
