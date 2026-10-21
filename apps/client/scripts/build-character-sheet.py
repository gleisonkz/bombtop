"""Builds a character sheet (SHEETS.<name> in render/sprites.ts) from its PixelLab animation frames:
  ninja: sprites/ninja.png, character "Ice ninja HD" (128px; carry poses from its "Carry" state)
  captain: sprites/captain.png, character "Captain America HD" (180px canvas; "Carry" state too)
  thor: sprites/thor.png, character "Thor HD" (180px canvas; cast and carry walk posed from our own skeletons;
    the back view comes from a second "Thor HD", made in v3 from the first's south/east/west, whose cape
    covers his back (the first one's hung in front of him),
    carry idle = the carry walk's standing frames, lobby = the v3 "victory pose" frames 1..8).
    PixelLab drew sparks round the thrust hammer that clash with the game's own bolt: the thrust holds its
    first frame (clean in front and back; in the side view cut off at the hammer's face). The hammer's
    face in the side and front thrust frames is printed as "muzzle" (from the anchor) for the bolt to leave from.
Frames come on different canvas sizes, so each row is aligned by the feet of its first frame
(standing pose) to one baseline, centered, and every cell is cropped to the union of what is drawn.
Usage: python build-character-sheet.py ninja|captain|thor FRAMES_DIR public/sprites/<name>.png
  FRAMES_DIR holds <animation>/<direction>/<i>.png as downloaded from PixelLab."""
import json, sys
from pathlib import Path
from PIL import Image

# (sheet row name, animation folder, direction, frames)
CHARACTERS = {
    "ninja": [
        ("idle.down", "idle-s3", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "skel", "south", 6), ("walk.side", "skel", "east", 6), ("walk.up", "skel", "north", 6),
        ("stun", "hit3", "south", 6),
        ("death", "death3", "south", 8),
        ("cast.down", "castice", "south", 9), ("cast.side", "castice", "east", 9), ("cast.up", "castice", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby-seal", "south", 8),
    ],
    # cast = raising the shield (skeleton-posed brace); "up" is the back view without the shield, the
    # renderer draws the big shield in front of him.
    "captain": [
        ("idle.down", "idle", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
    # cast = hammer swung overhead, then thrust forward as the bolt leaves it (frame 5, BEAM_DELAY)
    "thor": [
        ("idle.down", "idle", "south", 4), ("idle.side", "idle", "east", 4), ("idle.up", "idle", "north", 4),
        ("walk.down", "walk", "south", 6), ("walk.side", "walk", "east", 6), ("walk.up", "walk", "north", 6),
        ("stun", "hit", "south", 6),
        ("death", "death", "south", 7),
        ("cast.down", "cast", "south", 9), ("cast.side", "cast", "east", 9), ("cast.up", "cast", "north", 9),
        ("carryIdle.down", "carry-idle", "south", 4), ("carryIdle.side", "carry-idle", "east", 4), ("carryIdle.up", "carry-idle", "north", 4),
        ("carryWalk.down", "carry-walk", "south", 6), ("carryWalk.side", "carry-walk", "east", 6), ("carryWalk.up", "carry-walk", "north", 6),
        ("lobby", "lobby", "south", 8),
    ],
}
BASE = 400  # work canvas size, feet baseline at BASE * 0.75
THRUST = 5  # thor: first cast frame with the hammer thrust forward (BEAM_DELAY / CAST_TICKS_PER_FRAME)


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


def silver(p):
    """The hammer head's grey: opaque, light, unsaturated (the sparks are tinted blue)."""
    r, g, b, a = p
    return a > 200 and max(r, g, b) > 150 and max(r, g, b) - min(r, g, b) < 40


def hammer_face(im):
    """Side view: the rightmost column holding 8+ silver pixels (the hammer's face), and those pixels' rows."""
    px = im.load()
    for x in range(im.width - 1, -1, -1):
        ys = [y for y in range(im.height) if silver(px[x, y])]
        if len(ys) >= 8:
            return x, ys
    raise ValueError("no hammer face")


def hammer_face_cut(im):
    """Side view: erase everything past the hammer's face, sparks included."""
    edge = hammer_face(im)[0]
    px = im.load()
    for y in range(im.height):
        for x in range(edge + 1, im.width):
            px[x, y] = (0, 0, 0, 0)
    return im


def thor_cast(folder, d, frames):
    if folder != "cast":
        return frames
    thrust = hammer_face_cut(frames[THRUST]) if d == "east" else frames[THRUST]
    return frames[:THRUST] + [thrust.copy() for _ in frames[THRUST:]]


def silver_box(im):
    """Bounding box of the hammer head's grey (low saturation, light) pixels below the face."""
    px = im.load()
    pts = []
    for y in range(im.height // 2, im.height):
        for x in range(im.width):
            if silver(px[x, y]) and max(px[x, y][:3]) > 170:
                pts.append((x, y))
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def main():
    character, src, out = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    rows = []
    for name, folder, d, n in CHARACTERS[character]:
        frames = [Image.open(src / folder / d / f"{i}.png").convert("RGBA") for i in range(n)]
        if character == "thor":
            frames = thor_cast(folder, d, frames)
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
    if character == "thor":
        names = [name for name, _ in rows]
        ax, ay = info["anchorX"], info["anchorY"]
        side = rows[names.index("cast.side")][1][THRUST].crop((left, top, right, bottom))
        sb = side.getchannel("A").getbbox()
        fx, rows_at = hammer_face(side)
        face = fx + 1
        down = rows[names.index("cast.down")][1][THRUST].crop((left, top, right, bottom))
        x0, y0, x1, y1 = silver_box(down)
        info["muzzle"] = {
            "side": [face - ax, (rows_at[0] + rows_at[-1]) / 2 - ay],
            "down": [(x0 + x1 + 1) / 2 - ax, y1 + 1 - ay],
            # the back view hides the hammer in front of his face: the bolt leaves from over his head
            "up": [0, sb[1] + (sb[3] - sb[1]) * 0.25 - ay],
        }
    print(json.dumps(info))


main()
