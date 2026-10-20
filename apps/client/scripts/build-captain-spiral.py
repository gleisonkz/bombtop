"""Builds sprites/captain-spiral.png (SPIRAL in render/sprites.ts): the spiral of light round the
captain while his shield is up, made in PixelLab's VFX Creator ("Captain shield spiral").
Takes the effect's game pack (manifest.json + behind.png + front.png): every frame is put back on
the effect's canvas at anchor + offset, all cells are cropped to the union of what is drawn, and
the sheet gets one row behind the captain and one in front of him.
Usage: python build-captain-spiral.py PACK_DIR public/sprites/captain-spiral.png"""
import json, sys
from pathlib import Path
from PIL import Image


def frames(pack, clip, canvas):
    sheet = Image.open(pack / clip["sheets"][0]["file"]).convert("RGBA")
    fw, fh, cols = clip["frame"]["w"], clip["frame"]["h"], clip["sheets"][0]["columns"]
    x0, y0 = canvas["anchor"]["x"] + clip["offset"]["x"], canvas["anchor"]["y"] + clip["offset"]["y"]
    out = []
    for i in range(clip["frames"]):
        cell = sheet.crop(((i % cols) * fw, (i // cols) * fh, (i % cols + 1) * fw, (i // cols + 1) * fh))
        full = Image.new("RGBA", (canvas["canvas"]["w"], canvas["canvas"]["h"]))
        full.alpha_composite(cell, (x0, y0))
        out.append(full)
    return out


def main():
    pack, out = Path(sys.argv[1]), Path(sys.argv[2])
    manifest = json.loads((pack / "manifest.json").read_text())
    clips = {c["name"]: c for c in manifest["clips"]}
    rows = [frames(pack, clips[name], manifest) for name in ("behind", "front")]
    box = None
    for row in rows:
        for im in row:
            bb = im.getbbox()
            if bb:
                box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
    cw, ch = box[2] - box[0], box[3] - box[1]
    sheet = Image.new("RGBA", (cw * len(rows[0]), ch * len(rows)))
    for r, row in enumerate(rows):
        for c, im in enumerate(row):
            sheet.alpha_composite(im.crop(box), (c * cw, r * ch))
    sheet.save(out)
    a = manifest["anchor"]
    print(json.dumps({
        "width": sheet.width, "height": sheet.height, "frameW": cw, "frameH": ch,
        "anchorX": a["x"] - box[0], "anchorY": a["y"] - box[1], "frames": len(rows[0]), "fps": manifest["fps"],
    }))


main()
