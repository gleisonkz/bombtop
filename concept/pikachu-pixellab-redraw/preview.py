"""Export a timing-correct review GIF from the final atlas, without synthesizing poses."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
SAMPLES = ((0, 4, 15, "Parado"), (7, 7, 7, "Derrota"), (17, 8, 7, "Vitoria"),
           (3, 6, 7, "Andar frente"), (4, 6, 7, "Andar lado"), (5, 6, 7, "Andar costas"),
           (8, 9, 4, "Ataque frente"), (9, 9, 4, "Ataque lado"), (10, 9, 4, "Ataque costas"),
           (14, 6, 7, "Carregar frente"), (15, 6, 7, "Carregar lado"), (16, 6, 7, "Carregar costas"))


def main():
    atlas = Image.open(ROOT / "pikachu-candidate.png")
    frames = []
    for step in range(60):
        canvas = Image.new("RGBA", (540, 736), (40, 46, 55, 255))
        draw = ImageDraw.Draw(canvas)
        tick = step * 0.08 * 60
        for index, (row, count, period, label) in enumerate(SAMPLES):
            column = int(tick // period) % count
            if row == 7:
                column = min(int(tick // period), count - 1)
            cell = atlas.crop((column * 180, row * 164, (column + 1) * 180, (row + 1) * 164))
            x, y = index % 3 * 180, index // 3 * 184
            draw.text((x + 8, y + 5), label, fill="white")
            canvas.alpha_composite(cell, (x, y + 20))
        frames.append(canvas.convert("RGB"))
    frames[0].save(ROOT / "pikachu-preview.gif", save_all=True, append_images=frames[1:],
                   duration=80, loop=0, disposal=2)
    print("Exported 60 playback samples; every image comes from a packed source cell")


if __name__ == "__main__":
    main()
