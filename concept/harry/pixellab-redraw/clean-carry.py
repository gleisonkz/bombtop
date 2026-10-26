"""Remove detached blue generated props; preserve every character pixel and raw source."""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent


def clean(path):
    image = Image.open(path).convert("RGBA")
    remaining = {(x, y) for y in range(image.height) for x in range(image.width)
                 if image.getpixel((x, y))[3] > 0}
    components = []
    while remaining:
        start = remaining.pop()
        stack, points = [start], [start]
        while stack:
            x, y = stack.pop()
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
                point = (x + dx, y + dy)
                if point in remaining:
                    remaining.remove(point); stack.append(point); points.append(point)
        components.append(points)
    components.sort(key=len, reverse=True)
    removed = 0
    for component in components[1:]:
        blue = 0
        for point in component:
            red, green, value, alpha = image.getpixel(point)
            blue += alpha > 128 and value > 100 and value > red * 1.4 and green > red * 1.25
        if blue >= 4:
            for point in component:
                image.putpixel(point, (0, 0, 0, 0))
            removed += len(component)
    # One rear clip added a cyan spark whose antialiasing touches the sleeve.
    # Its exterior cyan pixels and white core are separate from Harry's palette.
    cyan = []
    spark_frames = path.parent.name == "carry-loop-north" and path.stem in {"4", "5", "6"}
    for y in range(36, min(100, image.height)) if spark_frames else ():
        for x in range(min(65, image.width)):
            red, green, blue, alpha = image.getpixel((x, y))
            if alpha and blue > 30 and blue > red * 1.35 and green > red * 1.2:
                cyan.append((x, y))
    for x, y in cyan:
        image.putpixel((x, y), (0, 0, 0, 0))
        removed += 1
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                px, py = x + dx, y + dy
                if 0 <= px < image.width and 0 <= py < image.height:
                    color = image.getpixel((px, py))
                    if color[3] and min(color[:3]) > 160:
                        image.putpixel((px, py), (0, 0, 0, 0))
                        removed += 1
    output = ROOT / "cleaned" / path.parent.name / path.name
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)
    return {"source": path.relative_to(ROOT).as_posix(), "output": output.relative_to(ROOT).as_posix(),
            "removed_detached_prop_pixels": removed}


if __name__ == "__main__":
    report = [clean(path) for pattern in ("carry-idle-*", "carry-loop-*")
              for folder in (ROOT / "frames").glob(pattern) for path in folder.glob("*.png")]
    (ROOT / "cleanup-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"Removed detached props from {sum(item['removed_detached_prop_pixels'] > 0 for item in report)} frames.")
