"""Lays a lobby showpiece out as its own image, public/sprites/<name>-lobby.png: one row of cells (SHEETS.<name>.lobby.image).

A showpiece runs to 16 frames and its effects (an aura, clones, a web out of the card) need room round the hero: laid
into the character sheet, it would widen every cell and add columns to every row, and each menu preview paints the
whole sheet in its player's color (a phone's memory filled up). Only the menus play the lobby, so it lives apart.
Takes FRAMES_DIR/lobby/south/<i>.png as a build-<name>-lobby.py script writes them (same canvas for all, the feet of
frame 0 (standing) on the ground); the cell is the union of what is drawn, centered on the canvas so mirroring stays
aligned, its anchor between frame 0's feet as build-character-sheet.py takes it. Prints the geometry for SHEETS.
Usage: python build-lobby-image.py NAME FRAMES_DIR"""
import json, sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent


def feet(im):
    bb = im.getchannel("A").point(lambda v: 255 if v > 32 else 0).getbbox()
    return bb[3] if bb else im.height


def body_middle(im):
    """Middle of the body's widest solid columns (as build-character-sheet.py takes it)."""
    a = im.getchannel("A").load()
    cols = [x for x in range(im.width) if sum(1 for y in range(im.height) if a[x, y] > 128) > 6]
    return (cols[0] + cols[-1] + 1) / 2


def main():
    name, src = sys.argv[1], Path(sys.argv[2]) / "lobby" / "south"
    frames = [Image.open(src / f"{i}.png").convert("RGBA") for i in range(len(list(src.glob("*.png"))))]
    w, h = frames[0].size
    box = None
    for im in frames:
        bb = im.getchannel("A").getbbox()
        if bb:
            box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
    half = max(w // 2 - box[0], box[2] - w // 2)
    left, top, right, bottom = w // 2 - half, box[1], w // 2 + half, max(box[3], feet(frames[0]))
    cw, ch = right - left, bottom - top
    out = Image.new("RGBA", (cw * len(frames), ch))
    for c, im in enumerate(frames):
        out.alpha_composite(im.crop((left, top, right, bottom)), (c * cw, 0))
    path = HERE.parent / "public" / "sprites" / f"{name}-lobby.png"
    out.save(path)
    print(json.dumps({"url": f"sprites/{name}-lobby.png", "width": out.width, "height": out.height, "frameW": cw, "frameH": ch,
                      "anchorX": body_middle(frames[0].crop((left, top, right, bottom))), "anchorY": feet(frames[0]) - top,
                      "frames": len(frames)}))


main()
