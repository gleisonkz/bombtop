"""Build review images from the final packed cells, never raw generation attempts."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent


def main():
    sheet = Image.open(ROOT / "harry-candidate.png").convert("RGBA")
    lobby = Image.open(ROOT / "harry-lobby-candidate.png").convert("RGBA")
    victory = Image.open(ROOT / "harry-victory-candidate.png").convert("RGBA")
    full = Image.new("RGBA", (2016, 4480))
    full.paste(sheet, (0, 0)); full.paste(lobby, (0, 17 * 224))
    for index in range(16):
        full.paste(victory.crop((index * 224, 0, (index + 1) * 224, 224)),
                   ((index % 9) * 224, (18 + index // 9) * 224))
    full.save(ROOT / "harry-complete-review.png")
    frames = []
    for column in range(6):
        canvas = Image.new("RGBA", (672, 224), (38, 42, 53, 255))
        for direction, row in enumerate((14, 15, 16)):
            canvas.alpha_composite(sheet.crop((column * 224, row * 224, (column + 1) * 224, (row + 1) * 224)),
                                   (direction * 224, 0))
        frames.append(canvas.convert("RGB").quantize(colors=128))
    frames[0].save(ROOT / "carry-preview.gif", save_all=True, append_images=frames[1:],
                   loop=0, duration=140, disposal=2)
    contact = Image.new("RGBA", (896, 896), (38, 42, 53, 255))
    draw = ImageDraw.Draw(contact)
    for y, (name, image, row, indices) in enumerate((
            ("cast", sheet, 8, [0, 2, 5, 8]), ("carry", sheet, 14, [0, 2, 3, 5]),
            ("lobby", lobby, 0, [0, 2, 4, 7]), ("victory", victory, 0, [0, 5, 10, 15]))):
        for x, column in enumerate(indices):
            contact.alpha_composite(image.crop((column * 224, row * 224, (column + 1) * 224, (row + 1) * 224)),
                                    (x * 224, y * 224))
            draw.text((x * 224 + 3, y * 224 + 3), f"{name}:{column}")
    contact.save(ROOT / "final-contact.png")
    blue = sum(a > 128 and b > 100 and b > r * 1.4 and g > r * 1.25
               for r, g, b, a in sheet.crop((0, 11 * 224, sheet.width, 17 * 224)).getdata())
    if blue > 4:
        raise ValueError(f"Unexpected saturated blue pixels in carry cells: {blue}")
    print("Updated 124-frame review and clean carry preview; no blue prop clusters remain.")


if __name__ == "__main__":
    main()
