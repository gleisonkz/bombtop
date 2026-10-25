import importlib.util
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path.cwd()
SOURCE = ROOT / "concept/powerups/powerup-family-concept-v1.png"
OUTPUT = ROOT / "apps/client/public/sprites/items.png"
SIZE = 192
SOURCE_SIZE = 512
ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]  # concept cells; Lula's picanha comes last (ITEMS.order)
RING_CELL, RING_CENTER, RING_INNER = 1, (259, 257), 186  # the fire's gold ring, around its own centre


def picanha_icon() -> Image.Image:
    """The picanha drawn by build-items.py (192px, no plate)."""
    spec = importlib.util.spec_from_file_location("build_items", Path(__file__).with_name("build-items.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.icon_picanha()


def picanha_medallion(source: Image.Image) -> Image.Image:
    """Lula's picanha in the family's look: the fire's gold ring with its inside painted over (a warm glow with
    rays) and the picanha on it. The fire and bomb poke over the ring's left and right arcs, so those arcs are
    the top arc turned a quarter round (the tabs sit every quarter, so they line up)."""
    x, y = (RING_CELL % 4) * SOURCE_SIZE, (RING_CELL // 4) * SOURCE_SIZE
    cell = source.crop((x, y, x + SOURCE_SIZE, y + SOURCE_SIZE))
    half = SOURCE_SIZE // 2
    centred = Image.new("RGBA", cell.size)
    centred.alpha_composite(cell, (half - RING_CENTER[0], half - RING_CENTER[1]))
    out = np.array(centred).astype(float)
    ys, xs = np.mgrid[0:SOURCE_SIZE, 0:SOURCE_SIZE]
    dist = np.hypot(xs - half, ys - half)
    angle = np.degrees(np.arctan2(ys - half, xs - half))
    left, right = np.abs(angle) > 130, np.abs(angle) < 50
    out[left] = np.array(centred.rotate(90)).astype(float)[left]
    out[right] = np.array(centred.rotate(-90)).astype(float)[right]
    t = np.clip(dist / RING_INNER, 0, 1)
    hot, warm, deep = np.array([255, 226, 140.0]), np.array([235, 110, 30.0]), np.array([130, 36, 10.0])
    glow = np.where((t < 0.55)[..., None], hot + (warm - hot) * (t / 0.55)[..., None],
                    warm + (deep - warm) * ((t - 0.55) / 0.45)[..., None])
    rays = (np.cos(np.radians(angle) * 12) > 0.75) * (t > 0.35) * 0.25
    glow = glow + (255 - glow) * rays[..., None]
    inside = dist < RING_INNER
    out[inside, :3], out[inside, 3] = glow[inside], 255
    medal = Image.fromarray(out.clip(0, 255).astype(np.uint8))
    ImageDraw.Draw(medal).ellipse((half - RING_INNER, half - RING_INNER, half + RING_INNER, half + RING_INNER),
                                  outline=(20, 10, 8, 255), width=7)
    meat = picanha_icon().resize((330, 330), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", meat.size)
    shadow.paste((60, 10, 0, 150), (0, 0), meat.getchannel("A").filter(ImageFilter.GaussianBlur(7)))
    medal.alpha_composite(shadow, (half - 165 + 8, half - 165 + 14))
    medal.alpha_composite(meat, (half - 165, half - 165))
    return medal


def make_frame(icon: Image.Image, frame: int) -> Image.Image:
    if frame == 0:
        return icon.copy()
    shine = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shine)
    center = (-40, 35, 100)[frame - 1]
    draw.polygon(
        [(center - 22, -30), (center + 3, -30), (center + 150, 220), (center + 125, 220)],
        fill=(255, 250, 224, 115),
    )
    shine.putalpha(ImageChops.multiply(shine.getchannel("A"), icon.getchannel("A")))
    return Image.alpha_composite(icon, shine)


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != (2048, 1536):
        raise ValueError(f"Unexpected source dimensions: {source.size}")
    crops = [source.crop(((i % 4) * SOURCE_SIZE, (i // 4) * SOURCE_SIZE, (i % 4 + 1) * SOURCE_SIZE, (i // 4 + 1) * SOURCE_SIZE))
             for i in ORDER] + [picanha_medallion(source)]
    sheet = Image.new("RGBA", (len(crops) * SIZE, 4 * SIZE))
    for column, crop in enumerate(crops):
        icon = crop.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        for frame in range(4):
            sheet.alpha_composite(make_frame(icon, frame), (column * SIZE, frame * SIZE))
    sheet.save(OUTPUT)
    print(f"Packed {len(crops)} items, 4 frames: {OUTPUT} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
