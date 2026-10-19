"""Builds sprites/ninja.png (SHEETS.ninja in render/sprites.ts) from the ninja's PixelLab animation
frames (character "Ice ninja HD", 128px; carry poses from its "Carry" state).
Frames come on different canvas sizes, so each row is aligned by the feet of its first frame
(standing pose) to one baseline, centered, and every cell is cropped to the union of what is drawn.
Usage: python build-ninja-sheet.py FRAMES_DIR public/sprites/ninja.png
  FRAMES_DIR holds <animation>/<direction>/<i>.png as downloaded from PixelLab."""
import json, sys
from pathlib import Path
from PIL import Image

# (sheet row name, animation folder, direction, frames)
ROWS = [
    ("idle.down", "idle-s3", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
    ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walkn3", "north", 6),
    ("stun", "hit3", "south", 6),
    ("death", "death3", "south", 8),
    ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
    ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
    ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
    ("lobby", "lobby-seal", "south", 8),
]
BASE = 400  # work canvas size, feet baseline at BASE * 0.75


def feet(im):
    """Lowest drawn row of a frame."""
    a = im.getchannel("A")
    bb = a.point(lambda v: 255 if v > 32 else 0).getbbox()
    return bb[3] if bb else im.height


def body_middle(im):
    """Middle of the body's widest solid columns: thin parts (the katana hilt) don't pull it off center."""
    a = im.getchannel("A").load()
    cols = [x for x in range(im.width) if sum(1 for y in range(im.height) if a[x, y] > 128) > 6]
    return (cols[0] + cols[-1] + 1) / 2


def main():
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    rows = []
    for name, folder, d, n in ROWS:
        frames = [Image.open(src / folder / d / f"{i}.png").convert("RGBA") for i in range(n)]
        ground = feet(frames[0])
        placed = []
        for im in frames:
            canvas = Image.new("RGBA", (BASE, BASE))
            x = (BASE - im.width) // 2
            y = int(BASE * 0.75) - ground
            canvas.alpha_composite(im, (x, y))
            placed.append(canvas)
        rows.append((name, placed))
    # union of everything drawn → the cell
    box = None
    for _, frames in rows:
        for c in frames:
            bb = c.getchannel("A").getbbox()
            if bb:
                box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
    # keep the cell centered on the canvas center so mirroring stays aligned
    half = max(BASE // 2 - box[0], box[2] - BASE // 2)
    left, right = BASE // 2 - half, BASE // 2 + half
    top, bottom = box[1], box[3]
    cw, ch = right - left, bottom - top
    cols = max(len(f) for _, f in rows)
    sheet = Image.new("RGBA", (cw * cols, ch * len(rows)))
    for r, (_, frames) in enumerate(rows):
        for c, im in enumerate(frames):
            sheet.alpha_composite(im.crop((left, top, right, bottom)), (c * cw, r * ch))
    sheet.save(out)
    stand = rows[0][1][0].crop((left, top, right, bottom))
    bb = stand.getchannel("A").getbbox()
    info = {
        "width": sheet.width, "height": sheet.height, "frameW": cw, "frameH": ch,
        "anchorX": body_middle(stand), "anchorY": int(BASE * 0.75) - top, "bodyH": bb[3] - bb[1],
        "rows": {name: i for i, (name, _) in enumerate(rows)},
    }
    print(json.dumps(info))


main()
