from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path.cwd()
SOURCE = ROOT / "concept/powerups/powerup-family-concept-v1.png"
OUTPUT = ROOT / "apps/client/public/sprites/items.png"
SIZE = 192
SOURCE_SIZE = 512
ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]


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
    sheet = Image.new("RGBA", (len(ORDER) * SIZE, 4 * SIZE))
    for column, index in enumerate(ORDER):
        x, y = (index % 4) * SOURCE_SIZE, (index // 4) * SOURCE_SIZE
        crop = source.crop((x, y, x + SOURCE_SIZE, y + SOURCE_SIZE))
        icon = crop.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
        for frame in range(4):
            sheet.alpha_composite(make_frame(icon, frame), (column * SIZE, frame * SIZE))
    sheet.save(OUTPUT)
    print(f"Packed {len(ORDER)} items, 4 frames: {OUTPUT} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
