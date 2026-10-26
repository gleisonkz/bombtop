"""Export a labelled 3-column, 4-row review GIF using packed poses and game timing."""
from PIL import Image, ImageDraw

from pack import CELL, ROOT

# (atlas row, frame count, ticks per pose at 60 Hz, label)
SAMPLES = (
    (0, 4, 15, "Idle south"), (7, 7, 7, "Death south"), (17, 8, 7, "Lobby south"),
    (3, 6, 7, "Walk south"), (4, 6, 7, "Walk east"), (5, 6, 7, "Walk north"),
    (8, 9, 4, "Cast south"), (9, 9, 4, "Cast east"), (10, 9, 4, "Cast north"),
    (14, 6, 7, "Carry walk south"), (15, 6, 7, "Carry walk east"),
    (16, 6, 7, "Carry walk north"),
)


def main():
    with Image.open(ROOT / "bugs-candidate.png") as image:
        if image.mode != "RGBA" or image.size != (1728, 3456):
            raise ValueError("Expected Bugs RGBA atlas 1728x3456; run pack.py first")
        atlas = image.copy()
    frames = []
    durations = []
    # Sample every game tick; GIF centisecond quantization alternates 20/10/20 ms.
    # This preserves every pose and bounds timing error to 5 ms (no 80 ms skips).
    for tick in range(288):
        canvas = Image.new("RGBA", (CELL[0] * 3, (CELL[1] + 20) * 4), (40, 46, 55, 255))
        draw = ImageDraw.Draw(canvas)
        for index, (row, count, period, label) in enumerate(SAMPLES):
            column = tick // period
            column = min(column, count - 1) if row == 7 else column % count
            left, top = column * CELL[0], row * CELL[1]
            cell = atlas.crop((left, top, left + CELL[0], top + CELL[1]))
            x, y = index % 3 * CELL[0], index // 3 * (CELL[1] + 20)
            draw.text((x + 8, y + 5), label, fill="white")
            canvas.alpha_composite(cell, (x, y + 20))
        frames.append(canvas.convert("RGB"))
        durations.append((round((tick + 1) * 100 / 60) - round(tick * 100 / 60)) * 10)
    frames[0].save(ROOT / "bugs-preview.gif", save_all=True, append_images=frames[1:],
                   duration=durations, loop=0, disposal=2, optimize=False)
    print("Exported 12 labelled strips, 576x848, 4.8 seconds; death holds its final pose")


if __name__ == "__main__":
    main()
