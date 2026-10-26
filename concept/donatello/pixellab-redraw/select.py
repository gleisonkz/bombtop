"""Select complete new clips and register the raised turtle palms."""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
ROWS = [("idle", 4), ("idle", 4), ("idle", 4),
        ("walk", 6), ("walk", 6), ("walk", 6),
        ("stun", 6), ("death", 6), ("cast", 9), ("cast", 9), ("cast", 9),
        ("carryIdle", 4), ("carryIdle", 4), ("carryIdle", 4),
        ("carryWalk", 6), ("carryWalk", 6), ("carryWalk", 6), ("lobby", 12)]
DIRECTIONS = ["south", "east", "north"] * 2 + ["south", "south"] + ["south", "east", "north"] * 3 + ["south"]


def is_green(color):
    red, green, blue, alpha = color
    return alpha > 200 and green > 55 and green > red * 1.08 and green > blue * 1.2


def mask_bounds(image):
    points = [(x, y) for y in range(image.height) for x in range(image.width)
              if (lambda c: c[3] > 128 and c[0] > c[1] * 1.2
                  and c[2] > c[1] * 1.4 and c[2] > 70)(image.getpixel((x, y)))]
    if not points:
        raise ValueError("Purple bandana missing")
    xs, ys = zip(*points)
    return [min(xs), min(ys), max(xs) + 1, max(ys) + 1]


def palm(image, box):
    left, top, right, bottom = box
    candidates = []
    for y in range(max(2, int(top)), min(image.height - 2, int(bottom))):
        for x in range(max(2, int(left)), min(image.width - 2, int(right))):
            if not is_green(image.getpixel((x, y))):
                continue
            score = sum(is_green(image.getpixel((x + dx, y + dy)))
                        for dx in range(-2, 3) for dy in range(-2, 3))
            candidates.append((score, -y, x, y))
    if not candidates:
        raise ValueError(f"No turtle palm in {box}")
    _, _, x, y = max(candidates)
    return [x, y]


def main():
    rows = []
    for (action, count), direction in zip(ROWS, DIRECTIONS):
        name = action + "-" + direction
        directory = ROOT / "generated" / name
        indices = [1, 2, 3, 4, 5, 6, 7, 9, 10] if action == "cast" else list(range(1, count + 1))
        paths = [directory / f"frame_{index:03}.png" for index in indices]
        reference = Image.open(directory / "frame_000.png").convert("RGBA")
        bounds = reference.getbbox()
        row = {"name": name, "frames": [p.relative_to(ROOT).as_posix() for p in paths],
               "anchor": [(bounds[0] + bounds[2]) // 2, bounds[3]],
               "metadata": {"source": "PixelLab v3", "staff": "strapped to shell" if action.startswith("carry") else "held in visible grip"}}
        heads, palms = [], []
        for path in paths:
            image = Image.open(path).convert("RGBA")
            mask = mask_bounds(image)
            middle = (mask[0] + mask[2]) / 2
            heads.append([max(0, int(middle - 30)), max(0, mask[1] - 26),
                          min(image.width, int(middle + 30)), min(image.height, mask[3] + 20)])
            if action.startswith("carry"):
                top, bottom = mask[1] - 40, mask[1] + 7
                if direction == "east":
                    points = [palm(image, (middle + 12, top, middle + 52, bottom))]
                else:
                    points = [palm(image, (middle - 70, top, middle - 18, bottom)),
                              palm(image, (middle + 18, top, middle + 70, bottom))]
                palms.append(points)
        row["headbounds"] = heads
        if palms:
            row["palms"] = palms
        rows.append(row)
    (ROOT / "selections.json").write_text(json.dumps({"rows": rows}, indent=2) + "\n")
    print("Selected 111 poses from the approved new Donatello; 50 palm positions registered.")


if __name__ == "__main__":
    main()
