"""Locks a character's head through its idles and walks, on the built sheet (run after build-character-sheet.py).
PixelLab's templates redraw the head on every frame: the captain's eyes, mouth and jaw changed shape
from step to step (and while standing, breathing), so his head seemed to wobble while his chin stayed put.
One clean head (each row's reference frame) is pasted over every frame of that row instead, moved only with the body's bob, read off the neck (the narrowest row
under the head); everything from the neck down stays as PixelLab drew it.
Usage: python lock-walk-head.py captain public/sprites/captain.png [preview.gif]
(the preview shows the first locked row)"""
import sys
from PIL import Image

# name: (frame w, frame h, [(row, frames, reference frame)]) as in SHEETS (render/sprites.ts).
# Captain: idle down, idle side, walk down, walk side (the backs barely change).
SHEETS = {"captain": (124, 138, [(4, 6, 1), (0, 4, 2), (1, 4, 2), (3, 6, 0)])}


def neck(cell):
    """The narrowest opaque row below the top of the head: where the head meets the collar."""
    a = cell.split()[3].load()
    w, h = cell.size
    top = next(y for y in range(h) if any(a[x, y] > 127 for x in range(w)))
    widths = [(sum(1 for x in range(w) if a[x, y] > 127), y) for y in range(top + 45, top + 68)]
    return min(widths)[1]


def lock(sheet, fw, fh, row, frames, ref):
    cells = [sheet.crop((f * fw, row * fh, (f + 1) * fw, (row + 1) * fh)) for f in range(frames)]
    ref_neck = neck(cells[ref])
    head = cells[ref].crop((0, 0, fw, ref_neck))
    out = []
    for cell in cells:
        n = neck(cell)
        fixed = Image.new("RGBA", (fw, fh))
        fixed.paste(cell.crop((0, n, fw, fh)), (0, n))
        fixed.alpha_composite(head, (0, n - ref_neck))
        out.append(fixed)
    for f, cell in enumerate(out):
        sheet.paste(cell, (f * fw, row * fh))
    return out


def main():
    name, path = sys.argv[1], sys.argv[2]
    fw, fh, rows = SHEETS[name]
    sheet = Image.open(path).convert("RGBA")
    out = [lock(sheet, fw, fh, row, frames, ref) for row, frames, ref in rows][0]
    sheet.save(path)
    if len(sys.argv) > 3:
        big = [Image.alpha_composite(Image.new("RGBA", c.size, (60, 120, 60, 255)), c).resize((fw * 4, fh * 4), Image.NEAREST) for c in out]
        big[0].save(sys.argv[3], save_all=True, append_images=big[1:], duration=7 * 1000 // 60, loop=0)


if __name__ == "__main__":
    main()
